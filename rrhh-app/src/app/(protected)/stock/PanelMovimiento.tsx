'use client'

import { memo, useImperativeHandle, useMemo, useRef, useState, type KeyboardEvent, type RefObject } from 'react'
import { toast } from 'sonner'
import clsx from 'clsx'
import { Plus, RotateCcw, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { mensajeError } from '@/lib/errores'
import type { StockMovimiento } from '@/types'
import {
  TIPO_MOVIMIENTO_LABEL, empleadoPorNombre, esMovimientoConPersona, excedenStock, fmtCantidad, fmtMoneda, hoyClave,
  normalizarNombre, parseCantidad, prepararLineas, sumarStock, type TipoMovimiento,
} from '@/modules/stock/reglas'
import { ItemPicker, type OpcionItem } from './ItemPicker'
import { btnPrimary, inputCls, labelCls, segBtn } from './estilos'

/** Lo que el resto de la pantalla le puede pedir al panel abierto. */
export interface ControlPanel {
  /** Suma el ítem a la carga abierta si es del mismo tipo. false = no puede (otro tipo). */
  agregar: (tipo: TipoMovimiento, itemId: string) => boolean
  /** ¿Hay líneas o un conteo sin registrar? */
  tieneCambios: () => boolean
  tipo: () => TipoMovimiento
}

interface Linea {
  key: string
  item_id: string
  cantidad: string
  precio: string
}

let secuencia = 0
function nuevaLinea(item_id = '', cantidad = ''): Linea {
  secuencia += 1
  return { key: `l${secuencia}`, item_id, cantidad, precio: '' }
}

/** En una entrega (o devolución) lo normal es 1 por persona; en un ingreso la cantidad se tipea siempre. */
const cantidadPorDefecto = (tipo: TipoMovimiento) => (esMovimientoConPersona(tipo) ? '1' : '')

/** Empleado activo de la empresa, para vincular entregas/devoluciones con su legajo. */
export interface EmpleadoOpcion { id: string; nombre: string | null; apellido: string | null }

/** Foco en la cantidad de una línea sin saltar de scroll (puede venir de un click en la matriz, más abajo). */
function enfocar(refs: Map<string, HTMLInputElement>, key: string) {
  requestAnimationFrame(() => {
    const el = refs.get(key)
    el?.focus({ preventScroll: true })
    el?.select()
  })
}

/** Siempre queda una línea en blanco al final para seguir cargando. */
function conLineaFinal(lineas: Linea[]): Linea[] {
  return lineas.length === 0 || lineas[lineas.length - 1].item_id ? [...lineas, nuevaLinea()] : lineas
}

const TITULO: Record<TipoMovimiento, string> = {
  consumo: 'Registrar entrega', devolucion: 'Registrar devolución', compra: 'Registrar ingreso', ajuste: 'Contar stock',
}

interface Props {
  empresaId: string
  opciones: OpcionItem[]
  destinatarios: string[]
  /** Empleados activos: si "Entregado a" coincide con uno, la entrega queda en su legajo. */
  empleados: EmpleadoOpcion[]
  proveedores: string[]
  tipoInicial: TipoMovimiento
  itemInicial: string
  controlRef: RefObject<ControlPanel | null>
  onRegistrados: (movs: StockMovimiento[]) => void
  onCerrar: () => void
}

/**
 * Panel para registrar movimientos. Vive aparte de la lista para que tipear acá
 * no re-renderice el inventario entero.
 * - Entrega e ingreso son de VARIAS líneas: un encabezado que se conserva
 *   ("Entregado a" + fecha, o proveedor + comprobante + fecha) y N líneas
 *   ítem + cantidad, guardadas en UN insert (entran todas o ninguna).
 * - El ajuste es de a un ítem: guarda la DIFERENCIA contra el stock contado,
 *   calculada con una lectura fresca de los movimientos del ítem.
 */
function PanelMovimientoBase({
  empresaId, opciones, destinatarios, empleados, proveedores, tipoInicial, itemInicial, controlRef, onRegistrados, onCerrar,
}: Props) {
  const [supabase] = useState(() => createClient())
  const [tipo, setTipo] = useState<TipoMovimiento>(tipoInicial)
  const [fecha, setFecha] = useState(() => hoyClave())
  const [destinatario, setDestinatario] = useState('')
  const [proveedor, setProveedor] = useState('')
  const [comprobante, setComprobante] = useState('')
  const [notas, setNotas] = useState('')
  const [lineas, setLineas] = useState<Linea[]>(() =>
    conLineaFinal(itemInicial && tipoInicial !== 'ajuste' ? [nuevaLinea(itemInicial, cantidadPorDefecto(tipoInicial))] : [])
  )
  const [ajusteItem, setAjusteItem] = useState(tipoInicial === 'ajuste' ? itemInicial : '')
  const [contado, setContado] = useState('')
  const [saving, setSaving] = useState(false)
  const [cargados, setCargados] = useState(0)
  /** La última entrega, para repetir el mismo kit a otra persona. */
  const [ultima, setUltima] = useState<{ destinatario: string; lineas: { item_id: string; cantidad: string }[] } | null>(null)

  const pickerRefs = useRef(new Map<string, HTMLInputElement>())
  const cantRefs = useRef(new Map<string, HTMLInputElement>())
  const encabezadoRef = useRef<HTMLInputElement>(null)
  const ajustePickerRef = useRef<HTMLInputElement | null>(null)
  const contadoRef = useRef<HTMLInputElement>(null)

  const porId = useMemo(() => new Map(opciones.map((o) => [o.id, o])), [opciones])
  // Sugerencias de "Entregado a": primero los empleados de la empresa, después lo que ya se usó.
  const sugerencias = useMemo(() => {
    const nombres = empleados.map((e) => [e.nombre, e.apellido].filter(Boolean).join(' ')).filter(Boolean)
    return [...new Set([...nombres, ...destinatarios])]
  }, [empleados, destinatarios])
  const empleadoVinculado = useMemo(() => empleadoPorNombre(destinatario, empleados), [destinatario, empleados])
  const hoy = useMemo(() => hoyClave(), [])

  // Lo pedido por ítem sumando todas las líneas (dos líneas del mismo ítem cuentan juntas).
  const pedidoPorItem = useMemo(() => {
    const m = new Map<string, number>()
    for (const l of lineas) {
      if (!l.item_id) continue
      m.set(l.item_id, (m.get(l.item_id) ?? 0) + (parseCantidad(l.cantidad) ?? 0))
    }
    return m
  }, [lineas])
  const cargadas = lineas.filter((l) => l.item_id).length
  const totalCompra = useMemo(() => {
    if (tipo !== 'compra') return 0
    let t = 0
    for (const l of lineas) {
      const c = parseCantidad(l.cantidad), p = parseCantidad(l.precio)
      if (l.item_id && c != null && p != null) t += c * p
    }
    return t
  }, [lineas, tipo])

  useImperativeHandle(controlRef, () => ({
    tipo: () => tipo,
    tieneCambios: () => (tipo === 'ajuste' ? !!contado.trim() : lineas.some((l) => l.item_id)),
    agregar(t, itemId) {
      if (t !== tipo) return false
      if (t === 'ajuste') {
        setAjusteItem(itemId)
        setContado('')
        return true
      }
      const existente = lineas.find((l) => l.item_id === itemId)
      if (existente) {
        enfocar(cantRefs.current, existente.key)
        return true
      }
      const vacia = lineas.find((l) => !l.item_id)
      let key: string
      let next: Linea[]
      if (vacia) {
        key = vacia.key
        next = lineas.map((l) => (l.key === vacia.key ? { ...l, item_id: itemId, cantidad: l.cantidad || cantidadPorDefecto(t) } : l))
      } else {
        const l = nuevaLinea(itemId, cantidadPorDefecto(t))
        key = l.key
        next = [...lineas, l]
      }
      setLineas(conLineaFinal(next))
      enfocar(cantRefs.current, key)
      return true
    },
  }), [tipo, lineas, contado])

  function elegirItem(key: string, itemId: string) {
    setLineas((prev) =>
      conLineaFinal(prev.map((l) => (l.key === key ? { ...l, item_id: itemId, cantidad: l.cantidad || cantidadPorDefecto(tipo) } : l)))
    )
    enfocar(cantRefs.current, key)
  }
  function cambiarLinea(key: string, campo: 'cantidad' | 'precio', valor: string) {
    setLineas((prev) => prev.map((l) => (l.key === key ? { ...l, [campo]: valor } : l)))
  }
  function quitarLinea(key: string) {
    setLineas((prev) => conLineaFinal(prev.filter((l) => l.key !== key)))
  }
  function cambiarTipo(t: TipoMovimiento) {
    if (t === tipo) return
    if (t === 'ajuste' && !ajusteItem) setAjusteItem(lineas.find((l) => l.item_id)?.item_id ?? '')
    setTipo(t)
  }

  /** Enter en la cantidad pasa a la línea siguiente (Ctrl/⌘+Enter registra). */
  function onCantidadKey(e: KeyboardEvent<HTMLInputElement>, i: number) {
    if (e.key !== 'Enter' || e.metaKey || e.ctrlKey) return
    e.preventDefault()
    const sig = lineas[i + 1]
    if (sig) pickerRefs.current.get(sig.key)?.focus()
  }

  function repetirUltima() {
    if (!ultima) return
    setLineas(conLineaFinal(ultima.lineas.map((l) => nuevaLinea(l.item_id, l.cantidad))))
    setDestinatario('')
    requestAnimationFrame(() => encabezadoRef.current?.focus())
  }

  function validarFecha(): boolean {
    if (!fecha) { toast.error('La fecha es obligatoria.'); return false }
    if (fecha > hoyClave()) { toast.error('La fecha no puede ser posterior a hoy.'); return false }
    return true
  }

  async function guardarLineas() {
    if (saving || tipo === 'ajuste') return
    if (!validarFecha()) return
    const r = prepararLineas(lineas, tipo === 'compra')
    if (!r.ok) {
      toast.error(r.error)
      const l = lineas[r.indice]
      if (l) (l.item_id ? cantRefs : pickerRefs).current.get(l.key)?.focus()
      return
    }
    if (tipo === 'consumo') {
      const exceden = excedenStock(r.lineas, (id) => porId.get(id)?.stock ?? 0)
      if (exceden.length > 0) {
        const detalle = exceden
          .map((x) => {
            const o = porId.get(x.item_id)
            return `• ${o?.nombre ?? 'Ítem'}: entregás ${fmtCantidad(x.pedido, o?.unidad)} y hay ${fmtCantidad(x.stock, o?.unidad)}`
          })
          .join('\n')
        if (!confirm(`Con esta entrega quedaría en negativo:\n${detalle}\n\n¿Registrar igual?`)) return
      }
    }

    const dest = normalizarNombre(destinatario)
    const conPersona = esMovimientoConPersona(tipo)
    const empleadoId = conPersona ? empleadoPorNombre(dest, empleados)?.id ?? null : null
    const filas = r.lineas.map((l) => ({
      item_id: l.item_id,
      empresa_id: empresaId,
      tipo,
      cantidad: l.cantidad,
      fecha,
      proveedor: tipo === 'compra' ? normalizarNombre(proveedor) || null : null,
      precio_unitario: tipo === 'compra' ? l.precio_unitario : null,
      comprobante: tipo === 'compra' ? comprobante.trim() || null : null,
      // La persona va en notas (así se cargó siempre y así la encuentra la búsqueda) y,
      // si coincide con un empleado, también en empleado_id: queda en su legajo.
      notas: conPersona ? dest || null : notas.trim() || null,
      empleado_id: empleadoId,
    }))

    setSaving(true)
    const { data, error } = await supabase.from('stock_movimientos').insert(filas).select()
    setSaving(false)
    if (error || !data) {
      toast.error(mensajeError(error, tipo === 'consumo' ? 'registrar la entrega' : tipo === 'devolucion' ? 'registrar la devolución' : 'registrar el ingreso'))
      return
    }

    onRegistrados(data)
    setCargados((n) => n + data.length)
    const n = data.length
    const items = `${n} ${n === 1 ? 'ítem' : 'ítems'}`
    if (conPersona) {
      const enLegajo = empleadoId ? ' (queda en su legajo)' : ''
      if (tipo === 'consumo') {
        toast.success(`Entrega registrada: ${items}${dest ? ` a ${dest}` : ''}${enLegajo}.`)
        setUltima({ destinatario: dest, lineas: r.lineas.map((l) => ({ item_id: l.item_id, cantidad: String(l.cantidad) })) })
      } else {
        toast.success(`Devolución registrada: ${items}${dest ? ` de ${dest}` : ''}${enLegajo}.`)
        setUltima(null)
      }
      // La próxima entrega suele ser para otra persona: se limpia el destinatario
      // (no se le atribuye un kit a quien no corresponde) y se conserva la fecha.
      setDestinatario('')
      setLineas([nuevaLinea()])
      requestAnimationFrame(() => encabezadoRef.current?.focus())
    } else {
      toast.success(`Ingreso registrado: ${items}.`)
      setUltima(null)
      setProveedor('')
      setComprobante('')
      setNotas('')
      const l = nuevaLinea()
      setLineas([l])
      requestAnimationFrame(() => pickerRefs.current.get(l.key)?.focus())
    }
  }

  async function guardarAjuste() {
    if (saving) return
    const it = porId.get(ajusteItem)
    if (!it) { toast.error('Elegí el ítem.'); return }
    if (!validarFecha()) return
    const nuevo = parseCantidad(contado)
    if (nuevo == null || nuevo < 0) { toast.error('Ingresá el stock real contado (número ≥ 0).'); return }

    // La diferencia se calcula con los movimientos FRESCOS del ítem, no con el
    // estado de esta pestaña (otro usuario pudo registrar algo mientras tanto).
    setSaving(true)
    const { data: frescos, error: eFrescos } = await supabase.from('stock_movimientos').select('tipo, cantidad').eq('item_id', it.id)
    if (eFrescos) {
      setSaving(false)
      toast.error(mensajeError(eFrescos, 'leer el stock actual'))
      return
    }
    const actual = sumarStock(frescos ?? [])
    const cantidad = Math.round((nuevo - actual) * 100) / 100
    if (cantidad === 0) {
      setSaving(false)
      toast.error(`El stock contado (${fmtCantidad(nuevo, it.unidad)}) es igual al actual: no hay nada que ajustar.`)
      return
    }
    // Queda registrado lo que se contó, no solo la diferencia (auditable a mano).
    const notasExtra = `Conteo: ${fmtCantidad(nuevo, it.unidad)} (había ${fmtCantidad(actual, it.unidad)})`
    const { data, error } = await supabase
      .from('stock_movimientos')
      .insert({
        item_id: it.id, empresa_id: empresaId, tipo: 'ajuste', cantidad, fecha,
        notas: [notas.trim(), notasExtra].filter(Boolean).join(' · '),
      })
      .select()
      .single()
    setSaving(false)
    if (error || !data) {
      toast.error(mensajeError(error, 'ajustar el stock'))
      return
    }
    onRegistrados([data])
    setCargados((n) => n + 1)
    toast.success(`Stock ajustado: ${it.nombre} queda en ${fmtCantidad(nuevo, it.unidad)}.`)
    setAjusteItem('')
    setContado('')
    setNotas('')
    requestAnimationFrame(() => ajustePickerRef.current?.focus())
  }

  function enviar() {
    if (tipo === 'ajuste') void guardarAjuste()
    else void guardarLineas()
  }

  const itemAjuste = porId.get(ajusteItem)
  const textoBoton = saving
    ? 'Guardando...'
    : tipo === 'ajuste'
      ? 'Ajustar stock'
      : `${TITULO[tipo]}${cargadas > 0 ? ` · ${cargadas} ${cargadas === 1 ? 'ítem' : 'ítems'}` : ''}`

  return (
    <form
      onSubmit={(e) => { e.preventDefault(); enviar() }}
      onKeyDown={(e) => {
        if (e.key === 'Escape') onCerrar()
        else if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); enviar() }
      }}
      className="rounded-xl border border-primary/30 bg-primary/5 p-5"
    >
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm font-medium text-foreground">{TITULO[tipo]}</p>
        <div className="inline-flex items-center gap-1 rounded-xl bg-muted p-1">
          {(['consumo', 'devolucion', 'compra', 'ajuste'] as TipoMovimiento[]).map((t) => (
            <button key={t} type="button" onClick={() => cambiarTipo(t)} className={segBtn(tipo === t)}>
              {TIPO_MOVIMIENTO_LABEL[t]}
            </button>
          ))}
        </div>
      </div>

      {tipo === 'ajuste' ? (
        <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="lg:col-span-2">
            <label className={labelCls}>Ítem *</label>
            <ItemPicker
              opciones={opciones}
              value={ajusteItem}
              onChange={(id) => {
                setAjusteItem(id)
                requestAnimationFrame(() => contadoRef.current?.focus())
              }}
              inputRef={(el) => { ajustePickerRef.current = el }}
              autoFocus={!ajusteItem}
            />
          </div>
          <div>
            <label className={labelCls}>Stock real contado *</label>
            <input
              ref={contadoRef}
              type="text"
              inputMode="decimal"
              value={contado}
              onChange={(e) => setContado(e.target.value)}
              className={inputCls}
              placeholder={itemAjuste ? `hoy figura ${fmtCantidad(itemAjuste.stock)}` : ''}
              autoFocus={!!ajusteItem}
            />
            <PreviewCantidad texto={contado} unidad={itemAjuste?.unidad} />
          </div>
          <div>
            <label className={labelCls}>Fecha *</label>
            <input type="date" value={fecha} max={hoy} onChange={(e) => setFecha(e.target.value)} className={inputCls} />
          </div>
          <div className="sm:col-span-2 lg:col-span-4">
            <label className={labelCls}>Motivo</label>
            <input type="text" value={notas} onChange={(e) => setNotas(e.target.value)} className={inputCls} placeholder="Ej: conteo mensual, rotura, faltante" />
          </div>
        </div>
      ) : (
        <>
          {/* Encabezado: se conserva para todas las líneas. */}
          {esMovimientoConPersona(tipo) ? (
            <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="sm:col-span-2">
                <label className={labelCls}>{tipo === 'devolucion' ? 'Devuelto por' : 'Entregado a'}</label>
                <input
                  ref={encabezadoRef}
                  type="text"
                  list="stock-destinatarios"
                  value={destinatario}
                  onChange={(e) => setDestinatario(e.target.value)}
                  className={inputCls}
                  placeholder={tipo === 'devolucion' ? 'Nombre y apellido de quien devuelve' : 'Nombre y apellido, o destino (ej: Barco Port Alberni)'}
                  autoFocus={!itemInicial}
                />
                <datalist id="stock-destinatarios">{sugerencias.map((d) => <option key={d} value={d} />)}</datalist>
                {destinatario.trim() && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    {empleadoVinculado
                      ? `Queda en el legajo de ${[empleadoVinculado.nombre, empleadoVinculado.apellido].filter(Boolean).join(' ')}.`
                      : 'No coincide con un empleado: se guarda solo como texto.'}
                  </p>
                )}
              </div>
              <div>
                <label className={labelCls}>Fecha *</label>
                <input type="date" value={fecha} max={hoy} onChange={(e) => setFecha(e.target.value)} className={inputCls} />
              </div>
            </div>
          ) : (
            <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <label className={labelCls}>Proveedor</label>
                <input
                  ref={encabezadoRef}
                  type="text"
                  list="stock-proveedores"
                  value={proveedor}
                  onChange={(e) => setProveedor(e.target.value)}
                  className={inputCls}
                  autoFocus={!itemInicial}
                />
                <datalist id="stock-proveedores">{proveedores.map((p) => <option key={p} value={p} />)}</datalist>
              </div>
              <div>
                <label className={labelCls}>Comprobante</label>
                <input type="text" value={comprobante} onChange={(e) => setComprobante(e.target.value)} className={inputCls} placeholder="N° de factura / remito" />
              </div>
              <div>
                <label className={labelCls}>Fecha *</label>
                <input type="date" value={fecha} max={hoy} onChange={(e) => setFecha(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Notas</label>
                <input type="text" value={notas} onChange={(e) => setNotas(e.target.value)} className={inputCls} placeholder="Ej: devolución de Tobías" />
              </div>
            </div>
          )}

          {/* Líneas */}
          <div
            className={clsx(
              'mb-1 hidden gap-2 px-0.5 sm:grid',
              tipo === 'compra' ? 'grid-cols-[1fr_7rem_8rem_2rem]' : 'grid-cols-[1fr_7rem_2rem]'
            )}
          >
            <span className={labelCls}>Ítem *</span>
            <span className={labelCls}>Cantidad *</span>
            {tipo === 'compra' && <span className={labelCls}>Precio unit. (ARS)</span>}
            <span />
          </div>
          <div className="space-y-2">
            {lineas.map((l, i) => {
              const op = l.item_id ? porId.get(l.item_id) : undefined
              const pedido = op ? (pedidoPorItem.get(op.id) ?? 0) : 0
              const quedaNegativo = tipo === 'consumo' && !!op && pedido > op.stock
              const esUltimaVacia = !l.item_id && i === lineas.length - 1
              return (
                <div key={l.key}>
                  <div className={clsx('grid gap-2', tipo === 'compra' ? 'grid-cols-[1fr_7rem_8rem_2rem]' : 'grid-cols-[1fr_7rem_2rem]')}>
                    <ItemPicker
                      opciones={opciones}
                      value={l.item_id}
                      onChange={(id) => elegirItem(l.key, id)}
                      inputRef={(el) => { if (el) pickerRefs.current.set(l.key, el); else pickerRefs.current.delete(l.key) }}
                      placeholder={esUltimaVacia && cargadas > 0 ? 'Agregar otro ítem…' : 'Buscá un ítem…'}
                      ariaLabel={`Ítem de la línea ${i + 1}`}
                    />
                    <input
                      ref={(el) => { if (el) cantRefs.current.set(l.key, el); else cantRefs.current.delete(l.key) }}
                      type="text"
                      inputMode="decimal"
                      aria-label={`Cantidad de la línea ${i + 1}`}
                      value={l.cantidad}
                      onChange={(e) => cambiarLinea(l.key, 'cantidad', e.target.value)}
                      onKeyDown={(e) => onCantidadKey(e, i)}
                      onFocus={(e) => e.target.select()}
                      autoFocus={!!itemInicial && i === 0}
                      className={clsx(inputCls, 'tabular-nums')}
                      placeholder={op ? op.unidad : ''}
                    />
                    {tipo === 'compra' && (
                      <input
                        type="text"
                        inputMode="decimal"
                        aria-label={`Precio unitario de la línea ${i + 1}`}
                        value={l.precio}
                        onChange={(e) => cambiarLinea(l.key, 'precio', e.target.value)}
                        className={clsx(inputCls, 'tabular-nums')}
                        placeholder="Opcional"
                      />
                    )}
                    {l.item_id ? (
                      <button
                        type="button"
                        onClick={() => quitarLinea(l.key)}
                        aria-label={`Quitar la línea ${i + 1}`}
                        title="Quitar línea"
                        className="flex items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                      >
                        <X className="size-4" strokeWidth={1.75} />
                      </button>
                    ) : <span />}
                  </div>
                  {op && (
                    <p className={clsx('mt-0.5 px-0.5 text-[11px] tabular-nums', quedaNegativo ? 'text-danger' : 'text-muted-foreground')}>
                      hay {fmtCantidad(op.stock, op.unidad)}
                      {tipo === 'consumo' && pedido > 0 && ` · queda ${fmtCantidad(Math.round((op.stock - pedido) * 100) / 100)}`}
                      <PreviewCantidad texto={l.cantidad} unidad={op.unidad} inline />
                    </p>
                  )}
                </div>
              )
            })}
          </div>
          <button
            type="button"
            onClick={() => {
              const l = nuevaLinea()
              setLineas((prev) => [...prev, l])
              requestAnimationFrame(() => pickerRefs.current.get(l.key)?.focus())
            }}
            className="mt-2 inline-flex items-center gap-1.5 rounded-md px-1 py-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <Plus className="size-3.5" strokeWidth={1.75} />
            Agregar línea
          </button>
          {tipo === 'compra' && totalCompra > 0 && (
            <p className="mt-2 text-xs text-muted-foreground">
              Total: <span className="font-medium text-foreground">{fmtMoneda(totalCompra)}</span>
            </p>
          )}
        </>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button type="submit" disabled={saving || (tipo === 'ajuste' ? !ajusteItem : cargadas === 0)} className={btnPrimary}>
          {textoBoton}
        </button>
        <button type="button" onClick={onCerrar} className="px-3 py-2 text-sm text-muted-foreground hover:text-foreground">
          {cargados > 0 ? 'Listo' : 'Cancelar'}
        </button>
        {tipo === 'consumo' && ultima && ultima.lineas.length > 0 && cargadas === 0 && (
          <button
            type="button"
            onClick={repetirUltima}
            className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-primary transition-colors hover:bg-primary/10"
          >
            <RotateCcw className="size-3.5" strokeWidth={1.75} />
            Repetir los mismos {ultima.lineas.length} {ultima.lineas.length === 1 ? 'ítem' : 'ítems'} para otra persona
          </button>
        )}
        <p className="ml-auto text-[11px] text-muted-foreground">
          {cargados > 0
            ? `${cargados} ${cargados === 1 ? 'movimiento registrado' : 'movimientos registrados'}`
            : tipo === 'ajuste'
              ? 'Se guarda la diferencia contra el stock actual'
              : 'Enter pasa a la línea siguiente · Ctrl+Enter registra'}
        </p>
      </div>
    </form>
  )
}

export const PanelMovimiento = memo(PanelMovimientoBase)

/**
 * Muestra cómo se interpreta lo tipeado ("1.250" es mil doscientos cincuenta; "1,25" es uno
 * coma veinticinco) para que el separador no sorprenda al guardar.
 */
function PreviewCantidad({ texto, unidad, inline }: { texto: string; unidad?: string | null; inline?: boolean }) {
  const n = texto.trim() ? parseCantidad(texto) : null
  if (n == null || /^\d+$/.test(texto.trim())) return null
  if (inline) return <> · se registra {fmtCantidad(n, unidad)}</>
  return <p className="mt-1 text-[11px] tabular-nums text-muted-foreground">Se registra: {fmtCantidad(n, unidad)}</p>
}
