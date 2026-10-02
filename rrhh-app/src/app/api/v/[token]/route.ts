import { NextRequest, NextResponse, after } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { diaClaveAR } from '@/lib/fechas-ar'
import { avisarEncargados, urlApp, vehiculoPorToken, type Admin, type VehiculoQR } from '@/modules/flota/servidor'
import {
  RESULTADO_LABEL, SLOTS_VALIDOS, SLOT_NOVEDAD, calcularResultado, evaluarKm,
  fotosFaltantes, itemPorId, itemsSinResponder, novedadesDelChecklist, novedadesNuevas, sumarMeses,
  type Resultado,
} from '@/modules/flota/reglas'

// Ruta PÚBLICA (proxy.ts → PUBLIC_PATHS): recibe el checklist quincenal o un
// reporte de novedad desde el formulario del QR. Escribe con service role
// DESPUÉS de validar el token y cada dato: el formulario no tiene sesión, así
// que todo lo que llega se trata como no confiable.
//
// Idempotente: el celular genera un `envioId` (uuid) al empezar y lo manda en
// cada intento. Con señal mala el envío puede llegar y la respuesta perderse;
// el reintento con el mismo id devuelve lo ya guardado, sin duplicar el
// checklist, sus novedades ni los avisos.

const MAX_CHECKLISTS_POR_DIA = 6
const MAX_NOVEDADES_POR_DIA = 10

type Cuerpo = Record<string, unknown>

const texto = (v: unknown, max = 500) => (typeof v === 'string' ? v.trim().slice(0, max) : '')

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/

/**
 * El id del envío: un uuid válido, null si no vino (un formulario abierto antes
 * de este cambio: se acepta, sin protección contra duplicados) o false si vino
 * con cualquier otra cosa.
 */
function envioIdDe(cuerpo: Cuerpo): string | null | false {
  if (cuerpo.envioId == null || cuerpo.envioId === '') return null
  if (typeof cuerpo.envioId !== 'string') return false
  const id = cuerpo.envioId.toLowerCase()
  return UUID.test(id) ? id : false
}

/**
 * Las fotos se guardan bajo el mes en que se subieron. Solo valen las del mes
 * actual o el anterior (un checklist empezado el 31 y enviado el 1): el
 * celular descarta los borradores de más de 12 horas, así que nada legítimo es
 * más viejo.
 */
function mesesAceptados(): Set<string> {
  const mes = diaClaveAR(new Date()).slice(0, 7)
  return new Set([mes, sumarMeses(`${mes}-01`, -1).slice(0, 7)])
}

function pathValido(path: unknown, vehiculoId: string, meses: Set<string>, slot?: string): path is string {
  if (typeof path !== 'string') return false
  const m = /^flota\/([0-9a-f-]{36})\/(\d{4}-\d{2})\/[0-9a-f-]{36}-([a-z_]+)\.(jpg|png|webp)$/.exec(path)
  return !!m && m[1] === vehiculoId && meses.has(m[2]) && (slot == null || m[3] === slot)
}

const ENVIO_INVALIDO = 'Los datos no llegaron bien. Recargá la página y probá de nuevo.'

/** Quién lo hace: un empleado activo de la empresa, o un nombre escrito a mano. */
async function resolverQuien(admin: Admin, vehiculo: VehiculoQR, cuerpo: Cuerpo) {
  const empleadoId = typeof cuerpo.realizadoPor === 'string' ? cuerpo.realizadoPor : null
  if (empleadoId) {
    const { data } = await admin
      .from('empleados')
      .select('id, nombre, apellido')
      .eq('id', empleadoId)
      .eq('empresa_id', vehiculo.empresa_id)
      .eq('activo', true)
      .maybeSingle()
    if (!data) return { error: 'Elegí quién hace el checklist de la lista' as const }
    return { id: data.id, nombre: [data.nombre, data.apellido].filter(Boolean).join(' ') }
  }
  const nombre = texto(cuerpo.nombreLibre, 80)
  if (nombre.length < 3) return { error: 'Escribí tu nombre y apellido' as const }
  return { id: null, nombre }
}

