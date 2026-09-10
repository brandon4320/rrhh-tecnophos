'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import clsx from 'clsx'
import {
  Archive, ArchiveRestore, Boxes, ChevronDown, CircleAlert, History, Package, PackageMinus,
  PackagePlus, Pencil, Plus, Search, ShoppingCart, Trash2,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { EstadoPill } from '@/components/ui/estado-pill'
import type { StockItem, StockMovimiento } from '@/types'
import {
  ESTADO_STOCK_LABEL, TIPO_MOVIMIENTO_LABEL, UNIDADES_SUGERIDAS, calcularStock, categoriasDe, comprasDelMes,
  estadoStock, fmtCantidad, fmtMoneda, mesClave, normalizarNombre, parseCantidad, type TipoMovimiento,
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

const hoyISO = () => new Date().toISOString().slice(0, 10)

// Mínimo 1 por defecto (criterio acordado el 10/09/2026: avisar cuando queda la última unidad).
const ITEM_VACIO = { nombre: '', categoria: '', unidad: 'unidad', stock_minimo: '1', notas: '', stock_inicial: '' }
const MOV_VACIO = { item_id: '', tipo: 'compra' as TipoMovimiento, cantidad: '', nuevo_stock: '', fecha: hoyISO(), proveedor: '', precio_unitario: '', comprobante: '', notas: '' }

/**
 * Stock de una empresa: catálogo de ítems (CRUD) + libro de movimientos.
 * El stock actual se calcula (compra +, consumo −, ajuste ±), nunca se tipea.
 * Mutaciones directas con el cliente de Supabase (la RLS stock_*_rrhh_all decide),
 * estado local optimista + router.refresh() para resincronizar, toasts siempre.
 */
export default function StockClient({ empresa, items: initItems, movimientos: initMovs, canEdit }: Props) {
  const supabase = createClient()
  const router = useRouter()
  const [items, setItems] = useState(initItems)
  const [movs, setMovs] = useState(initMovs)

  // filtros
  const [q, setQ] = useState('')
  const [categoria, setCategoria] = useState('')
  const [soloAlerta, setSoloAlerta] = useState(false)
  const [verArchivados, setVerArchivados] = useState(false)
  const [abierto, setAbierto] = useState<string | null>(null)

  // formularios
  const [panel, setPanel] = useState<'item' | 'mov' | null>(null)
  const [editandoId, setEditandoId] = useState<string | null>(null)
  const [fItem, setFItem] = useState(ITEM_VACIO)
  const [fMov, setFMov] = useState(MOV_VACIO)
  const [saving, setSaving] = useState(false)

  const stock = useMemo(() => calcularStock(items, movs), [items, movs])
  const categorias = useMemo(() => categoriasDe(items), [items])
  const proveedores = useMemo(
    () => [...new Set(movs.map((m) => (m.proveedor ?? '').trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'es')),
    [movs]
  )
  const mes = mesClave()
  const compras = useMemo(() => comprasDelMes(movs, mes), [movs, mes])

  const activos = items.filter((i) => i.activo !== false)
  const sinStock = activos.filter((i) => estadoStock(stock.get(i.id)?.stock ?? 0, i.stock_minimo) === 'vencido').length
  const bajoMinimo = activos.filter((i) => estadoStock(stock.get(i.id)?.stock ?? 0, i.stock_minimo) === 'proximo').length

  const visibles = items.filter((i) => {
    if (!verArchivados && i.activo === false) return false
    if (categoria && (i.categoria ?? '') !== categoria) return false
    if (soloAlerta && !['vencido', 'proximo'].includes(estadoStock(stock.get(i.id)?.stock ?? 0, i.stock_minimo))) return false
    if (q && !`${i.nombre} ${i.categoria ?? ''}`.toLowerCase().includes(q.toLowerCase())) return false
    return true
  })

  // ── helpers de formularios ──────────────────────────────────────────────
  function abrirNuevoItem() {
    setEditandoId(null)
    setFItem(ITEM_VACIO)
    setPanel('item')
  }
  function abrirEditarItem(it: StockItem) {
    setEditandoId(it.id)
    setFItem({
      nombre: it.nombre, categoria: it.categoria ?? '', unidad: it.unidad ?? 'unidad',
      stock_minimo: it.stock_minimo != null ? String(it.stock_minimo) : '', notas: it.notas ?? '', stock_inicial: '',
    })
    setPanel('item')
  }
  function abrirMovimiento(tipo: TipoMovimiento, itemId = '') {
    setFMov({ ...MOV_VACIO, tipo, item_id: itemId, fecha: hoyISO() })
    setPanel('mov')
  }
  function cerrar() {
    setPanel(null)
    setEditandoId(null)
    setFItem(ITEM_VACIO)
    setFMov(MOV_VACIO)
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
    if (editandoId) {
      const { data, error } = await supabase
        .from('stock_items').update({ ...payload, updated_at: new Date().toISOString() }).eq('id', editandoId).select().single()
      setSaving(false)
      if (error || !data) return toast.error('No se pudo guardar el ítem.')
      setItems((prev) => prev.map((i) => (i.id === editandoId ? data : i)))
      toast.success('Ítem actualizado.')
    } else {
      const { data, error } = await supabase
        .from('stock_items').insert({ ...payload, empresa_id: empresa.id }).select().single()
      if (error || !data) {
        setSaving(false)
        return toast.error('No se pudo crear el ítem.')
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
      setItems((prev) => [...prev, data].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')))
      setMovs((prev) => [...nuevosMovs, ...prev])
      toast.success(`Ítem "${data.nombre}" creado.`)
    }
    cerrar()
    router.refresh()
  }

  async function toggleArchivar(it: StockItem) {
    const activo = it.activo === false
    const { error } = await supabase.from('stock_items').update({ activo, updated_at: new Date().toISOString() }).eq('id', it.id)
    if (error) return toast.error('No se pudo cambiar el estado del ítem.')
    setItems((prev) => prev.map((i) => (i.id === it.id ? { ...i, activo } : i)))
    toast.success(activo ? 'Ítem restaurado.' : 'Ítem archivado. Conserva su historial.')
    router.refresh()
  }

  async function eliminarItem(it: StockItem) {
    const n = stock.get(it.id)?.movimientos ?? 0
    const aviso = n > 0
      ? `¿Eliminar "${it.nombre}" y sus ${n} movimiento(s)? Se pierde el historial. Si querés conservarlo, archivalo en vez de eliminarlo.`
      : `¿Eliminar "${it.nombre}"?`
    if (!confirm(aviso)) return
    const { error } = await supabase.from('stock_items').delete().eq('id', it.id)
    if (error) return toast.error('No se pudo eliminar el ítem.')
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
    if (fMov.tipo === 'ajuste') {
      const nuevo = parseCantidad(fMov.nuevo_stock)
      if (nuevo == null || nuevo < 0) return toast.error('Ingresá el stock real contado (número ≥ 0).')
      cantidad = Math.round((nuevo - (stock.get(it.id)?.stock ?? 0)) * 100) / 100
      if (cantidad === 0) return toast.error('El stock contado es igual al actual: no hay nada que ajustar.')
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
        notas: fMov.notas.trim() || null,
      })
      .select().single()
    setSaving(false)
    if (error || !data) return toast.error('No se pudo registrar el movimiento.')
    setMovs((prev) => [data, ...prev])
    const verbo = fMov.tipo === 'compra' ? 'Compra registrada' : fMov.tipo === 'consumo' ? 'Consumo registrado' : 'Stock ajustado'
    toast.success(`${verbo}: ${it.nombre}.`)
    setAbierto(it.id)
    cerrar()
    router.refresh()
  }

  async function eliminarMovimiento(m: StockMovimiento) {
    if (!confirm('¿Eliminar este movimiento? El stock se recalcula sin él.')) return
    const { error } = await supabase.from('stock_movimientos').delete().eq('id', m.id)
    if (error) return toast.error('No se pudo eliminar el movimiento.')
    setMovs((prev) => prev.filter((x) => x.id !== m.id))
    toast.success('Movimiento eliminado.')
    router.refresh()
  }

  const itemMov = items.find((i) => i.id === fMov.item_id)

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
          <button onClick={() => { setSoloAlerta(true); setVerArchivados(false) }} className="text-left sm:px-6">
            <p className={clsx('text-3xl font-semibold tabular-nums', sinStock > 0 && 'text-danger')}>{sinStock}</p>
            <p className="mt-0.5 text-sm text-muted-foreground">Sin stock</p>
            <p className="text-xs text-muted-foreground">hay que comprar</p>
          </button>
          <button onClick={() => { setSoloAlerta(true); setVerArchivados(false) }} className="text-left sm:px-6">
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

      {/* ── Panel: nuevo / editar ítem ── */}
      {canEdit && panel === 'item' && (
        <div className="rounded-xl border border-primary/30 bg-primary/5 p-5">
          <p className="mb-4 text-sm font-medium text-foreground">{editandoId ? 'Editar ítem' : 'Nuevo ítem'}</p>
          <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div className="lg:col-span-1">
              <label className={labelCls}>Nombre *</label>
              <input type="text" value={fItem.nombre} onChange={(e) => setFItem((f) => ({ ...f, nombre: e.target.value }))} className={inputCls} placeholder="Ej: Lavandina 5 L" autoFocus />
            </div>
            <div>
              <label className={labelCls}>Categoría</label>
              <input type="text" list="stock-categorias" value={fItem.categoria} onChange={(e) => setFItem((f) => ({ ...f, categoria: e.target.value }))} className={inputCls} placeholder="Ej: Limpieza, Insumos, Librería" />
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
            <button onClick={guardarItem} disabled={saving} className={btnPrimary}>{saving ? 'Guardando...' : editandoId ? 'Guardar cambios' : 'Crear ítem'}</button>
            <button onClick={cerrar} className="px-3 py-2 text-sm text-muted-foreground hover:text-foreground">Cancelar</button>
          </div>
        </div>
      )}

      {/* ── Panel: registrar movimiento ── */}
      {canEdit && panel === 'mov' && (
        <div className="rounded-xl border border-primary/30 bg-primary/5 p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm font-medium text-foreground">
              {fMov.tipo === 'compra' ? 'Registrar compra' : fMov.tipo === 'consumo' ? 'Registrar consumo' : 'Ajustar stock'}
            </p>
            <div className="inline-flex items-center gap-1 rounded-xl bg-muted p-1">
              {(['compra', 'consumo', 'ajuste'] as TipoMovimiento[]).map((t) => (
                <button
                  key={t}
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
              <select value={fMov.item_id} onChange={(e) => setFMov((f) => ({ ...f, item_id: e.target.value }))} className={inputCls} autoFocus={!fMov.item_id}>
                <option value="">Elegí un ítem…</option>
                {activos.map((i) => (
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
              </div>
            ) : (
              <div>
                <label className={labelCls}>Cantidad *{itemMov ? ` (${itemMov.unidad})` : ''}</label>
                <input type="text" inputMode="decimal" value={fMov.cantidad} onChange={(e) => setFMov((f) => ({ ...f, cantidad: e.target.value }))} className={inputCls} placeholder="Ej: 20" autoFocus={!!fMov.item_id} />
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
          <div className="flex items-center gap-3">
            <button onClick={guardarMovimiento} disabled={saving || !fMov.item_id} className={btnPrimary}>
              {saving ? 'Guardando...' : fMov.tipo === 'compra' ? 'Registrar compra' : fMov.tipo === 'consumo' ? 'Registrar consumo' : 'Ajustar stock'}
            </button>
            <button onClick={cerrar} className="px-3 py-2 text-sm text-muted-foreground hover:text-foreground">Cancelar</button>
          </div>
        </div>
      )}

      {/* ── Filtros ── */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1 sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" strokeWidth={1.75} />
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar ítem…" className={clsx(inputCls, 'pl-9')} />
        </div>
        {categorias.length > 0 && (
          <select value={categoria} onChange={(e) => setCategoria(e.target.value)} className={clsx(inputCls, 'w-auto')}>
            <option value="">Todas las categorías</option>
            {categorias.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        )}
        <button onClick={() => setSoloAlerta((v) => !v)} className={clsx(btnOutline, 'px-3 py-2', soloAlerta && 'border-warning/40 bg-warning-subtle text-warning hover:bg-warning-subtle hover:text-warning')}>
          <CircleAlert className="size-4" strokeWidth={1.75} />
          Solo con alerta
        </button>
        <button onClick={() => setVerArchivados((v) => !v)} className={clsx(btnOutline, 'px-3 py-2', verArchivados && 'bg-muted text-foreground')}>
          <Archive className="size-4" strokeWidth={1.75} />
          {verArchivados ? 'Ocultar archivados' : 'Ver archivados'}
        </button>
      </div>

      {/* ── Tabla de ítems ── */}
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
        <div className="overflow-hidden rounded-2xl border border-border bg-card">
          <div className="hidden grid-cols-[1fr_140px_120px_130px_1fr_auto] gap-4 border-b border-border px-5 py-3 text-[11px] font-medium uppercase tracking-wider text-muted-foreground md:grid">
            <span>Ítem</span><span className="text-right">Stock</span><span className="text-right">Mínimo</span><span>Estado</span><span>Última compra</span><span className="w-[168px]" />
          </div>
          <ul className="divide-y divide-border">
            {visibles.map((it) => {
              const s = stock.get(it.id) ?? { stock: 0, movimientos: 0, ultimaCompra: null, valorizado: null }
              const estado = estadoStock(s.stock, it.stock_minimo)
              const isOpen = abierto === it.id
              const historial = movs.filter((m) => m.item_id === it.id)
              return (
                <li key={it.id} className={clsx(it.activo === false && 'opacity-60')}>
                  <div
                    className="grid cursor-pointer grid-cols-1 gap-2 px-5 py-3.5 transition-colors hover:bg-accent md:grid-cols-[1fr_140px_120px_130px_1fr_auto] md:items-center md:gap-4"
                    onClick={() => setAbierto(isOpen ? null : it.id)}
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                        <Package className="size-4" strokeWidth={1.75} />
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-foreground">
                          {it.nombre}
                          {it.activo === false && <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">archivado</span>}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">{[it.categoria, it.notas].filter(Boolean).join(' · ') || '—'}</p>
                      </div>
                    </div>
                    <p className={clsx('text-sm font-semibold tabular-nums md:text-right', estado === 'vencido' && 'text-danger', estado === 'proximo' && 'text-warning')}>
                      {fmtCantidad(s.stock, it.unidad)}
                    </p>
                    <p className="text-sm tabular-nums text-muted-foreground md:text-right">{it.stock_minimo ? fmtCantidad(it.stock_minimo, it.unidad) : '—'}</p>
                    <div><EstadoPill estado={estado} label={ESTADO_STOCK_LABEL[estado]} /></div>
                    <p className="truncate text-xs text-muted-foreground">
                      {s.ultimaCompra
                        ? `${fmtFechaAR(s.ultimaCompra.fecha)}${s.ultimaCompra.precio_unitario != null ? ` · ${fmtMoneda(s.ultimaCompra.precio_unitario)}/${it.unidad}` : ''}${s.ultimaCompra.proveedor ? ` · ${s.ultimaCompra.proveedor}` : ''}`
                        : 'Sin compras registradas'}
                    </p>
                    <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                      {canEdit && it.activo !== false && (
                        <>
                          <button onClick={() => abrirMovimiento('compra', it.id)} title="Registrar compra" className={clsx(btnMini, 'text-primary hover:bg-primary/10')}>
                            <PackagePlus className="size-4" strokeWidth={1.75} />
                          </button>
                          <button onClick={() => abrirMovimiento('consumo', it.id)} title="Registrar consumo" className={clsx(btnMini, 'text-muted-foreground hover:bg-muted hover:text-foreground')}>
                            <PackageMinus className="size-4" strokeWidth={1.75} />
                          </button>
                          <button onClick={() => abrirEditarItem(it)} title="Editar ítem" className={clsx(btnMini, 'text-muted-foreground hover:bg-muted hover:text-foreground')}>
                            <Pencil className="size-4" strokeWidth={1.75} />
                          </button>
                        </>
                      )}
                      {canEdit && (
                        <>
                          <button onClick={() => toggleArchivar(it)} title={it.activo === false ? 'Restaurar' : 'Archivar (conserva historial)'} className={clsx(btnMini, 'text-muted-foreground hover:bg-muted hover:text-foreground')}>
                            {it.activo === false ? <ArchiveRestore className="size-4" strokeWidth={1.75} /> : <Archive className="size-4" strokeWidth={1.75} />}
                          </button>
                          <button onClick={() => eliminarItem(it)} title="Eliminar ítem" className={clsx(btnMini, 'text-danger/70 hover:bg-danger-subtle hover:text-danger')}>
                            <Trash2 className="size-4" strokeWidth={1.75} />
                          </button>
                        </>
                      )}
                      <ChevronDown className={clsx('ml-1 size-4 text-muted-foreground transition-transform', isOpen && 'rotate-180')} strokeWidth={1.75} />
                    </div>
                  </div>

                  {isOpen && (
                    <div className="border-t border-border bg-muted px-5 py-4">
                      <div className="mb-2 flex items-center justify-between gap-3">
                        <p className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                          <History className="size-3.5" strokeWidth={1.75} />
                          Historial · {historial.length} {historial.length === 1 ? 'movimiento' : 'movimientos'}
                          {s.valorizado != null && ` · valorizado ${fmtMoneda(s.valorizado)}`}
                        </p>
                        {canEdit && it.activo !== false && (
                          <button onClick={() => abrirMovimiento('ajuste', it.id)} className="text-xs font-medium text-primary hover:underline">
                            Ajustar por conteo
                          </button>
                        )}
                      </div>
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
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </div>
  )
}
