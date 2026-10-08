// ============================================================
// Reglas puras del módulo ARCOR (sin I/O): normalización de lugar y
// fecha, nombre de pestaña/mes, detección de silencio del sistema,
// resúmenes. Espejan las reglas del servicio Python (core.normalizar_lugar,
// excel_store.nombre_tab) — si cambian allá, cambian acá.
// ============================================================
import type { EstadoVencimiento } from '@/types'
import type { EventoRow } from './tipos'

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

/**
 * Localidades/terminales → provincia. Espejo de core.ALIAS_LUGAR del servicio
 * (si agregan una allá, agregarla acá). Sin la comparación difusa de difflib:
 * lo que no matchea devuelve null y el ingest cae a BUENOS AIRES, igual que allá.
 */
export const ALIAS_LUGAR: Record<string, Lugar> = {
  'ZARATE': 'BUENOS AIRES', 'CAMPANA': 'BUENOS AIRES', 'ESCOBAR': 'BUENOS AIRES',
  'DOCK SUD': 'BUENOS AIRES', 'LA PLATA': 'BUENOS AIRES', 'ENSENADA': 'BUENOS AIRES',
  'BAHIA BLANCA': 'BUENOS AIRES', 'EXOLGAN': 'BUENOS AIRES', 'TRP': 'BUENOS AIRES',
  'TERMINAL 4': 'BUENOS AIRES', 'PUERTO NUEVO': 'BUENOS AIRES',
  'SAN LORENZO': 'ROSARIO', 'PUERTO GENERAL SAN MARTIN': 'ROSARIO', 'TIMBUES': 'ROSARIO',
  'VILLA MARIA': 'CORDOBA', 'RIO CUARTO': 'CORDOBA', 'ARROYITO': 'CORDOBA',
  'SAN RAFAEL': 'MENDOZA', 'LUJAN DE CUYO': 'MENDOZA', 'RODRIGUEZ PENA': 'MENDOZA',
  'GODOY CRUZ': 'MENDOZA', 'GUAYMALLEN': 'MENDOZA', 'LAS HERAS': 'MENDOZA',
  'PALMIRA': 'MENDOZA', 'SAN MARTIN DE MENDOZA': 'MENDOZA',
}

