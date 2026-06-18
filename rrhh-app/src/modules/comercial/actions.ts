'use server'
// ============================================================
// Server actions del módulo Gestión Comercial.
// Cada action crítica registra actividad en comercial_actividad.
// ============================================================
import { createClient } from '@/lib/supabase/server'
import { requireModulo } from '@/lib/auth/session'
import { tieneRol, COMERCIAL_GESTION } from '@/lib/auth/roles'
import { validarCierreGanado, validarCierrePerdido } from './reglas'
import { calcularProbabilidadPorEtapa } from './reglas'
import type { EtapaProyecto } from './tipos'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function cdb(): Promise<any> { return createClient() }

async function registrarActividad(params: {
  tipo: string
  titulo: string
  descripcion?: string
  clienteId?: string | null
  proyectoId?: string | null
  tareaId?: string | null
  eventoId?: string | null
  viajeId?: string | null
  usuarioId: string
  metadata?: Record<string, unknown>
}) {
  const supabase = await cdb()
  await supabase.from('comercial_actividad').insert({
    tipo: params.tipo,
    titulo: params.titulo,
    descripcion: params.descripcion ?? null,
    cliente_id: params.clienteId ?? null,
    proyecto_id: params.proyectoId ?? null,
    tarea_id: params.tareaId ?? null,
    evento_id: params.eventoId ?? null,
    viaje_id: params.viajeId ?? null,
    usuario_id: params.usuarioId,
    metadata: params.metadata ?? {},
  })
}

// ── CLIENTES ──

export async function crearCliente(form: FormData) {
  const sesion = await requireModulo('comercial')
  const supabase = await cdb()

  const payload = {
    nombre: form.get('nombre') as string,
    razon_social: (form.get('razon_social') as string) || null,
    cuit_tax_id: (form.get('cuit_tax_id') as string) || null,
    tipo_cliente: (form.get('tipo_cliente') as string) || null,
    rubro: (form.get('rubro') as string) || null,
    pais: (form.get('pais') as string) || null,
    provincia_estado: (form.get('provincia_estado') as string) || null,
    ciudad: (form.get('ciudad') as string) || null,
    estado: (form.get('estado') as string) || 'prospecto',
    prioridad: (form.get('prioridad') as string) || 'media',
    origen: (form.get('origen') as string) || null,
    notas: (form.get('notas') as string) || null,
    vendedor_asignado_id: (form.get('vendedor_asignado_id') as string) || null,
    created_by: sesion.userId,
    updated_by: sesion.userId,
  }

  const { data, error } = await supabase.from('comercial_clientes').insert(payload).select('id, nombre').single()
  if (error) return { error: error.message }

  const clienteId = (data as { id: string }).id
  await registrarActividad({ tipo: 'cliente_creado', titulo: `Cliente creado: ${(data as { nombre: string }).nombre}`, clienteId, usuarioId: sesion.userId })
  return { clienteId }
}

export async function actualizarCliente(id: string, form: FormData) {
  const sesion = await requireModulo('comercial')
  const supabase = await cdb()

  const payload = {
    nombre: form.get('nombre') as string,
    razon_social: (form.get('razon_social') as string) || null,
    cuit_tax_id: (form.get('cuit_tax_id') as string) || null,
    tipo_cliente: (form.get('tipo_cliente') as string) || null,
    rubro: (form.get('rubro') as string) || null,
    pais: (form.get('pais') as string) || null,
    provincia_estado: (form.get('provincia_estado') as string) || null,
    ciudad: (form.get('ciudad') as string) || null,
    estado: (form.get('estado') as string) || 'prospecto',
    prioridad: (form.get('prioridad') as string) || 'media',
    notas: (form.get('notas') as string) || null,
    vendedor_asignado_id: (form.get('vendedor_asignado_id') as string) || null,
    updated_by: sesion.userId,
  }

  const { error } = await supabase.from('comercial_clientes').update(payload).eq('id', id)
  if (error) return { error: error.message }
  return { ok: true }
}

