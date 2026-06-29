// ============================================================
// Formateo de fechas en zona Argentina (UTC-3) para el módulo comercial.
// - timestamptz (con hora): se formatea en TZ AR.
// - date (solo fecha 'YYYY-MM-DD'): se ancla a mediodía para evitar
//   el corrimiento de un día.
// ============================================================

const TZ = 'America/Argentina/Buenos_Aires'

function toDate(value: string): Date {
  const isDateOnly = value.length === 10 && !value.includes('T')
  return new Date(isDateOnly ? value + 'T12:00:00' : value)
}

export function fmtFechaAR(value: string | null | undefined): string {
  if (!value) return ''
  try {
    return new Intl.DateTimeFormat('es-AR', { timeZone: TZ, day: '2-digit', month: '2-digit' }).format(toDate(value))
  } catch { return '' }
}

export function fmtHoraAR(value: string | null | undefined): string {
  if (!value) return ''
  try {
    return new Intl.DateTimeFormat('es-AR', { timeZone: TZ, hour: '2-digit', minute: '2-digit' }).format(toDate(value))
  } catch { return '' }
}

export function fmtFechaHoraAR(value: string | null | undefined): string {
  const f = fmtFechaAR(value)
  const h = fmtHoraAR(value)
  return f && h ? `${f} · ${h}` : f || h
}
