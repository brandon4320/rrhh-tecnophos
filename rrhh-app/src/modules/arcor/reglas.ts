// ============================================================
// Reglas puras del módulo ARCOR (sin I/O): normalización de lugar y
// fecha, nombre de pestaña/mes, detección de silencio del sistema,
// resúmenes. Espejan las reglas del servicio Python (core.normalizar_lugar,
// excel_store.nombre_tab) — si cambian allá, cambian acá.
// ============================================================
import type { EstadoVencimiento } from '@/types'

export const LUGARES = ['BUENOS AIRES', 'CORDOBA', 'MENDOZA', 'ROSARIO'] as const
export type Lugar = (typeof LUGARES)[number]

export const ESTADOS_CONTENEDOR = ['encontrado', 'pendiente_arcor', 'revisar_foto', 'descartado'] as const
export type EstadoContenedor = (typeof ESTADOS_CONTENEDOR)[number]

export const ORIGENES = ['whatsapp', 'manual', 'respuesta_arcor', 'conciliacion', 'backfill'] as const
export type Origen = (typeof ORIGENES)[number]

export const SEVERIDADES = ['info', 'warning', 'critical'] as const
export type Severidad = (typeof SEVERIDADES)[number]

export const MESES = [
  'ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO',
  'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE',
] as const

export const TZ_AR = 'America/Argentina/Buenos_Aires'

export const ESTADO_CONTENEDOR_LABEL: Record<EstadoContenedor, string> = {
  encontrado: 'Cargado',
  pendiente_arcor: 'Pendiente ARCOR',
  revisar_foto: 'Revisar foto',
  descartado: 'Descartado',
}

function sinAcentos(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '')
}

/** 'Rodríguez Peña' / 'TPR Rosario' / 'bs as' → una de las 4 provincias, o null si no reconoce nada. */
export function normalizarLugar(raw: unknown): Lugar | null {
  if (typeof raw !== 'string') return null
  const s = sinAcentos(raw).toUpperCase().replace(/[^A-Z ]/g, ' ').replace(/\s+/g, ' ').trim()
  if (!s) return null
  if (s.includes('ROSARIO')) return 'ROSARIO'
  if (s.includes('CORDOBA')) return 'CORDOBA'
  if (s.includes('MENDOZA')) return 'MENDOZA'
  if (s.includes('AIRES') || /\bBS\b/.test(s) || /\bBSAS\b/.test(s) || /\bCABA\b/.test(s)) return 'BUENOS AIRES'
  return null
}

/** Acepta 'YYYY-MM-DD', 'DD/MM/YYYY', 'D/M/YYYY' o un ISO con hora → 'YYYY-MM-DD' (o null). */
export function parseFechaFlexible(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const s = raw.trim()
  let y: number, m: number, d: number
  let match = /^(\d{4})-(\d{2})-(\d{2})(?:[T ].*)?$/.exec(s)
  if (match) {
    ;[y, m, d] = [Number(match[1]), Number(match[2]), Number(match[3])]
  } else {
    match = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s)
    if (!match) return null
    ;[d, m, y] = [Number(match[1]), Number(match[2]), Number(match[3])]
  }
  if (y < 2020 || y > 2100 || m < 1 || m > 12 || d < 1 || d > 31) return null
  const dt = new Date(Date.UTC(y, m - 1, d))
  if (dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

/** 'YYYY-MM-DD' → 'AGOSTO 2026' (nombre de la pestaña del Sheets). */
export function mesDeFecha(iso: string): string {
  const m = Number(iso.slice(5, 7))
  return `${MESES[m - 1]} ${iso.slice(0, 4)}`
}

export function esMesValido(s: unknown): s is string {
  return typeof s === 'string' && new RegExp(`^(${MESES.join('|')}) \\d{4}$`).test(s)
}

/** Mes en curso en hora Argentina. */
export function mesActual(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: TZ_AR, year: 'numeric', month: 'numeric' })
    .formatToParts(now)
  const y = parts.find((p) => p.type === 'year')!.value
  const m = Number(parts.find((p) => p.type === 'month')!.value)
  return `${MESES[m - 1]} ${y}`
}