// ── CONTACTOS ──

export async function crearContacto(form: FormData) {
  const sesion = await requireModulo('comercial')
  const supabase = await cdb()

  const payload = {
    cliente_id: form.get('cliente_id') as string,
    nombre: form.get('nombre') as string,
    apellido: (form.get('apellido') as string) || null,
    cargo: (form.get('cargo') as string) || null,
    area: (form.get('area') as string) || null,
    email: (form.get('email') as string) || null,
    telefono: (form.get('telefono') as string) || null,
    whatsapp: (form.get('whatsapp') as string) || null,
    idioma: (form.get('idioma') as string) || null,
    pais: (form.get('pais') as string) || null,
    es_contacto_principal: form.get('es_contacto_principal') === 'true',
    notas: (form.get('notas') as string) || null,
    created_by: sesion.userId,
  }

  const { data, error } = await supabase.from('comercial_contactos').insert(payload).select('id, nombre, cliente_id').single()
  if (error) return { error: error.message }

  const clienteId = (data as { cliente_id: string }).cliente_id
  await registrarActividad({ tipo: 'contacto_creado', titulo: `Contacto creado: ${(data as { nombre: string }).nombre}`, clienteId, usuarioId: sesion.userId })
  return { contactoId: (data as { id: string }).id, clienteId }
}

export async function actualizarContacto(id: string, form: FormData) {
  const sesion = await requireModulo('comercial')
  const supabase = await cdb()

  const payload = {
    nombre: form.get('nombre') as string,
    apellido: (form.get('apellido') as string) || null,
    cargo: (form.get('cargo') as string) || null,
    email: (form.get('email') as string) || null,
    telefono: (form.get('telefono') as string) || null,
    whatsapp: (form.get('whatsapp') as string) || null,
    idioma: (form.get('idioma') as string) || null,
    es_contacto_principal: form.get('es_contacto_principal') === 'true',
    notas: (form.get('notas') as string) || null,
  }

  const { error } = await supabase.from('comercial_contactos').update(payload).eq('id', id)
  if (error) return { error: error.message }
  return { ok: true }
}

// ── PROYECTOS ──

export async function crearProyecto(form: FormData) {
  const sesion = await requireModulo('comercial')
  const supabase = await cdb()

  const etapa = (form.get('etapa') as EtapaProyecto) || 'nuevo'
  const payload = {
    titulo: form.get('titulo') as string,
    cliente_id: (form.get('cliente_id') as string) || null,
    responsable_id: (form.get('responsable_id') as string) || sesion.userId,
    gerente_id: (form.get('gerente_id') as string) || null,
    tipo_proyecto: (form.get('tipo_proyecto') as string) || null,
    servicio_producto: (form.get('servicio_producto') as string) || null,
    etapa,
    estado: 'abierto',
    prioridad: (form.get('prioridad') as string) || 'media',
    valor_estimado: form.get('valor_estimado') ? parseFloat(form.get('valor_estimado') as string) : null,
    moneda: (form.get('moneda') as string) || 'USD',
    probabilidad: calcularProbabilidadPorEtapa(etapa),
    fecha_estimada_cierre: (form.get('fecha_estimada_cierre') as string) || null,
    proxima_accion: (form.get('proxima_accion') as string) || null,
    proxima_accion_fecha: (form.get('proxima_accion_fecha') as string) || null,
    descripcion: (form.get('descripcion') as string) || null,
    ultima_actividad_at: new Date().toISOString(),
    created_by: sesion.userId,
    updated_by: sesion.userId,
  }

  const { data, error } = await supabase.from('comercial_proyectos').insert(payload).select('id, titulo, cliente_id').single()
  if (error) return { error: error.message }

  const proyectoId = (data as { id: string }).id
  const clienteId = (data as { cliente_id: string | null }).cliente_id ?? null
  await registrarActividad({ tipo: 'proyecto_creado', titulo: `Proyecto creado: ${(data as { titulo: string }).titulo}`, proyectoId, clienteId, usuarioId: sesion.userId })
  return { proyectoId }
}