async function cantidadHoy(admin: Admin, tabla: 'vehiculo_checklists' | 'vehiculo_novedades', vehiculoId: string) {
  const desde = `${diaClaveAR(new Date())}T00:00:00-03:00`
  const { count } = await admin
    .from(tabla)
    .select('id', { count: 'exact', head: true })
    .eq('vehiculo_id', vehiculoId)
    .gte('created_at', desde)
  return count ?? 0
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const admin = createAdminClient()

  let vehiculo: VehiculoQR | null
  try {
    vehiculo = await vehiculoPorToken(admin, token)
  } catch {
    return NextResponse.json({ error: 'El sistema no está disponible. Probá de nuevo en un rato.' }, { status: 503 })
  }
  if (!vehiculo) return NextResponse.json({ error: 'QR no válido' }, { status: 404 })

  let cuerpo: Cuerpo
  try {
    cuerpo = (await request.json()) as Cuerpo
  } catch {
    return NextResponse.json({ error: 'Los datos no llegaron completos. Probá de nuevo.' }, { status: 400 })
  }

  const envioId = envioIdDe(cuerpo)
  if (envioId === false) return NextResponse.json({ error: ENVIO_INVALIDO }, { status: 400 })

  const quien = await resolverQuien(admin, vehiculo, cuerpo)
  if ('error' in quien) return NextResponse.json({ error: quien.error }, { status: 400 })

  if (cuerpo.tipo === 'checklist') return registrarChecklist(admin, vehiculo, cuerpo, quien, envioId)
  if (cuerpo.tipo === 'novedad') return registrarNovedad(admin, vehiculo, cuerpo, quien, envioId)
  return NextResponse.json({ error: 'Pedido no reconocido' }, { status: 400 })
}

// ── Checklist quincenal ─────────────────────────────────────────────────────

/**
 * Si el checklist de este envío ya está guardado, la misma respuesta que la
 * primera vez (sin volver a crear novedades ni avisar). null si no existe o si
 * no se pudo leer (entonces se intenta guardar y la clave única decide).
 */
async function checklistYaRecibido(admin: Admin, vehiculo: VehiculoQR, envioId: string): Promise<NextResponse | null> {
  const { data, error } = await admin
    .from('vehiculo_checklists')
    .select('id, vehiculo_id, resultado, km_inconsistente')
    .eq('id', envioId)
    .maybeSingle()
  if (error || !data) return null
  // Un id de otro vehículo no es un reintento: no se le cuenta nada.
  if (data.vehiculo_id !== vehiculo.id) return NextResponse.json({ error: ENVIO_INVALIDO }, { status: 409 })
  const { count } = await admin
    .from('vehiculo_novedades')
    .select('id', { count: 'exact', head: true })
    .eq('checklist_id', data.id)
  const resultado = data.resultado as Resultado
  return NextResponse.json({
    ok: true,
    repetido: true,
    resultado,
    resultadoLabel: RESULTADO_LABEL[resultado] ?? 'Checklist enviado',
    novedades: count ?? 0,
    yaReportadas: 0,
    kmInconsistente: data.km_inconsistente,
  })
}

