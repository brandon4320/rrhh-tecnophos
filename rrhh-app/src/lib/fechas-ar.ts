// ============================================================
// Formateo de fechas/horas en zona Argentina (UTC-3), independiente del
// TZ del servidor (Vercel corre en UTC). Ver AGENTS.md §9.
// - timestamptz (con hora): se formatea en TZ AR.
// - date ('YYYY-MM-DD'): se ancla a mediodía para evitar el corrimiento de un día.
// ============================================================

export const TZ_AR = 'America/Argentina/Buenos_Aires'

function toDate(value: string): Date {
  const isDateOnly = value.length === 10 && !value.includes('T')
  return new Date(isDateOnly ? value + 'T12:00:00' : value)
}

function fmt(value: string | null | undefined, opts: Intl.DateTimeFormatOptions): string {
  if (!value) return ''
  try {
    return new Intl.DateTimeFormat('es-AR', { timeZone: TZ_AR, ...opts }).format(toDate(value))
  } catch {
    return ''
  }
}

/** 08/09 */
export function fmtFechaAR(value: string | null | undefined): string {
  return fmt(value, { day: '2-digit', month: '2-digit' })
}

/** 08/09/2026 */
export function fmtFechaCompletaAR(value: string | null | undefined): string {
  return fmt(value, { day: '2-digit', month: '2-digit', year: 'numeric' })
}

/** 14:32 */
export function fmtHoraAR(value: string | null | undefined): string {
  return fmt(value, { hour: '2-digit', minute: '2-digit', hour12: false })
}

/** 08/09 · 14:32 */
export function fmtFechaHoraAR(value: string | null | undefined): string {
  const f = fmtFechaAR(value)
  const h = fmtHoraAR(value)
  return f && h ? `${f} · ${h}` : f || h
}

/** lunes 8 de septiembre */
export function fmtFechaLargaAR(value: string | null | undefined): string {
  return fmt(value, { weekday: 'long', day: 'numeric', month: 'long' })
}

/** Clave de día en hora Argentina: 'YYYY-MM-DD'. Sirve para agrupar timestamps por día local. */
export function diaClaveAR(value: string | Date): string {
  const d = typeof value === 'string' ? toDate(value) : value
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ_AR, year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(d)
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? ''
  return `${get('year')}-${get('month')}-${get('day')}`
}

/** 'Hoy' / 'Ayer' / 'lunes 8 de septiembre' para una clave de día. */
export function etiquetaDiaAR(claveDia: string, now: Date = new Date()): string {
  const hoy = diaClaveAR(now)
  if (claveDia === hoy) return 'Hoy'
  const ayer = diaClaveAR(new Date(now.getTime() - 86400000))
  if (claveDia === ayer) return 'Ayer'
  return fmtFechaLargaAR(claveDia)
}

/** 'hace un momento' · 'hace 5 min' · 'hace 3 h' · 'hace 2 días' */
export function tiempoRelativo(value: string | null | undefined, now: Date = new Date()): string {
  if (!value) return ''
  const t = new Date(value).getTime()
  if (Number.isNaN(t)) return ''
  const min = Math.round((now.getTime() - t) / 60000)
  if (min < 1) return 'hace un momento'
  if (min < 60) return `hace ${min} min`
  const h = Math.floor(min / 60)
  if (h < 48) return `hace ${h} h`
  const d = Math.floor(h / 24)
  return `hace ${d} días`
}

/** Duración legible entre dos instantes: '45 min' · '2 h 15 min' · '3 días' */
export function duracion(desde: string, hasta: string | Date = new Date()): string {
  const a = new Date(desde).getTime()
  const b = typeof hasta === 'string' ? new Date(hasta).getTime() : hasta.getTime()
  if (Number.isNaN(a) || Number.isNaN(b)) return ''
  const min = Math.max(0, Math.round((b - a) / 60000))
  if (min < 60) return `${min} min`
  const h = Math.floor(min / 60)
  if (h < 24) return min % 60 ? `${h} h ${min % 60} min` : `${h} h`
  const d = Math.floor(h / 24)
  return h % 24 ? `${d} d ${h % 24} h` : `${d} días`
}