export async function actualizarProyecto(id: string, form: FormData) {
  const sesion = await requireModulo('comercial')
  const supabase = await cdb()

  const payload: Record<string, unknown> = {
    titulo: form.get('titulo'),
    tipo_proyecto: form.get('tipo_proyecto') || null,
    servicio_producto: form.get('servicio_producto') || null,
    prioridad: form.get('prioridad') || 'media',
    valor_estimado: form.get('valor_estimado') ? parseFloat(form.get('valor_estimado') as string) : null,
    moneda: form.get('moneda') || 'USD',
    fecha_estimada_cierre: form.get('fecha_estimada_cierre') || null,
    descripcion: form.get('descripcion') || null,
    notas_internas: form.get('notas_internas') || null,
    updated_by: sesion.userId,
    ultima_actividad_at: new Date().toISOString(),
  }

  if (tieneRol(sesion.rol, COMERCIAL_GESTION)) {
    payload.responsable_id = form.get('responsable_id') || null
    payload.gerente_id = form.get('gerente_id') || null
  }

  const { error } = await supabase.from('comercial_proyectos').update(payload).eq('id', id)
  if (error) return { error: error.message }

  await registrarActividad({ tipo: 'proyecto_actualizado', titulo: 'Proyecto actualizado', proyectoId: id, usuarioId: sesion.userId })
  return { ok: true }
}

export async function cambiarEtapaProyecto(id: string, nuevaEtapa: EtapaProyecto) {
  const sesion = await requireModulo('comercial')
  const supabase = await cdb()

  const { data: prev } = await supabase.from('comercial_proyectos').select('etapa, titulo, cliente_id').eq('id', id).single()

  const { error } = await supabase.from('comercial_proyectos').update({
    etapa: nuevaEtapa,
    probabilidad: calcularProbabilidadPorEtapa(nuevaEtapa),
    ultima_actividad_at: new Date().toISOString(),
    updated_by: sesion.userId,
  }).eq('id', id)
  if (error) return { error: error.message }

  await registrarActividad({
    tipo: 'cambio_etapa',
    titulo: `Etapa cambiada: ${prev?.etapa} → ${nuevaEtapa}`,
    proyectoId: id,
    clienteId: prev?.cliente_id ?? null,
    usuarioId: sesion.userId,
    metadata: { de: prev?.etapa, a: nuevaEtapa },
  })
  return { ok: true }
}

export async function actualizarProximaAccion(id: string, accion: string, fecha: string) {
  const sesion = await requireModulo('comercial')
  const supabase = await cdb()

  const { error } = await supabase.from('comercial_proyectos').update({
    proxima_accion: accion,
    proxima_accion_fecha: fecha,
    ultima_actividad_at: new Date().toISOString(),
    updated_by: sesion.userId,
  }).eq('id', id)
  if (error) return { error: error.message }

  await registrarActividad({ tipo: 'proxima_accion_actualizada', titulo: `Próxima acción: ${accion} (${fecha})`, proyectoId: id, usuarioId: sesion.userId })
  return { ok: true }
}

export async function cerrarProyectoGanado(id: string, resultadoCierre?: string) {
  const sesion = await requireModulo('comercial')
  const supabase = await cdb()

  const { data: proyecto } = await supabase.from('comercial_proyectos').select('*').eq('id', id).single()
  if (!proyecto) return { error: 'Proyecto no encontrado.' }

  const errores = validarCierreGanado(proyecto)
  if (errores.length) return { error: errores[0] }

  const { error } = await supabase.from('comercial_proyectos').update({
    estado: 'ganado',
    etapa: 'ganado',
    fecha_cierre_real: new Date().toISOString().substring(0, 10),
    resultado_cierre: resultadoCierre ?? null,
    ultima_actividad_at: new Date().toISOString(),
    updated_by: sesion.userId,
  }).eq('id', id)
  if (error) return { error: error.message }

  await registrarActividad({ tipo: 'proyecto_ganado', titulo: `Proyecto ganado: ${proyecto.titulo}`, proyectoId: id, clienteId: proyecto.cliente_id, usuarioId: sesion.userId })
  return { ok: true }
}

