import { createClient } from '@/lib/supabase/server'
import { getEstadoVencimiento, diasHastaVencimiento } from '@/types'
import { format } from 'date-fns'
import Link from 'next/link'
import { Monograma } from '@/components/ui/monograma'
import { EstadoPill } from '@/components/ui/estado-pill'
import { VencimientosFilters } from './VencimientosFilters'

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
    supabase.from('empresas').select('id, nombre, slug').order('nombre'),
    supabase.from('tipos_certificado').select('id, nombre').order('orden'),
  ])

  const filtered = (certs ?? []).filter((c) => {
    const entitySlug = c.empleado?.empresa?.slug ?? c.vehiculo?.empresa?.slug ?? c.equipo?.empresa?.slug ?? c.empresa?.slug ?? ''
    const tipoId = c.tipo?.id ?? ''
    const est = getEstadoVencimiento(c.fecha_vencimiento, c.alerta_dias)

    if (empresa && entitySlug !== empresa) return false
    if (tipo && tipoId !== tipo) return false
    if (estado && est !== estado) return false
    return true
  })

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6 lg:p-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Vencimientos</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          {filtered.length} {filtered.length === 1 ? 'registro' : 'registros'}
        </p>
      </div>

      <VencimientosFilters
        empresa={empresa}
        tipo={tipo}
        estado={estado}
        empresas={empresas ?? []}
        tipos={tipos ?? []}
      />

      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        {filtered.length === 0 ? (
          <div className="py-12 text-center text-sm text-muted-foreground">
            No se encontraron registros con los filtros aplicados.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Referencia
                </th>
                <th className="hidden px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground sm:table-cell">
                  Empresa
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Certificado
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Vencimiento
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Estado
                </th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((cert) => {
                const estado_ = getEstadoVencimiento(cert.fecha_vencimiento, cert.alerta_dias)
                const dias = diasHastaVencimiento(cert.fecha_vencimiento!)
                const empSlug = cert.empleado?.empresa?.slug ?? cert.vehiculo?.empresa?.slug ?? cert.equipo?.empresa?.slug ?? cert.empresa?.slug ?? ''
                const empNombre = cert.empleado?.empresa?.nombre ?? cert.vehiculo?.empresa?.nombre ?? cert.equipo?.empresa?.nombre ?? cert.empresa?.nombre ?? '—'
                const nombreEmpleado = [cert.empleado?.nombre, cert.empleado?.apellido].filter(Boolean).join(' ')
                const referencia = cert.empleado
                  ? nombreEmpleado
                  : cert.vehiculo
                    ? `Vehículo ${cert.vehiculo.patente}`
                    : cert.equipo
                      ? cert.equipo.nombre
                      : empNombre
                const detailHref = cert.empleado?.id
                  ? `/legajo/${cert.empleado.id}`
                  : empSlug
                    ? `/empresa/${empSlug}?vista=documentacion`
                    : undefined
                const relativo =
                  dias < 0
                    ? `hace ${Math.abs(dias)} ${Math.abs(dias) === 1 ? 'día' : 'días'}`
                    : dias === 0
                      ? 'vence hoy'
                      : `en ${dias} ${dias === 1 ? 'día' : 'días'}`

                return (
                  <tr key={cert.id} className="transition-colors hover:bg-muted/40">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <Monograma nombre={referencia} size="sm" />
                        <span className="font-medium">{referencia}</span>
                      </div>
                    </td>
                    <td className="hidden px-4 py-3 text-muted-foreground sm:table-cell">{empNombre}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {cert.tipo?.nombre ?? cert.tipo_nombre_custom ?? '—'}
                    </td>
                    <td className="px-4 py-3">
                      <p className="tabular-nums">
                        {format(new Date(cert.fecha_vencimiento!.slice(0, 10) + 'T12:00:00'), 'dd/MM/yyyy')}
                      </p>
                      <p className="text-xs text-muted-foreground">{relativo}</p>
                    </td>
                    <td className="px-4 py-3">
                      <EstadoPill estado={estado_} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      {detailHref && (
                        <Link
                          href={detailHref}
                          className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                        >
                          Abrir
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
