// ============================================================
// Queries del módulo Gestión Comercial — server side.
// NOTA: Las tablas comercial_* no están en database.ts todavía (generado previo
// a la migración). Casteamos los resultados a interfaces explícitas para evitar
// los SelectQueryError de supabase-js hasta que se regeneren los tipos.
// ============================================================
import { createClient } from '@/lib/supabase/server'
import type { Sesion } from '@/lib/auth/session'
import { tieneRol, COMERCIAL_GESTION } from '@/lib/auth/roles'

function row<T>(x: unknown): T { return x as T }
function rows<T>(x: unknown): T[] { return (x as T[] | null) ?? [] }
// Las tablas comercial_* no están en database.ts (generado antes de la migración).
// Usamos un cliente sin tipo para evitar errores de sobrecargas en .from().
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function cdb(): Promise<any> { return createClient() }

function esGestion(sesion: Sesion) {
  return tieneRol(sesion.rol, COMERCIAL_GESTION)
}

// Interfaces explícitas de dominio (sustituyen los tipos generados)
interface ClienteRow { id: string; nombre: string; razon_social: string | null; pais: string | null; ciudad: string | null; rubro: string | null; estado: string; prioridad: string; vendedor_asignado_id: string | null; updated_at: string | null }
interface ClienteDetalleRow extends ClienteRow { cuit_tax_id: string | null; tipo_cliente: string | null; provincia_estado: string | null; origen: string | null; notas: string | null; created_at: string }
interface ContactoRow { id: string; nombre: string; apellido: string | null; cargo: string | null; area: string | null; email: string | null; telefono: string | null; whatsapp: string | null; pais: string | null; idioma: string | null; es_contacto_principal: boolean; estado: string; cliente_id: string }
interface ProyectoRow { id: string; codigo: string | null; titulo: string; etapa: string; estado: string; prioridad: string; valor_estimado: number | null; moneda: string | null; probabilidad: number | null; responsable_id: string; cliente_id: string | null; ultima_actividad_at: string | null; proxima_accion: string | null; proxima_accion_fecha: string | null; fecha_estimada_cierre: string | null; created_at: string; empresa: string | null }
interface PerfilComercialRow { id: string; nombre: string | null; rol: string }
interface ProyectoDetalleRow extends ProyectoRow { descripcion: string | null; tipo_proyecto: string | null; motivo_perdida_id: string | null; fecha_cierre_real: string | null; valor_cierre: number | null; feedback_perdida: string | null }
interface TareaRow { id: string; titulo: string; tipo: string; estado: string; prioridad: string; responsable_id: string; cliente_id: string | null; proyecto_id: string | null; fecha_vencimiento: string | null; created_at: string; empresa: string | null; asignado_por: string | null; nota_asignacion: string | null }
interface EventoRow { id: string; titulo: string; tipo: string; estado: string; fecha_inicio: string; fecha_fin: string | null; cliente_id: string | null; proyecto_id: string | null; responsable_id: string; resultado: string | null; empresa: string | null }
interface ViajeRow { id: string; titulo: string; pais: string | null; ciudad: string | null; fecha_inicio: string | null; fecha_fin: string | null; estado: string; responsable_id: string; motivo: string | null; empresa: string | null }
interface ActividadRow { id: string; tipo: string; titulo: string; descripcion: string | null; created_at: string; usuario_id: string | null; proyecto_id: string | null; cliente_id: string | null }
interface NotaRow { id: string; tipo: string; contenido: string; created_at: string; usuario_id: string | null }
interface ArchivoRow { id: string; nombre: string; path: string; mime_type: string | null; tipo_archivo: string | null; created_at: string; subido_por: string | null }
interface MotivoRow { id: string; nombre: string; descripcion: string | null }
interface VendedorRow { id: string; nombre: string | null }

