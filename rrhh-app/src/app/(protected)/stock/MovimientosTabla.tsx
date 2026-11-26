'use client'

import { useCallback, useDeferredValue, useMemo, useState, type RefObject } from 'react'
import clsx from 'clsx'
import { Search, Trash2 } from 'lucide-react'
import type { StockItem, StockMovimiento } from '@/types'
import { fmtFechaAR } from '@/lib/fechas-ar'
import {
  TIPO_MOVIMIENTO_LABEL, TIPO_MOVIMIENTO_PLURAL, contraparteDe, deltaDe, filtrarMovimientos, fmtCantidad, hoyClave,
  rangoMesActual, rangoMesAnterior, type TipoMovimiento,
} from '@/modules/stock/reglas'
import { inputCls, segBtn, thCls } from './estilos'

const LIMITE = 300

/**
 * Libro de movimientos de todos los ítems (ya está en memoria: no hace otra
 * consulta). Contesta "¿qué se entregó este mes?" y "¿qué recibió Nicolás
 * Fernández?": la búsqueda mira el ítem y también las notas, donde se escribe
 * a quién se entregó.
 */
export function MovimientosTabla({
  movimientos,
  itemsPorId,
  canEdit,
  tipoInicial,
  onEliminar,
  buscadorRef,
  autores,
}: {
  /** Ya ordenados, el más reciente primero (`compararMovimientosDesc`). */
  movimientos: StockMovimiento[]
  itemsPorId: Map<string, StockItem>
  canEdit: boolean
  tipoInicial: TipoMovimiento | null
  onEliminar: (m: StockMovimiento) => void
  buscadorRef: RefObject<HTMLInputElement | null>
  /** Nombre de quien cargó cada movimiento (perfiles por created_by; vacío en los anteriores al 03/10). */
  autores: Record<string, string>
}) {
  const [hoy] = useState(() => hoyClave())
  const mesActual = useMemo(() => rangoMesActual(hoy), [hoy])
  const mesAnterior = useMemo(() => rangoMesAnterior(hoy), [hoy])
  const [tipo, setTipo] = useState<TipoMovimiento | null>(tipoInicial)
  const [desde, setDesde] = useState(mesActual.desde)
  const [hasta, setHasta] = useState(mesActual.hasta)
  const [q, setQ] = useState('')
  const [verTodos, setVerTodos] = useState(false)
  const busqueda = useDeferredValue(q)

  const camposDe = useCallback(
    (m: StockMovimiento) => {
      const it = itemsPorId.get(m.item_id)
      return [it?.nombre, it?.categoria, m.notas, m.proveedor, m.comprobante]
    },
    [itemsPorId]
  )
  const { visibles, fueraDeRango } = useMemo(
    () => filtrarMovimientos(movimientos, { tipo, desde, hasta, busqueda }, camposDe),
    [movimientos, tipo, desde, hasta, busqueda, camposDe]
  )
  const resumen = useMemo(() => {
    const r = { consumo: 0, devolucion: 0, compra: 0, ajuste: 0 }
    for (const m of visibles) if (m.tipo in r) r[m.tipo as TipoMovimiento]++
    return r
  }, [visibles])

  const preset = desde === mesActual.desde && hasta === mesActual.hasta
    ? 'mes'
    : desde === mesAnterior.desde && hasta === mesAnterior.hasta
      ? 'anterior'
      : !desde && !hasta ? 'todo' : null
  const mostrados = verTodos ? visibles : visibles.slice(0, LIMITE)

  function rango(r: { desde: string; hasta: string }) {
    setDesde(r.desde)
    setHasta(r.hasta)
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[240px] flex-1 sm:max-w-sm">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" strokeWidth={1.75} />
          <input
            ref={buscadorRef}
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar ítem, persona, proveedor…  ( / )"
            className={clsx(inputCls, 'pl-9')}
          />
        </div>
        <div className="inline-flex items-center gap-1 rounded-xl bg-muted p-1">
          {([null, 'consumo', 'devolucion', 'compra', 'ajuste'] as (TipoMovimiento | null)[]).map((t) => (
            <button key={t ?? 'todos'} type="button" onClick={() => setTipo(t)} className={segBtn(tipo === t)}>
              {t ? TIPO_MOVIMIENTO_PLURAL[t] : 'Todos'}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex items-center gap-1 rounded-xl bg-muted p-1">
          <button type="button" onClick={() => rango(mesActual)} className={segBtn(preset === 'mes')}>Este mes</button>
          <button type="button" onClick={() => rango(mesAnterior)} className={segBtn(preset === 'anterior')}>Mes pasado</button>
          <button type="button" onClick={() => rango({ desde: '', hasta: '' })} className={segBtn(preset === 'todo')}>Todas las fechas</button>
        </div>
        <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
          Desde
          <input type="date" value={desde} max={hasta || hoy} onChange={(e) => setDesde(e.target.value)} className={clsx(inputCls, 'w-auto py-1.5')} />
        </label>
        <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
          Hasta
          <input type="date" value={hasta} min={desde || undefined} max={hoy} onChange={(e) => setHasta(e.target.value)} className={clsx(inputCls, 'w-auto py-1.5')} />
        </label>
      </div>

      <p className="text-xs text-muted-foreground">
        {visibles.length} {visibles.length === 1 ? 'movimiento' : 'movimientos'}
        {visibles.length > 0 && (
          <>
            {' · '}
            {[
              resumen.consumo > 0 && `${resumen.consumo} ${resumen.consumo === 1 ? 'entrega' : 'entregas'}`,
              resumen.devolucion > 0 && `${resumen.devolucion} ${resumen.devolucion === 1 ? 'devolución' : 'devoluciones'}`,
              resumen.compra > 0 && `${resumen.compra} ${resumen.compra === 1 ? 'ingreso' : 'ingresos'}`,
              resumen.ajuste > 0 && `${resumen.ajuste} ${resumen.ajuste === 1 ? 'ajuste' : 'ajustes'}`,
            ].filter(Boolean).join(' · ')}
          </>
        )}
        {fueraDeRango > 0 && (
          <>
            {' · '}
            <button type="button" onClick={() => rango({ desde: '', hasta: '' })} className="font-medium text-primary hover:underline">
              {fueraDeRango} más fuera de estas fechas
            </button>
          </>
        )}
      </p>

      {visibles.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border px-5 py-6 text-center text-sm text-muted-foreground">
          {movimientos.length === 0 ? 'Todavía no hay movimientos.' : 'Ningún movimiento coincide con los filtros.'}
        </div>
      ) : (
        <div className="rounded-2xl border border-border bg-card shadow-tarjeta md:overflow-x-auto">
          {/* En el celular cada movimiento es una tarjeta de dos o tres renglones: nada se desliza de costado. */}
          <table className="w-full text-sm max-md:block md:min-w-[820px] md:table-fixed">
            <thead className="max-md:hidden">
              <tr className="border-b border-border">
                <th className={clsx(thCls, 'w-[72px] pl-4 text-left')}>Fecha</th>
                <th className={clsx(thCls, 'w-[84px] text-left')}>Tipo</th>
                <th className={clsx(thCls, 'text-left')}>Ítem</th>
                <th className={clsx(thCls, 'w-[104px] text-right')}>Cant.</th>
                <th className={clsx(thCls, 'text-left')}>Para / Proveedor</th>
                <th className={clsx(thCls, 'w-[120px] text-left')}>Comprobante</th>
                <th className={clsx(thCls, 'w-[110px] text-left')}>Cargó</th>
                {canEdit && <th className={clsx(thCls, 'w-[44px]')} />}
              </tr>
            </thead>
            <tbody className="divide-y divide-border max-md:block">
              {mostrados.map((m, i) => {
                const it = itemsPorId.get(m.item_id)
                const delta = deltaDe(m)
                const c = contraparteDe(m)
                // Una entrega de un kit son muchas filas del mismo día: la fecha va solo en la primera.
                const mismaFecha = i > 0 && mostrados[i - 1].fecha === m.fecha
                return (
                  <tr key={m.id} className="hover:bg-accent/50 max-md:grid max-md:grid-cols-[auto_auto_minmax(0,1fr)_auto_auto] max-md:items-center max-md:gap-x-2 max-md:px-4 max-md:py-2 [&>td]:max-md:p-0">
                    <td className="py-2 pl-4 pr-3 text-xs tabular-nums text-muted-foreground max-md:col-start-1 max-md:row-start-2"><span className={mismaFecha ? 'md:hidden' : undefined}>{fmtFechaAR(m.fecha)}</span></td>
                    <td className="px-3 py-2 text-xs text-muted-foreground max-md:col-start-2 max-md:row-start-2">{TIPO_MOVIMIENTO_LABEL[m.tipo as TipoMovimiento] ?? m.tipo}</td>
                    <td className="px-3 py-2 max-md:col-span-3 max-md:col-start-1 max-md:row-start-1 max-md:min-w-0">
                      <span className="block truncate" title={it?.nombre}>
                        <span className={clsx('font-medium', it?.activo === false && 'text-muted-foreground')}>{it?.nombre ?? 'Ítem eliminado'}</span>
                        {it?.activo === false && <span className="ml-2 text-xs text-muted-foreground">archivado</span>}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums max-md:col-start-4 max-md:row-start-1">
                      <span className="font-medium">{delta > 0 ? '+' : ''}{fmtCantidad(delta)}</span>
                      {it?.unidad && <span className="ml-1 text-xs text-muted-foreground">{it.unidad}</span>}
                    </td>
                    <td className="px-3 py-2 max-md:col-span-3 max-md:col-start-3 max-md:row-start-2 max-md:min-w-0 max-md:text-xs">
                      <span className="block truncate" title={[c.principal, c.detalle].filter(Boolean).join(' · ')}>
                        {c.principal || <span className="text-muted-foreground">—</span>}
                        {c.detalle && <span className="ml-1.5 text-xs text-muted-foreground">{c.detalle}</span>}
                      </span>
                    </td>
                    <td className="truncate px-3 py-2 text-xs text-muted-foreground max-md:col-span-3 max-md:col-start-1 max-md:row-start-3 max-md:empty:hidden" title={m.comprobante ?? undefined}>{m.comprobante ?? ''}</td>
                    <td className="truncate px-3 py-2 text-xs text-muted-foreground max-md:col-span-2 max-md:col-start-4 max-md:row-start-3 max-md:text-right max-md:empty:hidden">{(m.created_by && autores[m.created_by]) || ''}</td>
                    {canEdit && (
                      <td className="px-2 py-2 text-right max-md:col-start-5 max-md:row-start-1">
                        <button
                          type="button"
                          onClick={() => onEliminar(m)}
                          title="Eliminar movimiento"
                          aria-label={`Eliminar movimiento de ${it?.nombre ?? 'ítem'} del ${fmtFechaAR(m.fecha)}`}
                          className="rounded-md p-1 text-muted-foreground/60 transition-colors hover:bg-danger-subtle hover:text-danger"
                        >
                          <Trash2 className="size-3.5" strokeWidth={1.75} />
                        </button>
                      </td>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>
          {visibles.length > mostrados.length && (
            <div className="border-t border-border px-4 py-2.5 text-center">
              <button type="button" onClick={() => setVerTodos(true)} className="text-xs font-medium text-primary hover:underline">
                Mostrar los {visibles.length - mostrados.length} restantes
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