export async function cerrarProyectoPerdido(id: string, motivoId: string, resultadoCierre?: string) {
  const sesion = await requireModulo('comercial')
  const supabase = await cdb()

  const { data: proyecto } = await supabase.from('comercial_proyectos').select('*').eq('id', id).single()
  if (!proyecto) return { error: 'Proyecto no encontrado.' }

  const errores = validarCierrePerdido({ estado: proyecto.estado, motivo_perdida_id: motivoId })
  if (errores.length) return { error: errores[0] }

  const { error } = await supabase.from('comercial_proyectos').update({
    estado: 'perdido',
    etapa: 'perdido',
    motivo_perdida_id: motivoId,
    fecha_cierre_real: new Date().toISOString().substring(0, 10),
    resultado_cierre: resultadoCierre ?? null,
    ultima_actividad_at: new Date().toISOString(),
    updated_by: sesion.userId,
  }).eq('id', id)
  if (error) return { error: error.message }

  await registrarActividad({ tipo: 'proyecto_perdido', titulo: `Proyecto perdido: ${proyecto.titulo}`, proyectoId: id, clienteId: proyecto.cliente_id, usuarioId: sesion.userId, metadata: { motivo_id: motivoId } })
  return { ok: true }
}

// ── TAREAS ──

export async function crearTarea(form: FormData) {
  const sesion = await requireModulo('comercial')
  const supabase = await cdb()

  const responsableId = (form.get('responsable_id') as string) || sesion.userId
  const esAsignacion = responsableId !== sesion.userId
  const payload = {
    titulo: form.get('titulo') as string,
    descripcion: (form.get('descripcion') as string) || null,
    tipo: (form.get('tipo') as string) || 'otro',
    estado: 'pendiente',
    prioridad: (form.get('prioridad') as string) || 'media',
    responsable_id: responsableId,
    creador_id: sesion.userId,
    empresa: (form.get('empresa') as string) || null,
    cliente_id: (form.get('cliente_id') as string) || null,
    proyecto_id: (form.get('proyecto_id') as string) || null,
    fecha_vencimiento: (form.get('fecha_vencimiento') as string) || null,
    asignado_por: esAsignacion ? sesion.userId : null,
    asignada_at: esAsignacion ? new Date().toISOString() : null,
    nota_asignacion: (form.get('nota_asignacion') as string) || null,
  }

  const { data, error } = await supabase.from('comercial_tareas').insert(payload).select('id, titulo, proyecto_id, cliente_id').single()
  if (error) return { error: error.message }

  const proyectoId = (data as { proyecto_id: string | null }).proyecto_id ?? null
  const clienteId = (data as { cliente_id: string | null }).cliente_id ?? null
  const tareaId = (data as { id: string }).id

  if (proyectoId) {
    await supabase.from('comercial_proyectos').update({ ultima_actividad_at: new Date().toISOString() }).eq('id', proyectoId)
  }
  await registrarActividad({ tipo: 'tarea_creada', titulo: `Tarea creada: ${(data as { titulo: string }).titulo}`, proyectoId, clienteId, tareaId, usuarioId: sesion.userId })
  return { proyectoId }
}

export async function actualizarTarea(id: string, form: FormData) {
  const sesion = await requireModulo('comercial')
  const supabase = await cdb()

  const { error } = await supabase.from('comercial_tareas').update({
    titulo: form.get('titulo'),
    descripcion: form.get('descripcion') || null,
    tipo: form.get('tipo') || 'otro',
    prioridad: form.get('prioridad') || 'media',
    responsable_id: form.get('responsable_id') || sesion.userId,
    fecha_vencimiento: form.get('fecha_vencimiento') || null,
  }).eq('id', id)
  if (error) return { error: error.message }
  return { ok: true }
}

