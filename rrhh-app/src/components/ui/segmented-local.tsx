'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'

/**
 * Variante client-side de Segmented: el contenido de cada tab ya viene
 * serializado en el payload, así que cambiar de tab no toca el server
 * (Segmented navega con Links y re-ejecuta la página entera).
 * La URL se sincroniza con replaceState para que compartir/recargar respete el tab.
 */
export function SegmentedLocal({
  tabs,
  inicial,
  paramKey = 'tab',
  className,
}: {
  tabs: { key: string; label: string; content: React.ReactNode }[]
  inicial: string
  paramKey?: string
  className?: string
}) {
  const [active, setActive] = useState(inicial)

  function cambiar(key: string) {
    setActive(key)
    try {
      const url = new URL(window.location.href)
      if (key === tabs[0]!.key) url.searchParams.delete(paramKey)
      else url.searchParams.set(paramKey, key)
      window.history.replaceState(null, '', url)
    } catch { /* la URL es cosmética: el tab ya cambió */ }
  }

  return (
    <>
      <div className={cn('inline-flex items-center gap-1 rounded-xl bg-muted p-1', className)}>
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => cambiar(t.key)}
            className={cn(
              'rounded-lg px-3.5 py-1.5 text-sm font-medium transition-colors',
              t.key === active
                ? 'bg-card text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {t.label}
          </button>
        ))}
      </div>
      {tabs.find((t) => t.key === active)?.content}
    </>
  )
}
