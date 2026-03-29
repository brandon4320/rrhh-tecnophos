import { redirect } from 'next/navigation'
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

    const empleadoId = String(formData.get('empleado_id') ?? '').trim()
    const username = normalizeUsername(String(formData.get('username') ?? ''))
    const password = String(formData.get('password') ?? '').trim()
    const rol = String(formData.get('rol') ?? 'usuario').trim() as 'admin' | 'usuario'

    if (!empleadoId || !username || !password) {
      redirect('/admin/usuarios?error=missing_fields')
    }

    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      redirect('/admin/usuarios?error=missing_service_role')
    }

    const { data: empleado } = await supabase
      .from('empleados')
      .select('id, nombre, apellido')
      .eq('id', empleadoId)
      .single()

    if (!empleado) {
      redirect('/admin/usuarios?error=employee_not_found')
    }

    const nombrePerfil = [empleado.nombre, empleado.apellido].filter(Boolean).join(' ')
    const internalEmail = usernameToInternalEmail(username)
    const admin = createAdminClient()

    let createdUserId: string | null = null

    try {
      const { data, error } = await admin.auth.admin.createUser({
        email: internalEmail,
        password,
        email_confirm: true,
        user_metadata: {
          nombre: nombrePerfil,
          empleado_id: empleado.id,
          username,
        },
      })

      if (error || !data.user) {
        redirect(buildAdminUsersRedirect('create_user_failed', error?.message ?? 'Error desconocido al crear el usuario'))
      }

      createdUserId = data.user.id

      const { error: perfilError } = await supabase.from('perfiles').insert({
        id: data.user.id,
        nombre: nombrePerfil,
        rol,
        empresa_acceso: null,
      })

      if (perfilError) {
        redirect(buildAdminUsersRedirect('create_profile_failed', perfilError.message ?? 'No se pudo crear el perfil'))
      }
    } catch (error) {
      if (createdUserId) {
        await admin.auth.admin.deleteUser(createdUserId)
      }
      const detail = error instanceof Error ? error.message : 'Error desconocido'
      redirect(buildAdminUsersRedirect('create_user_failed', detail))
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

    try {
      const { error: perfilDeleteError } = await supabase.from('perfiles').delete().eq('id', userId)
      if (perfilDeleteError) {
        redirect(buildAdminUsersRedirect('delete_failed', perfilDeleteError.message))
      }

      const { error } = await admin.auth.admin.deleteUser(userId)
      if (error) {
        redirect(buildAdminUsersRedirect('delete_failed', error.message))
      }
    } catch (error) {
      const detail = error instanceof Error ? error.message : 'Error desconocido'
      redirect(buildAdminUsersRedirect('delete_failed', detail))
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

    try {
      const admin = createAdminClient()
      const { error } = await admin.auth.admin.updateUserById(userId, { password: newPassword })
      if (error) {
        redirect(buildAdminUsersRedirect('password_failed', error.message))
      }
    } catch (error) {
      const detail = error instanceof Error ? error.message : 'Error desconocido'
      redirect(buildAdminUsersRedirect('password_failed', detail))
    }

    redirect('/admin/usuarios?success=password_updated')
  }

  const detail = params.detail ?? null

  const errorMessage =
    params.error === 'missing_fields'
      ? 'Completá empleado, username y contraseña.'
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
        <h1 className="text-2xl font-semibold text-gray-900">Administrar usuarios</h1>
        <p className="text-sm text-gray-500 mt-1">
          Creá y gestioná accesos para empleados desde la app. Este módulo solo es visible para administradores.
        </p>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6">
        {!process.env.SUPABASE_SERVICE_ROLE_KEY && (
          <div className="mb-5 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            Para crear y gestionar usuarios desde esta pantalla necesitás definir <strong>SUPABASE_SERVICE_ROLE_KEY</strong> en las variables de entorno del proyecto.
          </div>
        )}

        {errorMessage && (
          <div className="mb-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {errorMessage}
          </div>
        )}

        {successMessage && (
          <div className="mb-5 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
            {successMessage}
          </div>
        )}

        <form action={crearUsuario} className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Empleado</label>
              <select name="empleado_id" required defaultValue="" className="w-full px-3.5 py-2.5 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                <option value="" disabled>Seleccionar empleado</option>
                {(empleados ?? []).map((empleado: any) => {
                  const nombreCompleto = [empleado.nombre, empleado.apellido].filter(Boolean).join(' ')
                  return (
                    <option key={empleado.id} value={empleado.id}>
                      {nombreCompleto} · {empleado.empresa?.nombre ?? 'Sin empresa'}
                    </option>
                  )
                })}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Username</label>
              <input type="text" name="username" required className="w-full px-3.5 py-2.5 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" placeholder="aylen.tecnophos" />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Contraseña inicial</label>
              <input type="text" name="password" required minLength={6} className="w-full px-3.5 py-2.5 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" placeholder="Mínimo 6 caracteres" />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Rol</label>
              <select name="rol" defaultValue="usuario" className="w-full px-3.5 py-2.5 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                <option value="usuario">Usuario</option>
                <option value="admin">Administrador</option>
              </select>
            </div>

            <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-600">
              Todos los usuarios creados desde este módulo tienen acceso a todas las empresas.
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <SubmitButton />
          </div>
        </form>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-medium text-gray-900">Usuarios creados</h2>
        </div>

        {managedUsers.length === 0 ? (
          <div className="px-6 py-10 text-sm text-gray-400">No hay usuarios para mostrar, o falta configuración de administrador.</div>
        ) : (
          <div className="divide-y divide-gray-100">
            {managedUsers.map((managedUser) => (
              <div key={managedUser.id} className="px-6 py-5 space-y-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{managedUser.username}</p>
                    <p className="text-sm text-gray-500">{managedUser.nombre}</p>
                    <p className="text-xs text-gray-400 mt-1">Rol: {managedUser.rol}</p>
                  </div>
                  <div className="text-right text-xs text-gray-400">
                    <p>Creado: {managedUser.createdAt ? new Date(managedUser.createdAt).toLocaleDateString('es-AR') : '—'}</p>
                    <p>Último acceso: {managedUser.lastSignInAt ? new Date(managedUser.lastSignInAt).toLocaleDateString('es-AR') : 'Nunca'}</p>
                  </div>
                </div>

                <div className="flex flex-wrap items-end gap-3">
                  <form action={cambiarPassword} className="flex flex-wrap items-end gap-3">
                    <input type="hidden" name="user_id" value={managedUser.id} />
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Nueva contraseña</label>
                      <input type="text" name="new_password" minLength={6} required className="px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" placeholder="Mínimo 6 caracteres" />
                    </div>
                    <button type="submit" className="px-3 py-2 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50">
                      Actualizar contraseña
                    </button>
                  </form>

                  <form action={eliminarUsuario}>
                    <input type="hidden" name="user_id" value={managedUser.id} />
                    <button
                      type="submit"
                      disabled={managedUser.id === user.id}
                      className="px-3 py-2 rounded-lg border border-red-200 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed"
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
