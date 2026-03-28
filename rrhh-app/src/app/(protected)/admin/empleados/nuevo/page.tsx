import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export default async function NuevoEmpleadoPage() {
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

  const { data: empresas } = await supabase.from('empresas').select('id, nombre').order('nombre')

  async function crearEmpleado(formData: FormData) {
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

    const nombre = String(formData.get('nombre') ?? '').trim()
    const apellido = String(formData.get('apellido') ?? '').trim()
    const empresa_id = String(formData.get('empresa_id') ?? '').trim()
    const sector = String(formData.get('sector') ?? '').trim()

    if (!nombre || !empresa_id) {
      redirect('/admin/empleados/nuevo?error=missing_fields')
    }

    const { error } = await supabase.from('empleados').insert({
      nombre,
      apellido: apellido || null,
      empresa_id,
      sector: sector || null,
      activo: true,
    })

    if (error) {
      redirect('/admin/empleados/nuevo?error=insert_failed')
    }

    redirect('/empleados')
  }

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-gray-900">Nuevo empleado</h1>
        <p className="text-sm text-gray-500 mt-1">Cargá los datos básicos para crear un nuevo legajo.</p>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <form action={crearEmpleado} className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Nombre</label>
              <input
                type="text"
                name="nombre"
                required
                className="w-full px-3.5 py-2.5 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="Nombre"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Apellido</label>
              <input
                type="text"
                name="apellido"
                className="w-full px-3.5 py-2.5 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="Apellido"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Empresa</label>
              <select
                name="empresa_id"
                required
                className="w-full px-3.5 py-2.5 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                defaultValue=""
              >
                <option value="" disabled>
                  Seleccionar empresa
                </option>
                {(empresas ?? []).map((empresa) => (
                  <option key={empresa.id} value={empresa.id}>
                    {empresa.nombre}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Sector</label>
              <input
                type="text"
                name="sector"
                className="w-full px-3.5 py-2.5 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="Sector"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <a
              href="/empleados"
              className="px-4 py-2.5 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Cancelar
            </a>
            <button
              type="submit"
              className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-4 py-2.5 rounded-lg transition-colors"
            >
              Guardar empleado
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