async function registrarChecklist(
  admin: Admin,
  vehiculo: VehiculoQR,
  cuerpo: Cuerpo,
  quien: { id: string | null; nombre: string },
  envioId: string | null
) {
  if (envioId) {
    const previo = await checklistYaRecibido(admin, vehiculo, envioId)
    if (previo) return previo
  }

  if ((await cantidadHoy(admin, 'vehiculo_checklists', vehiculo.id)) >= MAX_CHECKLISTS_POR_DIA) {
    return NextResponse.json({ error: 'Ya se cargaron varios checklists hoy para esta camioneta.' }, { status: 429 })
  }

  const km = Number(cuerpo.km)
  if (!Number.isInteger(km) || km < 0 || km > 2_000_000) {
    return NextResponse.json({ error: 'Cargá los kilómetros del tablero, sin puntos ni comas' }, { status: 400 })
  }

  // Respuestas: solo ítems conocidos y valores válidos.
  const crudas = (cuerpo.respuestas ?? {}) as Record<string, unknown>
  const respuestas: Record<string, string> = {}
  for (const [id, v] of Object.entries(crudas)) {
    if (itemPorId(id) && (v === 'ok' || v === 'obs' || v === 'no_ok')) respuestas[id] = v
  }
  const sinResponder = itemsSinResponder(respuestas)
  if (sinResponder.length) {
    return NextResponse.json({ error: `Faltan ${sinResponder.length} ítems por revisar` }, { status: 400 })
  }
  const notasCrudas = (cuerpo.notas ?? {}) as Record<string, unknown>
  const notas: Record<string, string> = {}
  for (const [id, v] of Object.entries(notasCrudas)) {
    const t = texto(v, 300)
    if (itemPorId(id) && t) notas[id] = t
  }

  // Fotos: cada una tiene que ser de ESTE vehículo, del slot que dice ser y reciente.
  const meses = mesesAceptados()
  const fotosCrudas = (cuerpo.fotos ?? {}) as Record<string, unknown>
  const fotos: Record<string, string> = {}
  for (const [slot, path] of Object.entries(fotosCrudas)) {
    if (SLOTS_VALIDOS.has(slot) && pathValido(path, vehiculo.id, meses, slot)) fotos[slot] = path
  }
  const faltan = fotosFaltantes(fotos)
  if (faltan.length) {
    return NextResponse.json({ error: `Falta la foto: ${faltan.map((f) => f.label.toLowerCase()).join(', ')}` }, { status: 400 })
  }

  const danio = texto(cuerpo.danio, 500)
  const fotosDanio = (Array.isArray(cuerpo.fotosDanio) ? cuerpo.fotosDanio : [])
    .filter((p): p is string => pathValido(p, vehiculo.id, meses, SLOT_NOVEDAD))
    .slice(0, 6)

  const resultado = calcularResultado(respuestas)
  const evaluacion = evaluarKm(km, { km: vehiculo.km_actual, fecha: vehiculo.km_actualizado_at })

  const { data: checklist, error } = await admin
    .from('vehiculo_checklists')
    .insert({
      ...(envioId ? { id: envioId } : {}),
      vehiculo_id: vehiculo.id,
      empresa_id: vehiculo.empresa_id,
      realizado_por: quien.id,
      realizado_por_nombre: quien.nombre,
      km,
      km_inconsistente: evaluacion.inconsistente,
      resultado,
      respuestas,
      notas_items: notas,
      fotos,
      observaciones: texto(cuerpo.observaciones, 1000) || null,
      origen: 'qr',
    })
    .select('id')
    .single()
  if (error || !checklist) {
    // Dos reintentos que llegaron juntos: el segundo choca con la clave única.
    if (error?.code === '23505' && envioId) {
      const previo = await checklistYaRecibido(admin, vehiculo, envioId)
      if (previo) return previo
    }
    return NextResponse.json({ error: 'No se pudo guardar el checklist. Probá de nuevo.' }, { status: 500 })
  }

  // Lo que hay que arreglar queda como novedad abierta. Un ítem que ya tiene
  // una novedad abierta (la falla sigue sin arreglarse) no abre otra en cada
  // quincena. Si no se puede leer, se crean todas: mejor un duplicado que
  // perder una falla grave.
  const propuestas = novedadesDelChecklist(respuestas, notas)
  let itemsAbiertos: string[] = []
  if (propuestas.length) {
    const { data: abiertas, error: errAb } = await admin
      .from('vehiculo_novedades')
      .select('item')
      .eq('vehiculo_id', vehiculo.id)
      .eq('estado', 'abierta')
      .in('item', propuestas.map((p) => p.item))
    if (errAb) console.error('[flota] no se pudieron leer las novedades abiertas', errAb.message)
    else itemsAbiertos = (abiertas ?? []).map((a) => a.item).filter((i): i is string => !!i)
  }
  const nuevas = novedadesNuevas(propuestas, itemsAbiertos)
  const yaReportadas = propuestas.length - nuevas.length

  const novedades = nuevas.map((n) => ({
    vehiculo_id: vehiculo.id,
    empresa_id: vehiculo.empresa_id,
    checklist_id: checklist.id,
    origen: 'checklist',
    item: n.item,
    titulo: n.titulo,
    descripcion: n.descripcion,
    gravedad: n.gravedad,
    reportado_por_nombre: quien.nombre,
    km,
  }))
  if (danio) {
    novedades.push({
      vehiculo_id: vehiculo.id, empresa_id: vehiculo.empresa_id, checklist_id: checklist.id, origen: 'checklist',
      item: 'danio_nuevo', titulo: 'Golpe o daño nuevo', descripcion: danio, gravedad: 'media',
      reportado_por_nombre: quien.nombre, km,
    })
  }
  if (evaluacion.inconsistente) {
    novedades.push({
      vehiculo_id: vehiculo.id, empresa_id: vehiculo.empresa_id, checklist_id: checklist.id, origen: 'checklist',
      item: 'km_inconsistente', titulo: 'Revisar el kilometraje cargado',
      descripcion: `Se cargaron ${km.toLocaleString('es-AR')} km. ${evaluacion.motivo}. Mirá la foto del tablero.`,
      gravedad: 'baja', reportado_por_nombre: quien.nombre, km,
    })
  }
  if (novedades.length) {
    const filas = novedades.map((n) => (n.item === 'danio_nuevo' ? { ...n, fotos: fotosDanio } : n))
    const { error: errNov } = await admin.from('vehiculo_novedades').insert(filas)
    if (errNov) console.error('[flota] checklist guardado pero sin sus novedades', errNov.message)
  }

  // El km pisa el del vehículo solo si cuadra con el historial.
  if (!evaluacion.inconsistente) {
    await admin
      .from('vehiculos')
      .update({ km_actual: km, km_actualizado_at: new Date().toISOString() })
      .eq('id', vehiculo.id)
  }

  if (resultado === 'no_apto') {
    const graves = propuestas.filter((n) => n.gravedad === 'alta')
    const aviso = {
      empresaId: vehiculo.empresa_id,
      vehiculoId: vehiculo.id,
      tipo: 'checklist_no_apto',
      clave: `checklist_no_apto:${checklist.id}`,
      mensaje: [
        `⚠️ ${vehiculo.patente} quedó NO APTA para circular`,
        `Checklist de hoy, lo hizo ${quien.nombre} (${km.toLocaleString('es-AR')} km).`,
        '',
        ...graves.map((g) => `• ${g.titulo}${g.descripcion ? `: ${g.descripcion}` : ''}${itemsAbiertos.includes(g.item) ? ' (ya estaba reportado)' : ''}`),
        '',
        `Ver: ${urlApp()}/flota/${vehiculo.id}`,
      ].join('\n'),
    }
    // Después de responder: quien maneja no espera al WhatsApp.
    after(() => avisarEncargados(admin, aviso))
  }

  return NextResponse.json({
    ok: true,
    resultado,
    resultadoLabel: RESULTADO_LABEL[resultado],
    novedades: novedades.length,
    yaReportadas,
    kmInconsistente: evaluacion.inconsistente,
  })
}

