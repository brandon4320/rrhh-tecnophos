'use client'

import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import clsx from 'clsx'
import {
  Archive, ArchiveRestore, Boxes, ChevronRight, ClipboardCheck, History, PackageMinus,
  PackagePlus, Pencil, Plus, Search, ShoppingCart, Trash2, X,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { EstadoPill } from '@/components/ui/estado-pill'
import type { StockItem, StockMovimiento } from '@/types'
import {
  ESTADO_STOCK_LABEL, SIN_CATEGORIA, TIPO_MOVIMIENTO_LABEL, UNIDADES_SUGERIDAS, agruparCatalogo, calcularStock,
  categoriasDe, compararItems, comprasDelMes, estadoStock, fmtCantidad, fmtMoneda, hoyClave, mesClave,
  normalizarNombre, parseCantidad, sumarStock, type TipoMovimiento,
} from '@/modules/stock/reglas'
import { fmtFechaAR } from '@/lib/fechas-ar'

interface Props {
  empresa: { id: string; nombre: string; slug: string }
  items: StockItem[]
  movimientos: StockMovimiento[]
  canEdit: boolean
}

const inputCls =
  'w-full px-3.5 py-2.5 rounded-lg border border-input bg-card text-sm focus:outline-none focus:ring-2 focus:ring-ring'
const labelCls = 'mb-1 block text-xs font-medium text-foreground'
const btnPrimary =
  'inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50'
const btnOutline =
  'inline-flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground'
const btnMini = 'inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition-colors'
const btnFila =
  'inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-card hover:text-foreground'
const thCls = 'px-3 py-2.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground'

// Hoy en hora Argentina (toISOString() sería UTC: a las 22:00 AR ya es "mañana").
const hoyISO = () => hoyClave()

// Mínimo 1 por defecto (criterio acordado el 10/09/2026: avisar cuando queda la última unidad).
const ITEM_VACIO = { nombre: '', categoria: '', unidad: 'unidad', stock_minimo: '1', notas: '', stock_inicial: '' }
const MOV_VACIO = { item_id: '', tipo: 'compra' as TipoMovimiento, cantidad: '', nuevo_stock: '', fecha: hoyISO(), proveedor: '', precio_unitario: '', comprobante: '', notas: '' }

/** Vista de la lista. Los tres estados de reposición son excluyentes con "archivados". */
type Vista = 'todo' | 'reponer' | 'sin_stock' | 'bajo_minimo' | 'archivados'
const VISTAS_REPONER: Vista[] = ['reponer', 'sin_stock', 'bajo_minimo']

/**
 * Stock de una empresa: catálogo de ítems (CRUD) + libro de movimientos.
 * El stock actual se calcula (compra +, consumo −, ajuste ±), nunca se tipea.
 * Mutaciones directas con el cliente de Supabase (la RLS stock_*_rrhh_all decide);
 * el estado local se actualiza con la fila que devuelve el server (nunca antes:
 * si el insert falla, el número en pantalla no miente) + router.refresh() y toasts.
 */
export default function StockClient({ empresa, items: initItems, movimientos: initMovs, canEdit }: Props) {
  const supabase = createClient()
  const router = useRouter()
  const [items, setItems] = useState(initItems)
  const [movs, setMovs] = useState(initMovs)

  // filtros
  const [q, setQ] = useState('')
  const [vista, setVista] = useState<Vista>('todo')
  const [abierto, setAbierto] = useState<string | null>(null)

  // formularios
  const [panel, setPanel] = useState<'item' | 'mov' | null>(null)
  const [panelSeq, setPanelSeq] = useState(0)
  const [editandoId, setEditandoId] = useState<string | null>(null)
  const [fItem, setFItem] = useState(ITEM_VACIO)
  const [fMov, setFMov] = useState(MOV_VACIO)
  const [saving, setSaving] = useState(false)
  const [cargados, setCargados] = useState(0)
  const panelRef = useRef<HTMLDivElement>(null)
  const itemSelectRef = useRef<HTMLSelectElement>(null)
  const buscadorRef = useRef<HTMLInputElement>(null)

  // El panel vive arriba de la lista: sin esto, tocar el + de un ítem que está a
  // mitad de scroll abría el formulario fuera de la pantalla y no pasaba nada visible.
  useEffect(() => {
    if (panel) panelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [panel, panelSeq])

  // "/" enfoca el buscador (atajo local a esta pantalla, no global).
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

  // OJO: calcularStock recibe SIEMPRE el catálogo completo. Si se alimentara con la
  // lista filtrada, los ítems ocultos perderían su stock.
  const stock = useMemo(() => calcularStock(items, movs), [items, movs])
  const categorias = useMemo(() => categoriasDe(items), [items]) // alimenta el datalist del alta
  const movsPorItem = useMemo(() => {
    const m = new Map<string, StockMovimiento[]>()
    for (const mov of movs) {
      const arr = m.get(mov.item_id)
      if (arr) arr.push(mov)
      else m.set(mov.item_id, [mov])
    }
    return m
  }, [movs])
  const proveedores = useMemo(
    () => [...new Set(movs.map((m) => (m.proveedor ?? '').trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'es')),
    [movs]
  )
  const mes = mesClave()
  const compras = useMemo(() => comprasDelMes(movs, mes), [movs, mes])

  const estadoDe = (i: StockItem) => estadoStock(stock.get(i.id)?.stock ?? 0, i.stock_minimo)

  const activos = items.filter((i) => i.activo !== false)
  const sinStock = activos.filter((i) => estadoDe(i) === 'vencido').length
  const bajoMinimo = activos.filter((i) => estadoDe(i) === 'proximo').length
  // Sin mínimo definido no entran en "hay que comprar" (es EPP que la empresa no
  // maneja), pero están vacíos: si no se cuentan acá, no aparecen en ningún lado.
  const enCeroSinMinimo = activos.filter((i) => estadoDe(i) === 'sin_fecha').length

  // Lo accionable, ordenado por urgencia real: primero lo que está en cero, y
  // dentro de cada estado, lo que quedó más por debajo de su mínimo.
  const porComprar = useMemo(
    () =>
      activos
        .filter((i) => ['vencido', 'proximo'].includes(estadoDe(i)))
        .sort((a, b) => {
          const ea = estadoDe(a), eb = estadoDe(b)
          if (ea !== eb) return ea === 'vencido' ? -1 : 1
          const sa = stock.get(a.id)?.stock ?? 0, sb = stock.get(b.id)?.stock ?? 0
          const fa = a.stock_minimo ? sa / a.stock_minimo : 1
          const fb = b.stock_minimo ? sb / b.stock_minimo : 1
          return fa - fb || a.nombre.localeCompare(b.nombre, 'es')
        }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [activos, stock]
  )

  const visibles = items.filter((i) => {
    if (vista === 'archivados') { if (i.activo !== false) return false }
    else if (i.activo === false) return false
    const e = estadoDe(i)
    if (vista === 'reponer' && !['vencido', 'proximo'].includes(e)) return false
    if (vista === 'sin_stock' && e !== 'vencido') return false
    if (vista === 'bajo_minimo' && e !== 'proximo') return false
    if (q && !`${i.nombre} ${i.categoria ?? ''} ${i.notas ?? ''}`.toLowerCase().includes(q.toLowerCase())) return false
    return true
  })

  const grupos = useMemo(
    () => agruparCatalogo(visibles, estadoDe),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [visibles, stock]
  )

  // ── helpers de formularios ──────────────────────────────────────────────
  function abrirNuevoItem() {
    setEditandoId(null)
    setFItem(ITEM_VACIO)
    setPanel('item')
    setPanelSeq((n) => n + 1)
  }
  function abrirEditarItem(it: StockItem) {
    setEditandoId(it.id)
    setFItem({
      nombre: it.nombre, categoria: it.categoria ?? '', unidad: it.unidad ?? 'unidad',
      stock_minimo: it.stock_minimo != null ? String(it.stock_minimo) : '', notas: it.notas ?? '', stock_inicial: '',
    })
    setPanel('item')
    setPanelSeq((n) => n + 1)
  }
  /** Siempre con el id de un ítem REAL: el ajuste escribe la diferencia contra su stock. */
  function abrirMovimiento(tipo: TipoMovimiento, itemId = '') {
    setFMov({ ...MOV_VACIO, tipo, item_id: itemId, fecha: hoyISO() })
    setCargados(0)
    setPanel('mov')
    setPanelSeq((n) => n + 1)
  }
  function cerrar() {
    setPanel(null)
    setEditandoId(null)
    setFItem(ITEM_VACIO)
    setFMov(MOV_VACIO)
    setCargados(0)
  }
  /**
   * Tras guardar, el panel queda abierto para el siguiente ítem del mismo remito:
   * se limpia la línea (ítem, cantidad, precio) y se conserva el encabezado
   * (tipo, fecha, proveedor, comprobante), que es lo que se re-tipeaba cada vez.
   */
  function siguienteMovimiento() {
    setFMov((f) => ({ ...f, item_id: '', cantidad: '', nuevo_stock: '', precio_unitario: '', notas: '' }))
    itemSelectRef.current?.focus()
  }

  // ── ítems: crear / editar / archivar / eliminar ─────────────────────────
  async function guardarItem() {
    const nombre = normalizarNombre(fItem.nombre)
    if (!nombre) return toast.error('El nombre del ítem es obligatorio.')
    const minimo = fItem.stock_minimo.trim() ? parseCantidad(fItem.stock_minimo) : 0
    if (minimo == null || minimo < 0) return toast.error('El stock mínimo tiene que ser un número (0 = sin alerta).')
    const inicial = fItem.stock_inicial.trim() ? parseCantidad(fItem.stock_inicial) : null
    if (fItem.stock_inicial.trim() && (inicial == null || inicial < 0)) return toast.error('El stock inicial tiene que ser un número.')
    const duplicado = items.find((i) => i.id !== editandoId && i.nombre.toLowerCase() === nombre.toLowerCase())
    if (duplicado) return toast.error(`Ya existe un ítem llamado "${duplicado.nombre}".`)

    setSaving(true)
    const payload = {
      nombre, categoria: normalizarNombre(fItem.categoria) || null, unidad: normalizarNombre(fItem.unidad) || 'unidad',
      stock_minimo: minimo, notas: fItem.notas.trim() || null,
    }
    // 23505 = ya existe un ítem con ese nombre en la empresa (otro usuario lo creó, o el estado local está viejo).
    const yaExiste = (e: { code?: string } | null) => e?.code === '23505'
    if (editandoId) {
      const { data, error } = await supabase
        .from('stock_items').update({ ...payload, updated_at: new Date().toISOString() }).eq('id', editandoId).select().single()
      setSaving(false)
      if (yaExiste(error)) return toast.error(`Ya existe un ítem llamado "${nombre}" en ${empresa.nombre}. Recargá la página.`)
      if (error || !data) return toast.error(`No se pudo guardar el ítem. ${error?.message ?? ''}`)
      setItems((prev) => prev.map((i) => (i.id === editandoId ? data : i)))
      toast.success('Ítem actualizado.')
    } else {
      const { data, error } = await supabase
        .from('stock_items').insert({ ...payload, empresa_id: empresa.id }).select().single()
      if (error || !data) {
        setSaving(false)
        if (yaExiste(error)) return toast.error(`Ya existe un ítem llamado "${nombre}" en ${empresa.nombre}. Recargá la página.`)
        return toast.error(`No se pudo crear el ítem. ${error?.message ?? ''}`)
      }
      let nuevosMovs: StockMovimiento[] = []
      if (inicial && inicial > 0) {
        const { data: m, error: e2 } = await supabase
          .from('stock_movimientos')
          .insert({ item_id: data.id, empresa_id: empresa.id, tipo: 'ajuste', cantidad: inicial, fecha: hoyISO(), notas: 'Stock inicial' })
          .select().single()
        if (e2 || !m) toast.error('El ítem se creó pero no se pudo registrar el stock inicial.')
        else nuevosMovs = [m]
      }
      setSaving(false)
      setItems((prev) => [...prev, data].sort(compararItems))
      setMovs((prev) => [...nuevosMovs, ...prev])
      toast.success(`Ítem "${data.nombre}" creado.`)
    }
    cerrar()
    router.refresh()
  }

  async function toggleArchivar(it: StockItem) {
    if (saving) return
    const activo = it.activo === false
    setSaving(true)
    const { error } = await supabase.from('stock_items').update({ activo, updated_at: new Date().toISOString() }).eq('id', it.id)
    setSaving(false)
    if (error) return toast.error(`No se pudo cambiar el estado del ítem. ${error.message}`)
    setItems((prev) => prev.map((i) => (i.id === it.id ? { ...i, activo } : i)))
    toast.success(activo ? 'Ítem restaurado.' : 'Ítem archivado. Conserva su historial.')
    router.refresh()
  }

  async function eliminarItem(it: StockItem) {
    if (saving) return
    const n = stock.get(it.id)?.movimientos ?? 0
    const aviso = n > 0
      ? `¿Eliminar "${it.nombre}" y sus ${n} movimiento(s)? Se pierde el historial. Si querés conservarlo, archivalo en vez de eliminarlo.`
      : `¿Eliminar "${it.nombre}"?`
    if (!confirm(aviso)) return
    setSaving(true)
    const { error } = await supabase.from('stock_items').delete().eq('id', it.id)
    setSaving(false)
    if (error) return toast.error(`No se pudo eliminar el ítem. ${error.message}`)
    setItems((prev) => prev.filter((i) => i.id !== it.id))
    setMovs((prev) => prev.filter((m) => m.item_id !== it.id))
    if (abierto === it.id) setAbierto(null)
    toast.success('Ítem eliminado.')
    router.refresh()
  }

  // ── movimientos: registrar / eliminar ───────────────────────────────────
  async function guardarMovimiento() {
    const it = items.find((i) => i.id === fMov.item_id)
    if (!it) return toast.error('Elegí el ítem.')
    if (!fMov.fecha) return toast.error('La fecha es obligatoria.')
    let cantidad: number | null
    let notasExtra = ''
    if (fMov.tipo === 'ajuste') {
      const nuevo = parseCantidad(fMov.nuevo_stock)
      if (nuevo == null || nuevo < 0) return toast.error('Ingresá el stock real contado (número ≥ 0).')
      // El ajuste guarda la DIFERENCIA contra el stock actual: se calcula con los
      // movimientos FRESCOS del ítem, no con el estado de esta pestaña (otro usuario
      // pudo haber registrado algo desde que se abrió la página).
      setSaving(true)
      const { data: frescos, error: eFrescos } = await supabase
        .from('stock_movimientos').select('tipo, cantidad').eq('item_id', it.id)
      setSaving(false)
      if (eFrescos) return toast.error(`No se pudo leer el stock actual: ${eFrescos.message}`)
      const actual = sumarStock(frescos ?? [])
      cantidad = Math.round((nuevo - actual) * 100) / 100
      if (cantidad === 0) return toast.error(`El stock contado (${fmtCantidad(nuevo, it.unidad)}) es igual al actual: no hay nada que ajustar.`)
      // Queda registrado lo que se contó, no solo la diferencia (auditable a mano).
      notasExtra = `Conteo: ${fmtCantidad(nuevo, it.unidad)} (había ${fmtCantidad(actual, it.unidad)})`
    } else {
      cantidad = parseCantidad(fMov.cantidad)
      if (cantidad == null || cantidad <= 0) return toast.error('La cantidad tiene que ser mayor a 0.')
      if (fMov.tipo === 'consumo' && cantidad > (stock.get(it.id)?.stock ?? 0)) {
        if (!confirm(`Estás registrando un consumo de ${fmtCantidad(cantidad, it.unidad)} y el stock actual es ${fmtCantidad(stock.get(it.id)?.stock ?? 0, it.unidad)}. ¿Registrar igual? (el stock quedaría negativo)`)) return
      }
    }
    let precio: number | null = null
    if (fMov.tipo === 'compra' && fMov.precio_unitario.trim()) {
      precio = parseCantidad(fMov.precio_unitario)
      if (precio == null || precio < 0) return toast.error('El precio unitario tiene que ser un número.')
    }

    setSaving(true)
    const { data, error } = await supabase
      .from('stock_movimientos')
      .insert({
        item_id: it.id, empresa_id: empresa.id, tipo: fMov.tipo, cantidad, fecha: fMov.fecha,
        proveedor: fMov.tipo === 'compra' ? normalizarNombre(fMov.proveedor) || null : null,
        precio_unitario: precio,
        comprobante: fMov.tipo === 'compra' ? fMov.comprobante.trim() || null : null,
        notas: [fMov.notas.trim(), notasExtra].filter(Boolean).join(' · ') || null,
      })
      .select().single()
    setSaving(false)
    if (error || !data) return toast.error(`No se pudo registrar el movimiento. ${error?.message ?? ''}`)
    setMovs((prev) => [data, ...prev])
    const verbo = fMov.tipo === 'compra' ? 'Compra registrada' : fMov.tipo === 'consumo' ? 'Consumo registrado' : 'Stock ajustado'
    toast.success(`${verbo}: ${it.nombre}.`)
    setCargados((n) => n + 1)
    siguienteMovimiento()
    router.refresh()
  }

  async function eliminarMovimiento(m: StockMovimiento) {
    if (saving) return
    if (!confirm('¿Eliminar este movimiento? El stock se recalcula sin él.')) return
    setSaving(true)
    const { error } = await supabase.from('stock_movimientos').delete().eq('id', m.id)
    setSaving(false)
    if (error) return toast.error(`No se pudo eliminar el movimiento. ${error.message}`)
    setMovs((prev) => prev.filter((x) => x.id !== m.id))
    toast.success('Movimiento eliminado.')
    router.refresh()
  }

  const itemMov = items.find((i) => i.id === fMov.item_id)

  /**
   * Una fila del catálogo. `variante` la usa una familia: ahí el identificador es
   * el talle. Es una función que devuelve JSX, no un componente anidado: como
   * componente, React lo remontaría en cada render del padre.
   */
  function filaItem(it: StockItem, variante?: string) {
    const s = stock.get(it.id) ?? { stock: 0, movimientos: 0, ultimaCompra: null, valorizado: null }
    const estado = estadoDe(it)
    const isOpen = abierto === it.id
    const historial = movsPorItem.get(it.id) ?? []

    return (
      <Fragment key={it.id}>
        <tr
          onClick={() => setAbierto(isOpen ? null : it.id)}
          className={clsx('cursor-pointer transition-colors hover:bg-accent', it.activo === false && 'opacity-60')}
        >
          <td className="px-4 py-2">
            <div className={clsx('flex min-w-0 items-center gap-2', variante && 'pl-5')}>
              <ChevronRight
                className={clsx('size-3.5 shrink-0 text-muted-foreground/60 transition-transform', isOpen && 'rotate-90')}
                strokeWidth={2}
              />
              <span className="truncate font-medium text-foreground" title={it.notas ?? it.nombre}>
                {variante ? `Talle ${variante}` : it.nombre}
              </span>
              {it.activo === false && (
                <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">archivado</span>
              )}
            </div>
          </td>
          <td className="px-3 py-2 text-right tabular-nums">
            <span className={clsx('text-sm font-semibold', estado === 'vencido' && 'text-danger', estado === 'proximo' && 'text-warning')}>
              {fmtCantidad(s.stock)}
            </span>
            {it.unidad && <span className="ml-1 text-[10px] text-muted-foreground">{it.unidad}</span>}
            {!!it.stock_minimo && <span className="ml-2 text-[11px] text-muted-foreground">mín. {fmtCantidad(it.stock_minimo)}</span>}
          </td>
          <td className="px-3 py-2">
            <EstadoPill estado={estado} label={ESTADO_STOCK_LABEL[estado]} />
          </td>
          <td className="px-3 py-2 text-right text-xs tabular-nums text-muted-foreground">
            {s.ultimaCompra ? fmtFechaAR(s.ultimaCompra.fecha) : '—'}
          </td>
          <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
            {canEdit && it.activo !== false && (
              <div className="flex items-center justify-end gap-1">
                <button
                  onClick={() => abrirMovimiento('compra', it.id)}
                  aria-label={`Registrar entrada de ${it.nombre}`}
                  title="Entrada (compra)"
                  className={clsx(btnMini, 'text-primary hover:bg-primary/10')}
                >
                  <PackagePlus className="size-4" strokeWidth={1.75} />
                </button>
                <button
                  onClick={() => abrirMovimiento('consumo', it.id)}
                  aria-label={`Registrar salida de ${it.nombre}`}
                  title="Salida (consumo)"
                  className={clsx(btnMini, 'text-muted-foreground hover:bg-muted hover:text-foreground')}
                >
                  <PackageMinus className="size-4" strokeWidth={1.75} />
                </button>
              </div>
            )}
          </td>
        </tr>

        {isOpen && (
          <tr>
            <td colSpan={5} className="bg-muted px-4 py-3">
              {canEdit && (
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  {it.activo !== false && (
                    <button onClick={() => abrirMovimiento('ajuste', it.id)} className={btnFila}>
                      <ClipboardCheck className="size-3.5" strokeWidth={1.75} />
                      Ajustar por conteo
                    </button>
                  )}
                  <button onClick={() => abrirEditarItem(it)} className={btnFila}>
                    <Pencil className="size-3.5" strokeWidth={1.75} />
                    Editar ítem
                  </button>
                  <button onClick={() => toggleArchivar(it)} className={btnFila}>
                    {it.activo === false ? <ArchiveRestore className="size-3.5" strokeWidth={1.75} /> : <Archive className="size-3.5" strokeWidth={1.75} />}
                    {it.activo === false ? 'Restaurar' : 'Archivar'}
                  </button>
                  <button
                    onClick={() => eliminarItem(it)}
                    className={clsx(btnFila, 'ml-auto border-transparent text-danger/70 hover:bg-danger-subtle hover:text-danger')}
                  >
                    <Trash2 className="size-3.5" strokeWidth={1.75} />
                    Eliminar
                  </button>
                </div>
              )}

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
                    const delta = m.tipo === 'compra' ? m.cantidad : m.tipo === 'consumo' ? -m.cantidad : m.cantidad
                    return (
                      <li key={m.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                        <span className="w-16 shrink-0 text-xs tabular-nums text-muted-foreground">{fmtFechaAR(m.fecha)}</span>
                        <span className="w-16 shrink-0 text-xs text-muted-foreground">{TIPO_MOVIMIENTO_LABEL[m.tipo as TipoMovimiento] ?? m.tipo}</span>
                        <span className={clsx('w-24 shrink-0 text-right font-medium tabular-nums', delta < 0 ? 'text-danger' : 'text-success')}>
                          {delta > 0 ? '+' : ''}{fmtCantidad(delta)}
                        </span>
                        <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
                          {[
                            m.precio_unitario != null ? `${fmtMoneda(m.precio_unitario)}/${it.unidad}` : null,
                            m.precio_unitario != null ? `total ${fmtMoneda(m.precio_unitario * Math.abs(m.cantidad))}` : null,
                            m.proveedor, m.comprobante ? `comp. ${m.comprobante}` : null, m.notas,
                          ].filter(Boolean).join(' · ')}
                        </span>
                        {canEdit && (
                          <button onClick={() => eliminarMovimiento(m)} title="Eliminar movimiento" className="text-danger/60 hover:text-danger">
                            <Trash2 className="size-3.5" strokeWidth={1.75} />
                          </button>
                        )}
                      </li>
                    )
                  })}
                  {historial.length > 30 && (
                    <li className="px-4 py-2 text-center text-xs text-muted-foreground">… y {historial.length - 30} más</li>
                  )}
                </ul>
              )}
            </td>
          </tr>
        )}
      </Fragment>
    )
  }

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
            <button onClick={abrirNuevoItem} className={btnOutline}>
              <Plus className="size-4" strokeWidth={2} />
              Nuevo ítem
            </button>
            <button onClick={() => abrirMovimiento('compra')} className={btnPrimary} disabled={activos.length === 0}>
              <ShoppingCart className="size-4" strokeWidth={2} />
              Registrar compra
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
          <button onClick={() => setVista('sin_stock')} className="text-left sm:px-6">
            <p className={clsx('text-3xl font-semibold tabular-nums', sinStock > 0 && 'text-danger')}>{sinStock}</p>
            <p className="mt-0.5 text-sm text-muted-foreground">Sin stock</p>
            <p className="text-xs text-muted-foreground">
              {enCeroSinMinimo > 0 ? `+${enCeroSinMinimo} en cero sin mínimo` : 'hay que comprar'}
            </p>
          </button>
          <button onClick={() => setVista('bajo_minimo')} className="text-left sm:px-6">
            <p className={clsx('text-3xl font-semibold tabular-nums', bajoMinimo > 0 && 'text-warning')}>{bajoMinimo}</p>
            <p className="mt-0.5 text-sm text-muted-foreground">Bajo mínimo</p>
            <p className="text-xs text-muted-foreground">conviene reponer</p>
          </button>
          <div className="sm:pl-6">
            <p className="text-3xl font-semibold tabular-nums">{compras.compras}</p>
            <p className="mt-0.5 text-sm text-muted-foreground">Compras este mes</p>
            <p className="text-xs text-muted-foreground">
              {compras.total > 0 ? fmtMoneda(compras.total) : 'sin importes'}
              {compras.sinPrecio > 0 && ` · ${compras.sinPrecio} sin precio`}
            </p>
          </div>
        </div>
      </section>

      <div ref={panelRef} className="scroll-mt-4">
        {/* ── Panel: nuevo / editar ítem ── */}
        {canEdit && panel === 'item' && (
          <form
            onSubmit={(e) => { e.preventDefault(); guardarItem() }}
            onKeyDown={(e) => { if (e.key === 'Escape') cerrar() }}
            className="rounded-xl border border-primary/30 bg-primary/5 p-5"
          >
            <p className="mb-4 text-sm font-medium text-foreground">{editandoId ? 'Editar ítem' : 'Nuevo ítem'}</p>
            <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <div className="lg:col-span-1">
                <label className={labelCls}>Nombre *</label>
                <input type="text" value={fItem.nombre} onChange={(e) => setFItem((f) => ({ ...f, nombre: e.target.value }))} className={inputCls} placeholder="Ej: Lavandina 5 L" autoFocus />
              </div>
              <div>
                <label className={labelCls}>Categoría</label>
                <input type="text" list="stock-categorias" value={fItem.categoria} onChange={(e) => setFItem((f) => ({ ...f, categoria: e.target.value }))} className={inputCls} placeholder="Ej: EPP, Ropa, Insumos" />
                <datalist id="stock-categorias">{categorias.map((c) => <option key={c} value={c} />)}</datalist>
              </div>
              <div>
                <label className={labelCls}>Unidad</label>
                <input type="text" list="stock-unidades" value={fItem.unidad} onChange={(e) => setFItem((f) => ({ ...f, unidad: e.target.value }))} className={inputCls} />
                <datalist id="stock-unidades">{UNIDADES_SUGERIDAS.map((u) => <option key={u} value={u} />)}</datalist>
              </div>
              <div>
                <label className={labelCls}>Stock mínimo <span className="font-normal text-muted-foreground">(0 = sin alerta)</span></label>
                <input type="text" inputMode="decimal" value={fItem.stock_minimo} onChange={(e) => setFItem((f) => ({ ...f, stock_minimo: e.target.value }))} className={inputCls} placeholder="Ej: 5" />
              </div>
              {!editandoId && (
                <div>
                  <label className={labelCls}>Stock inicial <span className="font-normal text-muted-foreground">(lo que hay hoy)</span></label>
                  <input type="text" inputMode="decimal" value={fItem.stock_inicial} onChange={(e) => setFItem((f) => ({ ...f, stock_inicial: e.target.value }))} className={inputCls} placeholder="Ej: 12" />
                </div>
              )}
              <div className={editandoId ? 'sm:col-span-2' : ''}>
                <label className={labelCls}>Notas</label>
                <input type="text" value={fItem.notas} onChange={(e) => setFItem((f) => ({ ...f, notas: e.target.value }))} className={inputCls} placeholder="Marca, presentación, dónde se guarda…" />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button type="submit" disabled={saving} className={btnPrimary}>{saving ? 'Guardando...' : editandoId ? 'Guardar cambios' : 'Crear ítem'}</button>
              <button type="button" onClick={cerrar} className="px-3 py-2 text-sm text-muted-foreground hover:text-foreground">Cancelar</button>
            </div>
          </form>
        )}

        {/* ── Panel: registrar movimiento ── */}
        {canEdit && panel === 'mov' && (
          <form
            onSubmit={(e) => { e.preventDefault(); guardarMovimiento() }}
            onKeyDown={(e) => { if (e.key === 'Escape') cerrar() }}
            className="rounded-xl border border-primary/30 bg-primary/5 p-5"
          >
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm font-medium text-foreground">
                {fMov.tipo === 'compra' ? 'Registrar compra' : fMov.tipo === 'consumo' ? 'Registrar consumo' : 'Ajustar stock'}
              </p>
              <div className="inline-flex items-center gap-1 rounded-xl bg-muted p-1">
                {(['compra', 'consumo', 'ajuste'] as TipoMovimiento[]).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setFMov((f) => ({ ...f, tipo: t }))}
                    className={clsx('rounded-lg px-3 py-1.5 text-sm font-medium transition-colors', fMov.tipo === t ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground')}
                  >
                    {TIPO_MOVIMIENTO_LABEL[t]}
                  </button>
                ))}
              </div>
            </div>
            <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="lg:col-span-2">
                <label className={labelCls}>Ítem *</label>
                <select ref={itemSelectRef} value={fMov.item_id} onChange={(e) => setFMov((f) => ({ ...f, item_id: e.target.value }))} className={inputCls} autoFocus={!fMov.item_id}>
                  <option value="">Elegí un ítem…</option>
                  {[...activos].sort(compararItems).map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.nombre}{i.categoria ? ` · ${i.categoria}` : ''} — hoy {fmtCantidad(stock.get(i.id)?.stock ?? 0, i.unidad)}
                    </option>
                  ))}
                </select>
              </div>
              {fMov.tipo === 'ajuste' ? (
                <div>
                  <label className={labelCls}>Stock real contado *</label>
                  <input type="text" inputMode="decimal" value={fMov.nuevo_stock} onChange={(e) => setFMov((f) => ({ ...f, nuevo_stock: e.target.value }))} className={inputCls} placeholder={itemMov ? `actual: ${fmtCantidad(stock.get(itemMov.id)?.stock ?? 0)}` : ''} autoFocus={!!fMov.item_id} />
                  <PreviewCantidad texto={fMov.nuevo_stock} unidad={itemMov?.unidad} />
                </div>
              ) : (
                <div>
                  <label className={labelCls}>Cantidad *{itemMov ? ` (${itemMov.unidad})` : ''}</label>
                  <input type="text" inputMode="decimal" value={fMov.cantidad} onChange={(e) => setFMov((f) => ({ ...f, cantidad: e.target.value }))} className={inputCls} placeholder="Ej: 20" autoFocus={!!fMov.item_id} />
                  <PreviewCantidad texto={fMov.cantidad} unidad={itemMov?.unidad} />
                </div>
              )}
              <div>
                <label className={labelCls}>Fecha *</label>
                <input type="date" value={fMov.fecha} max={hoyISO()} onChange={(e) => setFMov((f) => ({ ...f, fecha: e.target.value }))} className={inputCls} />
              </div>
              {fMov.tipo === 'compra' && (
                <>
                  <div>
                    <label className={labelCls}>Precio unitario <span className="font-normal text-muted-foreground">(ARS)</span></label>
                    <input type="text" inputMode="decimal" value={fMov.precio_unitario} onChange={(e) => setFMov((f) => ({ ...f, precio_unitario: e.target.value }))} className={inputCls} placeholder="Ej: 1500" />
                  </div>
                  <div>
                    <label className={labelCls}>Proveedor</label>
                    <input type="text" list="stock-proveedores" value={fMov.proveedor} onChange={(e) => setFMov((f) => ({ ...f, proveedor: e.target.value }))} className={inputCls} />
                    <datalist id="stock-proveedores">{proveedores.map((p) => <option key={p} value={p} />)}</datalist>
                  </div>
                  <div>
                    <label className={labelCls}>Comprobante</label>
                    <input type="text" value={fMov.comprobante} onChange={(e) => setFMov((f) => ({ ...f, comprobante: e.target.value }))} className={inputCls} placeholder="N° de factura / remito" />
                  </div>
                </>
              )}
              <div className={fMov.tipo === 'compra' ? '' : 'lg:col-span-2'}>
                <label className={labelCls}>Notas</label>
                <input type="text" value={fMov.notas} onChange={(e) => setFMov((f) => ({ ...f, notas: e.target.value }))} className={inputCls} placeholder={fMov.tipo === 'consumo' ? 'Para qué se usó' : fMov.tipo === 'ajuste' ? 'Motivo del ajuste' : 'Opcional'} />
              </div>
            </div>
            {fMov.tipo === 'compra' && itemMov && fMov.cantidad && fMov.precio_unitario && parseCantidad(fMov.cantidad) && parseCantidad(fMov.precio_unitario) != null && (
              <p className="mb-3 text-xs text-muted-foreground">
                Total: <span className="font-medium text-foreground">{fmtMoneda((parseCantidad(fMov.cantidad) ?? 0) * (parseCantidad(fMov.precio_unitario) ?? 0))}</span>
              </p>
            )}
            <div className="flex flex-wrap items-center gap-3">
              <button type="submit" disabled={saving || !fMov.item_id} className={btnPrimary}>
                {saving ? 'Guardando...' : fMov.tipo === 'compra' ? 'Registrar compra' : fMov.tipo === 'consumo' ? 'Registrar consumo' : 'Ajustar stock'}
              </button>
              <button type="button" onClick={cerrar} className="px-3 py-2 text-sm text-muted-foreground hover:text-foreground">
                {cargados > 0 ? 'Listo' : 'Cancelar'}
              </button>
              {/* El panel queda abierto para seguir cargando el mismo remito. */}
              {cargados > 0 && (
                <p className="text-xs text-muted-foreground">
                  {cargados} {cargados === 1 ? 'movimiento cargado' : 'movimientos cargados'} · elegí el siguiente ítem
                </p>
              )}
            </div>
          </form>
        )}
      </div>

      {/* ── Hay que comprar: lo accionable, antes del inventario ── */}
      {vista === 'todo' && !q && porComprar.length > 0 && (
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
              return (
                <div key={it.id} className="flex items-center gap-4 rounded-xl border border-border px-4 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{it.nombre}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {[
                        (it.categoria ?? '').trim() || SIN_CATEGORIA,
                        it.stock_minimo ? `mínimo ${fmtCantidad(it.stock_minimo, it.unidad)}` : null,
                        s?.ultimaCompra
                          ? `última compra ${fmtFechaAR(s.ultimaCompra.fecha)}${s.ultimaCompra.proveedor ? ` · ${s.ultimaCompra.proveedor}` : ''}`
                          : 'sin compras registradas',
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
                      Registrar compra
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        </section>
      )}

      {/* ── Filtros ── */}
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
              <button
                key={v.key}
                onClick={() => setVista(v.key)}
                className={clsx(
                  'rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
                  activa ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                )}
              >
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
            <X className="size-3.5" strokeWidth={2} />
          </button>
        )}
      </div>

      {/* ── Catálogo agrupado por categoría (y por familia de talles) ── */}
      {visibles.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border px-6 py-12 text-center text-sm text-muted-foreground">
          {items.length === 0 ? (
            <>
              <Boxes className="mx-auto mb-3 size-8 text-muted-foreground/50" strokeWidth={1.5} />
              Todavía no hay ítems en el stock de {empresa.nombre}.{' '}
              {canEdit && <button onClick={abrirNuevoItem} className="text-primary hover:underline">Creá el primero</button>}
            </>
          ) : 'Ningún ítem coincide con los filtros.'}
        </div>
      ) : (
        <div className="rounded-2xl border border-border bg-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className={clsx(thCls, 'text-left')}>Ítem</th>
                <th className={clsx(thCls, 'w-[190px] text-right')}>Stock</th>
                <th className={clsx(thCls, 'w-[124px] text-left')}>Estado</th>
                <th className={clsx(thCls, 'w-[96px] text-right')}>Últ. compra</th>
                <th className={clsx(thCls, 'w-[96px]')} />
              </tr>
            </thead>

            {grupos.map((g) => (
              <tbody key={g.categoria} className="divide-y divide-border border-b border-border last:border-0">
                <tr>
                  <td colSpan={5} className="bg-muted/60 px-4 py-2">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <span className="text-xs font-semibold uppercase tracking-wide text-foreground">{g.categoria}</span>
                      <span className="text-[11px] text-muted-foreground">
                        {g.total} {g.total === 1 ? 'ítem' : 'ítems'}
                      </span>
                      {g.sinStock > 0 && <EstadoPill estado="vencido" label={`${g.sinStock} sin stock`} />}
                      {g.bajoMinimo > 0 && <EstadoPill estado="proximo" label={`${g.bajoMinimo} bajo mínimo`} />}
                    </div>
                  </td>
                </tr>

                {g.entradas.map((entrada) =>
                  entrada.tipo === 'item' ? (
                    filaItem(entrada.item)
                  ) : (
                    <Fragment key={entrada.base}>
                      {/* Rótulo de familia: agrupa los talles sin fusionarlos. Cada
                          variante sigue siendo su propio ítem, con su id y su stock. */}
                      <tr>
                        <td colSpan={5} className="px-4 pb-1 pt-2.5">
                          <span className="text-sm font-medium text-foreground">{entrada.base}</span>
                          <span className="ml-2 text-[11px] text-muted-foreground">
                            {entrada.variantes.length} talles
                          </span>
                        </td>
                      </tr>
                      {entrada.variantes.map((v) => filaItem(v.item, v.variante))}
                    </Fragment>
                  )
                )}
              </tbody>
            ))}
          </table>
        </div>
      )}
    </div>
  )
}

/**
 * Muestra cómo se interpreta lo tipeado ("1.250" es mil doscientos cincuenta; "1,25" es uno
 * coma veinticinco) para que el separador no sorprenda al guardar.
 */
function PreviewCantidad({ texto, unidad }: { texto: string; unidad?: string | null }) {
  const n = texto.trim() ? parseCantidad(texto) : null
  if (n == null || /^\d+$/.test(texto.trim())) return null
  return <p className="mt-1 text-[11px] tabular-nums text-muted-foreground">Se registra: {fmtCantidad(n, unidad)}</p>
}