export async function completarTarea(id: string, resultado?: string) {
  const sesion = await requireModulo('comercial')
  const supabase = await cdb()

  const { data: tarea } = await supabase.from('comercial_tareas').select('titulo, proyecto_id, cliente_id').eq('id', id).single()
  const { error } = await supabase.from('comercial_tareas').update({ estado: 'completada', fecha_completada: new Date().toISOString(), resultado: resultado ?? null }).eq('id', id)
  if (error) return { error: error.message }

  if (tarea?.proyecto_id) {
    await supabase.from('comercial_proyectos').update({ ultima_actividad_at: new Date().toISOString() }).eq('id', tarea.proyecto_id)
  }
  await registrarActividad({ tipo: 'tarea_completada', titulo: `Tarea completada: ${tarea?.titulo}`, proyectoId: tarea?.proyecto_id ?? null, clienteId: tarea?.cliente_id ?? null, tareaId: id, usuarioId: sesion.userId })
  return { ok: true }
}

export async function cancelarTarea(id: string) {
  const sesion = await requireModulo('comercial')
  const supabase = await cdb()
  const { error } = await supabase.from('comercial_tareas').update({ estado: 'cancelada' }).eq('id', id)
  if (error) return { error: error.message }
  return { ok: true }
}

// ── EVENTOS ──

export async function crearEvento(form: FormData) {
  const sesion = await requireModulo('comercial')
  const supabase = await cdb()

  const payload = {
    titulo: form.get('titulo') as string,
    tipo: (form.get('tipo') as string) || 'reunion',
    estado: 'programado',
    empresa: (form.get('empresa') as string) || null,
    cliente_id: (form.get('cliente_id') as string) || null,
    proyecto_id: (form.get('proyecto_id') as string) || null,
    responsable_id: (form.get('responsable_id') as string) || sesion.userId,
    fecha_inicio: form.get('fecha_inicio') as string,
    fecha_fin: (form.get('fecha_fin') as string) || null,
    ubicacion: (form.get('ubicacion') as string) || null,
    link_reunion: (form.get('link_reunion') as string) || null,
    objetivo: (form.get('objetivo') as string) || null,
    created_by: sesion.userId,
  }

  const { data, error } = await supabase.from('comercial_eventos').insert(payload).select('id, titulo, proyecto_id, cliente_id').single()
  if (error) return { error: error.message }

  const proyectoId = (data as { proyecto_id: string | null }).proyecto_id ?? null
  const clienteId = (data as { cliente_id: string | null }).cliente_id ?? null
  const eventoId = (data as { id: string }).id

  if (proyectoId) {
    await supabase.from('comercial_proyectos').update({ ultima_actividad_at: new Date().toISOString() }).eq('id', proyectoId)
  }
  await registrarActividad({ tipo: 'reunion_agendada', titulo: `Reunión agendada: ${(data as { titulo: string }).titulo}`, proyectoId, clienteId, eventoId, usuarioId: sesion.userId })
  return { proyectoId }
}

export async function actualizarEvento(id: string, form: FormData) {
  const sesion = await requireModulo('comercial')
  const supabase = await cdb()
  const { error } = await supabase.from('comercial_eventos').update({
    titulo: form.get('titulo'),
    tipo: form.get('tipo') || 'reunion',
    fecha_inicio: form.get('fecha_inicio'),
    fecha_fin: form.get('fecha_fin') || null,
    ubicacion: form.get('ubicacion') || null,
    link_reunion: form.get('link_reunion') || null,
    objetivo: form.get('objetivo') || null,
  }).eq('id', id)
  if (error) return { error: error.message }
  return { ok: true }
}

