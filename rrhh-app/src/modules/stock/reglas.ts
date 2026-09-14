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
  sin_fecha: 'Sin alerta',
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
