// ============================================================
// Reglas puras de los comprobantes de sueldo (sin I/O).
// ============================================================

export const TIPOS_RECIBO = ['mensual', 'sac', 'liquidacion_final', 'otro'] as const
export type TipoRecibo = (typeof TIPOS_RECIBO)[number]

export const TIPO_RECIBO_LABEL: Record<TipoRecibo, string> = {
  mensual: 'Sueldo mensual',
  sac: 'Aguinaldo (SAC)',
  liquidacion_final: 'Liquidación final',
  otro: 'Otro',
}

export function esTipoRecibo(v: unknown): v is TipoRecibo {
  return typeof v === 'string' && (TIPOS_RECIBO as readonly string[]).includes(v)
}

/** '2026-08' (input type="month") → '2026-08-01' (columna date). null si no es válido. */
export function periodoDesdeMes(v: unknown): string | null {
  if (typeof v !== 'string') return null
  const m = /^(\d{4})-(\d{2})(?:-\d{2})?$/.exec(v.trim())
  if (!m) return null
  const anio = Number(m[1])
  const mes = Number(m[2])
  if (anio < 2000 || anio > 2100 || mes < 1 || mes > 12) return null
  return `${m[1]}-${m[2]}-01`
}

/** '2026-08-01' → '2026-08' para precargar el input type="month". */
export function mesDesdePeriodo(periodo: string): string {
  return periodo.slice(0, 7)
}

/** '2026-08-01' → 'Agosto 2026'. */
export function labelPeriodo(periodo: string): string {
  const d = new Date(periodo.slice(0, 10) + 'T12:00:00')
  if (Number.isNaN(d.getTime())) return periodo
  const s = new Intl.DateTimeFormat('es-AR', { month: 'long', year: 'numeric' }).format(d)
  return s.charAt(0).toUpperCase() + s.slice(1).replace(' de ', ' ')
}

/** Mes anterior al actual en formato 'YYYY-MM' (lo habitual es cargar el sueldo del mes que cerró). */
export function mesAnteriorInput(now: Date = new Date()): string {
  const d = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

/** Agrupa por año, del más reciente al más viejo; adentro, por período desc. */
export function agruparPorAnio<T extends { periodo: string }>(items: T[]): { anio: string; items: T[] }[] {
  const mapa = new Map<string, T[]>()
  for (const it of [...items].sort((a, b) => (a.periodo < b.periodo ? 1 : -1))) {
    const anio = it.periodo.slice(0, 4)
    if (!mapa.has(anio)) mapa.set(anio, [])
    mapa.get(anio)!.push(it)
  }
  return [...mapa.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1)).map(([anio, items]) => ({ anio, items }))
}

export const MIME_RECIBO_PERMITIDOS = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'] as const
export const MAX_RECIBO_BYTES = 15 * 1024 * 1024

export function validarArchivoRecibo(file: { type: string; size: number; name: string }): string | null {
  if (!file.name) return 'Elegí un archivo.'
  if (file.size === 0) return 'El archivo está vacío.'
  if (file.size > MAX_RECIBO_BYTES) return `El archivo pesa ${(file.size / 1048576).toFixed(1)} MB; el máximo es 15 MB.`
  const tipo = file.type || ''
  const porExt = /\.(pdf|jpe?g|png|webp)$/i.test(file.name)
  if (!(MIME_RECIBO_PERMITIDOS as readonly string[]).includes(tipo) && !porExt) {
    return 'Solo se aceptan PDF o imágenes (JPG, PNG, WEBP).'
  }
  return null
}
