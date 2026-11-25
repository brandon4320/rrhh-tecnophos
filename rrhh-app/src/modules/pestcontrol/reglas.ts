// ============================================================
// Pestcontrol: stock de insumos de fumigación de barcos (migración 37).
// Funciones puras. El libro (cada movimiento con el saldo de cada insumo
// después de él) se arma igual que la planilla original: sumando en orden de
// fecha y, dentro del día, en el orden de carga. El saldo NUNCA se guarda.
// ============================================================

import { sanitizarNombreArchivo } from '@/modules/documentos/reglas'

/**
 * Empresas que llevan Pestcontrol, por NOMBRE normalizado (sin acentos ni mayúsculas): hoy solo
 * Tecnophos Bahía Blanca (la fumigación de barcos sale de ahí). Por nombre y no por slug porque
 * el slug de prod no es el que se deduce del nombre (la migración 37 lo supuso y no cargó nada).
 */
export const EMPRESAS_PESTCONTROL = ['tecnophos bahia blanca'] as const

export function llevaPestcontrol(empresa: { nombre: string | null } | null | undefined): boolean {
  const n = (empresa?.nombre ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim()
  return (EMPRESAS_PESTCONTROL as readonly string[]).includes(n)
}

export const SIN_PERMISO_PESTCONTROL = 'No tenés acceso a Pestcontrol.'

export interface PestInsumo {
  id: string
  codigo: string
  nombre: string
  unidad: string | null
  /** Unidades por caja (fosfuro: 14 tarros). null = no se cuenta en cajas. */
  por_caja: number | null
  orden: number
  /** Se muestra dentro de la tarjeta de otro insumo (los tubos, en equipos chicos). Migración 39. */
  dentro_de?: string | null
}

export interface PestLinea {
  insumo_id: string
  entrada: number
  salida: number
}

export interface PestMovimiento {
  id: string
  fecha: string
  barco: string | null
  detalle: string | null
  comprobante: string | null
  lugar: string | null
  notas: string | null
  orden: number
  lineas: PestLinea[]
  /** Cantidad de comprobantes adjuntos (remitos, facturas, fotos). */
  adjuntos: number
}

/** Un renglón del libro: el movimiento + el saldo de cada insumo después de él. */
export type PestRenglon = PestMovimiento & { saldos: Record<string, number> }

export function redondear(n: number): number {
  return Math.round(n * 1000) / 1000
}

export function ordenar<T extends { fecha: string; orden: number }>(movs: T[]): T[] {
  return [...movs].sort((a, b) => (a.fecha === b.fecha ? a.orden - b.orden : a.fecha < b.fecha ? -1 : 1))
}

/** Libro en orden cronológico, con el saldo acumulado de cada insumo. */
export function armarLibro(insumos: PestInsumo[], movs: PestMovimiento[]): PestRenglon[] {
  const saldo: Record<string, number> = Object.fromEntries(insumos.map((i) => [i.id, 0]))
  return ordenar(movs).map((m) => {
    for (const l of m.lineas) saldo[l.insumo_id] = redondear((saldo[l.insumo_id] ?? 0) + l.entrada - l.salida)
    return { ...m, saldos: { ...saldo } }
  })
}

export function saldosActuales(insumos: PestInsumo[], libro: PestRenglon[]): Record<string, number> {
  const ult = libro[libro.length - 1]
  return Object.fromEntries(insumos.map((i) => [i.id, ult?.saldos[i.id] ?? 0]))
}

/** Fecha del último movimiento de cada insumo. */
export function ultimoMovimiento(libro: PestRenglon[]): Record<string, string> {
  const out: Record<string, string> = {}
  for (const r of libro) for (const l of r.lineas) out[l.insumo_id] = r.fecha
  return out
}

const NUM = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 2 })

export function fmtCantidad(n: number): string {
  return NUM.format(n)
}

/** "≈ 101,9 cajas" para el fosfuro (saldo en tarros / 14). */
export function enCajas(insumo: Pick<PestInsumo, 'por_caja'>, cantidad: number): string | null {
  if (!insumo.por_caja) return null
  const c = cantidad / insumo.por_caja
  const txt = Number.isInteger(c) ? NUM.format(c) : `≈ ${NUM.format(Math.round(c * 10) / 10)}`
  return `${txt} ${Math.abs(c) === 1 ? 'caja' : 'cajas'}`
}

