import { cn } from '@/lib/utils'
import type { EstadoVencimiento } from '@/types'

/**
 * ÚNICO encoding visual del estado de vencimiento en toda la app:
 * dot + texto, color solo en el semántico. Reemplaza pills pastel,
 * barras de color y chips ad-hoc.
 */

const ESTILO: Record<EstadoVencimiento, { dot: string; text: string; label: string }> = {
  vencido:   { dot: 'bg-danger',           text: 'text-danger',           label: 'Vencido' },
  proximo:   { dot: 'bg-warning',          text: 'text-warning',          label: 'Por vencer' },
  vigente:   { dot: 'bg-success',          text: 'text-success',          label: 'OK' },
  sin_fecha: { dot: 'bg-muted-foreground/40', text: 'text-muted-foreground', label: 'Sin datos' },
}

export function EstadoPill({
  estado,
  label,
  className,
}: {
  estado: EstadoVencimiento
  /** Texto alternativo (ej: "Vence en 12 días"). Por defecto, la etiqueta del estado. */
  label?: string
  className?: string
}) {
  const s = ESTILO[estado]
  return (
    <span className={cn('inline-flex items-center gap-1.5 text-xs font-medium', s.text, className)}>
      <span className={cn('size-1.5 shrink-0 rounded-full', s.dot)} />
      {label ?? s.label}
    </span>
  )
}

/** Texto de la pastilla: el tono oscuro de cada estado, como las Pastilla del CRM (AA sobre su fondo). */
const TEXTO_PASTILLA: Record<EstadoVencimiento, string> = {
  vencido: 'text-danger-text',
  proximo: 'text-warning-text',
  vigente: 'text-success-text',
  sin_fecha: 'text-texto-2',
}

/** Variante contenida (fondo sutil) para cuando el pill necesita destacarse: hero, KPIs. */
export function EstadoBadgeSuave({
  estado,
  label,
  className,
}: {
  estado: EstadoVencimiento
  label?: string
  className?: string
}) {
  const s = ESTILO[estado]
  const bg: Record<EstadoVencimiento, string> = {
    vencido: 'bg-danger-subtle',
    proximo: 'bg-warning-subtle',
    vigente: 'bg-success-subtle',
    sin_fecha: 'bg-muted',
  }
  return (
    <span
      className={cn(
        'inline-flex h-6 items-center gap-1.5 rounded-full px-2.5 text-xs font-medium',
        bg[estado],
        TEXTO_PASTILLA[estado],
        className
      )}
    >
      <span className={cn('size-1.5 shrink-0 rounded-full', s.dot)} />
      {label ?? s.label}
    </span>
  )
}
