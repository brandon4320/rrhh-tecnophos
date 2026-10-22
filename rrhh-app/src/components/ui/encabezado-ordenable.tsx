import { ArrowDown, ArrowUp, ChevronsUpDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Orden } from '@/lib/orden'

/**
 * Título de columna que ordena (EncabezadoOrdenable del Pipeline del CRM): flechita doble sin
 * ordenar, arriba/abajo cuando ordena por esa columna. `aria-sort` para lectores de pantalla.
 */
export function EncabezadoOrdenable<C extends string>({
  campo,
  etiqueta,
  orden,
  onAlternar,
  className,
  alinear = 'izquierda',
}: {
  campo: C
  etiqueta: string
  orden: Orden<C>
  onAlternar: (campo: C) => void
  className?: string
  alinear?: 'izquierda' | 'centro' | 'derecha'
}) {
  const activo = orden.campo === campo
  const Icono = !activo ? ChevronsUpDown : orden.dir === 'asc' ? ArrowUp : ArrowDown
  return (
    <th
      scope="col"
      aria-sort={activo ? (orden.dir === 'asc' ? 'ascending' : 'descending') : 'none'}
      className={cn('py-2 text-xs font-medium whitespace-nowrap text-muted-foreground', alinear === 'centro' ? 'text-center' : alinear === 'derecha' ? 'text-right' : 'text-left', className)}
    >
      <button
        type="button"
        onClick={() => onAlternar(campo)}
        className={cn(
          '-mx-1.5 inline-flex h-8 cursor-pointer items-center gap-1 rounded-lg px-1.5 tracking-[0.04em] uppercase transition-colors hover:bg-muted hover:text-foreground',
          activo && 'text-foreground'
        )}
      >
        {etiqueta}
        <Icono className={cn('size-3.5', !activo && 'opacity-50')} strokeWidth={2} aria-hidden />
      </button>
    </th>
  )
}
