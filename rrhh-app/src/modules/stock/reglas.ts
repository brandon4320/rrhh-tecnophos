// ============================================================
// Reglas puras de Stock (sin I/O): el stock actual es la suma de los
// movimientos, el estado sale del mínimo, y las compras del mes se
// valorizan con precio × cantidad cuando hay precio.
// ============================================================
import type { EstadoVencimiento } from '@/types'
import { diaClaveAR } from '@/lib/fechas-ar'

export const TIPOS_MOVIMIENTO = ['compra', 'consumo', 'ajuste'] as const
export type TipoMovimiento = (typeof TIPOS_MOVIMIENTO)[number]

export const TIPO_MOVIMIENTO_LABEL: Record<TipoMovimiento, string> = {
  compra: 'Compra',
  consumo: 'Consumo',
  ajuste: 'Ajuste',
}

/** Sugerencias para el datalist; el campo acepta cualquier texto. */
export const UNIDADES_SUGERIDAS = ['unidad', 'litro', 'kg', 'metro', 'caja', 'bidón', 'rollo', 'par', 'paquete'] as const

export interface ItemBase {
  id: string
  nombre: string
  stock_minimo: number | null
  activo: boolean | null
}

export interface MovimientoBase {
  item_id: string
  tipo: string
  cantidad: number
  fecha: string
  precio_unitario?: number | null
  proveedor?: string | null
  /** Desempata compras del mismo día (la más reciente manda). */
  created_at?: string | null
}

/** ¿`a` es una compra más reciente que `b`? Por fecha y, a igual fecha, por created_at. */
function esMasReciente(a: { fecha: string; created_at?: string | null }, b: { fecha: string; created_at?: string | null }): boolean {
  if (a.fecha !== b.fecha) return a.fecha > b.fecha
  return (a.created_at ?? '') > (b.created_at ?? '')
}

/** '1.234,5' · '12,5' · '12.5' · '7' → número. null si no parsea. */
export function parseCantidad(v: unknown): number | null {
  if (typeof v === 'number') return Number.isFinite(v) ? Math.round(v * 100) / 100 : null
  if (typeof v !== 'string') return null
  let s = v.trim().replace(/\s/g, '')
  if (!s) return null
  // formato AR: punto de miles, coma decimal
  if (/^-?\d{1,3}(\.\d{3})+(,\d+)?$/.test(s)) s = s.replace(/\./g, '').replace(',', '.')
  else s = s.replace(',', '.')
  if (!/^-?\d+(\.\d+)?$/.test(s)) return null
  const n = Number(s)
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : null
}

/** Efecto de un movimiento sobre el stock. */
export function deltaDe(m: { tipo: string; cantidad: number }): number {
  if (m.tipo === 'compra') return Math.abs(m.cantidad)
  if (m.tipo === 'consumo') return -Math.abs(m.cantidad)
  return m.cantidad // ajuste: con signo
}

export interface StockCalculado {
  stock: number
  movimientos: number
  ultimaCompra: { fecha: string; precio_unitario: number | null; proveedor: string | null; created_at?: string | null } | null
  /** stock × último precio de compra (si hay). */
  valorizado: number | null
}

export function calcularStock(items: ItemBase[], movimientos: MovimientoBase[]): Map<string, StockCalculado> {
  const out = new Map<string, StockCalculado>()
  for (const it of items) out.set(it.id, { stock: 0, movimientos: 0, ultimaCompra: null, valorizado: null })
  for (const m of movimientos) {
    const s = out.get(m.item_id)
    if (!s) continue
    s.stock = Math.round((s.stock + deltaDe(m)) * 100) / 100
    s.movimientos++
    if (m.tipo === 'compra' && (!s.ultimaCompra || esMasReciente(m, s.ultimaCompra))) {
      s.ultimaCompra = { fecha: m.fecha, precio_unitario: m.precio_unitario ?? null, proveedor: m.proveedor ?? null, created_at: m.created_at ?? null }
    }
  }
  for (const s of out.values()) {
    const p = s.ultimaCompra?.precio_unitario
    s.valorizado = p != null && s.stock > 0 ? Math.round(s.stock * p * 100) / 100 : null
  }
  return out
}

