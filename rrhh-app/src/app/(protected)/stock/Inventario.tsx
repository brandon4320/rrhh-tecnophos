'use client'

import { Fragment } from 'react'
import clsx from 'clsx'
import {
  Archive, ArchiveRestore, ChevronRight, ClipboardCheck, History, PackageMinus, PackagePlus, Pencil, Trash2,
} from 'lucide-react'
import type { EstadoVencimiento, StockItem, StockMovimiento } from '@/types'
import { fmtFechaAR } from '@/lib/fechas-ar'
import {
  TIPO_MOVIMIENTO_LABEL, deltaDe, describirMovimiento, fmtCantidad, fmtMoneda, textoMinimo, type Prenda, type SistemaTalles,
  type StockCalculado, type TipoMovimiento,
} from '@/modules/stock/reglas'
import { btnFila, btnMini, colorStock, thCls } from './estilos'

/** Lo que se puede hacer con un ítem desde la vista. Siempre con el id de un ítem REAL. */
export interface AccionesItem {
  movimiento: (tipo: TipoMovimiento, itemId: string) => void
  editar: (item: StockItem) => void
  archivar: (item: StockItem) => void
  eliminar: (item: StockItem) => void
  eliminarMovimiento: (m: StockMovimiento) => void
}

interface Datos {
  stock: Map<string, StockCalculado>
  estados: Map<string, EstadoVencimiento>
  movsPorItem: Map<string, StockMovimiento[]>
  canEdit: boolean
  abierto: string | null
  onAbrir: (id: string | null) => void
  acciones: AccionesItem
}

const SIN_STOCK: StockCalculado = { stock: 0, movimientos: 0, ultimaCompra: null, valorizado: null }

/**
 * Ropa por talle: una fila por prenda, una columna por talle. Cada celda es UN
 * ítem real (con su id) que muestra su stock: rojo en cero, naranja en el
 * mínimo. Tocar una celda abre las acciones de ESE ítem. Nunca se suman talles.
 */