/** 'Rodríguez Peña' / 'TPR Rosario' / 'bs as' / 'Zárate' → una de las 4 provincias, o null si no reconoce nada. */
export function normalizarLugar(raw: unknown): Lugar | null {
  if (typeof raw !== 'string') return null
  const s = sinAcentos(raw).toUpperCase().replace(/[^A-Z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim()
  if (!s) return null
  if (s.includes('ROSARIO')) return 'ROSARIO'
  if (s.includes('CORDOBA')) return 'CORDOBA'
  if (s.includes('MENDOZA')) return 'MENDOZA'
  if (s.includes('AIRES') || /\bBS\b/.test(s) || /\bBSAS\b/.test(s) || /\bCABA\b/.test(s)) return 'BUENOS AIRES'
  for (const [alias, lugar] of Object.entries(ALIAS_LUGAR)) {
    if (s.includes(alias)) return lugar
  }
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

/** Minuto (0-59) en Argentina. */
export function minutoAR(now: Date = new Date()): number {
  return Number(new Intl.DateTimeFormat('en-US', { timeZone: TZ_AR, minute: 'numeric' }).format(now))
}

/** Hasta qué minuto después de las 08:00 AR se sigue tolerando el silencio nocturno (la guardia de las 08:00 puede demorar). */
export const GRACIA_AMANECER_MIN = 30

/**
 * ¿El sistema dejó de reportar? Todo lo que ARCOR manda a Gestión toca el
 * heartbeat; la guardia de WhatsApp (WF12) lo hace cada 2 h entre las 8 y las 22.
 * De día se tolera 3 h de silencio; de noche (22-08) no hay guardia, se toleran 11 h.
 * Entre las 08:00 y las 08:30 sigue valiendo el umbral nocturno: el último latido
 * seguro es el de las 22:00 y la corrida de las 08:00 todavía puede estar en camino.
 */
export function evaluarSilencio(
  heartbeatTs: string | null | undefined,
  now: Date = new Date()
): { silencio: boolean; minutos: number | null; umbralMin: number } {
  const h = horaAR(now)
  const amanecer = h === 8 && minutoAR(now) < GRACIA_AMANECER_MIN
  const umbralMin = h >= 8 && h < 22 && !amanecer ? 180 : 660
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

/**
 * Umbrales del WF10 (aviso de crédito): ≥70 % usado = warning; ≥90 % = critical.
 * `sinCredito` es la señal REAL del servicio (la API rechazó la última llamada por
 * falta de crédito): manda sobre el medidor local, que es solo una estimación.
 */
export function nivelCredito(porcentajeUsado: number | null | undefined, sinCredito?: boolean | null): Severidad {
  if (sinCredito) return 'critical'
  if (porcentajeUsado == null || Number.isNaN(porcentajeUsado)) return 'info'
  if (porcentajeUsado >= 90) return 'critical'
  if (porcentajeUsado >= 70) return 'warning'
  return 'info'
}

/** Etiquetas del campo `origen` de eventos y heartbeat (quién reportó). */
export const ORIGEN_LABEL: Record<string, string> = {
  servicio: 'servicio',
  n8n: 'n8n',
  wf0: 'n8n · errores',
  wf7: 'n8n · publicaciones',
  wf8: 'n8n · rechequeo',
  wf10: 'n8n · crédito',
  wf12: 'n8n · WhatsApp',
  wf13: 'n8n · conciliación',
  backfill: 'carga inicial',
  gestion: 'Gestión',
}

export function labelOrigen(origen: string | null | undefined): string {
  if (!origen) return '—'
  return ORIGEN_LABEL[origen] ?? origen
}

/**
 * Alerta sintética "el sistema dejó de reportar". No vive en la DB: se evalúa al
 * leer, a partir del heartbeat. Devuelve null si el sistema está reportando.
 */
export function alertaSilencio(
  silencio: ReturnType<typeof evaluarSilencio>,
  heartbeat: { ts?: string | null; updated_at?: string | null } | null | undefined,
  ahora: Date
): EventoRow | null {
  if (!silencio.silencio) return null
  const iso = ahora.toISOString()
  return {
    id: 'silencio',
    ts: heartbeat?.ts ?? heartbeat?.updated_at ?? iso,
    tipo: 'sistema_silencio',
    severidad: 'critical',
    titulo: heartbeat?.ts ? 'El sistema ARCOR dejó de reportar' : 'El sistema ARCOR todavía no reportó nunca',
    detalle: { umbral_min: silencio.umbralMin, minutos: silencio.minutos },
    origen: 'gestion',
    clave_alerta: 'silencio',
    resuelto_en: null,
    created_at: iso,
  }
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

// ── Contenedores: título de actividad y fusión de reportes ────────────────

/**
 * Título del evento de actividad de un contenedor. Lo usa el ingest al registrar
 * y ListaEventos al mostrar (tituloEvento): así los eventos viejos, grabados como
 * "Buenos aires" / "Cordoba", se ven igual que los nuevos.
 */
export function tituloContenedor(c: { contenedor: string; lugar: string; estado: EstadoContenedor; publicado: boolean }): string {
  const lugar = tituloLugar(c.lugar)
  switch (c.estado) {
    case 'encontrado':
      return `${c.contenedor} · ${lugar} · cargado${c.publicado ? ' y publicado' : ''}`
    case 'pendiente_arcor':
      return `${c.contenedor} · ${lugar} · pendiente ARCOR`
    case 'revisar_foto':
      return `Lectura dudosa · ${lugar} · ${c.contenedor}`
    default:
      return `${c.contenedor} · descartado`
  }
}

/** Tipo de evento que genera el ingest para cada estado de contenedor. */
export const TIPO_EVENTO_CONTENEDOR: Record<EstadoContenedor, string> = {
  encontrado: 'contenedor_cargado',
  pendiente_arcor: 'contenedor_pendiente',
  revisar_foto: 'lectura_dudosa',
  descartado: 'contenedor_descartado',
}

const ESTADO_POR_TIPO_EVENTO: Record<string, EstadoContenedor> = Object.fromEntries(
  Object.entries(TIPO_EVENTO_CONTENEDOR).map(([estado, tipo]) => [tipo, estado as EstadoContenedor])
)

/**
 * Título a mostrar de un evento. Los de contenedor que generó el ingest (traen
 * `detalle.accion`) se rearman con tituloContenedor; el resto se muestra tal cual.
 */
export function tituloEvento(e: Pick<EventoRow, 'tipo' | 'titulo' | 'detalle'>): string {
  const estado = ESTADO_POR_TIPO_EVENTO[e.tipo]
  const d = e.detalle ?? {}
  if (!estado || typeof d.accion !== 'string') return e.titulo
  if (typeof d.contenedor !== 'string' || !d.contenedor || typeof d.lugar !== 'string' || !d.lugar) return e.titulo
  return tituloContenedor({ contenedor: d.contenedor, lugar: d.lugar, estado, publicado: d.publicado === true })
}

// Estados que NO pueden pisar a un contenedor ya `encontrado`. Además de los obvios,
// `descartado`: el sistema ARCOR lo manda al limpiar la galería de fotos dudosas, y esa
// lectura puede coincidir con un contenedor que se cargó bien por otra foto (pasó el
// 26/08/2026 con TXGU4517978 / TYGU4517978). Limpiar una foto nunca puede borrar del
// tablero un certificado que ARCOR tiene cargado.
export const DEGRADANTES: readonly EstadoContenedor[] = ['pendiente_arcor', 'revisar_foto', 'descartado']

export interface ContenedorPrevio {
  estado: EstadoContenedor
  fecha: string | null
  lugar: string | null
  publicado: boolean | null
  booking: string | null
  oe: string | null
  hash_imagen: string | null
  observaciones: string | null
}

export interface ContenedorReportado {
  estado: EstadoContenedor
  fecha: string
  lugar: string
  publicado: boolean
  booking: string | null
  oe: string | null
  hash_imagen: string | null
  observaciones: string | null
  /**
   * Corrección deliberada: una persona confirmó que la carga era errónea (p. ej. el aviso de
   * ARCOR del 08/10/2026: MRSU7429565 se había cargado contra una operación de 2025 y el
   * certificado era de MRSU2129565). Solo habilita pasar un `encontrado` a `descartado`.
   */
  correccion?: boolean
}

/**
 * Cómo queda un contenedor ya conocido después de un reporte nuevo.
 *  - Un reporte con MENOS datos no borra lo que ya se sabía (booking/OE/hash y
 *    observaciones vacías se conservan — trampa #17 del sistema ARCOR).
 *  - `publicado` nunca vuelve a false.
 *  - Un `encontrado` no se degrada (`degrada`: solo se fusionan los datos sueltos), salvo
 *    una corrección deliberada a `descartado` (`correccion: true`).
 *  - `cambia` es false si el reporte no movió nada visible (estado, publicado,
 *    booking, OE, lugar, fecha): un re-envío idéntico no genera actividad.
 */
export function fusionarContenedor(prev: ContenedorPrevio, nuevo: ContenedorReportado) {
  const corrige = nuevo.correccion === true && nuevo.estado === 'descartado'
  const degrada = prev.estado === 'encontrado' && DEGRADANTES.includes(nuevo.estado) && !corrige
  const datos = {
    booking: nuevo.booking ?? prev.booking ?? null,
    oe: nuevo.oe ?? prev.oe ?? null,
    hash_imagen: nuevo.hash_imagen ?? prev.hash_imagen ?? null,
    observaciones: nuevo.observaciones ?? prev.observaciones ?? null,
    publicado: Boolean(prev.publicado) || nuevo.publicado,
  }
  const cambia =
    !degrada &&
    (nuevo.estado !== prev.estado ||
      nuevo.fecha !== prev.fecha ||
      nuevo.lugar !== prev.lugar ||
      datos.publicado !== Boolean(prev.publicado) ||
      datos.booking !== (prev.booking ?? null) ||
      datos.oe !== (prev.oe ?? null))
  return { degrada, cambia, datos }
}

// ── Colas abiertas (pendiente ARCOR / revisar foto), de TODOS los meses ───

/** Estados que esperan a alguien: no se cierran solos al cambiar de mes. */
export const ESTADOS_ABIERTOS = ['pendiente_arcor', 'revisar_foto'] as const
export type EstadoAbierto = (typeof ESTADOS_ABIERTOS)[number]

export interface ColaAbierta {
  total: number
  /** Con mes = el de referencia. */
  delMes: number
  /** De meses anteriores al de referencia (el arrastre que el mes en curso no muestra). */
  anteriores: number
  /** Fecha del certificado más viejo que sigue esperando ('YYYY-MM-DD'). */
  masViejo: string | null
}

export function resumirAbiertos(
  filas: { estado: string; fecha: string; mes: string }[],
  mes: string
): Record<EstadoAbierto, ColaAbierta> {
  const ref = claveMes(mes)
  const cola = (estado: EstadoAbierto): ColaAbierta => {
    const propias = filas.filter((f) => f.estado === estado)
    const fechas = propias.map((f) => f.fecha).filter(Boolean).sort()
    return {
      total: propias.length,
      delMes: propias.filter((f) => f.mes === mes).length,
      anteriores: propias.filter((f) => claveMes(f.mes) < ref).length,
      masViejo: fechas[0] ?? null,
    }
  }
  return { pendiente_arcor: cola('pendiente_arcor'), revisar_foto: cola('revisar_foto') }
}

/** Días enteros entre la fecha de un certificado y hoy (ambos 'YYYY-MM-DD', hoy en hora AR). */
export function diasDesde(fecha: string, hoy: string): number {
  const a = Date.UTC(Number(fecha.slice(0, 4)), Number(fecha.slice(5, 7)) - 1, Number(fecha.slice(8, 10)))
  const b = Date.UTC(Number(hoy.slice(0, 4)), Number(hoy.slice(5, 7)) - 1, Number(hoy.slice(8, 10)))
  return Math.round((b - a) / 86400000)
}

/** Más de estos días esperando y la fila se resalta (pendiente ARCOR / revisar foto). */
export const DIAS_DEMORA = 3

export function etiquetaDias(dias: number): string {
  if (dias <= 0) return 'hoy'
  return dias === 1 ? '1 día' : `${dias} días`
}

// ── Resumen del mes y comparación con el anterior ─────────────────────────

export interface ResumenMes {
  mes: string
  total: number          // sin descartados
  encontrados: number
  pendientes: number
  revisar: number
  publicados: number
  porLugar: ReturnType<typeof resumenPorLugar>
}

export function resumirMes(mes: string, items: { lugar: string; estado: string; publicado: boolean }[]): ResumenMes {
  const vivos = items.filter((i) => i.estado !== 'descartado')
  return {
    mes,
    total: vivos.length,
    encontrados: vivos.filter((i) => i.estado === 'encontrado').length,
    pendientes: vivos.filter((i) => i.estado === 'pendiente_arcor').length,
    revisar: vivos.filter((i) => i.estado === 'revisar_foto').length,
    publicados: vivos.filter((i) => i.publicado).length,
    porLugar: resumenPorLugar(items),
  }
}

/**
 * Contenedores (sin descartados) con fecha hasta el día `dia` inclusive. Para
 * comparar el mes en curso con el anterior "a esta altura": el 2 de octubre,
 * 3 contra los 158 de septiembre entero no dice nada; contra los del 1 y 2 de
 * septiembre, sí.
 */
export function totalHastaDia(items: { estado: string; fecha: string }[], dia: number): number {
  return items.filter((i) => i.estado !== 'descartado' && Number(i.fecha.slice(8, 10)) <= dia).length
}

// ── Selector de meses ─────────────────────────────────────────────────────

/** Meses de `desde` a `hasta` inclusive, del más reciente al más viejo. */
export function mesesEntre(desde: string, hasta: string): string[] {
  const tope = claveMes(desde)
  const out: string[] = []
  let m = hasta
  // 600 = 50 años: corta cualquier dato basura sin colgar el render.
  for (let i = 0; i < 600 && claveMes(m) >= tope; i++) {
    out.push(m)
    m = mesAnterior(m)
  }
  return out.length ? out : [hasta]
}

/** 'SEPTIEMBRE 2026' → 'Septiembre 2026'. */
export function tituloMes(mes: string): string {
  return mes.charAt(0) + mes.slice(1).toLowerCase()
}

/** Cantidad de días del mes: 'SEPTIEMBRE 2026' → 30, 'FEBRERO 2028' → 29. */
export function diasDelMes(mes: string): number {
  const [nombre, anio] = mes.split(' ')
  const idx = MESES.indexOf(nombre as (typeof MESES)[number])
  if (idx < 0) return 31
  return new Date(Date.UTC(Number(anio), idx + 1, 0)).getUTCDate()
}

// ── Actividad: ruido y paginación ─────────────────────────────────────────

/**
 * Tipos que no le dicen nada a una persona: fotos que no son certificados
 * (`imagen_ignorada`) y la lectura con Claude (`ocr_claude`), que duplica el
 * evento del contenedor que llega en el mismo instante. Eran el 65 % del log.
 */
export const TIPOS_RUIDO = ['imagen_ignorada', 'ocr_claude'] as const

/** Movimientos de contenedores (los que genera el ingest al recibir un contenedor). */
export const TIPOS_MOVIMIENTO: readonly string[] = Object.values(TIPO_EVENTO_CONTENEDOR)

export interface CursorEventos {
  ts: string
  id: string | null
}

const RE_TS = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,6})?(Z|[+-]\d{2}:\d{2})$/
const RE_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * `?antes=<ts>` o `?antes=<ts>,<id>` → cursor validado (o null). El id desempata
 * los eventos del mismo instante (un lote del ingest graba todos con el mismo ts).
 * El formato estricto importa: el valor termina dentro de un filtro `or=(...)`.
 */
export function parseCursor(raw: unknown): CursorEventos | null {
  if (typeof raw !== 'string') return null
  const [ts, id, ...resto] = raw.split(',')
  if (resto.length || !RE_TS.test(ts) || Number.isNaN(Date.parse(ts))) return null
  if (id !== undefined && !RE_UUID.test(id)) return null
  return { ts, id: id ?? null }
}

export function cursorDe(e: { ts: string; id: string }): string {
  return `${e.ts},${e.id}`
}

// ── Búsqueda de contenedores ──────────────────────────────────────────────

/**
 * Texto del buscador → patrón ilike de PostgREST (`*` es el comodín), o null.
 * Solo letras, números, guion y barra: nada que rompa la sintaxis de `or=(...)`.
 * Los espacios pasan a comodín: "MRSU 939" encuentra "MRSU9390570".
 */
export function patronBusqueda(q: unknown): string | null {
  if (typeof q !== 'string') return null
  const limpio = sinAcentos(q).replace(/[^A-Za-z0-9/ -]/g, ' ').trim().replace(/\s+/g, '*').slice(0, 40)
  return limpio ? `*${limpio}*` : null
}

// ── Publicaciones Colabora ────────────────────────────────────────────────

/** 'sin_tarea' → 'Sin tarea'. */
export function labelEstadoPublicacion(estado: string | null | undefined): string {
  if (!estado) return '—'
  const s = estado.replace(/_/g, ' ').trim()
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : '—'
}
