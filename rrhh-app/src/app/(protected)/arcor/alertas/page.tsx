import { CircleCheck } from 'lucide-react'
import { AlertaCard } from '@/components/arcor/AlertaCard'
import { ListaEventos } from '@/components/arcor/ListaEventos'
import { AutoRefresh } from '@/components/arcor/AutoRefresh'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { EstadoPill } from '@/components/ui/estado-pill'
import { getAlertasAbiertas, getEstados, getEventos } from '@/modules/arcor/queries'
import { alertaSilencio, diasDesde, etiquetaDias, evaluarSilencio, labelEstadoPublicacion, parseFechaFlexible } from '@/modules/arcor/reglas'
import type { EstadoHeartbeat, EstadoPublicaciones } from '@/modules/arcor/tipos'
import { diaClaveAR, fmtFechaAR, fmtFechaHoraAR } from '@/lib/fechas-ar'

export const dynamic = 'force-dynamic'

export default async function ArcorAlertasPage() {
  const ahora = new Date()
  const hoy = diaClaveAR(ahora)
  const hace7d = new Date(ahora.getTime() - 7 * 86400000).toISOString()
  const [estados, abiertas, incidentes, resueltas] = await Promise.all([
    getEstados(),
    getAlertasAbiertas(),
    getEventos({ desde: hace7d, soloIncidentes: true, limit: 200 }),
    getEventos({ soloResueltas: true, limit: 50 }),
  ])

  const hb = estados.heartbeat?.valor as EstadoHeartbeat | undefined
  const silencio = evaluarSilencio(hb?.ts ?? null, ahora)
  const sintetica = alertaSilencio(silencio, { ts: hb?.ts, updated_at: estados.heartbeat?.updated_at }, ahora)
  const todasAbiertas = sintetica ? [sintetica, ...abiertas] : abiertas

  // La cola de Colabora la reporta WF7 en arcor_estado.publicaciones (snapshot, no historial).
  const pub = estados.publicaciones?.valor as EstadoPublicaciones | undefined
  const vencidas = pub?.vencidas ?? []
  const paraRevisar = pub?.revisar ?? []

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6 lg:p-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Alertas</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            WhatsApp, crédito del lector, fallos de workflows, publicaciones y silencio del sistema
          </p>
        </div>
        <AutoRefresh generado={ahora.toISOString()} />
      </div>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold tracking-tight">Abiertas ahora</h2>
        {todasAbiertas.length === 0 ? (
          <div className="flex items-center gap-3 rounded-2xl border border-border bg-card px-5 py-4 text-sm">
            <CircleCheck className="size-4 shrink-0 text-success" strokeWidth={1.75} />
            <span>Sin alertas abiertas. Las guardias de n8n reportan cada 2 horas; si algo se cae, aparece acá.</span>
          </div>
        ) : (
          todasAbiertas.map((a) => <AlertaCard key={a.id} e={a} />)
        )}
      </section>

      {(vencidas.length > 0 || paraRevisar.length > 0) && (
        <section id="publicaciones" className="scroll-mt-6 rounded-2xl border border-border bg-card p-5 sm:p-6">
          <h2 className="text-lg font-semibold tracking-tight">Publicaciones en Colabora</h2>
          <p className="mb-4 text-sm text-muted-foreground">
            Lo que la cola de publicación no pudo cerrar
            {estados.publicaciones?.updated_at && ` · reportado ${fmtFechaHoraAR(estados.publicaciones.updated_at)}`}
          </p>

          {vencidas.length > 0 && (
            <>
              <p className="mb-2 text-sm font-medium">
                {vencidas.length === 1 ? '1 vencida' : `${vencidas.length} vencidas`}
              </p>
              <div className="overflow-x-auto rounded-xl border border-border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Contenedor</TableHead>
                      <TableHead>Operación</TableHead>
                      <TableHead>Creada</TableHead>
                      <TableHead>Estado</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {vencidas.map((v, i) => {
                      const creado = parseFechaFlexible(v.creado)
                      const dias = creado ? diasDesde(creado, hoy) : 0
                      return (
                        <TableRow key={`${v.contenedor}-${v.operacion}-${i}`}>
                          <TableCell className="font-mono text-sm font-medium">{v.contenedor}</TableCell>
                          <TableCell className="font-mono text-xs">{v.operacion || <span className="text-muted-foreground">—</span>}</TableCell>
                          <TableCell className="tabular-nums text-muted-foreground">
                            {creado ? `${fmtFechaAR(creado)} · ${dias > 0 ? `hace ${etiquetaDias(dias)}` : 'hoy'}` : (v.creado || '—')}
                          </TableCell>
                          <TableCell>
                            <EstadoPill estado="proximo" label={labelEstadoPublicacion(v.estado)} />
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
            </>
          )}

          {paraRevisar.length > 0 && (
            <>
              <p className={`mb-2 text-sm font-medium ${vencidas.length > 0 ? 'mt-5' : ''}`}>
                {paraRevisar.length === 1 ? '1 para revisar' : `${paraRevisar.length} para revisar`}
              </p>
              <ul className="divide-y divide-border rounded-xl border border-border">
                {paraRevisar.map((r, i) => (
                  <li key={`${r.contenedor}-${i}`} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-2.5">
                    <span className="font-mono text-sm font-medium">{r.contenedor}</span>
                    <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground" title={r.detalle ?? undefined}>
                      {r.detalle ?? ''}
                    </span>
                    <EstadoPill estado="proximo" label={labelEstadoPublicacion(r.estado)} />
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
      )}

      <section className="rounded-2xl border border-border bg-card p-5 sm:p-6">
        <h2 className="text-lg font-semibold tracking-tight">Incidentes de los últimos 7 días</h2>
        <p className="mb-4 text-sm text-muted-foreground">
          Fallos puntuales sin estado (un workflow que falló, una conciliación que recuperó fotos, una lectura dudosa)
        </p>
        <ListaEventos eventos={incidentes} vacio="Sin incidentes en la última semana." />
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold tracking-tight">Historial de alertas resueltas</h2>
        {resueltas.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border px-6 py-8 text-center text-sm text-muted-foreground">
            Todavía no hay alertas resueltas registradas.
          </div>
        ) : (
          resueltas.map((a) => <AlertaCard key={a.id} e={a} />)
        )}
      </section>
    </div>
  )
}
