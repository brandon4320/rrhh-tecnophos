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
  return (
    <section className="mt-10">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-foreground">EPP y ropa entregada</h2>
          <p className="text-xs text-muted-foreground">
            {movimientos.length === 0
              ? 'Sin entregas registradas en Stock a su nombre.'
              : `${movimientos.length} ${movimientos.length === 1 ? 'movimiento' : 'movimientos'} registrados en Stock`}
          </p>
        </div>
        {empresaSlug && (
          <Link href={`/stock?empresa=${empresaSlug}`} className="text-xs font-medium text-primary hover:underline">
            Ir a Stock
          </Link>
        )}
      </div>
      {movimientos.length > 0 && (
        <ul className="divide-y divide-border rounded-2xl border border-border bg-card">
          {movimientos.map((m) => (
            <li key={m.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
              <span className="w-24 shrink-0 text-xs tabular-nums text-muted-foreground">{fmtFechaCompletaAR(m.fecha)}</span>
              <span className="min-w-0 flex-1 truncate font-medium">{m.item?.nombre ?? 'Ítem eliminado'}</span>
              <span className="shrink-0 tabular-nums">
                {fmtCantidad(Math.abs(m.cantidad), m.item?.unidad ?? undefined)}
              </span>
              <span className="w-20 shrink-0 text-right text-xs text-muted-foreground">{m.tipo === 'devolucion' ? 'devolvió' : 'recibió'}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
