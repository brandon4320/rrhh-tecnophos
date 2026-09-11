// ============================================================
// Reglas puras de la documentación mensual por empresa (sin I/O).
// Réplica de las carpetas de la oficinista: AÑO → MES → carpetas fijas.
// ============================================================

import type { EstadoVencimiento } from '@/types'

/** Carpetas que se repiten todos los meses (en el orden en que se muestran). */
export const CARPETAS_FIJAS = ['Aportes sindicales', 'ART', 'F931', 'Pagos', 'Recibos de sueldos', 'SVO'] as const
export type CarpetaFija = (typeof CARPETAS_FIJAS)[number]

/** `carpeta = ''` en la base = archivos sueltos en la raíz del mes. */
export const CARPETA_RAIZ = ''
export const LABEL_RAIZ = 'Archivos sueltos del mes'

/** La carpeta cuyos "archivos" también pueden ser los recibos por empleado del legajo. */
export const CARPETA_RECIBOS: CarpetaFija = 'Recibos de sueldos'

export const MESES_CORTOS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'] as const
export const MESES_LARGOS = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
] as const

export interface DocMinimo {
  periodo: string        // 'YYYY-MM-01'
  carpeta: string
}

/** Colapsa espacios y, si coincide (sin importar mayúsculas) con una fija, devuelve el nombre canónico. */
export function normalizarCarpeta(v: unknown): string {
  if (typeof v !== 'string') return CARPETA_RAIZ
  const limpio = v.replace(/\s+/g, ' ').trim()
  if (!limpio) return CARPETA_RAIZ
  const fija = CARPETAS_FIJAS.find((c) => c.toLowerCase() === limpio.toLowerCase())
  return fija ?? limpio
}

/** Carpetas a mostrar en un mes: las fijas siempre, más las extra que tengan archivos (ordenadas). Nunca la raíz. */
export function carpetasDelMes(docs: DocMinimo[]): string[] {
  const extras = new Set<string>()
  for (const d of docs) {
    const c = normalizarCarpeta(d.carpeta)
    if (c && !(CARPETAS_FIJAS as readonly string[]).includes(c)) extras.add(c)
  }
  return [...CARPETAS_FIJAS, ...[...extras].sort((a, b) => a.localeCompare(b, 'es'))]
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

/** 'YYYY-MM-01' → 'Julio 2026'. */
export function labelPeriodo(periodo: string): string {
  const m = /^(\d{4})-(\d{2})/.exec(periodo)
  if (!m) return periodo
  const mes = Number(m[2])
  if (mes < 1 || mes > 12) return periodo
  return `${MESES_LARGOS[mes - 1]} ${m[1]}`
}

/** Primer día del mes actual en 'YYYY-MM-01' (según el reloj que se pase). */
export function periodoActual(now: Date = new Date()): string {
  return periodoDe(now.getFullYear(), now.getMonth() + 1)
}

/** Mes anterior al actual: lo habitual es cargar la documentación del mes que cerró. */
export function periodoAnterior(now: Date = new Date()): string {
  const d = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  return periodoDe(d.getFullYear(), d.getMonth() + 1)
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

/** Lo que baja de ARCA/ART/sindicatos: PDF casi siempre, a veces planillas o TXT (F931). */
export function validarArchivoDocumento(file: { type: string; size: number; name: string }): string | null {
  if (!file.name) return 'Elegí un archivo.'
  if (file.size === 0) return `"${file.name}" está vacío.`
  if (file.size > MAX_DOCUMENTO_BYTES) return `"${file.name}" pesa ${(file.size / 1048576).toFixed(1)} MB; el máximo es 25 MB.`
  if (!(MIME_PERMITIDOS as readonly string[]).includes(file.type || '') && !EXT_PERMITIDAS.test(file.name)) {
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
