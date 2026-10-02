'use client'

import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'

/**
 * Selector de mes cuando ya no entran como tabs. Cada opción trae su href
 * armado en el server (conserva los demás filtros); cambiar navega.
 */
export function SelectorMes({
  opciones,
  activo,
  className,
}: {
  opciones: { key: string; label: string; href: string }[]
  activo: string
  className?: string
}) {
  const router = useRouter()
  return (
    <select
      aria-label="Mes"
      value={activo}
      onChange={(e) => {
        const op = opciones.find((o) => o.key === e.target.value)
        if (op) router.push(op.href)
      }}
      className={cn(
        'rounded-xl border border-border bg-card px-3.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring',
        className
      )}
    >
      {opciones.map((o) => (
        <option key={o.key} value={o.key}>
          {o.label}
        </option>
      ))}
    </select>
  )
}
