// ============================================================
// Reglas puras de la documentación mensual por empresa (sin I/O).
// Réplica de las carpetas de la oficinista: AÑO → MES → carpetas fijas.
// Los períodos ('YYYY-MM-01', etiqueta "Julio 2026") se comparten con los
// comprobantes de sueldo: ver lib/recibos.ts (labelPeriodo, periodoDesdeMes).
// ============================================================

import type { EstadoVencimiento } from '@/types'
import { diaClaveAR } from '@/lib/fechas-ar'

/** Carpetas que se repiten todos los meses (en el orden en que se muestran). */
export const CARPETAS_FIJAS = ['Aportes sindicales', 'ART', 'F931', 'Pagos', 'Recibos de sueldos', 'SVO'] as const
export type CarpetaFija = (typeof CARPETAS_FIJAS)[number]

/** `carpeta = ''` en la base = archivos sueltos en la raíz del mes. */
export const CARPETA_RAIZ = ''
export const LABEL_RAIZ = 'Archivos sueltos del mes'

/** La carpeta cuyos "archivos" también pueden ser los recibos por empleado del legajo. */
export const CARPETA_RECIBOS: CarpetaFija = 'Recibos de sueldos'

export const MESES_CORTOS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'] as const

export interface DocMinimo {
  periodo: string        // 'YYYY-MM-01'
  carpeta: string
}

export function esCarpetaFija(c: string): c is CarpetaFija {
  return (CARPETAS_FIJAS as readonly string[]).includes(c)
}

/** Colapsa espacios y, si coincide (sin importar mayúsculas) con una fija, devuelve el nombre canónico. */
export function normalizarCarpeta(v: unknown): string {
  if (typeof v !== 'string') return CARPETA_RAIZ
  const limpio = v.replace(/\s+/g, ' ').trim()
  if (!limpio) return CARPETA_RAIZ
  const fija = CARPETAS_FIJAS.find((c) => c.toLowerCase() === limpio.toLowerCase())
  return fija ?? limpio
}

/** Carpetas NO fijas con archivos, ordenadas (nunca la raíz). */
export function carpetasExtra(docs: DocMinimo[]): string[] {
  const extras = new Set<string>()
  for (const d of docs) {
    const c = normalizarCarpeta(d.carpeta)
    if (c && !esCarpetaFija(c)) extras.add(c)
  }
  return [...extras].sort((a, b) => a.localeCompare(b, 'es'))
}

/** Carpetas a mostrar en un mes: las fijas siempre, más las extra que tengan archivos. */
export function carpetasDelMes(docs: DocMinimo[]): string[] {
  return [...CARPETAS_FIJAS, ...carpetasExtra(docs)]
}

/** Agrupa los documentos de un mes por carpeta ('' = raíz). */
export function agruparPorCarpeta<T extends DocMinimo>(docs: T[]): Map<string, T[]> {
  const mapa = new Map<string, T[]>()
  for (const d of docs) {
    const c = normalizarCarpeta(d.carpeta)
    if (!mapa.has(c)) mapa.set(c, [])
    mapa.get(c)!.push(d)
  }
  return mapa
}

export interface Completitud {
  /** Carpetas fijas con al menos un archivo (o cubiertas por otra fuente). */
  completas: CarpetaFija[]
  faltantes: CarpetaFija[]
  total: number
}

/**
 * Qué carpetas fijas del mes están cubiertas. `cubiertas` permite marcar una
 * carpeta como completa por otra vía (p. ej. "Recibos de sueldos" cuando todos
 * los empleados activos tienen su recibo en el legajo).
 */
export function completitudMes(docs: DocMinimo[], cubiertas: readonly string[] = []): Completitud {
  const con = new Set<string>(cubiertas)
  for (const d of docs) con.add(normalizarCarpeta(d.carpeta))
  const completas = CARPETAS_FIJAS.filter((c) => con.has(c))
  const faltantes = CARPETAS_FIJAS.filter((c) => !con.has(c))
  return { completas, faltantes, total: CARPETAS_FIJAS.length }
}

/** 'YYYY-MM-01' del mes (1..12) de un año. */
export function periodoDe(anio: number, mes: number): string {
  return `${anio}-${String(mes).padStart(2, '0')}-01`
}

/**
 * Año y mes EN HORA ARGENTINA del instante dado. Vercel corre en UTC: entre las
 * 21:00 y las 24:00 AR del último día del mes, `new Date().getMonth()` ya sería
 * el mes siguiente (AGENTS.md §9). Por eso todo "hoy" pasa por acá.
 */
export function anioMesAR(now: Date = new Date()): { anio: number; mes: number } {
  const clave = diaClaveAR(now) // 'YYYY-MM-DD'
  return { anio: Number(clave.slice(0, 4)), mes: Number(clave.slice(5, 7)) }
}

/** Primer día del mes actual (hora AR) en 'YYYY-MM-01'. */
export function periodoActual(now: Date = new Date()): string {
  const { anio, mes } = anioMesAR(now)
  return periodoDe(anio, mes)
}