// ── Reporte suelto de novedad (un golpe, una falla, una pinchadura) ─────────

const GRAVEDADES = new Set(['baja', 'media', 'alta'])

/** Si la novedad de este envío ya está guardada, ok (sin avisar de nuevo). */
async function novedadYaRecibida(admin: Admin, vehiculo: VehiculoQR, envioId: string): Promise<NextResponse | null> {
  const { data, error } = await admin.from('vehiculo_novedades').select('id, vehiculo_id').eq('id', envioId).maybeSingle()
  if (error || !data) return null
  if (data.vehiculo_id !== vehiculo.id) return NextResponse.json({ error: ENVIO_INVALIDO }, { status: 409 })
  return NextResponse.json({ ok: true, repetido: true })
}

async function registrarNovedad(
  admin: Admin,
  vehiculo: VehiculoQR,
  cuerpo: Cuerpo,
  quien: { id: string | null; nombre: string },
  envioId: string | null
) {
  if (envioId) {
    const previo = await novedadYaRecibida(admin, vehiculo, envioId)
    if (previo) return previo
  }
  if ((await cantidadHoy(admin, 'vehiculo_novedades', vehiculo.id)) >= MAX_NOVEDADES_POR_DIA) {
    return NextResponse.json({ error: 'Ya se reportaron muchas novedades hoy para esta camioneta.' }, { status: 429 })
  }
  const titulo = texto(cuerpo.titulo, 120)
  if (titulo.length < 3) return NextResponse.json({ error: 'Contá en pocas palabras qué pasó' }, { status: 400 })
  const gravedad = GRAVEDADES.has(String(cuerpo.gravedad)) ? String(cuerpo.gravedad) : 'media'
  const km = Number(cuerpo.km)
  const kmValido = Number.isInteger(km) && km >= 0 && km <= 2_000_000 ? km : null
  const meses = mesesAceptados()
  const fotos = (Array.isArray(cuerpo.fotos) ? cuerpo.fotos : [])
    .filter((p): p is string => pathValido(p, vehiculo.id, meses, SLOT_NOVEDAD))
    .slice(0, 6)

  const { data: novedad, error } = await admin
    .from('vehiculo_novedades')
    .insert({
      ...(envioId ? { id: envioId } : {}),
      vehiculo_id: vehiculo.id,
      empresa_id: vehiculo.empresa_id,
      origen: 'reporte',
      item: 'reporte',
      titulo,
      descripcion: texto(cuerpo.descripcion, 1000) || null,
      gravedad,
      fotos,
      reportado_por_nombre: quien.nombre,
      km: kmValido,
    })
    .select('id')
    .single()
  if (error || !novedad) {
    if (error?.code === '23505' && envioId) {
      const previo = await novedadYaRecibida(admin, vehiculo, envioId)
      if (previo) return previo
    }
    return NextResponse.json({ error: 'No se pudo guardar la novedad. Probá de nuevo.' }, { status: 500 })
  }

  const descripcionAviso = texto(cuerpo.descripcion, 300) || null
  // Después de responder: quien reporta no espera al WhatsApp.
  after(() => avisarEncargados(admin, {
    empresaId: vehiculo.empresa_id,
    vehiculoId: vehiculo.id,
    tipo: 'novedad',
    clave: `novedad:${novedad.id}`,
    mensaje: [
      `${gravedad === 'alta' ? '🔴' : gravedad === 'media' ? '🟠' : '🟡'} Novedad en ${vehiculo.patente}: ${titulo}`,
      descripcionAviso,
      `Reportó ${quien.nombre}${fotos.length ? ` · ${fotos.length} ${fotos.length === 1 ? 'foto' : 'fotos'}` : ''}.`,
      '',
      `Ver: ${urlApp()}/flota/${vehiculo.id}`,
    ].filter((l) => l !== null).join('\n'),
  }))

  return NextResponse.json({ ok: true })
}