export async function obtenerDashboardComercial(sesion: Sesion) {
  const supabase = await cdb()
  const hoy = new Date().toISOString()
  const hace7 = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

  const baseProyectos = supabase.from('comercial_proyectos').select('id, titulo, etapa, estado, prioridad, valor_estimado, moneda, ultima_actividad_at, proxima_accion, proxima_accion_fecha, responsable_id')
  const proyectosQ = esGestion(sesion) ? baseProyectos.eq('estado', 'abierto') : baseProyectos.eq('estado', 'abierto').eq('responsable_id', sesion.userId)

  const baseTareas = supabase.from('comercial_tareas').select('id, titulo, tipo, estado, prioridad, fecha_vencimiento, responsable_id, proyecto_id, cliente_id')
  const tareasQ = esGestion(sesion) ? baseTareas.not('estado', 'in', '("completada","cancelada")') : baseTareas.not('estado', 'in', '("completada","cancelada")').eq('responsable_id', sesion.userId)

  const baseEventos = supabase.from('comercial_eventos').select('id, titulo, tipo, estado, fecha_inicio, cliente_id, proyecto_id, responsable_id')
  const eventosQ = esGestion(sesion) ? baseEventos.eq('estado', 'programado').gte('fecha_inicio', hoy) : baseEventos.eq('estado', 'programado').gte('fecha_inicio', hoy).eq('responsable_id', sesion.userId)

  const actividadQ = supabase.from('comercial_actividad').select('id, tipo, titulo, descripcion, created_at, usuario_id, proyecto_id, cliente_id').order('created_at', { ascending: false }).limit(20)

  const [
    { data: proyectosRaw },
    { data: tareasRaw },
    { data: eventosRaw },
    { data: actividadRaw },
  ] = await Promise.all([proyectosQ, tareasQ, eventosQ.limit(10), actividadQ])

  const proyectosArr = rows<ProyectoRow>(proyectosRaw)
  const tareasArr = rows<TareaRow>(tareasRaw)
  const eventosArr = rows<EventoRow>(eventosRaw)

  const tareasHoy = tareasArr.filter((t) => t.fecha_vencimiento && t.fecha_vencimiento.substring(0, 10) === hoy.substring(0, 10))
  const tareasVencidas = tareasArr.filter((t) => t.fecha_vencimiento && t.fecha_vencimiento < hoy)
  const sinProximaAccion = proyectosArr.filter((p) => !p.proxima_accion)
  const sinMovimiento = proyectosArr.filter((p) => !p.ultima_actividad_at || p.ultima_actividad_at < hace7)

  const pipeline = proyectosArr.reduce((sum, p) => sum + (p.valor_estimado ?? 0), 0)

  const porEtapa = proyectosArr.reduce<Record<string, number>>((acc, p) => {
    acc[p.etapa] = (acc[p.etapa] ?? 0) + 1
    return acc
  }, {})

  return {
    proyectosAbiertos: proyectosArr.length,
    tareasHoy,
    tareasVencidas,
    proximasReuniones: eventosArr,
    sinProximaAccion,
    sinMovimiento,
    pipeline,
    porEtapa,
    actividadReciente: rows<ActividadRow>(actividadRaw),
    topProyectos: proyectosArr.filter((p) => p.prioridad === 'alta').slice(0, 5),
  }
}

export async function listarClientes(sesion: Sesion, filtros?: { estado?: string; prioridad?: string; vendedor?: string }): Promise<ClienteRow[]> {
  const supabase = await cdb()
  let q = supabase
    .from('comercial_clientes')
    .select('id, nombre, razon_social, pais, ciudad, rubro, estado, prioridad, vendedor_asignado_id, updated_at')
    .order('nombre')

  if (!esGestion(sesion) && sesion.rol === 'vendedor') {
    q = q.eq('vendedor_asignado_id', sesion.userId)
  }
  if (filtros?.estado) q = q.eq('estado', filtros.estado)
  if (filtros?.prioridad) q = q.eq('prioridad', filtros.prioridad)
  if (filtros?.vendedor) q = q.eq('vendedor_asignado_id', filtros.vendedor)

  const { data, error } = await q
  if (error) throw error
  return rows<ClienteRow>(data)
}

