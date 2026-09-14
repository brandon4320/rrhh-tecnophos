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
// El heartbeat (arcor_estado.heartbeat) se toca solo si se procesó al menos un
// item: una request que falla entera NO cuenta como "el sistema está vivo".
// Idempotente: reintentar el mismo payload no duplica contenedores ni alertas
// (los "(ilegible)" sin hash se clavean por fecha+lugar+observaciones).
// ============================================================
import { NextRequest, NextResponse } from 'next/server'
import { createHash, timingSafeEqual } from 'node:crypto'
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

/**
 * supabase-js no lanza: devuelve { data, error }. Un error de DB (caída, service
 * key mal, migración sin aplicar) NO es "token inválido": se propaga para
 * responder 503 y que el operador no rote el token persiguiendo un fantasma.
 */
async function tokenValido(admin: Admin, token: string): Promise<boolean> {
  const { data, error } = await admin
    .from('arcor_config')
    .select('valor')
    .eq('clave', 'ingest_token_hash')
    .maybeSingle()
  if (error) throw new Error(`arcor_config: ${error.message}`)
  const esperado = data?.valor as string | undefined
  if (!esperado) throw new Error('arcor_config sin ingest_token_hash')
  const hash = createHash('sha256').update(token).digest('hex')
  const a = Buffer.from(hash, 'utf8')
  const b = Buffer.from(esperado, 'utf8')
  return a.length === b.length && timingSafeEqual(a, b)
}