/** Mes anterior al actual (hora AR): lo habitual es cargar la documentación del mes que cerró. */
export function periodoAnterior(now: Date = new Date()): string {
  const { anio, mes } = anioMesAR(now)
  return mes === 1 ? periodoDe(anio - 1, 12) : periodoDe(anio, mes - 1)
}

export const ESTADO_MES_LABEL: Record<EstadoVencimiento, string> = {
  vigente: 'Completo',
  proximo: 'Incompleto',
  vencido: 'Sin cargar',
  sin_fecha: 'Sin archivos',
}

/**
 * Estado de un mes para el pill:
 *  - vigente  → las 6 carpetas fijas cubiertas
 *  - proximo  → algo cargado pero faltan carpetas
 *  - vencido  → nada cargado y el mes ya pasó (su documentación debería existir)
 *  - sin_fecha → nada cargado, mes en curso o futuro (todavía no corresponde)
 */
export function estadoMes(periodo: string, completitud: Completitud, cantidadArchivos: number, now: Date = new Date()): EstadoVencimiento {
  if (completitud.faltantes.length === 0) return 'vigente'
  if (completitud.completas.length > 0 || cantidadArchivos > 0) return 'proximo'
  return periodo < periodoActual(now) ? 'vencido' : 'sin_fecha'
}

/** Nombre de carpeta → segmento seguro para la clave en R2. */
export function slugCarpeta(carpeta: string): string {
  const c = normalizarCarpeta(carpeta)
  if (!c) return '_raiz'
  return c
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'carpeta'
}

/** Nombre de archivo → seguro para la clave en R2 (conserva la extensión). */
export function sanitizarNombreArchivo(nombre: string): string {
  const base = nombre.split(/[\\/]/).pop() ?? nombre
  const limpio = base
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z0-9._-]+/g, '_').replace(/^_+|_+$/g, '')
  return limpio.slice(0, 120) || 'archivo'
}

/** Clave en R2. Lleva el id de la empresa para poder validar el path al registrar la fila. */
export function pathDocumento(empresaId: string, periodo: string, carpeta: string, nombre: string, now: number = Date.now()): string {
  return `documentos/${empresaId}/${periodo.slice(0, 7)}/${slugCarpeta(carpeta)}/${now}-${sanitizarNombreArchivo(nombre)}`
}

export const MAX_DOCUMENTO_BYTES = 25 * 1024 * 1024
const EXT_PERMITIDAS = /\.(pdf|jpe?g|png|webp|xlsx?|csv|docx?|txt|zip)$/i
const MIME_PERMITIDOS = [
  'application/pdf', 'image/jpeg', 'image/png', 'image/webp',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.ms-excel', 'text/csv',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/msword',
  'text/plain', 'application/zip', 'application/x-zip-compressed',
] as const

/**
 * Lo que baja de ARCA/ART/sindicatos: PDF casi siempre, a veces planillas o TXT (F931).
 * Se aplica en el browser Y en el servidor (firma de URL y registro). El tamaño
 * que llega al servidor es el declarado por el cliente, así que ahí vale como
 * chequeo de coherencia, no como garantía.
 */
export function validarArchivoDocumento(file: { type: string; size: number; name: string }): string | null {
  if (!file.name) return 'Elegí un archivo.'
  if (file.size === 0) return `"${file.name}" está vacío.`
  if (file.size > MAX_DOCUMENTO_BYTES) return `"${file.name}" pesa ${fmtBytes(file.size)}; el máximo es 25 MB.`
  // La extensión manda (el navegador deduce el mime de ahí); el mime, si viene, tiene que ser conocido o genérico.
  const mimeOk = !file.type || file.type === 'application/octet-stream' || (MIME_PERMITIDOS as readonly string[]).includes(file.type)
  if (!EXT_PERMITIDAS.test(file.name) || !mimeOk) {
    return `"${file.name}": solo se aceptan PDF, imágenes, Excel, Word, TXT o ZIP.`
  }
  return null
}

/**
 * Cuántos empleados distintos tienen recibo mensual en cada período
 * (para la carpeta "Recibos de sueldos": "18 de 21 empleados").
 */
export function empleadosConReciboPorPeriodo(recibos: { periodo: string; empleado_id: string; tipo?: string }[]): Map<string, number> {
  const sets = new Map<string, Set<string>>()
  for (const r of recibos) {
    if (r.tipo && r.tipo !== 'mensual') continue
    if (!sets.has(r.periodo)) sets.set(r.periodo, new Set())
    sets.get(r.periodo)!.add(r.empleado_id)
  }
  return new Map([...sets.entries()].map(([p, s]) => [p, s.size]))
}

export function fmtBytes(bytes: number | null | undefined): string {
  if (!bytes) return ''
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`
  return `${(bytes / 1048576).toFixed(1)} MB`
}