export function mesAnterior(mes: string): string {
  const [nombre, anio] = mes.split(' ')
  const idx = MESES.indexOf(nombre as (typeof MESES)[number])
  if (idx < 0) return mes
  return idx === 0 ? `DICIEMBRE ${Number(anio) - 1}` : `${MESES[idx - 1]} ${anio}`
}

/** Para ordenar meses: 'AGOSTO 2026' → 202608. */
export function claveMes(mes: string): number {
  const [nombre, anio] = mes.split(' ')
  const idx = MESES.indexOf(nombre as (typeof MESES)[number])
  return Number(anio) * 100 + (idx < 0 ? 0 : idx + 1)
}

/** Hora (0-23) en Argentina. */
export function horaAR(now: Date = new Date()): number {
  const h = new Intl.DateTimeFormat('en-US', { timeZone: TZ_AR, hour: 'numeric', hour12: false }).format(now)
  return Number(h) % 24
}

/**
 * ¿El sistema dejó de reportar? Todo lo que ARCOR manda a Gestión toca el
 * heartbeat; la guardia de WhatsApp (WF12) lo hace cada 2 h entre las 8 y las 22.
 * De día se tolera 3 h de silencio; de noche (22-08) no hay guardia, se toleran 11 h.
 */
export function evaluarSilencio(
  heartbeatTs: string | null | undefined,
  now: Date = new Date()
): { silencio: boolean; minutos: number | null; umbralMin: number } {
  const h = horaAR(now)
  const umbralMin = h >= 8 && h < 22 ? 180 : 660
  if (!heartbeatTs) return { silencio: true, minutos: null, umbralMin }
  const t = new Date(heartbeatTs).getTime()
  if (Number.isNaN(t)) return { silencio: true, minutos: null, umbralMin }
  const minutos = Math.max(0, Math.round((now.getTime() - t) / 60000))
  return { silencio: minutos > umbralMin, minutos, umbralMin }
}

export function resumenPorLugar(
  rows: { lugar: string; estado: string }[]
): { lugar: Lugar; total: number; pendientes: number; revisar: number }[] {
  return LUGARES.map((lugar) => {
    const propios = rows.filter((r) => r.lugar === lugar && r.estado !== 'descartado')
    return {
      lugar,
      total: propios.length,
      pendientes: propios.filter((r) => r.estado === 'pendiente_arcor').length,
      revisar: propios.filter((r) => r.estado === 'revisar_foto').length,
    }
  })
}

/** Umbrales del WF10 (aviso de crédito): ≥70 % usado = warning; ≥90 % = critical. */
export function nivelCredito(porcentajeUsado: number | null | undefined): Severidad {
  if (porcentajeUsado == null || Number.isNaN(porcentajeUsado)) return 'info'
  if (porcentajeUsado >= 90) return 'critical'
  if (porcentajeUsado >= 70) return 'warning'
  return 'info'
}

/** Severidad → estado visual (EstadoPill es el único encoding de estado de la app). */
export function severidadAEstado(s: Severidad): EstadoVencimiento {
  return s === 'critical' ? 'vencido' : s === 'warning' ? 'proximo' : 'vigente'
}

export function estadoContenedorAEstado(e: EstadoContenedor): EstadoVencimiento {
  switch (e) {
    case 'encontrado': return 'vigente'
    case 'pendiente_arcor': return 'proximo'
    case 'revisar_foto': return 'vencido'
    default: return 'sin_fecha'
  }
}

/** Título legible de un lugar: 'BUENOS AIRES' → 'Buenos Aires'. */
export function tituloLugar(lugar: string): string {
  const especiales: Record<string, string> = { CORDOBA: 'Córdoba' }
  if (especiales[lugar]) return especiales[lugar]
  return lugar.toLowerCase().replace(/(^|\s)\S/g, (c) => c.toUpperCase())
}
