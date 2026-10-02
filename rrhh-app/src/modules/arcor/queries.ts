// ============================================================
// Lecturas del módulo ARCOR (server components). Usan el cliente de sesión:
// la RLS decide quién ve (app_es_rrhh() and app_ve_todas_empresas()).
// Volúmenes chicos (~150 contenedores/mes, ~300 eventos/semana): los agregados
// se hacen en JS, y los conteos que pueden crecer van con count exact (head).
// OJO: PostgREST corta en 1000 filas por request aunque se pida más.
// ============================================================
import { adb, contar, rows } from './db'
import type { ContenedorRow, EventoRow, EstadoRow } from './tipos'
import {
  ESTADOS_ABIERTOS, TIPOS_RUIDO, mesActual, mesAnterior, mesDeFecha, mesesEntre, resumirAbiertos, resumirMes,
  totalHastaDia,
  type ColaAbierta, type CursorEventos, type EstadoAbierto, type ResumenMes,
} from './reglas'

export type { ResumenMes } from './reglas'

export async function getEstados(): Promise<Record<string, EstadoRow>> {
  const db = await adb()
  const res = await db.from('arcor_estado').select('clave, valor, updated_at')
  const out: Record<string, EstadoRow> = {}
  for (const r of rows<EstadoRow>(res)) out[r.clave] = r
  return out
}

/** Alertas con estado que siguen abiertas (warning/critical, sin resuelto_en). */
export async function getAlertasAbiertas(): Promise<EventoRow[]> {
  const db = await adb()
  const res = await db
    .from('arcor_eventos')
    .select('*')
    .not('clave_alerta', 'is', null)
    .is('resuelto_en', null)
    .in('severidad', ['warning', 'critical'])
    .order('ts', { ascending: false })
  return rows<EventoRow>(res)
}

const NO_RUIDO = `(${TIPOS_RUIDO.join(',')})`

export async function getEventos(opts: {
  desde?: string
  limit?: number
  /** Solo warning/critical (incidentes) o eventos con clave de alerta. */
  soloAlertas?: boolean
  /** Solo alertas ya resueltas (historial). */
  soloResueltas?: boolean
  /** Solo incidentes puntuales: severidad != info y sin clave de alerta. */
  soloIncidentes?: boolean
  /** Sin imagen_ignorada ni ocr_claude (ver TIPOS_RUIDO). */
  sinRuido?: boolean
} = {}): Promise<EventoRow[]> {
  const db = await adb()
  let q = db.from('arcor_eventos').select('*').order('ts', { ascending: false }).limit(opts.limit ?? 200)
  if (opts.desde) q = q.gte('ts', opts.desde)
  if (opts.soloAlertas) q = q.or('clave_alerta.not.is.null,severidad.neq.info')
  if (opts.soloResueltas) q = q.not('clave_alerta', 'is', null).not('resuelto_en', 'is', null).in('severidad', ['warning', 'critical'])
  if (opts.soloIncidentes) q = q.is('clave_alerta', null).in('severidad', ['warning', 'critical'])
  if (opts.sinRuido) q = q.not('tipo', 'in', NO_RUIDO)
  return rows<EventoRow>(await q)
}

// ── Actividad (feed paginado + conteos del encabezado) ─────────────────────

