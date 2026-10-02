'use client'

import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import clsx from 'clsx'
import { Boxes, PackageMinus, PackagePlus, Plus, Search, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { mensajeError } from '@/lib/errores'
import { coincide } from '@/lib/texto'
import { EstadoPill } from '@/components/ui/estado-pill'
import type { EstadoVencimiento, StockItem, StockMovimiento } from '@/types'
import {
  ESTADO_STOCK_LABEL, SIN_CATEGORIA, agruparPrendas, calcularStock, categoriaDe, categoriasDe, compararItems,
  compararMovimientosDesc, comprasDelMes, describirMovimiento, destinatariosFrecuentes, estadoStock, fmtCantidad, fmtMoneda,
  matricesDePrendas, mesClave, ordenarPorUrgencia, textoMinimo, ultimoMovimientoPorItem, type TipoMovimiento,
} from '@/modules/stock/reglas'
import { fmtFechaAR } from '@/lib/fechas-ar'
import type { OpcionItem } from './ItemPicker'
import { PanelMovimiento, type ControlPanel } from './PanelMovimiento'
import { PanelItem } from './PanelItem'
import { MovimientosTabla } from './MovimientosTabla'
import { MatrizTalles, TablaItems, type AccionesItem } from './Inventario'
import { btnFila, btnOutline, btnPrimary, inputCls, segBtn } from './estilos'

export type PestanaStock = 'inventario' | 'movimientos'

interface Props {
  empresa: { id: string; nombre: string; slug: string }
  items: StockItem[]
  movimientos: StockMovimiento[]
  canEdit: boolean
  pestanaInicial: PestanaStock
}

/** Vista de la lista. Los tres estados de reposición son excluyentes con "archivados". */
type Vista = 'todo' | 'reponer' | 'sin_stock' | 'bajo_minimo' | 'archivados'
const VISTAS_REPONER: Vista[] = ['reponer', 'sin_stock', 'bajo_minimo']

type Panel =
  | { clase: 'item'; editando: StockItem | null; seq: number }
  | { clase: 'mov'; tipo: TipoMovimiento; itemId: string; seq: number }

/**
 * Stock de una empresa: catálogo de ítems (CRUD) + libro de movimientos.
 * El stock actual se calcula (compra +, consumo −, ajuste ±), nunca se tipea.
 * Mutaciones directas con el cliente de Supabase (la RLS stock_*_rrhh_all decide);
 * el estado local se actualiza con la fila que devuelve el server (nunca antes:
 * si el insert falla, el número en pantalla no miente) + toasts.
 *
 * router.refresh(): la pantalla vive de su estado local; el refresh existe para que
 * la caché del router (staleTimes.dynamic=30) no devuelva un stock viejo al volver.
 * Se hace UNA vez al cerrar el panel de movimientos (no por cada línea cargada), o
 * enseguida tras acciones sueltas (alta/edición de ítem, archivar, eliminar).
 */
export default function StockClient({ empresa, items: initItems, movimientos: initMovs, canEdit, pestanaInicial }: Props) {
  const [supabase] = useState(() => createClient())
  const router = useRouter()
  const [items, setItems] = useState(initItems)
  const [movs, setMovs] = useState(initMovs)

  // navegación y filtros
  const [pestana, setPestana] = useState<PestanaStock>(pestanaInicial)
  const [tipoMovsInicial, setTipoMovsInicial] = useState<TipoMovimiento | null>(null)
  const [movsSeq, setMovsSeq] = useState(0)
  const [q, setQ] = useState('')
  const busqueda = useDeferredValue(q)
  const [vista, setVista] = useState<Vista>('todo')
  const [categoria, setCategoria] = useState<string | null>(null)
  const [abierto, setAbierto] = useState<string | null>(null)

  // paneles
  const [panel, setPanel] = useState<Panel | null>(null)
  const [scrollSeq, setScrollSeq] = useState(0)
  const [saving, setSaving] = useState(false)
  const seqRef = useRef(0)
  const panelRef = useRef<HTMLDivElement>(null)
  const buscadorRef = useRef<HTMLInputElement>(null)
  const controlRef = useRef<ControlPanel | null>(null)
  /** Hubo movimientos registrados desde el último refresh. */
  const pendienteRefresh = useRef(false)

  // El panel vive arriba de la lista: sin esto, tocar "Entregar" en un ítem que está
  // a mitad de scroll abría el formulario fuera de la pantalla y no pasaba nada visible.
  useEffect(() => {
    if (panel) panelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [panel, scrollSeq])

  // "/" enfoca el buscador de la pestaña visible (atajo local a esta pantalla, no global).
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== '/' || e.metaKey || e.ctrlKey || e.altKey) return
      const el = document.activeElement
      if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement) return
      e.preventDefault()
      buscadorRef.current?.focus()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // ── derivados (memoizados de verdad: cada uno depende solo de estado) ──────
  // OJO: calcularStock recibe SIEMPRE el catálogo completo. Si se alimentara con la
  // lista filtrada, los ítems ocultos perderían su stock.
  const stock = useMemo(() => calcularStock(items, movs), [items, movs])
  const estados = useMemo(() => {
    const m = new Map<string, EstadoVencimiento>()
    for (const i of items) m.set(i.id, estadoStock(stock.get(i.id)?.stock ?? 0, i.stock_minimo))
    return m
  }, [items, stock])
  const estadoDe = useCallback((i: StockItem): EstadoVencimiento => estados.get(i.id) ?? 'vigente', [estados])
  const activos = useMemo(() => items.filter((i) => i.activo !== false), [items])
  const itemsPorId = useMemo(() => new Map(items.map((i) => [i.id, i])), [items])
  const categorias = useMemo(() => categoriasDe(items), [items]) // alimenta el datalist del alta
  const movsOrdenados = useMemo(() => [...movs].sort(compararMovimientosDesc), [movs])
  const movsPorItem = useMemo(() => {
    const m = new Map<string, StockMovimiento[]>()
    for (const mov of movsOrdenados) {
      const arr = m.get(mov.item_id)
      if (arr) arr.push(mov)
      else m.set(mov.item_id, [mov])
    }
    return m
  }, [movsOrdenados])
  const ultimoPorItem = useMemo(() => ultimoMovimientoPorItem(movs), [movs])
  const proveedores = useMemo(
    () => [...new Set(movs.map((m) => (m.proveedor ?? '').trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'es')),
    [movs]
  )
  const destinatarios = useMemo(() => destinatariosFrecuentes(movs), [movs])
  const opciones = useMemo<OpcionItem[]>(
    () =>
      [...activos].sort(compararItems).map((i) => ({
        id: i.id, nombre: i.nombre, categoria: i.categoria, unidad: i.unidad,
        stock: stock.get(i.id)?.stock ?? 0, estado: estados.get(i.id) ?? 'vigente',
      })),
    [activos, stock, estados]
  )

  const [mes] = useState(() => mesClave())
  const compras = useMemo(() => comprasDelMes(movs, mes), [movs, mes])
  const entregasMes = useMemo(() => movs.filter((m) => m.tipo === 'consumo' && m.fecha.startsWith(mes)).length, [movs, mes])
  const kpis = useMemo(() => {
    let sinStock = 0, bajoMinimo = 0, enCeroSinMinimo = 0
    for (const i of activos) {
      const e = estados.get(i.id)
      if (e === 'vencido') sinStock++
      else if (e === 'proximo') bajoMinimo++
      // Sin mínimo definido no entran en "hay que comprar" (es EPP que la empresa no
      // maneja), pero están vacíos: si no se cuentan acá, no aparecen en ningún lado.
      else if (e === 'sin_fecha') enCeroSinMinimo++
    }
    return { sinStock, bajoMinimo, enCeroSinMinimo }
  }, [activos, estados])

  // Lo accionable, ordenado por urgencia real: primero lo que está en cero, y
  // dentro de cada estado, lo que quedó más por debajo de su mínimo.
  const porComprar = useMemo(
    () =>
      activos
        .filter((i) => {
          const e = estados.get(i.id)
          return e === 'vencido' || e === 'proximo'
        })
        .sort((a, b) => {
          const ea = estados.get(a.id), eb = estados.get(b.id)
          if (ea !== eb) return ea === 'vencido' ? -1 : 1
          const sa = stock.get(a.id)?.stock ?? 0, sb = stock.get(b.id)?.stock ?? 0
          const fa = a.stock_minimo ? sa / a.stock_minimo : 1
          const fb = b.stock_minimo ? sb / b.stock_minimo : 1
          return fa - fb || a.nombre.localeCompare(b.nombre, 'es')
        }),
    [activos, estados, stock]
  )

  // ── inventario: matriz de ropa + tabla plana, con la categoría como filtro ──
  const itemsDeVista = useMemo(
    () => items.filter((i) => (vista === 'archivados' ? i.activo === false : i.activo !== false)),
    [items, vista]
  )
  const chips = useMemo(() => {
    const set = new Set(itemsDeVista.map(categoriaDe))
    return [...set].sort((a, b) => (a === SIN_CATEGORIA ? 1 : b === SIN_CATEGORIA ? -1 : a.localeCompare(b, 'es')))
  }, [itemsDeVista])
  const categoriaActiva = categoria && chips.includes(categoria) ? categoria : null
  const base = useMemo(
    () => (categoriaActiva ? itemsDeVista.filter((i) => categoriaDe(i) === categoriaActiva) : itemsDeVista),
    [itemsDeVista, categoriaActiva]
  )
  // La estructura (qué prendas hay) sale del catálogo, no de la búsqueda: así una
  // búsqueda atenúa celdas en vez de mandar un talle suelto a la tabla plana.
  const { prendas, sueltos } = useMemo(() => agruparPrendas(base), [base])
  const coincideItem = useCallback(
    (i: StockItem) => {
      const e = estados.get(i.id)
      if (vista === 'reponer' && e !== 'vencido' && e !== 'proximo') return false
      if (vista === 'sin_stock' && e !== 'vencido') return false
      if (vista === 'bajo_minimo' && e !== 'proximo') return false
      return coincide(busqueda, i.nombre, i.categoria, i.notas)
    },
    [estados, vista, busqueda]
  )
  const matrices = useMemo(
    () => matricesDePrendas(prendas.filter((p) => p.talles.some((t) => coincideItem(t.item)))),
    [prendas, coincideItem]
  )
  const sueltosVisibles = useMemo(() => ordenarPorUrgencia(sueltos.filter(coincideItem), estadoDe), [sueltos, coincideItem, estadoDe])

  // ── acciones ────────────────────────────────────────────────────────────
  const refrescar = useCallback(() => {
    pendienteRefresh.current = false
    router.refresh()
  }, [router])

  const cambiarPestana = useCallback((p: PestanaStock) => {
    setPestana(p)
    try {
      const url = new URL(window.location.href)
      if (p === 'inventario') url.searchParams.delete('tab')
      else url.searchParams.set('tab', p)
      window.history.replaceState(null, '', url)
    } catch { /* la URL es cosmética: la pestaña ya cambió */ }
  }, [])

  const verMovimientos = useCallback((tipo: TipoMovimiento | null) => {
    setTipoMovsInicial(tipo)
    setMovsSeq((n) => n + 1)
    cambiarPestana('movimientos')
  }, [cambiarPestana])

  /**
   * Abre el panel de movimientos. Siempre con el id de un ítem REAL (el ajuste escribe
   * la diferencia contra su stock). Si ya hay una entrega/ingreso abierto del mismo
   * tipo, el ítem se SUMA como una línea más (armar un kit tocando celdas).
   */
  const abrirMovimiento = useCallback((tipo: TipoMovimiento, itemId = '') => {
    if (panel?.clase === 'mov') {
      const ctl = controlRef.current
      if (ctl && ctl.tipo() === tipo) {
        if (!itemId || tipo === 'ajuste') {
          if (itemId) ctl.agregar(tipo, itemId)
          setScrollSeq((n) => n + 1)
          return
        }
        if (ctl.agregar(tipo, itemId)) {
          // Sin saltar al panel: se puede seguir armando el kit tocando celdas.
          const nombre = itemsPorId.get(itemId)?.nombre ?? 'ítem'
          toast(`Sumado ${tipo === 'consumo' ? 'a la entrega' : 'al ingreso'}: ${nombre}`)
          return
        }
      }
      if (ctl?.tieneCambios() && !confirm('Hay una carga sin registrar en el panel. ¿Descartarla?')) return
    }
    seqRef.current += 1
    setPanel({ clase: 'mov', tipo, itemId, seq: seqRef.current })
  }, [panel, itemsPorId])

  const abrirItem = useCallback((editando: StockItem | null) => {
    if (panel?.clase === 'mov' && controlRef.current?.tieneCambios() && !confirm('Hay una carga sin registrar en el panel. ¿Descartarla?')) return
    if (panel?.clase === 'mov' && pendienteRefresh.current) refrescar()
    seqRef.current += 1
    setPanel({ clase: 'item', editando, seq: seqRef.current })
  }, [panel, refrescar])

  const cerrarPanel = useCallback(() => {
    setPanel(null)
    // Un solo refresh por tanda de carga, al terminar.
    if (pendienteRefresh.current) refrescar()
  }, [refrescar])

  const onRegistrados = useCallback((nuevos: StockMovimiento[]) => {
    setMovs((prev) => [...nuevos, ...prev])
    pendienteRefresh.current = true
  }, [])

  const onItemGuardado = useCallback((item: StockItem, nuevosMovs: StockMovimiento[], esNuevo: boolean) => {
    setItems((prev) => (esNuevo ? [...prev, item].sort(compararItems) : prev.map((i) => (i.id === item.id ? item : i))))
    if (nuevosMovs.length > 0) setMovs((prev) => [...nuevosMovs, ...prev])
    setPanel(null)
    refrescar()
  }, [refrescar])

  const toggleArchivar = useCallback(async (it: StockItem) => {
    if (saving) return
    const activo = it.activo === false
    setSaving(true)
    const { error } = await supabase.from('stock_items').update({ activo, updated_at: new Date().toISOString() }).eq('id', it.id)
    setSaving(false)
    if (error) return toast.error(mensajeError(error, 'cambiar el estado del ítem'))
    setItems((prev) => prev.map((i) => (i.id === it.id ? { ...i, activo } : i)))
    toast.success(activo ? 'Ítem restaurado.' : 'Ítem archivado. Conserva su historial.')
    refrescar()
  }, [saving, supabase, refrescar])

  const eliminarItem = useCallback(async (it: StockItem) => {
    if (saving) return
    const n = stock.get(it.id)?.movimientos ?? 0
    const aviso = n > 0
      ? `¿Eliminar "${it.nombre}" y sus ${n} movimiento(s)? Se pierde el historial. Si querés conservarlo, archivalo en vez de eliminarlo.`
      : `¿Eliminar "${it.nombre}"?`
    if (!confirm(aviso)) return
    setSaving(true)
    const { error } = await supabase.from('stock_items').delete().eq('id', it.id)
    setSaving(false)
    if (error) return toast.error(mensajeError(error, 'eliminar el ítem'))
    setItems((prev) => prev.filter((i) => i.id !== it.id))
    setMovs((prev) => prev.filter((m) => m.item_id !== it.id))
    setAbierto((a) => (a === it.id ? null : a))
    toast.success('Ítem eliminado.')
    refrescar()
  }, [saving, stock, supabase, refrescar])

  const eliminarMovimiento = useCallback(async (m: StockMovimiento) => {
    if (saving) return
    if (!confirm('¿Eliminar este movimiento? El stock se recalcula sin él.')) return
    setSaving(true)
    const { error } = await supabase.from('stock_movimientos').delete().eq('id', m.id)
    setSaving(false)
    if (error) return toast.error(mensajeError(error, 'eliminar el movimiento'))
    setMovs((prev) => prev.filter((x) => x.id !== m.id))
    toast.success('Movimiento eliminado.')
    refrescar()
  }, [saving, supabase, refrescar])

  const acciones = useMemo<AccionesItem>(() => ({
    movimiento: abrirMovimiento,
    editar: abrirItem,
    archivar: (it) => void toggleArchivar(it),
    eliminar: (it) => void eliminarItem(it),
    eliminarMovimiento: (m) => void eliminarMovimiento(m),
  }), [abrirMovimiento, abrirItem, toggleArchivar, eliminarItem, eliminarMovimiento])

  const datos = { stock, estados, movsPorItem, canEdit, abierto, onAbrir: setAbierto, acciones }
  const hayVisibles = matrices.length > 0 || sueltosVisibles.length > 0
  const filtrando = !!busqueda.trim() || vista !== 'todo'

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6 lg:p-8">
      {/* ── Header ── */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Stock</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {activos.length} {activos.length === 1 ? 'ítem' : 'ítems'} · {empresa.nombre}
          </p>
        </div>
        {canEdit && (
          <div className="flex flex-wrap items-center gap-2">
            <button onClick={() => abrirItem(null)} className={btnOutline}>
              <Plus className="size-4" strokeWidth={1.75} />
              Nuevo ítem
            </button>
            <button onClick={() => abrirMovimiento('compra')} className={btnOutline} disabled={activos.length === 0}>
              <PackagePlus className="size-4" strokeWidth={1.75} />
              Registrar ingreso
            </button>
            {/* Lo que más se hace: entregar EPP y ropa (3 entregas por cada compra). */}
            <button onClick={() => abrirMovimiento('consumo')} className={btnPrimary} disabled={activos.length === 0}>
              <PackageMinus className="size-4" strokeWidth={1.75} />
              Registrar entrega
            </button>
          </div>
        )}
      </div>

      {/* ── KPIs ── */}
      <section className="rounded-2xl border border-border bg-card p-5 sm:p-6">
        <div className="grid grid-cols-2 gap-y-5 sm:grid-cols-4 sm:divide-x sm:divide-border">
          <div className="sm:pr-6">
            <p className="text-3xl font-semibold tabular-nums">{activos.length}</p>
            <p className="mt-0.5 text-sm text-muted-foreground">Ítems activos</p>
            <p className="text-xs text-muted-foreground">{items.length - activos.length} archivados</p>
          </div>
          <button onClick={() => { cambiarPestana('inventario'); setVista('sin_stock') }} className="text-left sm:px-6">
            <p className={clsx('text-3xl font-semibold tabular-nums', kpis.sinStock > 0 && 'text-danger')}>{kpis.sinStock}</p>
            <p className="mt-0.5 text-sm text-muted-foreground">Sin stock</p>
            <p className="text-xs text-muted-foreground">
              {kpis.enCeroSinMinimo > 0 ? `+${kpis.enCeroSinMinimo} en cero sin mínimo` : 'hay que comprar'}
            </p>
          </button>
          <button onClick={() => { cambiarPestana('inventario'); setVista('bajo_minimo') }} className="text-left sm:px-6">
            <p className={clsx('text-3xl font-semibold tabular-nums', kpis.bajoMinimo > 0 && 'text-warning')}>{kpis.bajoMinimo}</p>
            <p className="mt-0.5 text-sm text-muted-foreground">Bajo mínimo</p>
            <p className="text-xs text-muted-foreground">conviene reponer</p>
          </button>
          <button onClick={() => verMovimientos('consumo')} className="text-left sm:pl-6">
            <p className="text-3xl font-semibold tabular-nums">{entregasMes}</p>
            <p className="mt-0.5 text-sm text-muted-foreground">Entregas este mes</p>
            <p className="text-xs text-muted-foreground">
              {compras.compras} {compras.compras === 1 ? 'ingreso' : 'ingresos'}
              {compras.total > 0 && ` · ${fmtMoneda(compras.total)}`}
              {compras.sinPrecio > 0 && compras.total > 0 && ` · ${compras.sinPrecio} sin precio`}
            </p>
          </button>
        </div>
      </section>

      <div ref={panelRef} className="scroll-mt-4">
        {canEdit && panel?.clase === 'item' && (
          <PanelItem
            key={panel.seq}
            empresa={empresa}
            editando={panel.editando}
            items={items}
            categorias={categorias}
            onGuardado={onItemGuardado}
            onCerrar={cerrarPanel}
          />
        )}
        {canEdit && panel?.clase === 'mov' && (
          <PanelMovimiento
            key={panel.seq}
            empresaId={empresa.id}
            opciones={opciones}
            destinatarios={destinatarios}
            proveedores={proveedores}
            tipoInicial={panel.tipo}
            itemInicial={panel.itemId}
            controlRef={controlRef}
            onRegistrados={onRegistrados}
            onCerrar={cerrarPanel}
          />
        )}
      </div>

      {/* ── Pestañas ── */}
      <div className="inline-flex items-center gap-1 rounded-xl bg-muted p-1">
        <button type="button" onClick={() => cambiarPestana('inventario')} className={segBtn(pestana === 'inventario')}>Inventario</button>
        <button type="button" onClick={() => { if (pestana !== 'movimientos') verMovimientos(null) }} className={segBtn(pestana === 'movimientos')}>Movimientos</button>
      </div>

      {pestana === 'movimientos' ? (
        <MovimientosTabla
          key={movsSeq}
          movimientos={movsOrdenados}
          itemsPorId={itemsPorId}
          canEdit={canEdit}
          tipoInicial={tipoMovsInicial}
          onEliminar={acciones.eliminarMovimiento}
          buscadorRef={buscadorRef}
        />
      ) : (
        <>
          {/* ── Hay que comprar: lo accionable, antes del inventario ── */}
          {vista === 'todo' && !busqueda && porComprar.length > 0 && (
            <section className="rounded-2xl border border-border bg-card p-5 sm:p-6">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold tracking-tight">Hay que comprar</h2>
                  <p className="text-sm text-muted-foreground">Ordenado por urgencia</p>
                </div>
                {porComprar.length > 6 && (
                  <button onClick={() => setVista('reponer')} className="text-xs font-medium text-primary hover:underline">
                    Ver los {porComprar.length}
                  </button>
                )}
              </div>
              <div className="mt-4 space-y-2">
                {porComprar.slice(0, 6).map((it) => {
                  const s = stock.get(it.id)
                  const estado = estadoDe(it)
                  const ultimo = ultimoPorItem.get(it.id)
                  return (
                    <div key={it.id} className="flex items-center gap-4 rounded-xl border border-border px-4 py-2.5">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{it.nombre}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {[
                            chips.length > 1 ? categoriaDe(it) : null,
                            textoMinimo(it.stock_minimo, it.unidad),
                            ultimo ? `último: ${fmtFechaAR(ultimo.fecha)} · ${describirMovimiento(ultimo)}` : 'sin movimientos',
                          ].filter(Boolean).join(' · ')}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className={clsx('text-sm font-semibold tabular-nums', estado === 'vencido' ? 'text-danger' : 'text-warning')}>
                          {fmtCantidad(s?.stock ?? 0, it.unidad)}
                        </p>
                        <EstadoPill estado={estado} label={ESTADO_STOCK_LABEL[estado]} />
                      </div>
                      {canEdit && (
                        <button onClick={() => abrirMovimiento('compra', it.id)} className={btnFila + ' shrink-0'}>
                          Registrar ingreso
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
            </section>
          )}

          {/* ── Filtros ── */}
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative min-w-[220px] flex-1 sm:max-w-xs">
                <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" strokeWidth={1.75} />
                <input
                  ref={buscadorRef}
                  type="search"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Buscar ítem…  ( / )"
                  className={clsx(inputCls, 'pl-9')}
                />
              </div>
              <div className="inline-flex items-center gap-1 rounded-xl bg-muted p-1">
                {([
                  { key: 'todo' as Vista, label: 'Todo' },
                  { key: 'reponer' as Vista, label: porComprar.length > 0 ? `Hay que comprar (${porComprar.length})` : 'Hay que comprar' },
                  { key: 'archivados' as Vista, label: 'Archivados' },
                ]).map((v) => {
                  const activa = v.key === 'reponer' ? VISTAS_REPONER.includes(vista) : vista === v.key
                  return (
                    <button key={v.key} onClick={() => setVista(v.key)} className={segBtn(activa)}>
                      {v.label}
                    </button>
                  )
                })}
              </div>
              {/* Los KPIs entran a un subconjunto de "hay que comprar": que se vea cuál. */}
              {(vista === 'sin_stock' || vista === 'bajo_minimo') && (
                <button
                  onClick={() => setVista('reponer')}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
                >
                  solo {vista === 'sin_stock' ? 'sin stock' : 'bajo mínimo'}
                  <X className="size-3.5" strokeWidth={1.75} />
                </button>
              )}
            </div>
            {/* La categoría es un filtro, no un encabezado intercalado. Con una sola, no hay nada que elegir. */}
            {chips.length > 1 && (
              <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Filtrar por categoría">
                {[null, ...chips].map((c) => (
                  <button
                    key={c ?? 'todas'}
                    type="button"
                    onClick={() => setCategoria(c)}
                    aria-pressed={categoriaActiva === c}
                    className={clsx(
                      'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                      categoriaActiva === c
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border bg-card text-muted-foreground hover:text-foreground'
                    )}
                  >
                    {c ?? 'Todas'}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* ── Inventario: ropa por talle (matriz) + el resto (tabla plana) ── */}
          {!hayVisibles ? (
            <div className="rounded-2xl border border-dashed border-border px-6 py-12 text-center text-sm text-muted-foreground">
              {items.length === 0 ? (
                <>
                  <Boxes className="mx-auto mb-3 size-8 text-muted-foreground/50" strokeWidth={1.5} />
                  Todavía no hay ítems en el stock de {empresa.nombre}.{' '}
                  {canEdit && <button onClick={() => abrirItem(null)} className="text-primary hover:underline">Creá el primero</button>}
                </>
              ) : vista === 'archivados' && itemsDeVista.length === 0 ? 'No hay ítems archivados.' : 'Ningún ítem coincide con los filtros.'}
            </div>
          ) : (
            <div className="space-y-6">
              {matrices.length > 0 && (
                <section className="space-y-2">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <h2 className="text-sm font-semibold text-foreground">Ropa por talle</h2>
                    <p className="text-xs text-muted-foreground">
                      Cada número es el stock de ese talle
                      <span className="text-danger"> · rojo: sin stock</span>
                      <span className="text-warning"> · naranja: en el mínimo</span>
                      {canEdit && ' · tocá uno para entregar, ingresar o contar'}
                      {filtrando && ' · lo que no coincide queda atenuado'}
                    </p>
                  </div>
                  {matrices.map((m) => (
                    <MatrizTalles key={m.sistema} {...m} coincideItem={coincideItem} {...datos} />
                  ))}
                </section>
              )}
              {sueltosVisibles.length > 0 && (
                <section className="space-y-2">
                  {matrices.length > 0 && <h2 className="text-sm font-semibold text-foreground">Otros ítems</h2>}
                  <TablaItems items={sueltosVisibles} ultimoPorItem={ultimoPorItem} {...datos} />
                </section>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}
