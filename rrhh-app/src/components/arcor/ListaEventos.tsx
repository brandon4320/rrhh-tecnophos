import { IconoEvento } from './IconoEvento'
import { EstadoPill } from '@/components/ui/estado-pill'
import type { EventoRow } from '@/modules/arcor/tipos'
import { severidadAEstado } from '@/modules/arcor/reglas'
import { diaClaveAR, etiquetaDiaAR, fmtHoraAR } from '@/lib/fechas-ar'
import { cn } from '@/lib/utils'

const ORIGEN_LABEL: Record<string, string> = {
  servicio: 'servicio',
  wf0: 'n8n · errores',
  wf10: 'n8n · crédito',
  wf12: 'n8n · WhatsApp',
  wf13: 'n8n · conciliación',
  backfill: 'carga inicial',
}

function subtitulo(e: EventoRow): string | null {
  const d = e.detalle ?? {}
  const partes: string[] = []
  if (typeof d.booking === 'string' && d.booking) partes.push(`Booking ${d.booking}`)
  if (typeof d.oe === 'string' && d.oe) partes.push(`OE ${d.oe}`)
  if (typeof d.fecha === 'string' && d.fecha) partes.push(`cert. ${d.fecha.slice(8, 10)}/${d.fecha.slice(5, 7)}`)
  if (typeof d.error === 'string' && d.error) partes.push(d.error.slice(0, 120))
  if (typeof d.nodo === 'string' && d.nodo) partes.push(`nodo ${d.nodo}`)
  if (typeof d.recuperadas === 'number') partes.push(`${d.recuperadas} recuperadas`)
  return partes.length ? partes.join(' · ') : null
}

function Fila({ e }: { e: EventoRow }) {
  const grave = e.severidad !== 'info'
  return (
    <li className="flex items-start gap-3 px-1 py-2.5">
      <span className="w-11 shrink-0 pt-0.5 text-xs tabular-nums text-muted-foreground">{fmtHoraAR(e.ts)}</span>
      <span
        className={cn(
          'mt-0.5 inline-flex size-6 shrink-0 items-center justify-center rounded-md',
          e.severidad === 'critical' ? 'bg-danger-subtle text-danger'
          : e.severidad === 'warning' ? 'bg-warning-subtle text-warning'
          : 'bg-muted text-muted-foreground'
        )}
      >
        <IconoEvento tipo={e.tipo} className="size-3.5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-foreground">{e.titulo}</p>
        {subtitulo(e) && <p className="truncate text-xs text-muted-foreground">{subtitulo(e)}</p>}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {grave && <EstadoPill estado={severidadAEstado(e.severidad)} label={e.severidad === 'critical' ? 'Crítico' : 'Atención'} />}
        {e.origen && (
          <span className="hidden rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground sm:inline">
            {ORIGEN_LABEL[e.origen] ?? e.origen}
          </span>
        )}
      </div>
    </li>
  )
}

/**
 * Feed cronológico de eventos, agrupado por día (hora Argentina).
 * Server component: sin estado, el rango lo decide la URL.
 */
export function ListaEventos({
  eventos,
  agrupar = true,
  vacio = 'Sin actividad en este período.',
}: {
  eventos: EventoRow[]
  agrupar?: boolean
  vacio?: string
}) {
  if (eventos.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border px-6 py-8 text-center text-sm text-muted-foreground">
        {vacio}
      </div>
    )
  }

  if (!agrupar) {
    return <ul className="divide-y divide-border">{eventos.map((e) => <Fila key={e.id} e={e} />)}</ul>
  }

  const grupos = new Map<string, EventoRow[]>()
  for (const e of eventos) {
    const k = diaClaveAR(e.ts)
    if (!grupos.has(k)) grupos.set(k, [])
    grupos.get(k)!.push(e)
  }

  return (
    <div className="space-y-5">
      {[...grupos.entries()].map(([dia, lista]) => (
        <section key={dia}>
          <div className="mb-1 flex items-center gap-3 px-1">
            <p className="text-xs font-medium capitalize text-muted-foreground">{etiquetaDiaAR(dia)}</p>
            <span className="h-px flex-1 bg-border" />
            <span className="text-[11px] tabular-nums text-muted-foreground">{lista.length}</span>
          </div>
          <ul className="divide-y divide-border">{lista.map((e) => <Fila key={e.id} e={e} />)}</ul>
        </section>
      ))}
    </div>
  )
}
