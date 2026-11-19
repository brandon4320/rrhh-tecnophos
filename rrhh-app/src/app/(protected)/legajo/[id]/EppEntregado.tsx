import Link from 'next/link'
import { fmtFechaCompletaAR } from '@/lib/fechas-ar'
import { fmtCantidad } from '@/modules/stock/reglas'

export interface MovimientoEpp {
  id: string
  fecha: string
  tipo: string
  cantidad: number
  item: { nombre: string; unidad: string | null } | null
}

/**
 * EPP y ropa entregados a este empleado (y lo que devolvió), desde Stock: las
 * entregas con empleado_id (migración 24). Sirve de respaldo para la constancia de
 * entrega de EPP. Solo lectura: se carga desde Stock → Registrar entrega.
 */
export default function EppEntregado({ movimientos, empresaSlug }: { movimientos: MovimientoEpp[]; empresaSlug: string | null }) {
  const irAStock = empresaSlug && (
    <Link href={`/stock?empresa=${empresaSlug}`} className="mt-3 inline-flex h-11 items-center gap-1.5 self-start rounded-lg border border-border bg-card px-3 text-[13px] font-medium shadow-min transition-colors hover:bg-hover md:h-7">
      Ir a Stock
    </Link>
  )
  if (movimientos.length === 0) {
    return (
      <section className="flex flex-col items-center gap-1 py-8 text-center">
        <h4 className="text-xl font-medium tracking-[-0.01em]">Sin entregas</h4>
        <p className="text-[13px] text-texto-2">Sin entregas registradas en Stock a su nombre.</p>
        {irAStock}
      </section>
    )
  }
  return (
    <section className="flex flex-col">
      <ul className="overflow-hidden rounded-[16px] border border-border" aria-label={`${movimientos.length} ${movimientos.length === 1 ? 'movimiento' : 'movimientos'} registrados en Stock`}>
        {movimientos.map((m) => (
          <li key={m.id} className="flex min-h-[60px] items-center gap-3 border-t border-divisor py-1.5 pr-3 pl-4 text-[13px] first:border-t-0 md:min-h-[52px]">
            <span className="w-[88px] shrink-0 text-xs text-muted-foreground">{fmtFechaCompletaAR(m.fecha)}</span>
            <b className="min-w-0 flex-1 truncate font-medium">{m.item?.nombre ?? 'Ítem eliminado'}</b>
            <span className="shrink-0 font-medium">{fmtCantidad(Math.abs(m.cantidad), m.item?.unidad ?? undefined)}</span>
            <span className="w-16 shrink-0 text-right text-[13px] text-texto-2">{m.tipo === 'devolucion' ? 'devolvió' : 'recibió'}</span>
          </li>
        ))}
      </ul>
      {irAStock}
    </section>
  )
}
