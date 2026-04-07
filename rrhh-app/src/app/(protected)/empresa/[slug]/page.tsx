import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { getEstadoVencimiento, ESTADO_COLORS } from '@/types'
import { format } from 'date-fns'
import Link from 'next/link'
import VehiculosClient from './VehiculosClient'

const EMPRESA_BG: Record<string, string> = {
  'tecnophos-bb': 'bg-indigo-500',
  'tecnophos-rosario': 'bg-sky-500',
  'tecnophos-necochea': 'bg-emerald-500',
  adc: 'bg-amber-500',
}

export default async function EmpresaPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const supabase = await createClient()

  const { data: empresa } = await supabase
    .from('empresas')
    .select('*')
    .eq('slug', slug)
    .single()

  if (!empresa) notFound()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data: perfil } = await supabase
    .from('perfiles')
    .select('rol')
    .eq('id', user?.id ?? '')
    .single()

  const isAdmin = perfil?.rol === 'admin'

  const [
    { data: empleados },
    { data: vehiculos },
    { data: certsEmpresa },
    { data: tiposVehiculo },
  ] = await Promise.all([
    supabase
      .from('empleados')
      .select('*, certificados(id, fecha_vencimiento, alerta_dias, tipo:tipos_certificado(nombre))')
      .eq('empresa_id', empresa.id)
      .eq('activo', true)
      .order('nombre'),
    supabase
      .from('vehiculos')
      .select(
        '*, certificados(id, tipo_id, tipo_nombre_custom, fecha_vencimiento, notas, alerta_dias, tipo:tipos_certificado(nombre))'
      )
      .eq('empresa_id', empresa.id)
      .eq('activo', true)
      .order('patente'),
    supabase
      .from('certificados')
      .select('*, tipo:tipos_certificado(nombre)')
      .eq('empresa_id', empresa.id)
      .order('fecha_vencimiento'),
    supabase
      .from('tipos_certificado')
      .select('*')
      .eq('aplica_vehiculo', true)
      .order('orden'),
  ])

  const sectores = [...new Set((empleados ?? []).map((e) => e.sector ?? 'General'))].sort()

  function peorEstado(certs: { fecha_vencimiento?: string; alerta_dias?: number }[]) {
    const estados = certs.map((c) =>
      getEstadoVencimiento(c.fecha_vencimiento, c.alerta_dias)
    )
    if (estados.includes('vencido')) return 'vencido'
    if (estados.includes('proximo')) return 'proximo'
    return 'vigente'
  }

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="flex items-center gap-4 mb-8">
        <div
          className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
            EMPRESA_BG[slug] ?? 'bg-gray-500'
          }`}
        >
          <svg
            className="w-5 h-5 text-white"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.8}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21"
            />
          </svg>
        </div>
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">{empresa.nombre}</h1>
          <p className="text-sm text-gray-500">
            {empleados?.length ?? 0} empleados activos
          </p>
        </div>
      </div>

      {(certsEmpresa?.length ?? 0) > 0 && (
        <div className="mb-8">
          <h2 className="text-base font-semibold text-gray-800 mb-3">
            Habilitaciones de empresa
          </h2>
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="divide-y divide-gray-50">
              {certsEmpresa!.map((cert) => {
                const estado = getEstadoVencimiento(cert.fecha_vencimiento)
                return (
                  <div key={cert.id} className="flex items-center gap-4 px-5 py-3.5">
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900">
                        {cert.tipo?.nombre ?? cert.tipo_nombre_custom}
                      </p>
                      {cert.numero_documento && (
                        <p className="text-xs text-gray-400">{cert.numero_documento}</p>
                      )}
                    </div>
                    <div className="text-right">
                      <span
                        className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${ESTADO_COLORS[estado]}`}
                      >
                        {cert.fecha_vencimiento
                          ? format(new Date(cert.fecha_vencimiento + 'T12:00:00'), 'dd/MM/yyyy')
                          : '—'}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {sectores.map((sector) => {
        const emps = (empleados ?? []).filter((e) => (e.sector ?? 'General') === sector)
        return (
          <div key={sector} className="mb-8">
            <h2 className="text-base font-semibold text-gray-800 mb-3">
              {sector}
              <span className="ml-2 text-sm font-normal text-gray-400">({emps.length})</span>
            </h2>
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    <th className="text-left px-5 py-3 font-medium text-gray-500 text-xs uppercase tracking-wide">
                      Nombre
                    </th>
                    <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wide">
                      Certificados
                    </th>
                    <th className="text-center px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wide">
                      Estado
                    </th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {emps.map((emp) => {
                    const certs = emp.certificados ?? []
                    const estado = certs.length > 0 ? peorEstado(certs) : 'sin_fecha'
                    const vencidos = certs.filter(
                      (c: { fecha_vencimiento?: string }) =>
                        getEstadoVencimiento(c.fecha_vencimiento) === 'vencido'
                    ).length
                    const proximos = certs.filter(
                      (c: { fecha_vencimiento?: string }) =>
                        getEstadoVencimiento(c.fecha_vencimiento) === 'proximo'
                    ).length

                    return (
                      <tr key={emp.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-5 py-3.5">
                          <p className="font-medium text-gray-900">{emp.nombre}</p>
                        </td>
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-2">
                            <span className="text-gray-500">{certs.length} registrados</span>
                            {vencidos > 0 && (
                              <span className="text-xs bg-red-100 text-red-700 px-1.5 py-0.5 rounded font-medium">
                                {vencidos} vencido{vencidos > 1 ? 's' : ''}
                              </span>
                            )}
                            {proximos > 0 && (
                              <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-medium">
                                {proximos} próximo{proximos > 1 ? 's' : ''}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3.5 text-center">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${ESTADO_COLORS[estado]}`}
                          >
                            {estado === 'vigente'
                              ? 'OK'
                              : estado === 'vencido'
                                ? 'Vencido'
                                : estado === 'proximo'
                                  ? 'Por vencer'
                                  : 'Sin datos'}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 text-right">
                          <Link
                            href={`/legajo/${emp.id}`}
                            className="text-xs text-indigo-600 hover:text-indigo-800 font-medium"
                          >
                            Ver legajo →
                          </Link>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )
      })}

      <VehiculosClient
        vehiculos={vehiculos ?? []}
        tiposCertificado={tiposVehiculo ?? []}
        canEdit={isAdmin || perfil?.rol === 'usuario'}
      />
    </div>
  )
}
