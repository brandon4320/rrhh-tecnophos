import Link from 'next/link'
import type { ResumenMes } from '@/modules/arcor/queries'
import { tituloLugar } from '@/modules/arcor/reglas'

/** Contenedores por provincia: barras proporcionales al máximo del mes (acento único). */
export function ProvinciasBarras({ resumen, mesHref }: { resumen: ResumenMes; mesHref: string }) {
  const max = Math.max(1, ...resumen.porLugar.map((l) => l.total))
  return (
    <ul className="space-y-3">
      {resumen.porLugar.map((l) => (
        <li key={l.lugar}>
          <div className="flex items-baseline justify-between gap-3">
            <Link
              href={`${mesHref}&lugar=${encodeURIComponent(l.lugar)}`}
              className="text-sm font-medium text-foreground hover:underline"
            >
              {tituloLugar(l.lugar)}
            </Link>
            <p className="text-sm tabular-nums">
              <span className="font-semibold">{l.total}</span>
              {l.pendientes > 0 && <span className="ml-2 text-xs text-warning">{l.pendientes} pend.</span>}
              {l.revisar > 0 && <span className="ml-2 text-xs text-danger">{l.revisar} revisar</span>}
            </p>
          </div>
          <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${Math.round((l.total / max) * 100)}%` }} />
          </div>
        </li>
      ))}
    </ul>
  )
}