export interface FiltroActividad {
  desde: string
  soloAlertas?: boolean
  sinRuido?: boolean
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function filtrarActividad(q: any, f: FiltroActividad): any {
  q = q.gte('ts', f.desde)
  if (f.soloAlertas) q = q.or('clave_alerta.not.is.null,severidad.neq.info')
  if (f.sinRuido) q = q.not('tipo', 'in', NO_RUIDO)
  return q
}
/* eslint-enable @typescript-eslint/no-explicit-any */

/**
 * Una página del feed, del más nuevo al más viejo. `antes` es el cursor del último
 * evento mostrado: (ts, id) para no saltear eventos del mismo instante. Varios `or`
 * en la misma consulta se combinan con AND (PostgREST), así que el cursor convive
 * con el filtro de alertas.
 */
export async function getActividad(
  f: FiltroActividad & { antes?: CursorEventos | null; limit: number }
): Promise<{ eventos: EventoRow[]; hayMas: boolean }> {
  const db = await adb()
  let q = filtrarActividad(db.from('arcor_eventos').select('*'), f)
  if (f.antes) {
    const ts = `"${f.antes.ts}"`
    q = f.antes.id
      ? q.or(`ts.lt.${ts},and(ts.eq.${ts},id.lt.${f.antes.id})`)
      : q.lt('ts', f.antes.ts)
  }
  const res = await q
    .order('ts', { ascending: false })
    .order('id', { ascending: false })
    .limit(f.limit + 1)
  const todos = rows<EventoRow>(res)
  return { eventos: todos.slice(0, f.limit), hayMas: todos.length > f.limit }
}

/** Cuántos eventos hay en el rango (sin traerlos). `tipos` restringe a esos tipos; `soloRuido`, a los de TIPOS_RUIDO. */
export async function contarActividad(
  f: FiltroActividad & { tipos?: readonly string[]; soloRuido?: boolean }
): Promise<number> {
  const db = await adb()
  let q = filtrarActividad(db.from('arcor_eventos').select('id', { count: 'exact', head: true }), f)
  if (f.tipos) q = q.in('tipo', f.tipos)
  if (f.soloRuido) q = q.in('tipo', [...TIPOS_RUIDO])
  return contar(await q)
}

// ── Contenedores ──────────────────────────────────────────────────────────

export async function getContenedores(opts: {
  /** Sin mes = todos los meses. */
  mes?: string
  lugar?: string
  estado?: string
  /** Patrón ilike (patronBusqueda) contra contenedor, booking y OE. */
  patron?: string | null
  /** Sin estado elegido, los descartados quedan afuera salvo que se pidan. */
  incluirDescartados?: boolean
  /** Más viejo primero (colas de pendientes). */
  ascendente?: boolean
  limit?: number
} = {}): Promise<{ items: ContenedorRow[]; total: number }> {
  const db = await adb()
  let q = db
    .from('arcor_contenedores')
    .select('*', { count: 'exact' })
    .order('fecha', { ascending: !!opts.ascendente })
    .order('created_at', { ascending: !!opts.ascendente })
    .limit(opts.limit ?? 500)
  if (opts.mes) q = q.eq('mes', opts.mes)
  if (opts.lugar) q = q.eq('lugar', opts.lugar)
  if (opts.estado) q = q.eq('estado', opts.estado)
  else if (!opts.incluirDescartados) q = q.neq('estado', 'descartado')
  if (opts.patron) q = q.or(`contenedor.ilike.${opts.patron},booking.ilike.${opts.patron},oe.ilike.${opts.patron}`)
  const res = await q
  const items = rows<ContenedorRow>(res)
  return { items, total: (res.count as number | null) ?? items.length }
}

/**
 * Meses para el selector: del mes del certificado más viejo hasta el mes en curso.
 * Una sola fila (min fecha) en vez de leer la tabla entera.
 */
export async function getMeses(ahora: Date = new Date()): Promise<string[]> {
  const db = await adb()
  const res = await db.from('arcor_contenedores').select('fecha').order('fecha', { ascending: true }).limit(1)
  const primera = rows<{ fecha: string }>(res)[0]?.fecha
  const actual = mesActual(ahora)
  return primera ? mesesEntre(mesDeFecha(primera), actual) : [actual]
}

/**
 * Fotos que esperan en la galería de revisión, de CUALQUIER mes. El botón "Revisar
 * dudosas" no puede mirar solo el mes en curso: el 02/10 quedaba gris con tres dudosas
 * de Córdoba del 30/09 esperando, porque caían en septiembre.
 */
export async function getRevisarPendientes(): Promise<number> {
  const db = await adb()
  const res = await db
    .from('arcor_contenedores')
    .select('id', { count: 'exact', head: true })
    .eq('estado', 'revisar_foto')
  return contar(res)
}

/**
 * Pendiente ARCOR y Revisar foto de TODOS los meses (el 02/10 había 19 pendientes de
 * septiembre que el tablero del mes no mostraba), con cuántos son de meses anteriores
 * a `mes` y la fecha del más viejo.
 */
export async function getColasAbiertas(mes: string): Promise<Record<EstadoAbierto, ColaAbierta>> {
  const db = await adb()
  const res = await db
    .from('arcor_contenedores')
    .select('estado, fecha, mes')
    .in('estado', [...ESTADOS_ABIERTOS])
    .order('fecha', { ascending: true })
    .limit(1000)
  return resumirAbiertos(rows<{ estado: string; fecha: string; mes: string }>(res), mes)
}

export interface ComparacionMes {
  actual: ResumenMes
  previo: {
    mes: string
    /** Mes anterior entero (sin descartados). */
    total: number
    /** Mes anterior hasta el mismo día del mes que hoy: la comparación justa. */
    hastaDia: number
  }
}

/** Resumen del mes y el anterior en UNA consulta; `dia` = día del mes de hoy (hora AR). */
export async function getResumenConAnterior(mes: string, dia: number): Promise<ComparacionMes> {
  const db = await adb()
  const previo = mesAnterior(mes)
  const res = await db
    .from('arcor_contenedores')
    .select('mes, fecha, lugar, estado, publicado')
    .in('mes', [mes, previo])
    .limit(1000)
  const items = rows<{ mes: string; fecha: string; lugar: string; estado: string; publicado: boolean }>(res)
  const delPrevio = items.filter((i) => i.mes === previo)
  return {
    actual: resumirMes(mes, items.filter((i) => i.mes === mes)),
    previo: {
      mes: previo,
      total: delPrevio.filter((i) => i.estado !== 'descartado').length,
      hastaDia: totalHastaDia(delPrevio, dia),
    },
  }
}
