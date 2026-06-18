import { cn } from '@/lib/utils'
import type { Prioridad } from '@/modules/comercial/tipos'

const COLORES: Record<Prioridad, string> = {
  alta:  'bg-red-500/10 text-red-700 border-red-500/20 dark:text-red-400',
  media: 'bg-amber-500/10 text-amber-700 border-amber-500/20 dark:text-amber-400',
  baja:  'bg-slate-500/10 text-slate-500 border-slate-500/20',
}

const LABELS: Record<Prioridad, string> = { alta: 'Alta', media: 'Media', baja: 'Baja' }

export function PriorityBadge({ prioridad, className }: { prioridad: Prioridad | string; className?: string }) {
  const p = prioridad as Prioridad
  return (
    <span className={cn('inline-flex items-center rounded border px-2 py-0.5 text-xs font-medium', COLORES[p] ?? 'bg-muted text-muted-foreground border-border', className)}>
      {LABELS[p] ?? prioridad}
    </span>
  )
}