export async function obtenerCliente(id: string, sesion: Sesion) {
  const supabase = await cdb()
  const { data, error } = await supabase
    .from('comercial_clientes')
    .select('*')
    .eq('id', id)
    .single()
  if (error) throw error

  const [{ data: contactosRaw }, { data: proyectosRaw }, { data: tareasRaw }, { data: eventosRaw }, { data: notasRaw }] = await Promise.all([
    supabase.from('comercial_contactos').select('*').eq('cliente_id', id).order('es_contacto_principal', { ascending: false }),
    supabase.from('comercial_proyectos').select('id, titulo, etapa, estado, prioridad, responsable_id, ultima_actividad_at, proxima_accion_fecha').eq('cliente_id', id).order('created_at', { ascending: false }),
    supabase.from('comercial_tareas').select('id, titulo, tipo, estado, prioridad, fecha_vencimiento, responsable_id').eq('cliente_id', id).not('estado', 'in', '("completada","cancelada")').order('fecha_vencimiento'),
    supabase.from('comercial_eventos').select('id, titulo, tipo, estado, fecha_inicio').eq('cliente_id', id).eq('estado', 'programado').order('fecha_inicio').limit(5),
    supabase.from('comercial_notas').select('id, tipo, contenido, created_at, usuario_id').eq('cliente_id', id).order('created_at', { ascending: false }).limit(10),
  ])

  return {
    cliente: data as unknown as ClienteDetalleRow,
    contactos: rows<ContactoRow>(contactosRaw),
    proyectos: rows<ProyectoRow>(proyectosRaw),
    tareas: rows<TareaRow>(tareasRaw),
    eventos: rows<EventoRow>(eventosRaw),
    notas: rows<NotaRow>(notasRaw),
  }
}

export async function listarContactos(sesion: Sesion, filtros?: { cliente_id?: string; pais?: string; idioma?: string }): Promise<ContactoRow[]> {
  const supabase = await cdb()
  let q = supabase
    .from('comercial_contactos')
    .select('id, nombre, apellido, cargo, area, email, telefono, pais, idioma, es_contacto_principal, estado, cliente_id')
    .order('nombre')

  if (filtros?.cliente_id) q = q.eq('cliente_id', filtros.cliente_id)
  if (filtros?.pais) q = q.eq('pais', filtros.pais)
  if (filtros?.idioma) q = q.eq('idioma', filtros.idioma)

  const { data, error } = await q
  if (error) throw error
  return rows<ContactoRow>(data)
}

export async function listarProyectos(sesion: Sesion, filtros?: { estado?: string; etapa?: string; responsable?: string; prioridad?: string; empresa?: string }): Promise<ProyectoRow[]> {
  const supabase = await cdb()
  let q = supabase
    .from('comercial_proyectos')
    .select('id, codigo, titulo, etapa, estado, prioridad, valor_estimado, moneda, probabilidad, responsable_id, cliente_id, ultima_actividad_at, proxima_accion, proxima_accion_fecha, fecha_estimada_cierre, created_at, empresa')
    .order('created_at', { ascending: false })

  if (!esGestion(sesion) && sesion.rol === 'vendedor') {
    q = q.eq('responsable_id', sesion.userId)
  }
  if (filtros?.estado) q = q.eq('estado', filtros.estado)
  if (filtros?.etapa) q = q.eq('etapa', filtros.etapa)
  if (filtros?.responsable) q = q.eq('responsable_id', filtros.responsable)
  if (filtros?.prioridad) q = q.eq('prioridad', filtros.prioridad)
  if (filtros?.empresa) q = q.eq('empresa', filtros.empresa)

  const { data, error } = await q
  if (error) throw error
  return rows<ProyectoRow>(data)
}

export async function obtenerProyecto(id: string, sesion: Sesion) {
  const supabase = await cdb()
  const { data, error } = await supabase
    .from('comercial_proyectos')
    .select('*')
    .eq('id', id)
    .single()
  if (error) throw error

  const [{ data: tareasRaw }, { data: eventosRaw }, { data: notasRaw }, { data: actividadRaw }, { data: archivosRaw }] = await Promise.all([
    supabase.from('comercial_tareas').select('id, titulo, tipo, estado, prioridad, fecha_vencimiento, responsable_id').eq('proyecto_id', id).not('estado', 'in', '("completada","cancelada")').order('fecha_vencimiento'),
    supabase.from('comercial_eventos').select('id, titulo, tipo, estado, fecha_inicio, resultado, responsable_id').eq('proyecto_id', id).order('fecha_inicio', { ascending: false }).limit(10),
    supabase.from('comercial_notas').select('id, tipo, contenido, created_at, usuario_id').eq('proyecto_id', id).order('created_at', { ascending: false }).limit(20),
    supabase.from('comercial_actividad').select('id, tipo, titulo, descripcion, created_at, usuario_id').eq('proyecto_id', id).order('created_at', { ascending: false }).limit(30),
    supabase.from('comercial_archivos').select('id, nombre, path, mime_type, tipo_archivo, created_at, subido_por').eq('proyecto_id', id).order('created_at', { ascending: false }),
  ])

  return {
    proyecto: data as unknown as ProyectoDetalleRow,
    tareas: rows<TareaRow>(tareasRaw),
    eventos: rows<EventoRow>(eventosRaw),
    notas: rows<NotaRow>(notasRaw),
    actividad: rows<ActividadRow>(actividadRaw),
    archivos: rows<ArchivoRow>(archivosRaw),
  }
}

