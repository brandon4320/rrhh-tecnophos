// ============================================================
// Lecturas del módulo ARCOR (server components). Usan el cliente de sesión:
// la RLS decide quién ve (app_es_rrhh() and app_ve_todas_empresas()).
// Volúmenes chicos (~150 contenedores/mes, algunos cientos de eventos):
// los agregados se hacen en JS.
// ============================================================
import { adb, rows } from './db'
import type { ContenedorRow, EventoRow, EstadoRow } from './tipos'
import { claveMes, resumenPorLugar } from './reglas'

export async function getEstados(): Promise<Record<string, EstadoRow>> {
  const db = await adb()
  const { data } = await db.from('arcor_estado').select('clave, valor, updated_at')
  const out: Record<string, EstadoRow> = {}
  for (const r of rows<EstadoRow>(data)) out[r.clave] = r
  return out
}

/** Alertas con estado que siguen abiertas (warning/critical, sin resuelto_en). */
export async function getAlertasAbiertas(): Promise<EventoRow[]> {
  const db = await adb()
  const { data } = await db
    .from('arcor_eventos')
    .select('*')
    .not('clave_alerta', 'is', null)
    .is('resuelto_en', null)
    .in('severidad', ['warning', 'critical'])
    .order('ts', { ascending: false })
  return rows<EventoRow>(data)
}

export async function getEventos(opts: {
  desde?: string
  limit?: number
  /** Solo warning/critical (incidentes) o eventos con clave de alerta. */
  soloAlertas?: boolean
  /** Solo alertas ya resueltas (historial). */
  soloResueltas?: boolean
  /** Solo incidentes puntuales: severidad != info y sin clave de alerta. */
  soloIncidentes?: boolean
} = {}): Promise<EventoRow[]> {
  const db = await adb()
  let q = db.from('arcor_eventos').select('*').order('ts', { ascending: false }).limit(opts.limit ?? 200)
  if (opts.desde) q = q.gte('ts', opts.desde)
  if (opts.soloAlertas) q = q.or('clave_alerta.not.is.null,severidad.neq.info')
  if (opts.soloResueltas) q = q.not('clave_alerta', 'is', null).not('resuelto_en', 'is', null).in('severidad', ['warning', 'critical'])
  if (opts.soloIncidentes) q = q.is('clave_alerta', null).in('severidad', ['warning', 'critical'])
  const { data } = await q
  return rows<EventoRow>(data)
}

export async function getContenedores(opts: {
  mes?: string
  lugar?: string
  estado?: string
  limit?: number
} = {}): Promise<ContenedorRow[]> {
  const db = await adb()
  let q = db
    .from('arcor_contenedores')
    .select('*')
    .order('fecha', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(opts.limit ?? 500)
  if (opts.mes) q = q.eq('mes', opts.mes)
  if (opts.lugar) q = q.eq('lugar', opts.lugar)
  if (opts.estado) q = q.eq('estado', opts.estado)
  const { data } = await q
  return rows<ContenedorRow>(data)
}

/** Meses con datos, del más reciente al más viejo. */
export async function getMeses(): Promise<string[]> {
  const db = await adb()
  const { data } = await db.from('arcor_contenedores').select('mes').limit(5000)
  const set = new Set(rows<{ mes: string }>(data).map((r) => r.mes))
  return [...set].sort((a, b) => claveMes(b) - claveMes(a))
}

export interface ResumenMes {
  mes: string
  total: number          // sin descartados
  encontrados: number
  pendientes: number
  revisar: number
  publicados: number
  porLugar: ReturnType<typeof resumenPorLugar>
}

export async function getResumenMes(mes: string): Promise<ResumenMes> {
  const db = await adb()
  const { data } = await db
    .from('arcor_contenedores')
    .select('lugar, estado, publicado')
    .eq('mes', mes)
    .limit(5000)
  const items = rows<{ lugar: string; estado: string; publicado: boolean }>(data)
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
