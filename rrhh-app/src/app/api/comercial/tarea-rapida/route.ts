import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireModulo } from '@/lib/auth/session'
import { tieneRol, COMERCIAL_GESTION } from '@/lib/auth/roles'

async function cdb(): Promise<any> { return createClient() }

export async function POST(req: NextRequest) {
  const sesion = await requireModulo('comercial')
  if (!tieneRol(sesion.rol, COMERCIAL_GESTION)) {
    return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
  }

  const form = await req.formData()
  const titulo = (form.get('titulo') as string)?.trim()
  if (!titulo) return NextResponse.json({ error: 'Título requerido' }, { status: 400 })

  const supabase = await cdb()
  const responsableId = (form.get('responsable_id') as string) || sesion.userId
  const fechaVenc = (form.get('fecha_vencimiento') as string) || null
  const notaAsig = (form.get('nota_asignacion') as string) || null

  const payload: Record<string, unknown> = {
    titulo,
    tipo: 'tarea',
    estado: 'pendiente',
    prioridad: (form.get('prioridad') as string) || 'media',
    responsable_id: responsableId,
    fecha_vencimiento: fechaVenc || null,
    nota_asignacion: notaAsig,
    created_by: sesion.userId,
  }

  if (responsableId !== sesion.userId) {
    payload.asignado_por = sesion.userId
    payload.asignada_at = new Date().toISOString()
  }

  const { error } = await supabase.from('comercial_tareas').insert(payload)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  return NextResponse.json({ ok: true })
}
