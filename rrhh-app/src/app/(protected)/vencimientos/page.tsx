import { createClient } from '@/lib/supabase/server'
import { getEstadoVencimiento, diasHastaVencimiento, ESTADO_COLORS, ESTADO_LABELS } from '@/types'
import { format } from 'date-fns'
import Link from 'next/link'
import { VencimientosFilters } from './VencimientosFilters'

const EMPRESA_COLORS: Record<string, string> = {
  'tecnophos-bb': 'text-primary bg-primary/10 border-primary/30',
  'tecnophos-rosario': 'text-sky-400 bg-sky-50 border-sky-500/30',
  'tecnophos-necochea': 'text-emerald-700 bg-emerald-50 border-emerald-200',
  adc: 'text-amber-400 bg-amber-50 border-amber-500/30',
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
        empleado:empleados(id, nombre, apellido, empresa_id, empresa:empresas(nombre, slug)),
        vehiculo:vehiculos(id, patente, empresa_id, empresa:empresas(nombre, slug)),
        equipo:equipos(id, nombre, empresa_id, empresa:empresas(nombre, slug)),
        empresa:empresas(nombre, slug)
      `)
      .not('fecha_vencimiento', 'is', null)
      .order('fecha_vencimiento', { ascending: true }),
    supabase.from('empresas').select('*').order('nombre'),
    supabase.from('tipos_certificado').select('id, nombre').order('orden'),
  ])

  const filtered = (certs ?? []).filter((c) => {
    const entitySlug = c.empleado?.empresa?.slug ?? c.vehiculo?.empresa?.slug ?? c.equipo?.empresa?.slug ?? c.empresa?.slug ?? ''
    const tipoId = c.tipo?.id ?? ''
    const est = getEstadoVencimiento(c.fecha_vencimiento)

    if (empresa && entitySlug !== empresa) return false
    if (tipo && tipoId !== tipo) return false
    if (estado && est !== estado) return false
    return true
  })

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-foreground">Vencimientos</h1>
        <p className="text-sm text-muted-foreground mt-1">{filtered.length} registros encontrados</p>
      </div>

      <VencimientosFilters
        empresa={empresa}
        tipo={tipo}
        estado={estado}
        empresas={empresas ?? []}
        tipos={tipos ?? []}
      />

      <div className="bg-card rounded-xl border border-border overflow-hidden">
        {filtered.length === 0 ? (
          <div className="text-center py-12 text-sm text-muted-foreground">
            No se encontraron registros con los filtros aplicados.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted">
                <th className="text-left px-5 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">
                  Referencia
                </th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">
                  Empresa
                </th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">
                  Certificado
                </th>
                <th className="text-center px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">
                  Vencimiento
                </th>
                <th className="text-center px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">
                  Estado
                </th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((cert) => {
                const estado_ = getEstadoVencimiento(cert.fecha_vencimiento)
                const dias = diasHastaVencimiento(cert.fecha_vencimiento!)
                const empSlug = cert.empleado?.empresa?.slug ?? cert.vehiculo?.empresa?.slug ?? cert.equipo?.empresa?.slug ?? cert.empresa?.slug ?? ''
                const empNombre = cert.empleado?.empresa?.nombre ?? cert.vehiculo?.empresa?.nombre ?? cert.equipo?.empresa?.nombre ?? cert.empresa?.nombre ?? '—'
                const nombreEmpleado = [cert.empleado?.nombre, cert.empleado?.apellido].filter(Boolean).join(' ')
                const referencia = cert.empleado
                  ? nombreEmpleado
                  : cert.vehiculo
                    ? `Vehículo ${cert.vehiculo.patente}`
                    : cert.equipo
                      ? `Equipo ${cert.equipo.nombre}`
                      : '(Empresa)'
                const detailHref = cert.empleado?.id
                  ? `/legajo/${cert.empleado.id}`
                  : cert.vehiculo?.empresa?.slug
                    ? `/empresa/${cert.vehiculo.empresa?.slug}`
                    : empSlug
                      ? `/empresa/${empSlug}`
                      : undefined

                return (
                  <tr key={cert.id} className="hover:bg-accent transition-colors">
                    <td className="px-5 py-3.5 font-medium text-foreground">{referencia}</td>
                    <td className="px-4 py-3.5">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${
                          EMPRESA_COLORS[empSlug] ?? 'text-muted-foreground bg-muted border-border'
                        }`}
                      >
                        {empNombre}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-foreground">
                      {cert.tipo?.nombre ?? cert.tipo_nombre_custom ?? '—'}
                    </td>
                    <td className="px-4 py-3.5 text-center">
                      <p className="font-mono text-foreground">
                        {format(new Date(cert.fecha_vencimiento!.slice(0, 10) + 'T12:00:00'), 'dd/MM/yyyy')}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {dias < 0
                          ? `hace ${Math.abs(dias)} ${Math.abs(dias) === 1 ? 'día' : 'días'}`
                          : dias === 0
                            ? 'vence hoy'
                            : `en ${dias} ${dias === 1 ? 'día' : 'días'}`}
                      </p>
                    </td>
                    <td className="px-4 py-3.5 text-center">
                      <span
                        className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${ESTADO_COLORS[estado_]}`}
                      >
                        {ESTADO_LABELS[estado_]}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      {detailHref && (
                        <Link href={detailHref} className="text-xs text-primary hover:underline">
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