export async function marcarEventoRealizado(id: string, resultado: string, proximaAccion?: string) {
  const sesion = await requireModulo('comercial')
  const supabase = await cdb()

  const { data: ev } = await supabase.from('comercial_eventos').select('titulo, proyecto_id, cliente_id').eq('id', id).single()
  const { error } = await supabase.from('comercial_eventos').update({ estado: 'realizado', resultado, proxima_accion: proximaAccion ?? null }).eq('id', id)
  if (error) return { error: error.message }

  if (ev?.proyecto_id) {
    await supabase.from('comercial_proyectos').update({ ultima_actividad_at: new Date().toISOString() }).eq('id', ev.proyecto_id)
  }
  await registrarActividad({ tipo: 'reunion_realizada', titulo: `Reunión realizada: ${ev?.titulo}`, proyectoId: ev?.proyecto_id ?? null, clienteId: ev?.cliente_id ?? null, eventoId: id, usuarioId: sesion.userId })
  return { ok: true }
}

export async function cancelarEvento(id: string) {
  const sesion = await requireModulo('comercial')
  const supabase = await cdb()
  const { error } = await supabase.from('comercial_eventos').update({ estado: 'cancelado' }).eq('id', id)
  if (error) return { error: error.message }
  return { ok: true }
}

// ── VIAJES ──

export async function crearViaje(form: FormData) {
  const sesion = await requireModulo('comercial')
  const supabase = await cdb()

  const payload = {
    titulo: form.get('titulo') as string,
    responsable_id: (form.get('responsable_id') as string) || sesion.userId,
    pais: (form.get('pais') as string) || null,
    ciudad: (form.get('ciudad') as string) || null,
    fecha_inicio: (form.get('fecha_inicio') as string) || null,
    fecha_fin: (form.get('fecha_fin') as string) || null,
    motivo: (form.get('motivo') as string) || null,
    costo_estimado: form.get('costo_estimado') ? parseFloat(form.get('costo_estimado') as string) : null,
    moneda: (form.get('moneda') as string) || 'USD',
    notas: (form.get('notas') as string) || null,
    estado: 'planificado',
    created_by: sesion.userId,
  }

  const { data, error } = await supabase.from('comercial_viajes').insert(payload).select('id, titulo').single()
  if (error) return { error: error.message }
  return { data }
}

export async function actualizarViaje(id: string, form: FormData) {
  const sesion = await requireModulo('comercial')
  const supabase = await cdb()
  const { error } = await supabase.from('comercial_viajes').update({
    titulo: form.get('titulo'),
    pais: form.get('pais') || null,
    ciudad: form.get('ciudad') || null,
    fecha_inicio: form.get('fecha_inicio') || null,
    fecha_fin: form.get('fecha_fin') || null,
    motivo: form.get('motivo') || null,
    notas: form.get('notas') || null,
  }).eq('id', id)
  if (error) return { error: error.message }
  return { ok: true }
}

export async function cerrarViaje(id: string, notas?: string) {
  const sesion = await requireModulo('comercial')
  const supabase = await cdb()
  const { error } = await supabase.from('comercial_viajes').update({ estado: 'finalizado', notas: notas ?? null }).eq('id', id)
  if (error) return { error: error.message }
  return { ok: true }
}

// ── NOTAS ──

export async function crearNota(form: FormData) {
  const sesion = await requireModulo('comercial')
  const supabase = await cdb()

  const payload = {
    cliente_id: (form.get('cliente_id') as string) || null,
    proyecto_id: (form.get('proyecto_id') as string) || null,
    tipo: (form.get('tipo') as string) || 'nota_general',
    contenido: form.get('contenido') as string,
    visibilidad: (form.get('visibilidad') as string) || 'interna',
    usuario_id: sesion.userId,
  }

  const { data, error } = await supabase.from('comercial_notas').insert(payload).select('id, proyecto_id, cliente_id').single()
  if (error) return { error: error.message }

  const proyectoId = (data as { proyecto_id: string | null }).proyecto_id ?? null
  const clienteId = (data as { cliente_id: string | null }).cliente_id ?? null
  if (proyectoId) {
    await supabase.from('comercial_proyectos').update({ ultima_actividad_at: new Date().toISOString() }).eq('id', proyectoId)
  }
  await registrarActividad({ tipo: 'nota_creada', titulo: 'Nota registrada', proyectoId, clienteId, usuarioId: sesion.userId })
  return { ok: true }
}
