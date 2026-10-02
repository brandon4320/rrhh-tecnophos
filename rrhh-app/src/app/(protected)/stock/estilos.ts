// Clases compartidas por las piezas de la pantalla de Stock.
import clsx from 'clsx'
import type { EstadoVencimiento } from '@/types'

export const inputCls =
  'w-full px-3.5 py-2.5 rounded-lg border border-input bg-card text-sm focus:outline-none focus:ring-2 focus:ring-ring'
export const labelCls = 'mb-1 block text-xs font-medium text-foreground'
export const btnPrimary =
  'inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50'
export const btnOutline =
  'inline-flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50'
export const btnMini = 'inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition-colors'
export const btnFila =
  'inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-card hover:text-foreground'
export const thCls = 'px-3 py-2.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground'

/** Botón de un control segmentado (mismo look que SegmentedLocal). */
export function segBtn(activa: boolean): string {
  return clsx(
    'rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
    activa ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
  )
}

/** Color del número de stock: el color es el estado (no hace falta otra columna que lo repita). */
export function colorStock(estado: EstadoVencimiento | undefined): string | false {
  if (estado === 'vencido') return 'text-danger'
  if (estado === 'proximo') return 'text-warning'
  if (estado === 'sin_fecha') return 'text-muted-foreground'
  return false
}