export function MatrizTalles({
  sistema, prendas, talles, coincideItem, ...d
}: Datos & {
  sistema: SistemaTalles
  prendas: Prenda<StockItem>[]
  talles: string[]
  /** Las celdas que no pasan el filtro/búsqueda se atenúan (la fila conserva su forma). */
  coincideItem: (item: StockItem) => boolean
}) {
  const columnas = talles.length + 1
  return (
    <div className="overflow-x-auto rounded-2xl border border-border bg-card">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border">
            <th className={clsx(thCls, 'pl-4 text-left')}>{sistema === 'letras' ? 'Prenda · talle' : 'Prenda · número'}</th>
            {talles.map((t) => (
              <th key={t} className={clsx(thCls, 'w-14 px-1 text-center')}>{t}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {prendas.map((p) => {
            const porTalle = new Map(p.talles.map((t) => [t.talle, t.item]))
            const abiertoAca = p.talles.find((t) => t.item.id === d.abierto)?.item
            return (
              <Fragment key={p.clave}>
                <tr>
                  <td className="py-1.5 pl-4 pr-3 font-medium text-foreground">{p.base}</td>
                  {talles.map((t) => {
                    const item = porTalle.get(t)
                    if (!item) return <td key={t} className="px-1 text-center text-muted-foreground/30" aria-hidden>·</td>
                    const s = d.stock.get(item.id)?.stock ?? 0
                    const estado = d.estados.get(item.id)
                    const min = textoMinimo(item.stock_minimo, item.unidad)
                    const esAbierto = d.abierto === item.id
                    return (
                      <td key={t} className="p-1 text-center">
                        <button
                          type="button"
                          onClick={() => d.onAbrir(esAbierto ? null : item.id)}
                          aria-expanded={esAbierto}
                          aria-label={`${item.nombre}: ${fmtCantidad(s, item.unidad)}`}
                          title={[item.nombre, fmtCantidad(s, item.unidad), min].filter(Boolean).join(' · ')}
                          className={clsx(
                            'w-full rounded-md px-1 py-1.5 text-sm font-semibold tabular-nums transition-colors hover:bg-accent',
                            colorStock(estado),
                            !coincideItem(item) && 'opacity-25',
                            esAbierto && 'bg-primary/10 ring-1 ring-primary'
                          )}
                        >
                          {fmtCantidad(s)}
                        </button>
                      </td>
                    )
                  })}
                </tr>
                {abiertoAca && (
                  <tr>
                    <td colSpan={columnas} className="bg-muted px-4 py-3">
                      <FichaItem item={abiertoAca} {...d} />
                    </td>
                  </tr>
                )}
              </Fragment>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

/**
 * Todo lo que no es ropa por talle: Ítem | Stock | Último movimiento, ordenado
 * rojo → naranja → alfabético (lo ordena quien llama). El color del número ya es
 * el estado: no hay columna "Estado" que lo repita.
 */
export function TablaItems({ items, ultimoPorItem, ...d }: Datos & { items: StockItem[]; ultimoPorItem: Map<string, StockMovimiento> }) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-border bg-card">
      <table className="w-full min-w-[640px] table-fixed text-sm">
        <thead>
          <tr className="border-b border-border">
            <th className={clsx(thCls, 'w-[40%] pl-4 text-left')}>Ítem</th>
            <th className={clsx(thCls, 'w-[170px] text-right')}>Stock</th>
            <th className={clsx(thCls, 'text-left')}>Último movimiento</th>
            <th className={clsx(thCls, 'w-[56px]')} />
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {items.map((it) => {
            const s = d.stock.get(it.id)?.stock ?? 0
            const estado = d.estados.get(it.id)
            const min = textoMinimo(it.stock_minimo, it.unidad)
            const ultimo = ultimoPorItem.get(it.id)
            const ultimoTexto = ultimo ? `${fmtFechaAR(ultimo.fecha)} · ${describirMovimiento(ultimo)}` : 'Sin movimientos'
            const isOpen = d.abierto === it.id
            return (
              <Fragment key={it.id}>
                <tr
                  onClick={() => d.onAbrir(isOpen ? null : it.id)}
                  className={clsx('cursor-pointer transition-colors hover:bg-accent', it.activo === false && 'opacity-60')}
                >
                  <td className="py-2 pl-4 pr-3">
                    <div className="flex min-w-0 items-center gap-2">
                      <ChevronRight
                        className={clsx('size-3.5 shrink-0 text-muted-foreground/60 transition-transform', isOpen && 'rotate-90')}
                        strokeWidth={1.75}
                      />
                      <span className="truncate font-medium text-foreground" title={it.notas ?? it.nombre}>{it.nombre}</span>
                      {it.activo === false && (
                        <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">archivado</span>
                      )}
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">
                    <span className={clsx('text-sm font-semibold', colorStock(estado))}>{fmtCantidad(s)}</span>
                    {it.unidad && <span className="ml-1 text-[10px] text-muted-foreground">{it.unidad}</span>}
                    {min && <span className="ml-2 text-[11px] text-muted-foreground">{min}</span>}
                  </td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">
                    <span className="block truncate" title={ultimoTexto}>{ultimoTexto}</span>
                  </td>
                  <td className="px-3 py-2 text-right" onClick={(e) => e.stopPropagation()}>
                    {d.canEdit && it.activo !== false && (
                      <button
                        type="button"
                        onClick={() => d.acciones.movimiento('consumo', it.id)}
                        aria-label={`Entregar ${it.nombre}`}
                        title="Entregar"
                        className={clsx(btnMini, 'text-primary hover:bg-primary/10')}
                      >
                        <PackageMinus className="size-4" strokeWidth={1.75} />
                      </button>
                    )}
                  </td>
                </tr>
                {isOpen && (
                  <tr>
                    <td colSpan={4} className="bg-muted px-4 py-3">
                      <FichaItem item={it} {...d} />
                    </td>
                  </tr>
                )}
              </Fragment>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

/** Acciones e historial de UN ítem (se abre al tocar una celda o una fila). */
function FichaItem({ item: it, stock, estados, movsPorItem, canEdit, acciones }: Datos & { item: StockItem }) {
  const s = stock.get(it.id) ?? SIN_STOCK
  const estado = estados.get(it.id)
  const historial = movsPorItem.get(it.id) ?? []
  const min = textoMinimo(it.stock_minimo, it.unidad)
  const activo = it.activo !== false

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-2">
        <p className="text-sm">
          <span className="font-medium text-foreground">{it.nombre}</span>
          <span className={clsx('ml-2 font-semibold tabular-nums', colorStock(estado))}>{fmtCantidad(s.stock, it.unidad)}</span>
          {min && <span className="ml-2 text-xs text-muted-foreground">{min}</span>}
          {it.categoria && <span className="ml-2 text-xs text-muted-foreground">· {it.categoria}</span>}
        </p>
        {canEdit && (
          <div className="flex flex-1 flex-wrap items-center gap-2">
            {activo && (
              <>
                <button type="button" onClick={() => acciones.movimiento('consumo', it.id)} className={clsx(btnFila, 'border-primary/40 text-primary hover:text-primary')}>
                  <PackageMinus className="size-3.5" strokeWidth={1.75} />
                  Entregar
                </button>
                <button type="button" onClick={() => acciones.movimiento('compra', it.id)} className={btnFila}>
                  <PackagePlus className="size-3.5" strokeWidth={1.75} />
                  Ingresar
                </button>
                <button type="button" onClick={() => acciones.movimiento('ajuste', it.id)} className={btnFila}>
                  <ClipboardCheck className="size-3.5" strokeWidth={1.75} />
                  Contar stock
                </button>
              </>
            )}
            <button type="button" onClick={() => acciones.editar(it)} className={btnFila}>
              <Pencil className="size-3.5" strokeWidth={1.75} />
              Editar ítem
            </button>
            <button type="button" onClick={() => acciones.archivar(it)} className={btnFila}>
              {activo ? <Archive className="size-3.5" strokeWidth={1.75} /> : <ArchiveRestore className="size-3.5" strokeWidth={1.75} />}
              {activo ? 'Archivar' : 'Restaurar'}
            </button>
            <button
              type="button"
              onClick={() => acciones.eliminar(it)}
              className={clsx(btnFila, 'ml-auto border-transparent text-danger/70 hover:bg-danger-subtle hover:text-danger')}
            >
              <Trash2 className="size-3.5" strokeWidth={1.75} />
              Eliminar
            </button>
          </div>
        )}
      </div>

      <p className="mb-2 inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <History className="size-3.5" strokeWidth={1.75} />
        Historial · {historial.length} {historial.length === 1 ? 'movimiento' : 'movimientos'}
        {s.valorizado != null && ` · valorizado ${fmtMoneda(s.valorizado)}`}
      </p>
      {historial.length === 0 ? (
        <p className="py-2 text-xs text-muted-foreground">Sin movimientos todavía.</p>
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-card">
          {historial.slice(0, 30).map((m) => {
            const delta = deltaDe(m)
            return (
              <li key={m.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                <span className="w-12 shrink-0 text-xs tabular-nums text-muted-foreground">{fmtFechaAR(m.fecha)}</span>
                <span className="w-16 shrink-0 text-xs text-muted-foreground">{TIPO_MOVIMIENTO_LABEL[m.tipo as TipoMovimiento] ?? m.tipo}</span>
                <span className="w-20 shrink-0 text-right font-medium tabular-nums">
                  {delta > 0 ? '+' : ''}{fmtCantidad(delta)}
                </span>
                <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
                  {[
                    m.tipo === 'consumo' ? (m.notas ? `a ${m.notas}` : null) : m.notas,
                    m.proveedor,
                    m.precio_unitario != null ? `${fmtMoneda(m.precio_unitario)}/${it.unidad}` : null,
                    m.precio_unitario != null ? `total ${fmtMoneda(m.precio_unitario * Math.abs(m.cantidad))}` : null,
                    m.comprobante ? `comp. ${m.comprobante}` : null,
                  ].filter(Boolean).join(' · ')}
                </span>
                {canEdit && (
                  <button
                    type="button"
                    onClick={() => acciones.eliminarMovimiento(m)}
                    title="Eliminar movimiento"
                    aria-label="Eliminar movimiento"
                    className="text-danger/60 hover:text-danger"
                  >
                    <Trash2 className="size-3.5" strokeWidth={1.75} />
                  </button>
                )}
              </li>
            )
          })}
          {historial.length > 30 && (
            <li className="px-4 py-2 text-center text-xs text-muted-foreground">… y {historial.length - 30} más (en la pestaña Movimientos)</li>
          )}
        </ul>
      )}
    </div>
  )
}
