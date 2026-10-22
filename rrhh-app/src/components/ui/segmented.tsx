import Link from 'next/link'
import { cn } from '@/lib/utils'

/**
 * Tabs segmentados estilo mockup: contenedor gris, tab activa blanca.
 * Server-friendly: cada tab es un Link (estado por URL).
 */
export function Segmented({
  tabs,
  active,
  className,
}: {
  tabs: { key: string; label: string; href: string }[]
  active: string
  className?: string
}) {
  return (
    <div className={cn('inline-flex items-center gap-1 rounded-[12px] bg-muted p-1', className)}>
      {tabs.map((t) => (
        <Link
          key={t.key}
          href={t.href}
          className={cn(
            'inline-flex h-8 items-center rounded-[9px] px-3.5 text-sm font-medium transition-colors',
            t.key === active
              ? 'bg-card text-foreground shadow-[0_1px_2px_rgba(23,22,31,0.08),0_1px_1px_rgba(23,22,31,0.04)]'
              : 'text-texto-2 hover:text-foreground'
          )}
        >
          {t.label}
        </Link>
      ))}
    </div>
  )
}