function esUniqueViolation(error: { code?: string; message?: string } | null | undefined): boolean {
  return !!error && (error.code === '23505' || String(error.message ?? '').includes('duplicate key'))
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

const DEGRADANTES: readonly EstadoContenedor[] = ['pendiente_arcor', 'revisar_foto']

interface ContenedorExistente {
  id: string
  publicado: boolean | null
  observaciones: string | null
  estado: EstadoContenedor
  booking: string | null
  oe: string | null
  hash_imagen: string | null
}

async function buscarContenedor(admin: Admin, contenedor: string, mes: string): Promise<ContenedorExistente | null> {
  const { data, error } = await admin
    .from('arcor_contenedores')
    .select('id, publicado, observaciones, estado, booking, oe, hash_imagen')
    .eq('contenedor', contenedor)
    .eq('mes', mes)
    .maybeSingle()
  if (error) throw new ItemError(`lookup: ${error.message}`)
  return (data as ContenedorExistente | null) ?? null
}

async function procesarContenedor(admin: Admin, it: Record<string, unknown>, origenReq: string | null, ahora: string) {
  const fecha = parseFechaFlexible(it.fecha)
  if (!fecha) throw new ItemError('fecha inválida (esperado YYYY-MM-DD o DD/MM/YYYY)')

  const estado = String(it.estado ?? 'encontrado') as EstadoContenedor
  if (!ESTADOS_CONTENEDOR.includes(estado)) throw new ItemError(`estado inválido: ${estado}`)

  // El servicio ya normaliza con fallback a BUENOS AIRES (core.normalizar_lugar); acá se espeja.
  const lugar = normalizarLugar(it.lugar) ?? 'BUENOS AIRES'
  const origenRaw = str(it.origen, 30) ?? (origenReq === 'backfill' ? 'backfill' : null)
  const origen = (ORIGENES as readonly string[]).includes(origenRaw ?? '') ? (origenRaw as Origen) : null
  const mes = esMesValido(it.mes) ? it.mes : mesDeFecha(fecha)
  const publicado = it.publicado === true
  const observaciones = str(it.observaciones, 500)

  const hash = str(it.hash_imagen, 40)
  let contenedor = String(it.contenedor ?? '').replace(/\s+/g, '')
  if (!contenedor || /ilegible/i.test(contenedor)) {
    // Sin hash (backfill del NO ENCONTRADOS): clave determinística por fila, así
    // re-correr el backfill no duplica "(ilegible)-xxxx".
    const clave = hash ?? createHash('sha1').update(`${fecha}|${lugar}|${observaciones ?? ''}`).digest('hex').slice(0, 8)
    contenedor = `(ilegible)-${clave}`
  } else {
    contenedor = contenedor.toUpperCase().slice(0, 40)
  }

  const entrante = {
    fecha,
    booking: str(it.booking, 60),
    oe: str(it.oe, 60),
    lugar,
    estado,
    origen,
    hash_imagen: hash,
    updated_at: ahora,
  }

  let accion: 'creado' | 'actualizado' | 'sin_cambios' = 'creado'
  let existente = await buscarContenedor(admin, contenedor, mes)
  if (!existente) {
    const { error } = await admin
      .from('arcor_contenedores')
      .insert({ ...entrante, contenedor, mes, observaciones, publicado, created_at: ahora })
    if (error && esUniqueViolation(error)) {
      // Carrera: otro worker (o request) lo insertó entre el lookup y el insert. Se sigue por el update.
      existente = await buscarContenedor(admin, contenedor, mes)
      if (!existente) throw new ItemError(`insert: ${error.message}`)
    } else if (error) {
      throw new ItemError(`insert: ${error.message}`)
    } else {
      accion = 'creado'
    }
  }

  if (existente) {
    // Un reporte posterior con MENOS datos no puede borrar lo que ya se sabía:
    //  - Trampa #17 del sistema ARCOR: observaciones vacías no pisan las existentes.
    //  - Booking/OE/hash: el productor los omite cuando no los tiene → se conservan.
    //  - Un contenedor ya ENCONTRADO no vuelve a "pendiente" ni "revisar foto" por una
    //    foto re-enviada o una fila vieja del NO ENCONTRADOS (backfill).
    const degrada = existente.estado === 'encontrado' && DEGRADANTES.includes(estado)
    const { error } = await admin
      .from('arcor_contenedores')
      .update({
        ...(degrada ? { updated_at: ahora } : entrante),
        booking: entrante.booking ?? existente.booking ?? null,
        oe: entrante.oe ?? existente.oe ?? null,
        hash_imagen: entrante.hash_imagen ?? existente.hash_imagen ?? null,
        observaciones: observaciones ?? existente.observaciones ?? null,
        publicado: Boolean(existente.publicado) || publicado,
      })
      .eq('id', existente.id)
    if (error) throw new ItemError(`update: ${error.message}`)
    accion = degrada ? 'sin_cambios' : 'actualizado'
  }

  // Sin evento para el backfill (sin_evento) ni para un reporte que no cambió nada.
  if (it.sin_evento !== true && accion !== 'sin_cambios') {
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
      detalle: { contenedor, lugar, fecha, mes, booking: entrante.booking, oe: entrante.oe, origen, publicado, accion },
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
  // (detalle, y también severidad/título: un warning que escala a critical tiene
  // que verse como critical) y no se duplica.
  if (clave && severidad !== 'info') {
    const { data: abierta, error: eAb } = await admin
      .from('arcor_eventos')
      .select('id, detalle, severidad, titulo')
      .eq('clave_alerta', clave)
      .is('resuelto_en', null)
      .in('severidad', ['warning', 'critical'])
      .order('ts', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (eAb) throw new ItemError(`buscar alerta: ${eAb.message}`)
    if (abierta) {
      const escalo = abierta.severidad !== severidad
      const { error } = await admin
        .from('arcor_eventos')
        .update({
          severidad,
          titulo,
          detalle: {
            ...(abierta.detalle ?? {}),
            ...(detalle ?? {}),
            ultima_verificacion: ts,
            verificaciones: Number(abierta.detalle?.verificaciones ?? 1) + 1,
            ...(escalo ? { severidad_anterior: abierta.severidad, cambio_severidad_en: ts } : {}),
          },
        })
        .eq('id', abierta.id)
      if (error) throw new ItemError(`refrescar alerta: ${error.message}`)
      return { kind: 'evento', accion: escalo ? 'alerta_actualizada' : 'alerta_ya_abierta', clave }
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

  let admin: Admin
  let ok: boolean
  try {
    admin = adbAdmin() // lanza si falta SUPABASE_SERVICE_ROLE_KEY
    ok = await tokenValido(admin, token)
  } catch (e) {
    console.error('[arcor/ingest] no se pudo validar el token:', e instanceof Error ? e.message : e)
    return NextResponse.json({ error: 'Ingest no disponible (configuración o base de datos)' }, { status: 503 })
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

  // Latido: solo si entró al menos un item. Una request que falla entera (p. ej.
  // el productor cambió el formato) NO debe mantener el tablero en "Reportando".
  if (procesados.length > 0) {
    const { error } = await admin
      .from('arcor_estado')
      .upsert(
        { clave: 'heartbeat', valor: { ts: ahora, origen: origenReq, items: items.length, procesados: procesados.length, errores: errores.length }, updated_at: ahora },
        { onConflict: 'clave' }
      )
    if (error) console.error('[arcor/ingest] heartbeat:', error.message)
  }

  const status = procesados.length > 0 ? 200 : 400
  return NextResponse.json({ ok: errores.length === 0, procesados: procesados.length, resultados: procesados, errores }, { status })
}
