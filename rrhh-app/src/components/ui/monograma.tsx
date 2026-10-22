import { cn } from '@/lib/utils'

/**
 * Avatar de iniciales — identidad neutra para personas y empresas.
 * Reemplaza los tiles de colores por empresa y los íconos de edificio.
 */

const SIZES = {
  sm: 'size-7 text-[11px]',
  md: 'size-9 text-xs',
  lg: 'size-11 text-sm',
} as const

export function Monograma({
  nombre,
  size = 'md',
  variant = 'neutral',
  redondo = false,
  className,
}: {
  nombre: string | null | undefined
  size?: keyof typeof SIZES
  /** accent: para la entidad activa/protagonista (tint índigo). */
  variant?: 'neutral' | 'accent'
  /** Círculo, como las personas en el CRM (por defecto, cuadrado redondeado). */
  redondo?: boolean
  className?: string
}) {
  const iniciales = (nombre ?? '?')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0])
    .join('')
    .toUpperCase() || '?'

  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center justify-center font-semibold',
        redondo ? 'rounded-full' : 'rounded-lg',
        SIZES[size],
        variant === 'accent'
          ? 'bg-accent text-accent-foreground'
          : 'bg-muted text-muted-foreground',
        className
      )}
    >
      {iniciales}
    </span>
  )
}