export async function listarTareas(sesion: Sesion, filtros?: { estado?: string; prioridad?: string; responsable?: string; proyecto_id?: string; rango?: 'hoy' | 'vencidas' | 'semana'; empresa?: string }): Promise<TareaRow[]> {
  const supabase = await cdb()
  // Usar fecha en zona Argentina (UTC-3) para filtros de "hoy"
  const ahora = new Date()
  const offsetAR = -3 * 60 // UTC-3, sin DST
  const localAR = new Date(ahora.getTime() + (offsetAR - ahora.getTimezoneOffset()) * 60000)
  const inicioHoy = new Date(Date.UTC(localAR.getFullYear(), localAR.getMonth(), localAR.getDate())).toISOString()
  const finHoy    = new Date(Date.UTC(localAR.getFullYear(), localAR.getMonth(), localAR.getDate() + 1)).toISOString()
  const finSemana = new Date(Date.UTC(localAR.getFullYear(), localAR.getMonth(), localAR.getDate() + 7)).toISOString()

  let q = supabase
    .from('comercial_tareas')
    .select('id, titulo, tipo, estado, prioridad, responsable_id, cliente_id, proyecto_id, fecha_vencimiento, created_at, empresa, asignado_por, nota_asignacion')
    .order('fecha_vencimiento')

  if (!esGestion(sesion)) q = q.eq('responsable_id', sesion.userId)
  if (filtros?.estado) q = q.eq('estado', filtros.estado)
  if (filtros?.prioridad) q = q.eq('prioridad', filtros.prioridad)
  if (filtros?.responsable && esGestion(sesion)) q = q.eq('responsable_id', filtros.responsable)
  if (filtros?.proyecto_id) q = q.eq('proyecto_id', filtros.proyecto_id)
  if (filtros?.empresa) q = q.eq('empresa', filtros.empresa)
  if (filtros?.rango === 'hoy') q = q.gte('fecha_vencimiento', inicioHoy).lt('fecha_vencimiento', finHoy)
  if (filtros?.rango === 'vencidas') q = q.lt('fecha_vencimiento', inicioHoy).not('estado', 'in', '("completada","cancelada")')
  if (filtros?.rango === 'semana') q = q.gte('fecha_vencimiento', inicioHoy).lte('fecha_vencimiento', finSemana)

  const { data, error } = await q
  if (error) throw error
  return rows<TareaRow>(data)
}

export async function listarEventos(sesion: Sesion, filtros?: { estado?: string; cliente_id?: string; proyecto_id?: string; empresa?: string }): Promise<EventoRow[]> {
  const supabase = await cdb()
  let q = supabase
    .from('comercial_eventos')
    .select('id, titulo, tipo, estado, fecha_inicio, fecha_fin, cliente_id, proyecto_id, responsable_id, resultado, empresa')
    .order('fecha_inicio', { ascending: false })

  if (!esGestion(sesion)) q = q.eq('responsable_id', sesion.userId)
  if (filtros?.estado) q = q.eq('estado', filtros.estado)
  if (filtros?.cliente_id) q = q.eq('cliente_id', filtros.cliente_id)
  if (filtros?.proyecto_id) q = q.eq('proyecto_id', filtros.proyecto_id)
  if (filtros?.empresa) q = q.eq('empresa', filtros.empresa)

  const { data, error } = await q
  if (error) throw error
  return rows<EventoRow>(data)
}

