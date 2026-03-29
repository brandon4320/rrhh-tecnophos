import { createClient } from '@/lib/supabase/server'
import { getEstadoVencimiento, ESTADO_COLORS } from '@/types'
import { format, differenceInDays } from 'date-fns'
import { es } from 'date-fns/locale'
import Link from 'next/link'

const EMPRESA_COLORS: Record<string, string> = {
  'tecnophos-bb': 'bg-indigo-500',
  'tecnophos-rosario': 'bg-sky-500',
  'tecnophos-necochea': 'bg-emerald-500',
  adc: 'bg-amber-500',
}

export default async function DashboardPage() {
  const supabase = await createClient()

  const [{ data: certs }, { data: empresas }, { data: empleados }] = await Promise.all([
    supabase
      .from('certificados')
      .select(`
        *,
        tipo:tipos_certificado(nombre),
        empleado:empleados(nombre, apellido, empresa_id, empresa:empresas(id, nombre, slug)),
        vehiculo:vehiculos(patente, empresa_id, empresa:empresas(id, nombre, slug)),
        empresa:empresas(id, nombre, slug)
      `)
      .not('fecha_vencimiento', 'is', null)
      .order('fecha_vencimiento', { ascending: true }),
    supabase.from('empresas').select('*').order('nombre'),
    supabase.from('empleados').select('id, empresa_id').eq('activo', true),
  ])

  const hoy = new Date()

  const vencidos = (certs ?? []).filter((c) => getEstadoVencimiento(c.fecha_vencimiento) === 'vencido')
  const proximos = (certs ?? []).filter((c) => getEstadoVencimiento(c.fecha_vencimiento) === 'proximo')
  const alertas = [...vencidos, ...proximos].slice(0, 20)

  const byEmpresa = (empresas ?? []).map((emp) => ({
    ...emp,
    total: (empleados ?? []).filter((e) => e.empresa_id === emp.id).length,
    vencidos: (certs ?? []).filter((c) => {
      const empId = c.empleado?.empresa_id ?? c.vehiculo?.empresa_id ?? c.empresa?.id ?? null
      return empId === emp.id && getEstadoVencimiento(c.fecha_vencimiento) === 'vencido'
    }).length,
    proximos: (certs ?? []).filter((c) => {
      const empId = c.empleado?.empresa_id ?? c.vehiculo?.empresa_id ?? c.empresa?.id ?? null
      return empId === emp.id && getEstadoVencimiento(c.fecha_vencimiento) === 'proximo'
    }).length,
  }))

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-gray-900">Dashboard</h1>
        <p className="text-sm text-gray-500 mt-1">
          {format(hoy, "EEEE d 'de' MMMM 'de' yyyy", { locale: es })}
        </p>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-sm text-gray-500">Empleados activos</p>
          <p className="text-3xl font-semibold text-gray-900 mt-1">{empleados?.length ?? 0}</p>
          <p className="text-xs text-gray-400 mt-1">en {empresas?.length ?? 0} empresas</p>
        </div>
        <div className="bg-red-50 rounded-xl border border-red-200 p-5">
          <p className="text-sm text-red-600">Certificados vencidos</p>
          <p className="text-3xl font-semibold text-red-700 mt-1">{vencidos.length}</p>
          <p className="text-xs text-red-400 mt-1">requieren atención inmediata</p>
        </div>
        <div className="bg-amber-50 rounded-xl border border-amber-200 p-5">
          <p className="text-sm text-amber-600">Por vencer (30 días)</p>
          <p className="text-3xl font-semibold text-amber-700 mt-1">{proximos.length}</p>
          <p className="text-xs text-amber-400 mt-1">en los próximos 30 días</p>
        </div>
      </div>

      <div className="grid grid-cols-5 gap-6">
        <div className="col-span-3">
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="font-medium text-gray-900">Alertas de vencimiento</h2>
              <Link href="/vencimientos" className="text-xs text-indigo-600 hover:underline">
                Ver todos →
              </Link>
            </div>

            {alertas.length === 0 ? (
              <div className="px-5 py-10 text-center">
                <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-3">
                  <svg className="w-5 h-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                </div>
                <p className="text-sm text-gray-500">Sin alertas activas</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {alertas.map((cert) => {
                  const estado = getEstadoVencimiento(cert.fecha_vencimiento)
                  const dias = differenceInDays(new Date(cert.fecha_vencimiento!), hoy)
                  const nombreEmpleado = [cert.empleado?.nombre, cert.empleado?.apellido].filter(Boolean).join(' ')
                  const nombre = cert.empleado
                    ? nombreEmpleado
                    : cert.vehiculo
                      ? cert.vehiculo.patente ?? 'Vehículo'
                      : cert.empresa?.nombre ?? '—'
                  const empresa = cert.empleado?.empresa ?? cert.vehiculo?.empresa ?? cert.empresa
                  const slug = empresa?.slug ?? ''

                  return (
                    <Link
                      key={cert.id}
                      href={slug ? `/empresa/${slug}` : '/vencimientos'}
                      className="flex items-center gap-4 px-5 py-3.5 hover:bg-gray-50 transition-colors"
                    >
                      <div className={`w-2 h-2 rounded-full shrink-0 ${EMPRESA_COLORS[slug] ?? 'bg-gray-300'}`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{nombre}</p>
                        <p className="text-xs text-gray-500 truncate">{cert.tipo?.nombre ?? cert.tipo_nombre_custom}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${ESTADO_COLORS[estado]}`}>
                          {estado === 'vencido' ? `hace ${Math.abs(dias)}d` : `${dias}d`}
                        </span>
                        <p className="text-xs text-gray-400 mt-1">
                          {format(new Date(cert.fecha_vencimiento!), 'dd/MM/yyyy')}
                        </p>
                      </div>
                    </Link>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        <div className="col-span-2 space-y-3">
          <h2 className="font-medium text-gray-900">Por empresa</h2>
          {byEmpresa.map((emp) => (
            <Link
              key={emp.id}
              href={`/empresa/${emp.slug}`}
              className="block bg-white rounded-xl border border-gray-200 p-4 hover:border-indigo-300 hover:shadow-sm transition-all"
            >
              <div className="flex items-center gap-3 mb-3">
                <span className={`w-3 h-3 rounded-full shrink-0 ${EMPRESA_COLORS[emp.slug] ?? 'bg-gray-400'}`} />
                <p className="text-sm font-medium text-gray-900 truncate">{emp.nombre}</p>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div>
                  <p className="text-lg font-semibold text-gray-900">{emp.total}</p>
                  <p className="text-xs text-gray-400">empleados</p>
                </div>
                <div>
                  <p className={`text-lg font-semibold ${emp.vencidos > 0 ? 'text-red-600' : 'text-gray-400'}`}>
                    {emp.vencidos}
                  </p>
                  <p className="text-xs text-gray-400">vencidos</p>
                </div>
                <div>
                  <p className={`text-lg font-semibold ${emp.proximos > 0 ? 'text-amber-600' : 'text-gray-400'}`}>
                    {emp.proximos}
                  </p>
                  <p className="text-xs text-gray-400">próximos</p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
