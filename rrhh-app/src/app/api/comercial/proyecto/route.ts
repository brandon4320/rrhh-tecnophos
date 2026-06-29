import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireModulo } from '@/lib/auth/session'
import { calcularProbabilidadPorEtapa } from '@/modules/comercial/reglas'
import type { EtapaProyecto } from '@/modules/comercial/tipos'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function cdb(): Promise<any> { return createClient() }

const SELECT = 'id, titulo, etapa, estado, prioridad, valor_estimado, moneda, probabilidad, responsable_id, cliente_id, etiquetas, ultima_actividad_at, proxima_accion'

// Actualizar proyecto (mover de etapa en el pipeline / editar inline)
export async function PATCH(req: NextRequest) {
  const sesion = await requireModulo('comercial')
  const body = await req.json().catch(() => ({}))

  const id = body.id as string
  if (!id) return NextResponse.json({ error: 'id requerido' }, { status: 400 })

  const supabase = await cdb()
  const patch: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
    ultima_actividad_at: new Date().toISOString(),
    updated_by: sesion.userId,
  }
  if (typeof body.prioridad === 'string') patch.prioridad = body.prioridad
  if (Array.isArray(body.etiquetas)) patch.etiquetas = body.etiquetas

  let etapaPrev: string | null = null
  if (typeof body.etapa === 'string') {
    const etapa = body.etapa as EtapaProyecto
    const { data: prev } = await supabase.from('comercial_proyectos').select('etapa').eq('id', id).single()
    etapaPrev = prev?.etapa ?? null
    patch.etapa = etapa
    patch.probabilidad = calcularProbabilidadPorEtapa(etapa)
    if (etapa === 'ganado') {
      patch.estado = 'ganado'
      patch.fecha_cierre_real = new Date().toISOString().slice(0, 10)
    } else if (etapa === 'perdido') {
      patch.estado = 'perdido'
      patch.fecha_cierre_real = new Date().toISOString().slice(0, 10)
      if (body.motivo_perdida_id) patch.motivo_perdida_id = body.motivo_perdida_id
    } else {
      // volver a una etapa abierta reabre el proyecto
      patch.estado = 'abierto'
      patch.fecha_cierre_real = null
    }
  } else if (typeof body.estado === 'string') {
    patch.estado = body.estado
  }

  const { data, error } = await supabase.from('comercial_proyectos').update(patch).eq('id', id).select(SELECT).single()
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  if (!data) return NextResponse.json({ error: 'No encontrado o sin permiso' }, { status: 404 })

  if (typeof body.etapa === 'string' && etapaPrev !== body.etapa) {
    await supabase.from('comercial_actividad').insert({
      tipo: 'cambio_etapa', titulo: `Etapa: ${etapaPrev ?? '—'} → ${body.etapa}`,
      proyecto_id: id, cliente_id: data.cliente_id, usuario_id: sesion.userId,
      metadata: { de: etapaPrev, a: body.etapa },
    })
  }

  return NextResponse.json({ proyecto: data })
}
