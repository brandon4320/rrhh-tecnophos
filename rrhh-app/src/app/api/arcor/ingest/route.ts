// ============================================================
// POST /api/arcor/ingest — el sistema ARCOR (servicio FastAPI / n8n del
// droplet) le cuenta a Gestión lo que va pasando: contenedores cargados,
// estado del sistema (WhatsApp, crédito Claude, cola de Colabora) y alertas.
//
// Auth: `Authorization: Bearer <token>`; se compara sha256(token) contra
// arcor_config.ingest_token_hash (service role). La ruta es pública en el
// proxy (no hay sesión de navegador acá). Ningún usuario final llega a este
// endpoint: es máquina-a-máquina.
//
// Body: { origen?: string, items: IngestItem[] }  (o un IngestItem suelto)
//   kind 'contenedor' -> upsert por (contenedor, mes) + evento de actividad
//   kind 'evento'     -> fila en arcor_eventos; con clave_alerta gestiona el
//                        ciclo abierta/resuelta (una abierta por clave)
//   kind 'estado'     -> upsert en arcor_estado
// Toda request aceptada actualiza arcor_estado.heartbeat.
// Idempotente: reintentar el mismo payload no duplica contenedores ni alertas.
// ============================================================
import { NextRequest, NextResponse } from 'next/server'
import { createHash, timingSafeEqual, randomUUID } from 'node:crypto'
import { adbAdmin } from '@/modules/arcor/db'
import {
  ESTADOS_CONTENEDOR, ORIGENES, SEVERIDADES, esMesValido, mesDeFecha,
  normalizarLugar, parseFechaFlexible,
  type EstadoContenedor, type Origen, type Severidad,
} from '@/modules/arcor/reglas'

export const dynamic = 'force-dynamic'
// Lotes del backfill: 150 items son ~300 viajes a Supabase (São Paulo) desde Vercel.
// Por encima de los 10 s por defecto; 60 s es el máximo del plan.
export const maxDuration = 60

const MAX_ITEMS = 500

function str(v: unknown, max = 200): string | null {
  if (v == null) return null
  const s = String(v).trim()
  return s ? s.slice(0, max) : null
}

function obj(v: unknown): Record<string, unknown> | null {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null
}

class ItemError extends Error {}

/* eslint-disable @typescript-eslint/no-explicit-any */
type Admin = any

async function tokenValido(admin: Admin, token: string): Promise<boolean> {
  const { data } = await admin
    .from('arcor_config')
    .select('valor')
    .eq('clave', 'ingest_token_hash')
    .maybeSingle()
  const esperado = data?.valor as string | undefined
  if (!esperado) return false
  const hash = createHash('sha256').update(token).digest('hex')
  const a = Buffer.from(hash, 'utf8')
  const b = Buffer.from(esperado, 'utf8')
  return a.length === b.length && timingSafeEqual(a, b)
}

