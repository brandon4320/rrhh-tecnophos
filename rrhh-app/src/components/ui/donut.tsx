import { cn } from '@/lib/utils'

/**
 * Donut de porcentaje en SVG puro (sin librerías).
 * Usado para "Cumplimiento" (% certificados al día).
 */
export function Donut({
  pct,
  size = 104,
  stroke = 10,
  className,
  children,
}: {
  pct: number // 0–100
  size?: number
  stroke?: number
  className?: string
  children?: React.ReactNode
}) {
  const clamped = Math.max(0, Math.min(100, pct))
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const filled = (clamped / 100) * c

  return (
    <div className={cn('relative inline-flex items-center justify-center', className)} style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle
          cx={size / 2} cy={size / 2} r={r}
          fill="none" strokeWidth={stroke}
          className="stroke-muted"
        />
        <circle
          cx={size / 2} cy={size / 2} r={r}
          fill="none" strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={`${filled} ${c - filled}`}
          className="stroke-success transition-all"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        {children ?? (
          <>
            <span className="text-lg font-semibold tabular-nums">{Math.round(clamped)}%</span>
            <span className="text-[10px] text-muted-foreground">al día</span>
          </>
        )}
      </div>
    </div>
  )
}
