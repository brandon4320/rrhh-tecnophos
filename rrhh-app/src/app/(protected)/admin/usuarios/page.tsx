import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { normalizeUsername, usernameToInternalEmail } from '@/lib/auth-helpers'
import SubmitButton from './SubmitButton'

export default async function AdminUsuariosPage({
  searchParams,
}: {
  searchParams?: Promise<{ error?: string; success?: string }>
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
      .select('id, nombre, apellido, empresa_id')
      .eq('id', empleadoId)
      .single()

    if (!empleado) {
      redirect('/admin/usuarios?error=employee_not_found')
    }

    const nombrePerfil = [empleado.nombre, empleado.apellido].filter(Boolean).join(' ')
    const internalEmail = usernameToInternalEmail(username)

    try {
      const admin = createAdminClient()
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
        redirect('/admin/usuarios?error=create_user_failed')
      }

      const { error: perfilError } = await supabase.from('perfiles').insert({
        id: data.user.id,
        nombre: nombrePerfil,
        rol,
        empresa_acceso: null,
      })

      if (perfilError) {
        await admin.auth.admin.deleteUser(data.user.id)
        redirect('/admin/usuarios?error=create_profile_failed')
      }
    } catch {
      redirect('/admin/usuarios?error=create_user_failed')
    }

    redirect('/admin/usuarios?success=1')
  }

  const errorMessage =
    params.error === 'missing_fields'
      ? 'Completá empleado, username y contraseña.'
      : params.error === 'missing_service_role'
        ? 'Falta configurar SUPABASE_SERVICE_ROLE_KEY en el entorno del proyecto.'
        : params.error === 'employee_not_found'
          ? 'No se encontró el empleado seleccionado.'
          : params.error === 'create_profile_failed'
            ? 'Se creó el usuario en Auth pero falló el perfil. La operación fue revertida.'
            : params.error === 'create_user_failed'
              ? 'No se pudo crear el usuario. Revisá si el username ya existe o si falta configuración.'
              : null

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-gray-900">Administrar usuarios</h1>
        <p className="text-sm text-gray-500 mt-1">
          Creá accesos para empleados desde la app. Este módulo solo es visible para administradores.
        </p>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        {!process.env.SUPABASE_SERVICE_ROLE_KEY && (
          <div className="mb-5 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            Para crear usuarios desde esta pantalla necesitás definir <strong>SUPABASE_SERVICE_ROLE_KEY</strong> en las variables de entorno del proyecto.
          </div>
        )}

        {errorMessage && (
          <div className="mb-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {errorMessage}
          </div>
        )}

        {params.success === '1' && (
          <div className="mb-5 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
            Usuario creado correctamente.
          </div>
        )}

        <form action={crearUsuario} className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Empleado</label>
              <select
                name="empleado_id"
                required
                defaultValue=""
                className="w-full px-3.5 py-2.5 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="" disabled>
                  Seleccionar empleado
                </option>
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
              <input
                type="text"
                name="username"
                required
                className="w-full px-3.5 py-2.5 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="aylen.tecnophos"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Contraseña inicial</label>
              <input
                type="text"
                name="password"
                required
                minLength={6}
                className="w-full px-3.5 py-2.5 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="Mínimo 6 caracteres"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Rol</label>
              <select
                name="rol"
                defaultValue="usuario"
                className="w-full px-3.5 py-2.5 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
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
    </div>
  )
}
