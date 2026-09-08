import { cn } from '@/lib/utils'
import type { Severidad } from '@/modules/arcor/reglas'

/** Barra de consumo (crédito Claude): el color sigue la severidad, no un gradiente decorativo. */
export function BarraConsumo({ pct, nivel, className }: { pct: number; nivel: Severidad; className?: string }) {
  const clamped = Math.max(0, Math.min(100, pct))
  const color = nivel === 'critical' ? 'bg-danger' : nivel === 'warning' ? 'bg-warning' : 'bg-success'
  return (
    <div className={cn('h-1.5 w-full overflow-hidden rounded-full bg-muted', className)}>
      <div className={cn('h-full rounded-full transition-all', color)} style={{ width: `${clamped}%` }} />
    </div>
  )
}
