// ============================================================
// Reglas puras de Stock (sin I/O): el stock actual es la suma de los
// movimientos, el estado sale del mínimo, y las compras del mes se
// valorizan con precio × cantidad cuando hay precio.
// ============================================================
import type { EstadoVencimiento } from '@/types'

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
  ultimaCompra: { fecha: string; precio_unitario: number | null; proveedor: string | null } | null
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
    if (m.tipo === 'compra' && (!s.ultimaCompra || m.fecha >= s.ultimaCompra.fecha)) {
      s.ultimaCompra = { fecha: m.fecha, precio_unitario: m.precio_unitario ?? null, proveedor: m.proveedor ?? null }
    }
  }
  for (const s of out.values()) {
    const p = s.ultimaCompra?.precio_unitario
    s.valorizado = p != null && s.stock > 0 ? Math.round(s.stock * p * 100) / 100 : null
  }
  return out
}

/** Sin stock → rojo; bajo el mínimo (si hay mínimo) → naranja; si no, OK. */
export function estadoStock(stock: number, minimo: number | null | undefined): EstadoVencimiento {
  if (stock <= 0) return 'vencido'
  if (minimo != null && minimo > 0 && stock <= minimo) return 'proximo'
  return 'vigente'
}

export const ESTADO_STOCK_LABEL: Record<EstadoVencimiento, string> = {
  vencido: 'Sin stock',
  proximo: 'Bajo mínimo',
  vigente: 'OK',
  sin_fecha: '—',
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

export function mesClave(d: Date = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
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