export async function listarViajes(sesion: Sesion, filtros?: { estado?: string }): Promise<ViajeRow[]> {
  const supabase = await cdb()
  let q = supabase
    .from('comercial_viajes')
    .select('id, titulo, pais, ciudad, fecha_inicio, fecha_fin, estado, responsable_id, motivo')
    .order('fecha_inicio', { ascending: false })

  if (!esGestion(sesion)) q = q.eq('responsable_id', sesion.userId)
  if (filtros?.estado) q = q.eq('estado', filtros.estado)

  const { data, error } = await q
  if (error) throw error
  return rows<ViajeRow>(data)
}

export async function obtenerActividadProyecto(proyectoId: string): Promise<ActividadRow[]> {
  const supabase = await cdb()
  const { data, error } = await supabase
    .from('comercial_actividad')
    .select('id, tipo, titulo, descripcion, created_at, usuario_id')
    .eq('proyecto_id', proyectoId)
    .order('created_at', { ascending: false })
    .limit(50)
  if (error) throw error
  return rows<ActividadRow>(data)
}

export async function obtenerReportesComerciales(sesion: Sesion, filtros?: { desde?: string; hasta?: string; vendedor?: string; estado?: string }) {
  const supabase = await cdb()
  const hoy = new Date().toISOString()
  const hace7 = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

  let baseP = supabase.from('comercial_proyectos').select('id, etapa, estado, valor_estimado, moneda, responsable_id, motivo_perdida_id, ultima_actividad_at, proxima_accion, proxima_accion_fecha, created_at')
  if (filtros?.desde) baseP = baseP.gte('created_at', filtros.desde)
  if (filtros?.hasta) baseP = baseP.lte('created_at', filtros.hasta)
  if (filtros?.vendedor) baseP = baseP.eq('responsable_id', filtros.vendedor)
  if (filtros?.estado) baseP = baseP.eq('estado', filtros.estado)

  const [{ data: proyectos }, { data: tareas }, { data: eventos }] = await Promise.all([
    baseP,
    supabase.from('comercial_tareas').select('id, estado, responsable_id, fecha_vencimiento').not('estado', 'in', '("cancelada")'),
    supabase.from('comercial_eventos').select('id, tipo, estado, responsable_id, resultado').not('estado', 'in', '("cancelado")'),
  ])

  const ps = rows<ProyectoRow & { motivo_perdida_id: string | null }>(proyectos)
  const ts = rows<TareaRow>(tareas)
  const es = rows<EventoRow>(eventos)

  const abiertos = ps.filter((p) => p.estado === 'abierto')
  const ganados = ps.filter((p) => p.estado === 'ganado')
  const perdidos = ps.filter((p) => p.estado === 'perdido')
  const pipeline = abiertos.reduce((sum, p) => sum + (p.valor_estimado ?? 0), 0)
  const sinMovimiento = abiertos.filter((p) => !p.ultima_actividad_at || p.ultima_actividad_at < hace7)
  const sinProximaAccion = abiertos.filter((p) => !p.proxima_accion)
  const tareasVencidas = ts.filter((t) => t.fecha_vencimiento && t.fecha_vencimiento < hoy && t.estado !== 'completada')
  const reunionesRealizadas = es.filter((e) => e.estado === 'realizado')
  const reunionesSinResultado = es.filter((e) => e.estado === 'realizado' && !e.resultado)

  const porEtapa = abiertos.reduce<Record<string, number>>((acc, p) => {
    acc[p.etapa] = (acc[p.etapa] ?? 0) + 1
    return acc
  }, {})

  return {
    proyectosAbiertos: abiertos.length,
    pipeline,
    ganados: ganados.length,
    perdidos: perdidos.length,
    tareasVencidas: tareasVencidas.length,
    reunionesRealizadas: reunionesRealizadas.length,
    reunionesSinResultado: reunionesSinResultado.length,
    sinMovimiento: sinMovimiento.length,
    sinProximaAccion: sinProximaAccion.length,
    porEtapa,
  }
}

export async function listarMotivosPerdida(): Promise<MotivoRow[]> {
  const supabase = await cdb()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabase as any).from('comercial_motivos_perdida').select('id, nombre, descripcion').eq('activo', true).order('orden')
  return rows<MotivoRow>(data)
}

