import { cn } from '@/lib/utils'
import { diasHastaVencimiento } from '@/types'

/**
 * Barra de urgencia de un vencimiento (estilo mockup):
 * vencido = llena roja; próximo = parcial naranja (más llena cuanto
 * más cerca); vigente = gris tenue.
 */
export function BarraVencimiento({
  fecha,
  alertaDias,
  className,
}: {
  fecha: string
  alertaDias?: number | null
  className?: string
}) {
  const dias = diasHastaVencimiento(fecha)
  const ventana = alertaDias ?? 30

  let color = 'bg-muted-foreground/25'
  let pct = 15
  if (dias < 0) {
    color = 'bg-danger'
    pct = 100
  } else if (dias <= ventana) {
    color = 'bg-warning'
    // más cerca del vencimiento → barra más llena (60–95%)
    pct = Math.round(95 - (dias / ventana) * 35)
  }

  return (
    <div className={cn('h-1.5 w-full max-w-[240px] overflow-hidden rounded-full bg-muted', className)}>
      <div className={cn('h-full rounded-full transition-all', color)} style={{ width: `${pct}%` }} />
    </div>
  )
}
