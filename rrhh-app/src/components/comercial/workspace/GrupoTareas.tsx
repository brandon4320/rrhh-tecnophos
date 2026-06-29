import { EmpresaBadge } from '@/components/comercial/EmpresaBadge'
import { PriorityBadge } from '@/components/comercial/PriorityBadge'
import { ToggleTareaButton } from './ToggleTareaButton'
import { fmtFechaAR } from '@/modules/comercial/fechas'
import { ChevronDown } from 'lucide-react'
import Link from 'next/link'

export interface TareaItem {
  id: string; titulo: string; estado: string; prioridad: string
  proyecto_id: string | null; fecha_vencimiento: string | null; empresa?: string | null
}

export function TareaRow({ t }: { t: TareaItem }) {
  const completada = t.estado === 'completada'
  return (
    <div className="flex items-center gap-3 px-3 py-2 hover:bg-accent/40 transition-colors">
      <ToggleTareaButton tareaId={t.id} completada={completada} />
      <span className={`min-w-0 flex-1 truncate text-sm ${completada ? 'text-muted-foreground line-through' : ''}`}>
        {t.titulo}
      </span>
      <div className="flex shrink-0 items-center gap-2">
        {t.empresa && <EmpresaBadge empresa={t.empresa} size="xs" />}
        {!completada && <PriorityBadge prioridad={t.prioridad} />}
        {t.fecha_vencimiento && (
          <span className="text-[11px] text-muted-foreground tabular-nums">{fmtFechaAR(t.fecha_vencimiento)}</span>
        )}
      </div>
    </div>
  )
}

export function GrupoTareas({
  titulo, href, badge, tareas, footer,
}: {
  titulo: string
  href?: string
  badge?: React.ReactNode
  tareas: TareaItem[]
  footer?: React.ReactNode
}) {
  const ordenadas = [...tareas].sort((a, b) => Number(a.estado === 'completada') - Number(b.estado === 'completada'))
  const completas = tareas.filter((t) => t.estado === 'completada').length

  return (
    <details open className="group rounded-xl border border-border bg-card overflow-hidden">
      <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 hover:bg-accent/40">
        <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-0 -rotate-90" strokeWidth={2} />
        <div className="flex min-w-0 flex-1 items-center gap-2">
          {href ? (
            <Link href={href} className="truncate font-semibold hover:underline">{titulo}</Link>
          ) : (
            <span className="truncate font-semibold">{titulo}</span>
          )}
          {badge}
        </div>
        <span className="shrink-0 text-xs text-muted-foreground">{completas}/{tareas.length}</span>
      </summary>

      <div className="divide-y divide-border border-t border-border">
        {ordenadas.map((t) => <TareaRow key={t.id} t={t} />)}
        {footer}
      </div>
    </details>
  )
}
