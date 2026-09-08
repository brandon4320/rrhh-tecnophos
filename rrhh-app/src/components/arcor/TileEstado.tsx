import type { ReactNode } from 'react'
import { EstadoPill } from '@/components/ui/estado-pill'
import type { EstadoVencimiento } from '@/types'
import { cn } from '@/lib/utils'

/**
 * Indicador de estado del sistema (WhatsApp, crédito, latido, cola).
 * El color entra SOLO por el pill de estado; el valor grande es neutro,
 * salvo que el estado sea crítico.
 */
export function TileEstado({
  label,
  valor,
  sub,
  estado,
  pill,
  extra,
  className,
}: {
  label: string
  valor: ReactNode
  sub?: ReactNode
  estado: EstadoVencimiento
  pill: string
  extra?: ReactNode
  className?: string
}) {
  return (
    <div className={cn('min-w-0', className)}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">{label}</p>
        <EstadoPill estado={estado} label={pill} />
      </div>
      <p className={cn('mt-1.5 text-2xl font-semibold tabular-nums tracking-tight', estado === 'vencido' && 'text-danger')}>
        {valor}
      </p>
      {sub && <p className="mt-0.5 truncate text-xs text-muted-foreground">{sub}</p>}
      {extra && <div className="mt-2.5">{extra}</div>}
    </div>
  )
}