interface MotivoDetalleRow extends MotivoRow { activo: boolean; orden: number }

export async function listarMotivosDetalle(): Promise<MotivoDetalleRow[]> {
  const supabase = await cdb()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabase as any).from('comercial_motivos_perdida').select('id, nombre, descripcion, activo, orden').order('orden')
  return rows<MotivoDetalleRow>(data)
}

export async function obtenerConfigComercial(): Promise<Record<string, unknown>> {
  const supabase = await cdb()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabase as any).from('comercial_config').select('clave, valor')
  const items = rows<{ clave: string; valor: unknown }>(data)
  return items.reduce<Record<string, unknown>>((acc, c) => { acc[c.clave] = c.valor; return acc }, {})
}

export async function listarVendedores(): Promise<VendedorRow[]> {
  const supabase = await cdb()
  const { data } = await supabase
    .from('perfiles')
    .select('id, nombre')
    .in('rol', ['vendedor', 'gerente_comercial', 'admin', 'direccion'])
    .order('nombre')
  return rows<VendedorRow>(data)
}

export interface EquipoMiembro {
  id: string
  nombre: string | null
  rol: string
  tareasHoy: number
  tareasVencidas: number
  tareasAbiertas: number
  proyectosAbiertos: number
  pipeline: number
  ultimaActividad: string | null
}

export async function listarEquipoComercial(): Promise<EquipoMiembro[]> {
  const supabase = await cdb()

  // Zona Argentina UTC-3
  const ahora = new Date()
  const offsetAR = -3 * 60
  const localAR = new Date(ahora.getTime() + (offsetAR - ahora.getTimezoneOffset()) * 60000)
  const inicioHoy = new Date(Date.UTC(localAR.getFullYear(), localAR.getMonth(), localAR.getDate())).toISOString()
  const finHoy    = new Date(Date.UTC(localAR.getFullYear(), localAR.getMonth(), localAR.getDate() + 1)).toISOString()

  const [{ data: perfiles }, { data: tareas }, { data: proyectos }] = await Promise.all([
    supabase.from('perfiles').select('id, nombre, rol')
      .in('rol', ['vendedor', 'gerente_comercial', 'asistente_comercial', 'direccion'])
      .order('nombre'),
    supabase.from('comercial_tareas').select('id, responsable_id, estado, fecha_vencimiento, created_at')
      .not('estado', 'in', '("completada","cancelada")'),
    supabase.from('comercial_proyectos').select('id, responsable_id, estado, valor_estimado, ultima_actividad_at')
      .eq('estado', 'abierto'),
  ])

  const tareasArr   = rows<{ id: string; responsable_id: string; estado: string; fecha_vencimiento: string | null; created_at: string }>(tareas)
  const proyArr     = rows<{ id: string; responsable_id: string; estado: string; valor_estimado: number | null; ultima_actividad_at: string | null }>(proyectos)
  const perfilesArr = rows<PerfilComercialRow>(perfiles)

  return perfilesArr.map((p) => {
    const misTareas = tareasArr.filter((t) => t.responsable_id === p.id)
    const misProy   = proyArr.filter((pr) => pr.responsable_id === p.id)
    const tareasHoy = misTareas.filter((t) => t.fecha_vencimiento && t.fecha_vencimiento >= inicioHoy && t.fecha_vencimiento < finHoy).length
    const tareasVencidas = misTareas.filter((t) => t.fecha_vencimiento && t.fecha_vencimiento < inicioHoy).length
    const pipeline  = misProy.reduce((s, pr) => s + (pr.valor_estimado ?? 0), 0)
    const ultimaAct = misProy.reduce<string | null>((last, pr) => {
      if (!pr.ultima_actividad_at) return last
      if (!last || pr.ultima_actividad_at > last) return pr.ultima_actividad_at
      return last
    }, null)
    return {
      id: p.id,
      nombre: p.nombre,
      rol: p.rol,
      tareasHoy,
      tareasVencidas,
      tareasAbiertas: misTareas.length,
      proyectosAbiertos: misProy.length,
      pipeline,
      ultimaActividad: ultimaAct,
    }
  })
}
