import { createClient } from '@/lib/supabase/server'
import { getEstadoVencimiento, ESTADO_COLORS, ESTADO_LABELS } from '@/types'
import { format, differenceInDays } from 'date-fns'
import Link from 'next/link'

const EMPRESA_COLORS: Record<string, string> = {
  'tecnophos-bb':      'text-indigo-700 bg-indigo-50 border-indigo-200',
  'tecnophos-rosario': 'text-sky-700 bg-sky-50 border-sky-200',
  'tecnophos-necochea':'text-emerald-700 bg-emerald-50 border-emerald-200',
  'adc':               'text-amber-700 bg-amber-50 border-amber-200',
}

export default async function VencimientosPage({
  searchParams,
}: {
  searchParams: Promise<{ empresa?: string; tipo?: string; estado?: string }>
}) {
  const { empresa, tipo, estado } = await searchParams
  const supabase = await createClient()

  const [{ data: certs }, { data: empresas }, { data: tipos }] = await Promise.all([
    supabase
      .from('certificados')
      .select(`
        *,
        tipo:tipos_certificado(id, nombre),
        empleado:empleados(id, nombre, empresa_id, empresa:empresas(nombre, slug)),
        empresa:empresas(nombre, slug)
      `)
      .not('fecha_vencimiento', 'is', null)
      .order('fecha_vencimiento', { ascending: true }),
    supabase.from('empresas').select('*').order('nombre'),
    supabase.from('tipos_certificado').select('id, nombre').eq('aplica_personal', true).order('orden'),
  ])

  const hoy = new Date()

  const filtered = (certs ?? []).filter(c => {
    const empSlug = c.empleado?.empresa?.slug ?? c.empresa?.slug ?? ''
    const tipoId = c.tipo?.id ?? ''
    const est = getEstadoVencimiento(c.fecha_vencimiento)

    if (empresa && empSlug !== empresa) return false
    if (tipo && tipoId !== tipo) return false
    if (estado && est !== estado) return false
    return true
  })

  const buildUrl = (params: Record<string, string | undefined>) => {
    const p = new URLSearchParams()
    const merged = { empresa, tipo, estado, ...params }
    Object.entries(merged).forEach(([k, v]) => { if (v) p.set(k, v) })
    const qs = p.toString()
    return `/vencimientos${qs ? '?' + qs : ''}`
  }

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-gray-900">Vencimientos</h1>
        <p className="text-sm text-gray-500 mt-1">{filtered.length} registros encontrados</p>
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6 flex flex-wrap gap-3 items-center">
        <span className="text-sm font-medium text-gray-600 shrink-0">Filtrar por:</span>

        {/* Estado */}
        <div className="flex items-center gap-1.5">
          {[
            { value: '', label: 'Todos' },
            { value: 'vencido', label: 'Vencido' },
            { value: 'proximo', label: 'Por vencer' },
            { value: 'vigente', label: 'Vigente' },
          ].map(opt => (
            <Link
              key={opt.value}
              href={buildUrl({ estado: opt.value || undefined })}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                (estado ?? '') === opt.value
                  ? 'bg-indigo-600 text-white border-indigo-600'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
              }`}
            >
              {opt.label}
            </Link>
          ))}
        </div>

        <div className="h-4 w-px bg-gray-200" />

        {/* Empresa */}
        <select
          defaultValue={empresa ?? ''}
          onChange={e => window.location.href = buildUrl({ empresa: e.target.value || undefined })}
          className="px-3 py-1.5 rounded-lg border border-gray-200 text-xs text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="">Todas las empresas</option>
          {(empresas ?? []).map(e => (
            <option key={e.id} value={e.slug}>{e.nombre}</option>
          ))}
        </select>

        {/* Tipo */}
        <select
          defaultValue={tipo ?? ''}
          onChange={e => window.location.href = buildUrl({ tipo: e.target.value || undefined })}
          className="px-3 py-1.5 rounded-lg border border-gray-200 text-xs text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="">Todos los certificados</option>
          {(tipos ?? []).map(t => (
            <option key={t.id} value={t.id}>{t.nombre}</option>
          ))}
        </select>

        {(empresa || tipo || estado) && (
          <Link href="/vencimientos" className="text-xs text-red-500 hover:underline ml-auto">
            Limpiar filtros
          </Link>
        )}
      </div>

      {/* Tabla */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {filtered.length === 0 ? (
          <div className="text-center py-12 text-sm text-gray-400">
            No se encontraron registros con los filtros aplicados.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-5 py-3 font-medium text-gray-500 text-xs uppercase tracking-wide">Empleado</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wide">Empresa</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wide">Certificado</th>
                <th className="text-center px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wide">Vencimiento</th>
                <th className="text-center px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wide">Estado</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map(cert => {
                const estado_ = getEstadoVencimiento(cert.fecha_vencimiento)
                const dias = differenceInDays(new Date(cert.fecha_vencimiento!), hoy)
                const empSlug = cert.empleado?.empresa?.slug ?? cert.empresa?.slug ?? ''
                const empNombre = cert.empleado?.empresa?.nombre ?? cert.empresa?.nombre ?? '—'
                const nombre = cert.empleado?.nombre ?? '(empresa)'

                return (
                  <tr key={cert.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-3.5 font-medium text-gray-900">{nombre}</td>
                    <td className="px-4 py-3.5">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${EMPRESA_COLORS[empSlug] ?? 'text-gray-600 bg-gray-50 border-gray-200'}`}>
                        {empNombre}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-gray-700">
                      {cert.tipo?.nombre ?? cert.tipo_nombre_custom ?? '—'}
                    </td>
                    <td className="px-4 py-3.5 text-center">
                      <p className="font-mono text-gray-700">
                        {format(new Date(cert.fecha_vencimiento!), 'dd/MM/yyyy')}
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {dias < 0 ? `hace ${Math.abs(dias)} días` : `en ${dias} días`}
                      </p>
                    </td>
                    <td className="px-4 py-3.5 text-center">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${ESTADO_COLORS[estado_]}`}>
                        {ESTADO_LABELS[estado_]}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      {cert.empleado?.id && (
                        <Link href={`/legajo/${cert.empleado.id}`} className="text-xs text-indigo-600 hover:underline">
                          Legajo →
                        </Link>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