/**
 * Sin stock → rojo; bajo el mínimo → naranja; si no, OK.
 * Mínimo 0 (o null) significa "sin alerta" DE VERDAD: un ítem que no se controla
 * (p. ej. EPP que esa empresa no maneja) no aparece en rojo por estar en 0 — se
 * muestra gris "Sin alerta". Con stock > 0 sigue siendo OK.
 */
export function estadoStock(stock: number, minimo: number | null | undefined): EstadoVencimiento {
  const sinAlerta = minimo == null || minimo <= 0
  if (stock <= 0) return sinAlerta ? 'sin_fecha' : 'vencido'
  if (!sinAlerta && stock <= minimo) return 'proximo'
  return 'vigente'
}

export const ESTADO_STOCK_LABEL: Record<EstadoVencimiento, string> = {
  vencido: 'Sin stock',
  proximo: 'Bajo mínimo',
  vigente: 'OK',
  // 'sin_fecha' SOLO ocurre con stock <= 0 y sin mínimo: el ítem está vacío, pero
  // nadie pidió que avise. Decía "Sin alerta", que describe la configuración y no
  // el stock: la fila parecía normal estando en cero. Gris (no alarma) pero honesto.
  sin_fecha: 'En cero',
}

/** Compras de un mes ('YYYY-MM'): cuántas y cuánto (solo las que tienen precio). */
export function comprasDelMes(movimientos: MovimientoBase[], mes: string): { compras: number; total: number; sinPrecio: number } {
  let compras = 0, total = 0, sinPrecio = 0
  for (const m of movimientos) {
    if (m.tipo !== 'compra' || !m.fecha.startsWith(mes)) continue
    compras++
    if (m.precio_unitario != null) total += Math.abs(m.cantidad) * m.precio_unitario
    else sinPrecio++
  }
  return { compras, total: Math.round(total * 100) / 100, sinPrecio }
}

/** Mes en curso 'YYYY-MM' en hora Argentina (Vercel corre en UTC). */
export function mesClave(d: Date = new Date()): string {
  return diaClaveAR(d).slice(0, 7)
}

/** Hoy 'YYYY-MM-DD' en hora Argentina: fecha por defecto y tope de los movimientos. */
export function hoyClave(d: Date = new Date()): string {
  return diaClaveAR(d)
}

/** Stock actual a partir de una lista de movimientos de UN ítem (para recalcular con datos frescos antes de un ajuste). */
export function sumarStock(movimientos: { tipo: string; cantidad: number }[]): number {
  return Math.round(movimientos.reduce((acc, m) => acc + deltaDe(m), 0) * 100) / 100
}

export function fmtCantidad(n: number, unidad?: string | null): string {
  const num = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 2 }).format(n)
  return unidad ? `${num} ${unidad}` : num
}

export function fmtMoneda(n: number): string {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n)
}

export function normalizarNombre(s: string): string {
  return s.replace(/\s+/g, ' ').trim()
}

