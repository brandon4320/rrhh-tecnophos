import { redirect } from 'next/navigation'
import { QuienEs } from './QuienEs'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { internalEmailToUsername, normalizeUsername, usernameToInternalEmail } from '@/lib/auth-helpers'
import SubmitButton from './SubmitButton'

function buildAdminUsersRedirect(error: string, detail?: string) {
  const params = new URLSearchParams({ error })
  if (detail) params.set('detail', detail)
  return `/admin/usuarios?${params.toString()}`
}

export default async function AdminUsuariosPage({
  searchParams,
}: {
  searchParams?: Promise<{ error?: string; success?: string; detail?: string }>
}) {
  const params = (await searchParams) ?? {}
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: perfil } = await supabase
    .from('perfiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (perfil?.rol !== 'admin') redirect('/dashboard')

  const { data: empleados } = await supabase
    .from('empleados')
    .select('id, nombre, apellido, empresa_id, empresa:empresas(nombre)')
    .eq('activo', true)
    .order('nombre')

  const { data: perfiles } = await supabase
    .from('perfiles')
    .select('id, nombre, rol, empresa_acceso')
    .order('nombre')

  let managedUsers: Array<{
    id: string
    username: string
    nombre: string
    rol: string
    createdAt?: string | null
    lastSignInAt?: string | null
  }> = []

  if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
    try {
      const admin = createAdminClient()
      const { data } = await admin.auth.admin.listUsers()
      const perfilesMap = new Map((perfiles ?? []).map((item) => [item.id, item]))

      managedUsers = (data?.users ?? [])
        .map((authUser) => {
          const perfilItem = perfilesMap.get(authUser.id)
          const metadata = authUser.user_metadata ?? {}
          return {
            id: authUser.id,
            username: String(metadata.username ?? internalEmailToUsername(authUser.email ?? '')),
            nombre: String(metadata.nombre ?? perfilItem?.nombre ?? authUser.email ?? '—'),
            rol: String(perfilItem?.rol ?? 'usuario'),
            createdAt: authUser.created_at,
            lastSignInAt: authUser.last_sign_in_at,
          }
        })
        .sort((a, b) => a.username.localeCompare(b.username))
    } catch {
      managedUsers = []
    }
  }

  async function crearUsuario(formData: FormData) {
    'use server'

    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) redirect('/login')

    const { data: perfil } = await supabase
      .from('perfiles')
      .select('rol')
      .eq('id', user.id)
      .single()

    if (perfil?.rol !== 'admin') redirect('/dashboard')

    // El empleado es opcional: un usuario puede ser alguien que no está en la nómina (un socio,
    // un asesor, el contador). Sin empleado, el nombre se escribe a mano.
    const empleadoId = String(formData.get('empleado_id') ?? '').trim()
    const nombreLibre = String(formData.get('nombre') ?? '').trim().replace(/\s+/g, ' ')
    const username = normalizeUsername(String(formData.get('username') ?? ''))
    const password = String(formData.get('password') ?? '').trim()
    const rol = String(formData.get('rol') ?? 'usuario').trim() as 'admin' | 'usuario'

    if ((!empleadoId && !nombreLibre) || !username || !password) {
      redirect('/admin/usuarios?error=missing_fields')
    }

    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      redirect('/admin/usuarios?error=missing_service_role')
    }

    let empleado: { id: string; nombre: string | null; apellido: string | null } | null = null
    if (empleadoId) {
      const { data } = await supabase
        .from('empleados')
        .select('id, nombre, apellido')
        .eq('id', empleadoId)
        .single()
      if (!data) redirect('/admin/usuarios?error=employee_not_found')
      empleado = data
    }

    const nombrePerfil = empleado ? [empleado.nombre, empleado.apellido].filter(Boolean).join(' ') : nombreLibre
    const internalEmail = usernameToInternalEmail(username)
    const admin = createAdminClient()

    let createdUserId: string | null = null
    let actionError: { code: string; detail?: string } | null = null

    try {
      const { data, error } = await admin.auth.admin.createUser({
        email: internalEmail,
        password,
        email_confirm: true,
        user_metadata: {
          nombre: nombrePerfil,
          ...(empleado ? { empleado_id: empleado.id } : {}),
          username,
        },
      })

      if (error || !data.user) {
        actionError = {
          code: 'create_user_failed',
          detail: error?.message ?? 'Error desconocido al crear el usuario',
        }
      } else {
        createdUserId = data.user.id

        const { error: perfilError } = await admin.from('perfiles').insert({
          id: data.user.id,
          nombre: nombrePerfil,
          rol,
          empresa_acceso: null,
        })

        if (perfilError) {
          await admin.auth.admin.deleteUser(data.user.id)
          actionError = {
            code: 'create_profile_failed',
            detail: perfilError.message ?? 'No se pudo crear el perfil',
          }
        }
      }
    } catch (error) {
      if (createdUserId) {
        await admin.auth.admin.deleteUser(createdUserId)
      }
      actionError = {
        code: 'create_user_failed',
        detail: error instanceof Error ? error.message : 'Error desconocido',
      }
    }

    if (actionError) {
      redirect(buildAdminUsersRedirect(actionError.code, actionError.detail))
    }

    redirect('/admin/usuarios?success=created')
  }

  async function eliminarUsuario(formData: FormData) {
    'use server'

    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) redirect('/login')

    const { data: perfil } = await supabase
      .from('perfiles')
      .select('rol')
      .eq('id', user.id)
      .single()

    if (perfil?.rol !== 'admin') redirect('/dashboard')
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) redirect('/admin/usuarios?error=missing_service_role')

    const userId = String(formData.get('user_id') ?? '').trim()
    if (!userId) redirect('/admin/usuarios?error=delete_failed')
    if (userId === user.id) redirect(buildAdminUsersRedirect('delete_failed', 'No podés eliminar tu propio usuario.'))

    const admin = createAdminClient()
    let actionError: string | null = null

    try {
      const { error: perfilDeleteError } = await admin.from('perfiles').delete().eq('id', userId)
      if (perfilDeleteError) {
        actionError = perfilDeleteError.message
      } else {
        const { error } = await admin.auth.admin.deleteUser(userId)
        if (error) actionError = error.message
      }
    } catch (error) {
      actionError = error instanceof Error ? error.message : 'Error desconocido'
    }

    if (actionError) {
      redirect(buildAdminUsersRedirect('delete_failed', actionError))
    }

    redirect('/admin/usuarios?success=deleted')
  }

  async function cambiarPassword(formData: FormData) {
    'use server'

    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) redirect('/login')

    const { data: perfil } = await supabase
      .from('perfiles')
      .select('rol')
      .eq('id', user.id)
      .single()

    if (perfil?.rol !== 'admin') redirect('/dashboard')
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) redirect('/admin/usuarios?error=missing_service_role')

    const userId = String(formData.get('user_id') ?? '').trim()
    const newPassword = String(formData.get('new_password') ?? '').trim()

    if (!userId || newPassword.length < 6) {
      redirect(buildAdminUsersRedirect('password_failed', 'La nueva contraseña debe tener al menos 6 caracteres.'))
    }

    let actionError: string | null = null

    try {
      const admin = createAdminClient()
      const { error } = await admin.auth.admin.updateUserById(userId, { password: newPassword })
      if (error) actionError = error.message
    } catch (error) {
      actionError = error instanceof Error ? error.message : 'Error desconocido'
    }

    if (actionError) {
      redirect(buildAdminUsersRedirect('password_failed', actionError))
    }

    redirect('/admin/usuarios?success=password_updated')
  }

  const detail = params.detail ?? null

  const errorMessage =
    params.error === 'missing_fields'
      ? 'Faltan datos: nombre (o empleado), username y contraseña.'
      : params.error === 'missing_service_role'
        ? 'Falta configurar SUPABASE_SERVICE_ROLE_KEY en el entorno del proyecto.'
        : params.error === 'employee_not_found'
          ? 'No se encontró el empleado seleccionado.'
          : params.error === 'create_profile_failed'
            ? `Falló la creación del perfil. ${detail ?? ''}`.trim()
            : params.error === 'create_user_failed'
              ? `No se pudo crear el usuario. ${detail ?? ''}`.trim()
              : params.error === 'delete_failed'
                ? `No se pudo eliminar el usuario. ${detail ?? ''}`.trim()
                : params.error === 'password_failed'
                  ? `No se pudo actualizar la contraseña. ${detail ?? ''}`.trim()
                  : null

  const successMessage =
    params.success === 'created'
      ? 'Usuario creado correctamente.'
      : params.success === 'deleted'
        ? 'Usuario eliminado correctamente.'
        : params.success === 'password_updated'
          ? 'Contraseña actualizada correctamente.'
          : null

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-8">
      <div>
        <h1 className="text-[28px] leading-tight font-semibold tracking-[-0.02em]">Usuarios</h1>
      </div>

      <div className="bg-card rounded-2xl border border-border p-6 shadow-tarjeta">
        {!process.env.SUPABASE_SERVICE_ROLE_KEY && (
          <div className="mb-5 rounded-xl border border-warning/20 bg-warning-subtle px-4 py-3 text-sm text-warning-text">
            Para crear y gestionar usuarios desde esta pantalla necesitás definir <strong>SUPABASE_SERVICE_ROLE_KEY</strong> en las variables de entorno del proyecto.
          </div>
        )}

        {errorMessage && (
          <div className="mb-5 rounded-xl border border-danger/30 bg-danger-subtle px-4 py-3 text-sm text-danger">
            {errorMessage}
          </div>
        )}

        {successMessage && (
          <div className="mb-5 rounded-xl border border-success/20 bg-success-subtle px-4 py-3 text-sm text-success-text">
            {successMessage}
          </div>
        )}

        <form action={crearUsuario} className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <QuienEs
              empleados={(empleados ?? []).map((e) => {
                // El join puede venir como objeto o como lista según cómo lo tipe Supabase.
                const empresa = Array.isArray(e.empresa) ? e.empresa[0] : e.empresa
                return { id: e.id, etiqueta: `${[e.nombre, e.apellido].filter(Boolean).join(' ')} · ${empresa?.nombre ?? 'Sin empresa'}` }
              })}
            />

            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Username</label>
              <input type="text" name="username" required className="min-h-10 w-full px-3 py-2 rounded-[10px] border border-input text-sm focus:outline-none focus:ring-2 focus:ring-ring/15 focus:border-ring" placeholder="nombre.apellido" />
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Contraseña</label>
              <input type="text" name="password" required minLength={6} className="min-h-10 w-full px-3 py-2 rounded-[10px] border border-input text-sm focus:outline-none focus:ring-2 focus:ring-ring/15 focus:border-ring" />
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Rol</label>
              <select name="rol" defaultValue="usuario" className="min-h-10 w-full px-3 py-2 rounded-[10px] border border-input text-sm focus:outline-none focus:ring-2 focus:ring-ring/15 focus:border-ring">
                <option value="usuario">Usuario</option>
                <option value="admin">Administrador</option>
              </select>
            </div>

          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <SubmitButton />
          </div>
        </form>
      </div>

      <div className="bg-card rounded-2xl border border-border overflow-hidden shadow-tarjeta">
        <div className="px-6 py-4 border-b border-border">
          <h2 className="text-lg font-medium text-foreground">Usuarios creados</h2>
        </div>

        {managedUsers.length === 0 ? (
          <div className="px-6 py-10 text-sm text-muted-foreground">No hay usuarios para mostrar, o falta configuración de administrador.</div>
        ) : (
          <div className="divide-y divide-border">
            {managedUsers.map((managedUser) => (
              <div key={managedUser.id} className="px-6 py-5 space-y-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold text-foreground">{managedUser.username}</p>
                    <p className="text-sm text-muted-foreground">{managedUser.nombre}</p>
                    <p className="text-xs text-muted-foreground mt-1">Rol: {managedUser.rol}</p>
                  </div>
                  <div className="text-right text-xs text-muted-foreground">
                    <p>Creado: {managedUser.createdAt ? new Date(managedUser.createdAt).toLocaleDateString('es-AR') : '—'}</p>
                    <p>Último acceso: {managedUser.lastSignInAt
                      ? new Date(managedUser.lastSignInAt).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })
                      : 'Nunca'}</p>
                  </div>
                </div>

                <div className="flex flex-wrap items-end gap-3">
                  <form action={cambiarPassword} className="flex flex-wrap items-end gap-3">
                    <input type="hidden" name="user_id" value={managedUser.id} />
                    <div>
                      <label className="block text-xs font-medium text-muted-foreground mb-1">Nueva contraseña</label>
                      <input type="text" name="new_password" minLength={6} required className="min-h-10 px-3 py-2 rounded-[10px] border border-input text-sm focus:outline-none focus:ring-2 focus:ring-ring/15 focus:border-ring" />
                    </div>
                    <button type="submit" className="px-3 py-2 rounded-lg border border-input text-sm font-medium text-foreground hover:bg-accent">
                      Actualizar contraseña
                    </button>
                  </form>

                  <form action={eliminarUsuario}>
                    <input type="hidden" name="user_id" value={managedUser.id} />
                    <button
                      type="submit"
                      disabled={managedUser.id === user.id}
                      className="px-3 py-2 rounded-lg border border-danger/30 text-sm font-medium text-danger hover:bg-danger-subtle disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Eliminar usuario
                    </button>
                  </form>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