/**
 * Cajas como las muestra la columna "Cajas" del Excel: tarros / por_caja, sin decimales
 * (formato '0' de Excel: redondea alejándose de cero). 1426 tarros → 102 cajas.
 * Es lo que mira la gente de Pestcontrol; los tarros quedan como detalle.
 */
export function cajasEnteras(insumo: Pick<PestInsumo, 'por_caja'>, cantidad: number): number | null {
  if (!insumo.por_caja) return null
  const c = cantidad / insumo.por_caja
  const r = Math.round(Math.abs(c))
  return r === 0 ? 0 : c < 0 ? -r : r
}

/** "4 equipos" / "1 equipo" / "110 mangas" (sin unidad, el nombre del insumo). */
export function cantidadConUnidad(cantidad: number, insumo: Pick<PestInsumo, 'nombre' | 'unidad'>): string {
  const n = Math.abs(cantidad)
  const unidad = insumo.unidad ?? insumo.nombre.toLowerCase()
  return `${fmtCantidad(n)} ${n === 1 && unidad.endsWith('s') ? unidad.slice(0, -1) : unidad}`
}

/**
 * Saldo negativo = lo que les DEBEN (así lo lee Pestcontrol). Junta el insumo y los que
 * van dentro de su tarjeta: "4 equipos y 2 tubos". null si no hay deuda.
 */
export function textoDeuda(partes: { saldo: number; insumo: Pick<PestInsumo, 'nombre' | 'unidad'> }[]): string | null {
  const deudas = partes.filter((p) => p.saldo < 0).map((p) => cantidadConUnidad(p.saldo, p.insumo))
  if (!deudas.length) return null
  return deudas.length === 1 ? deudas[0] : `${deudas.slice(0, -1).join(', ')} y ${deudas.at(-1)}`
}

/** Cantidad tipeada ("12,5", "12.5", "1.200,5") → número ≥ 0. Lo que no es un número válido cuenta como 0. */
export function parseCantidad(s: string): number {
  const t = s.trim()
  const n = Number(t.includes(',') ? t.replace(/\./g, '').replace(',', '.') : t)
  return Number.isFinite(n) && n > 0 ? n : 0
}

/** "12" → busca en barco, detalle, comprobante, lugar y notas (por palabras, sin acentos). */
export function textoBuscable(m: Pick<PestMovimiento, 'barco' | 'detalle' | 'comprobante' | 'lugar' | 'notas'>): (string | null)[] {
  return [m.barco, m.detalle, m.comprobante, m.lugar, m.notas]
}

// ── Comprobantes adjuntos (R2) ──

export const MAX_ADJUNTO_BYTES = 15 * 1024 * 1024
const EXT_ADJUNTO = /\.(pdf|jpe?g|png|webp|heic|heif)$/i
const MIME_ADJUNTO = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']

/** Foto o PDF del remito/factura, hasta 15 MB. Se aplica en el browser Y en el servidor. */
export function validarAdjunto(file: { type: string; size: number; name: string }): string | null {
  if (!file.name) return 'Elegí un archivo.'
  if (file.size === 0) return `"${file.name}" está vacío.`
  if (file.size > MAX_ADJUNTO_BYTES) return `"${file.name}" pesa más de 15 MB.`
  const mimeOk = !file.type || file.type === 'application/octet-stream' || MIME_ADJUNTO.includes(file.type)
  if (!EXT_ADJUNTO.test(file.name) || !mimeOk) return `"${file.name}": solo se aceptan fotos o PDF.`
  return null
}

/** Clave en R2: `pestcontrol/<movimiento>/<ts>-<nombre>`. El registro valida el prefijo del movimiento. */
export function pathAdjunto(movimientoId: string, nombre: string, now: number = Date.now()): string {
  return `${prefijoAdjuntos(movimientoId)}${now}-${sanitizarNombreArchivo(nombre)}`
}

export function prefijoAdjuntos(movimientoId: string): string {
  return `pestcontrol/${movimientoId}/`
}

/** 'YYYY-MM-DD' → 'DD/MM/YYYY' sin pasar por Date (una fecha sola no tiene huso: AGENTS.md §9). */
export function fmtFecha(fecha: string): string {
  const [a, m, d] = fecha.slice(0, 10).split('-')
  return d && m && a ? `${d}/${m}/${a}` : fecha
}