/** Categorías distintas presentes, ordenadas; sin vacíos. */
export function categoriasDe(items: { categoria?: string | null }[]): string[] {
  return [...new Set(items.map((i) => (i.categoria ?? '').trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'es'))
}

// ============================================================
// Organización del catálogo para la vista: categoría → familia → ítem.
// La mitad del catálogo son talles de una misma prenda ("Camisa ADC T 36"…
// "T 54"): en una lista plana alfabética son nueve filas casi idénticas.
// Acá se agrupan, pero NUNCA se fusionan: cada fila sigue siendo un ítem real
// con su id, porque los movimientos (y sobre todo el ajuste por conteo, que
// escribe la diferencia contra el stock del ítem) necesitan un id verdadero.
// ============================================================

export const SIN_CATEGORIA = 'Sin categoría'

/** Talles alfabéticos en orden real; los numéricos se ordenan como números. */
const TALLES = ['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL']

/**
 * "Camisa ADC T 42" → { base: 'Camisa ADC', variante: '42' }. null si no es una variante.
 * Exige el marcador T/Talle antes del talle, así "Bidón 20 L" o "Lavandina 5 L"
 * no se parten. Conservador a propósito: lo peor que puede pasar con un falso
 * positivo es que dos filas queden agrupadas de más — nada se oculta ni se suma.
 */
export function partirVariante(nombre: string): { base: string; variante: string } | null {
  const m = /^(.+?)\s+(?:T|Talle)\.?\s*([A-Za-z]{1,4}|\d{1,2})$/.exec(nombre.trim())
  if (!m) return null
  const v = m[2].toUpperCase()
  if (/^\d+$/.test(v)) return { base: m[1].trim(), variante: v }
  return TALLES.includes(v) ? { base: m[1].trim(), variante: v } : null
}

function compararVariante(a: string, b: string): number {
  const ia = TALLES.indexOf(a), ib = TALLES.indexOf(b)
  if (ia !== -1 && ib !== -1) return ia - ib
  const na = Number(a), nb = Number(b)
  if (Number.isFinite(na) && Number.isFinite(nb)) return na - nb
  return a.localeCompare(b, 'es')
}

/** Orden del catálogo: por nombre base y, dentro de una familia, por talle real (S, M, L, XL). */
export function compararItems(a: { nombre: string }, b: { nombre: string }): number {
  const va = partirVariante(a.nombre), vb = partirVariante(b.nombre)
  const base = (va?.base ?? a.nombre).localeCompare(vb?.base ?? b.nombre, 'es')
  if (base !== 0) return base
  if (!va || !vb) return a.nombre.localeCompare(b.nombre, 'es')
  return compararVariante(va.variante, vb.variante)
}

/** Una familia de talles (≥2 variantes) o un ítem suelto con su nombre completo. */
export type EntradaCatalogo<T> =
  | { tipo: 'familia'; base: string; variantes: { item: T; variante: string }[] }
  | { tipo: 'item'; item: T }

export interface GrupoCategoria<T> {
  categoria: string
  total: number
  sinStock: number
  bajoMinimo: number
  entradas: EntradaCatalogo<T>[]
}

/**
 * Agrupa por categoría (y dentro, por familia de talles) con los subtotales que
 * van en el encabezado de cada sección. `estadoDe` la calcula quien llama, que
 * es el único que conoce el stock.
 */
export function agruparCatalogo<T extends { nombre: string; categoria?: string | null }>(
  items: T[],
  estadoDe: (item: T) => EstadoVencimiento
): GrupoCategoria<T>[] {
  const porCategoria = new Map<string, T[]>()
  for (const it of items) {
    const cat = (it.categoria ?? '').trim() || SIN_CATEGORIA
    const arr = porCategoria.get(cat)
    if (arr) arr.push(it)
    else porCategoria.set(cat, [it])
  }

  const grupos: GrupoCategoria<T>[] = []
  for (const [categoria, propios] of porCategoria) {
    let sinStock = 0, bajoMinimo = 0
    for (const it of propios) {
      const e = estadoDe(it)
      if (e === 'vencido') sinStock++
      else if (e === 'proximo') bajoMinimo++
    }

    // Familias por nombre base; las de un solo miembro se muestran como ítem suelto
    // (un rótulo "Campera ADC" sobre una única fila sería ruido, no estructura).
    const porBase = new Map<string, { item: T; variante: string }[]>()
    const sueltos: T[] = []
    for (const it of propios) {
      const v = partirVariante(it.nombre)
      if (!v) { sueltos.push(it); continue }
      const arr = porBase.get(v.base)
      if (arr) arr.push({ item: it, variante: v.variante })
      else porBase.set(v.base, [{ item: it, variante: v.variante }])
    }

    const entradas: EntradaCatalogo<T>[] = []
    for (const [base, variantes] of porBase) {
      if (variantes.length === 1) sueltos.push(variantes[0].item)
      else entradas.push({ tipo: 'familia', base, variantes: variantes.sort((a, b) => compararVariante(a.variante, b.variante)) })
    }
    for (const item of sueltos) entradas.push({ tipo: 'item', item })

    const nombreDe = (e: EntradaCatalogo<T>) => (e.tipo === 'familia' ? e.base : e.item.nombre)
    entradas.sort((a, b) => nombreDe(a).localeCompare(nombreDe(b), 'es'))

    grupos.push({ categoria, total: propios.length, sinStock, bajoMinimo, entradas })
  }

  // "Sin categoría" al final; el resto alfabético.
  return grupos.sort((a, b) => {
    if (a.categoria === SIN_CATEGORIA) return 1
    if (b.categoria === SIN_CATEGORIA) return -1
    return a.categoria.localeCompare(b.categoria, 'es')
  })
}
