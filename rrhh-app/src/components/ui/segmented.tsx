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
    <div className={cn('inline-flex items-center gap-1 rounded-xl bg-muted p-1', className)}>
      {tabs.map((t) => (
        <Link
          key={t.key}
          href={t.href}
          className={cn(
            'rounded-lg px-3.5 py-1.5 text-sm font-medium transition-colors',
            t.key === active
              ? 'bg-card text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          {t.label}
        </Link>
      ))}
    </div>
  )
}
