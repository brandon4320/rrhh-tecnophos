import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireModulo } from '@/lib/auth/session'
import { tieneRol, COMERCIAL_GESTION } from '@/lib/auth/roles'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function cdb(): Promise<any> { return createClient() }

const SELECT = 'id, titulo, estado, prioridad, tipo, responsable_id, proyecto_id, cliente_id, empresa, etiquetas, fecha_vencimiento, fecha_completada'

// Crear tarea (alta inline / rápida)
export async function POST(req: NextRequest) {
  const sesion = await requireModulo('comercial')
  const body = await req.json().catch(() => ({}))

  const titulo = (body.titulo as string)?.trim()
  if (!titulo) return NextResponse.json({ error: 'Título requerido' }, { status: 400 })

  const responsableId = (body.responsable_id as string) || sesion.userId
  const esAsignacion = responsableId !== sesion.userId
  if (esAsignacion && !tieneRol(sesion.rol, COMERCIAL_GESTION)) {
    return NextResponse.json({ error: 'Sin permisos para asignar a otro' }, { status: 403 })
  }

  const supabase = await cdb()
  const payload = {
    titulo,
    descripcion: (body.descripcion as string) || null,
    tipo: (body.tipo as string) || 'otro',
    estado: 'pendiente',
    prioridad: (body.prioridad as string) || 'media',
    responsable_id: responsableId,
    creador_id: sesion.userId,
    empresa: (body.empresa as string) || null,
    cliente_id: (body.cliente_id as string) || null,
    proyecto_id: (body.proyecto_id as string) || null,
    etiquetas: Array.isArray(body.etiquetas) ? body.etiquetas : [],
    fecha_vencimiento: (body.fecha_vencimiento as string) || null,
    asignado_por: esAsignacion ? sesion.userId : null,
    asignada_at: esAsignacion ? new Date().toISOString() : null,
    nota_asignacion: (body.nota_asignacion as string) || null,
  }

  const { data, error } = await supabase.from('comercial_tareas').insert(payload).select(SELECT).single()
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  if (payload.proyecto_id) {
    await supabase.from('comercial_proyectos').update({ ultima_actividad_at: new Date().toISOString() }).eq('id', payload.proyecto_id)
  }
  await supabase.from('comercial_actividad').insert({
    tipo: 'tarea_creada', titulo: `Tarea creada: ${titulo}`,
    proyecto_id: payload.proyecto_id, cliente_id: payload.cliente_id, tarea_id: data.id,
    usuario_id: sesion.userId, metadata: {},
  })

  return NextResponse.json({ tarea: data })
}

// Actualizar tarea (mover en kanban / editar inline)
export async function PATCH(req: NextRequest) {
  const sesion = await requireModulo('comercial')
  const body = await req.json().catch(() => ({}))

  const id = body.id as string
  if (!id) return NextResponse.json({ error: 'id requerido' }, { status: 400 })

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (typeof body.titulo === 'string') patch.titulo = body.titulo
  if (typeof body.prioridad === 'string') patch.prioridad = body.prioridad
  if (typeof body.tipo === 'string') patch.tipo = body.tipo
  if ('fecha_vencimiento' in body) patch.fecha_vencimiento = body.fecha_vencimiento || null
  if ('proyecto_id' in body) patch.proyecto_id = body.proyecto_id || null
  if (Array.isArray(body.etiquetas)) patch.etiquetas = body.etiquetas

  // Cambiar responsable solo gestión
  if ('responsable_id' in body) {
    if (!tieneRol(sesion.rol, COMERCIAL_GESTION)) {
      return NextResponse.json({ error: 'Sin permisos para reasignar' }, { status: 403 })
    }
    patch.responsable_id = body.responsable_id || sesion.userId
  }

  if (typeof body.estado === 'string') {
    patch.estado = body.estado
    patch.fecha_completada = body.estado === 'completada' ? new Date().toISOString() : null
  }

  const supabase = await cdb()
  const { data, error } = await supabase.from('comercial_tareas').update(patch).eq('id', id).select(SELECT).single()
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  if (!data) return NextResponse.json({ error: 'No encontrada o sin permiso' }, { status: 404 })

  if (data.proyecto_id) {
    await supabase.from('comercial_proyectos').update({ ultima_actividad_at: new Date().toISOString() }).eq('id', data.proyecto_id)
  }
  if (body.estado === 'completada') {
    await supabase.from('comercial_actividad').insert({
      tipo: 'tarea_completada', titulo: `Tarea completada: ${data.titulo}`,
      proyecto_id: data.proyecto_id, cliente_id: data.cliente_id, tarea_id: id,
      usuario_id: sesion.userId, metadata: {},
    })
  }

  return NextResponse.json({ tarea: data })
}