function tituloContenedor(c: { contenedor: string; lugar: string; estado: EstadoContenedor; publicado: boolean }) {
  const lugar = c.lugar.charAt(0) + c.lugar.slice(1).toLowerCase()
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

async function procesarContenedor(admin: Admin, it: Record<string, unknown>, origenReq: string | null, ahora: string) {
  const fecha = parseFechaFlexible(it.fecha)
  if (!fecha) throw new ItemError('fecha inválida (esperado YYYY-MM-DD o DD/MM/YYYY)')

  const hash = str(it.hash_imagen, 40)
  let contenedor = String(it.contenedor ?? '').replace(/\s+/g, '')
  if (!contenedor || /ilegible/i.test(contenedor)) {
    contenedor = `(ilegible)-${hash ?? randomUUID().slice(0, 8)}`
  } else {
    contenedor = contenedor.toUpperCase().slice(0, 40)
  }

  const estado = String(it.estado ?? 'encontrado') as EstadoContenedor
  if (!ESTADOS_CONTENEDOR.includes(estado)) throw new ItemError(`estado inválido: ${estado}`)

  // El servicio ya normaliza con fallback a BUENOS AIRES (core.normalizar_lugar); acá se espeja.
  const lugar = normalizarLugar(it.lugar) ?? 'BUENOS AIRES'
  const origenRaw = str(it.origen, 30) ?? (origenReq === 'backfill' ? 'backfill' : null)
  const origen = (ORIGENES as readonly string[]).includes(origenRaw ?? '') ? (origenRaw as Origen) : null
  const mes = esMesValido(it.mes) ? it.mes : mesDeFecha(fecha)
  const publicado = it.publicado === true
  const observaciones = str(it.observaciones, 500)

  const { data: existente, error: e1 } = await admin
    .from('arcor_contenedores')
    .select('id, publicado, observaciones')
    .eq('contenedor', contenedor)
    .eq('mes', mes)
    .maybeSingle()
  if (e1) throw new ItemError(`lookup: ${e1.message}`)

  const base = {
    fecha,
    booking: str(it.booking, 60),
    oe: str(it.oe, 60),
    lugar,
    estado,
    origen,
    hash_imagen: hash,
    updated_at: ahora,
  }

  let accion: 'creado' | 'actualizado'
  if (existente) {
    const { error } = await admin
      .from('arcor_contenedores')
      .update({
        ...base,
        // Trampa #17 del sistema ARCOR: una carga repetida sin observaciones no debe pisar las que ya hay.
        observaciones: observaciones ?? existente.observaciones ?? null,
        publicado: Boolean(existente.publicado) || publicado,
      })
      .eq('id', existente.id)
    if (error) throw new ItemError(`update: ${error.message}`)
    accion = 'actualizado'
  } else {
    const { error } = await admin
      .from('arcor_contenedores')
      .insert({ ...base, contenedor, mes, observaciones, publicado, created_at: ahora })
    if (error) throw new ItemError(`insert: ${error.message}`)
    accion = 'creado'
  }

  if (it.sin_evento !== true) {
    const tipo =
      estado === 'encontrado' ? 'contenedor_cargado'
      : estado === 'pendiente_arcor' ? 'contenedor_pendiente'
      : estado === 'revisar_foto' ? 'lectura_dudosa'
      : 'contenedor_descartado'
    const severidad: Severidad = estado === 'revisar_foto' ? 'warning' : 'info'
    const { error } = await admin.from('arcor_eventos').insert({
      ts: ahora,
      tipo,
      severidad,
      titulo: tituloContenedor({ contenedor, lugar, estado, publicado }),
      detalle: { contenedor, lugar, fecha, mes, booking: base.booking, oe: base.oe, origen, publicado, accion },
      origen: origenReq,
    })
    if (error) throw new ItemError(`evento: ${error.message}`)
  }
  return { kind: 'contenedor', contenedor, mes, accion }
}

async function procesarEvento(admin: Admin, it: Record<string, unknown>, origenReq: string | null, ahora: string) {
  const tipo = str(it.tipo, 60)
  const titulo = str(it.titulo, 200)
  if (!tipo || !titulo) throw new ItemError('evento requiere tipo y titulo')
  const severidad = (str(it.severidad, 10) ?? 'info') as Severidad
  if (!SEVERIDADES.includes(severidad)) throw new ItemError(`severidad inválida: ${severidad}`)
  const clave = str(it.clave_alerta, 40)
  const origen = str(it.origen, 30) ?? origenReq
  const detalle = obj(it.detalle)
  const tsRaw = str(it.ts, 40)
  const ts = tsRaw && !Number.isNaN(new Date(tsRaw).getTime()) ? new Date(tsRaw).toISOString() : ahora

  // Resolver: cierra lo abierto de esa clave. Solo registra la resolución si
  // había algo abierto (así el servicio puede mandar "resolver" en cada éxito
  // sin llenar el log de "OK, OK, OK").
  if (it.resolver === true && clave) {
    const { data: abiertas, error } = await admin
      .from('arcor_eventos')
      .update({ resuelto_en: ts })
      .eq('clave_alerta', clave)
      .is('resuelto_en', null)
      .in('severidad', ['warning', 'critical'])
      .select('id, ts')
    if (error) throw new ItemError(`resolver: ${error.message}`)
    const n = (abiertas ?? []).length
    if (n === 0) return { kind: 'evento', accion: 'nada_que_resolver', clave }
    const desde = (abiertas as { ts: string }[]).map((a) => a.ts).sort()[0]
    const { error: e2 } = await admin.from('arcor_eventos').insert({
      ts, tipo, severidad: 'info', titulo, origen, clave_alerta: clave, resuelto_en: ts,
      detalle: { ...(detalle ?? {}), resueltas: n, abierta_desde: desde },
    })
    if (e2) throw new ItemError(`evento resolución: ${e2.message}`)
    return { kind: 'evento', accion: 'resuelta', clave, resueltas: n }
  }

  // Alerta con estado: una sola abierta por clave. Si ya hay una, se refresca
  // el detalle (última verificación) y no se duplica.
  if (clave && severidad !== 'info') {
    const { data: abierta } = await admin
      .from('arcor_eventos')
      .select('id, detalle')
      .eq('clave_alerta', clave)
      .is('resuelto_en', null)
      .in('severidad', ['warning', 'critical'])
      .order('ts', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (abierta) {
      const { error } = await admin
        .from('arcor_eventos')
        .update({ detalle: { ...(abierta.detalle ?? {}), ...(detalle ?? {}), ultima_verificacion: ts, verificaciones: Number(abierta.detalle?.verificaciones ?? 1) + 1 } })
        .eq('id', abierta.id)
      if (error) throw new ItemError(`refrescar alerta: ${error.message}`)
      return { kind: 'evento', accion: 'alerta_ya_abierta', clave }
    }
  }

  const { error } = await admin.from('arcor_eventos').insert({
    ts, tipo, severidad, titulo, detalle, origen, clave_alerta: clave,
  })
  if (error) throw new ItemError(`insert evento: ${error.message}`)
  return { kind: 'evento', accion: 'creado', tipo }
}

async function procesarEstado(admin: Admin, it: Record<string, unknown>, ahora: string) {
  const clave = str(it.clave, 40)
  const valor = obj(it.valor)
  if (!clave || !valor) throw new ItemError('estado requiere clave y valor (objeto)')
  if (clave === 'heartbeat') throw new ItemError('heartbeat lo escribe el ingest, no el cliente')
  const { error } = await admin
    .from('arcor_estado')
    .upsert({ clave, valor, updated_at: ahora }, { onConflict: 'clave' })
  if (error) throw new ItemError(`estado: ${error.message}`)
  return { kind: 'estado', clave }
}
/* eslint-enable @typescript-eslint/no-explicit-any */

export async function POST(request: NextRequest) {
  const auth = request.headers.get('authorization') ?? ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : ''
  if (!token) return NextResponse.json({ error: 'Falta el token' }, { status: 401 })

  const admin = adbAdmin()
  let ok: boolean
  try {
    ok = await tokenValido(admin, token)
  } catch {
    return NextResponse.json({ error: 'Ingest no configurado (arcor_config)' }, { status: 503 })
  }
  if (!ok) return NextResponse.json({ error: 'Token inválido' }, { status: 401 })

  const body = await request.json().catch(() => null)
  const items: unknown[] = Array.isArray(body?.items) ? body.items : body && body.kind ? [body] : []
  if (items.length === 0) return NextResponse.json({ error: 'Sin items' }, { status: 400 })
  if (items.length > MAX_ITEMS) return NextResponse.json({ error: `Máximo ${MAX_ITEMS} items por request` }, { status: 400 })
  const origenReq = str(body?.origen, 30) ?? 'servicio'
  const ahora = new Date().toISOString()

  const resultados: unknown[] = new Array(items.length)
  const errores: { indice: number; error: string }[] = []
  // Paralelismo acotado: cada item son 1-2 viajes a Supabase (~100 ms desde Vercel a
  // São Paulo) y en serie un lote de 150 superaba el timeout (pasó en el backfill del
  // 08/09/2026). Las alertas con estado podrían carrerear si la MISMA clave viniera
  // repetida en un lote: no ocurre (cada workflow manda una por corrida).
  const CONCURRENCIA = 8
  let cursor = 0
  async function worker() {
    while (cursor < items.length) {
      const i = cursor++
      const it = obj(items[i])
      try {
        if (!it) throw new ItemError('item no es un objeto')
        if (it.kind === 'contenedor') resultados[i] = await procesarContenedor(admin, it, origenReq, ahora)
        else if (it.kind === 'evento') resultados[i] = await procesarEvento(admin, it, origenReq, ahora)
        else if (it.kind === 'estado') resultados[i] = await procesarEstado(admin, it, ahora)
        else throw new ItemError(`kind desconocido: ${String(it.kind)}`)
      } catch (e) {
        errores.push({ indice: i, error: e instanceof Error ? e.message : String(e) })
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(CONCURRENCIA, items.length) }, worker))
  const procesados = resultados.filter((r) => r !== undefined)

  // Latido: cualquier request válida prueba que el sistema ARCOR está vivo.
  await admin
    .from('arcor_estado')
    .upsert({ clave: 'heartbeat', valor: { ts: ahora, origen: origenReq, items: items.length }, updated_at: ahora }, { onConflict: 'clave' })

  const status = procesados.length > 0 ? 200 : 400
  return NextResponse.json({ ok: errores.length === 0, procesados: procesados.length, resultados: procesados, errores }, { status })
}
