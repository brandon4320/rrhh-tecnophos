import { NextRequest, NextResponse } from 'next/server'
import { deleteFromR2, uploadToR2 } from '@/lib/r2/operations'
import { sesionApi } from '@/lib/auth/session'
import { LEGAJO_ESCRITURA } from '@/lib/auth/roles'
import { SIN_PERMISO_PESTCONTROL, pathAdjunto, prefijoAdjuntos, validarAdjunto } from '@/modules/pestcontrol/reglas'
import { pdb } from '@/modules/pestcontrol/db'

/**
 * Comprobantes de Pestcontrol (tabla pest_adjuntos, migración 37).
 *  POST JSON      → registra la fila de un archivo que YA subió directo a R2 (/api/upload-url recurso 'pestcontrol')
 *  POST multipart → fallback para archivos chicos: sube vía Vercel y registra
 *  DELETE ?id=    → borra la fila (gated por RLS) y DESPUÉS el objeto en R2 — nunca al revés.
 * Toda escritura pasa por el cliente de sesión: la RLS (pest_adjuntos_rrhh_all) decide.
 */

const COLUMNAS = 'id, movimiento_id, path, nombre_archivo, mime_type, size_bytes, created_at'

async function acceso() {
  const s = await sesionApi(LEGAJO_ESCRITURA, SIN_PERMISO_PESTCONTROL)
  if ('error' in s) return s
  if (!s.sesion.vePestcontrol) return { error: NextResponse.json({ error: SIN_PERMISO_PESTCONTROL }, { status: 403 }) }
  return s
}

/** El movimiento visible por RLS (y su empresa, que la fila del adjunto repite). */
async function movimientoVisible(supabase: unknown, id: string): Promise<{ id: string; empresa_id: string } | null> {
  if (!id) return null
  const { data } = await pdb(supabase).from('pest_movimientos').select('id, empresa_id').eq('id', id).maybeSingle()
  return data ?? null
}

function errorInsert(message: string) {
  console.error('[api/pestcontrol/adjuntos] insert:', message)
  if (message.includes('duplicate key')) {
    return NextResponse.json({ error: 'Ese archivo ya está registrado. Recargá la página.' }, { status: 409 })
  }
  return NextResponse.json({ error: 'No se pudo registrar el comprobante.' }, { status: 500 })
}

export async function POST(request: NextRequest) {
  const s = await acceso()
  if ('error' in s) return s.error
  const { supabase, sesion } = s

  // ── Modo registro (JSON): el archivo ya está en R2 ──
  if (request.headers.get('content-type')?.includes('application/json')) {
    const body = await request.json().catch(() => null)
    const path = String(body?.path ?? '')
    const nombre = String(body?.nombre ?? '').trim()
    const mimeType = typeof body?.mimeType === 'string' ? body.mimeType : ''
    const sizeBytes = Number.isInteger(body?.sizeBytes) && body.sizeBytes > 0 ? (body.sizeBytes as number) : null
    const mov = await movimientoVisible(supabase, String(body?.movimientoId ?? ''))
    if (!mov) return NextResponse.json({ error: 'Movimiento no encontrado o sin permiso.' }, { status: 403 })
    if (!path || !nombre) return NextResponse.json({ error: 'Faltan datos' }, { status: 400 })
    const invalido = validarAdjunto({ name: nombre, type: mimeType, size: sizeBytes ?? 1 })
    if (invalido) return NextResponse.json({ error: invalido }, { status: 400 })
    // El path tiene que ser el que firmó /api/upload-url para ESTE movimiento.
    if (!path.startsWith(prefijoAdjuntos(mov.id))) return NextResponse.json({ error: 'Path inválido' }, { status: 400 })

    const { data, error } = await pdb(supabase)
      .from('pest_adjuntos')
      .insert({
        empresa_id: mov.empresa_id, movimiento_id: mov.id, path, nombre_archivo: nombre,
        mime_type: mimeType || null, size_bytes: sizeBytes, uploaded_by: sesion.userId,
      })
      .select(COLUMNAS)
      .single()
    if (error) return errorInsert(error.message)
    return NextResponse.json({ adjunto: data })
  }

  // ── Fallback multipart (≤4MB): el PUT directo a R2 falló (p. ej. CORS) ──
  const fd = await request.formData()
  const file = fd.get('file') as File | null
  const mov = await movimientoVisible(supabase, String(fd.get('movimientoId') ?? ''))
  if (!file) return NextResponse.json({ error: 'Faltan datos' }, { status: 400 })
  if (!mov) return NextResponse.json({ error: 'Movimiento no encontrado o sin permiso.' }, { status: 403 })
  const invalido = validarAdjunto(file)
  if (invalido) return NextResponse.json({ error: invalido }, { status: 400 })

  const path = pathAdjunto(mov.id, file.name)
  try {
    await uploadToR2(path, Buffer.from(await file.arrayBuffer()), file.type || 'application/octet-stream')
  } catch (e) {
    console.error('[api/pestcontrol/adjuntos] R2 upload:', e)
    return NextResponse.json({ error: 'No se pudo guardar el archivo en el almacenamiento.' }, { status: 502 })
  }

  const { data, error } = await pdb(supabase)
    .from('pest_adjuntos')
    .insert({
      empresa_id: mov.empresa_id, movimiento_id: mov.id, path, nombre_archivo: file.name,
      mime_type: file.type || null, size_bytes: file.size, uploaded_by: sesion.userId,
    })
    .select(COLUMNAS)
    .single()
  if (error) {
    await deleteFromR2(path).catch(() => {})
    return errorInsert(error.message)
  }
  return NextResponse.json({ adjunto: data })
}

export async function DELETE(request: NextRequest) {
  const s = await acceso()
  if ('error' in s) return s.error
  const { supabase } = s

  const id = request.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Falta id' }, { status: 400 })

  // Primero la fila (gated por RLS); si no la puede ver, no se borra nada y no tocamos R2.
  const { data: adj, error } = await pdb(supabase).from('pest_adjuntos').delete().eq('id', id).select('path').maybeSingle()
  if (error) {
    console.error('[api/pestcontrol/adjuntos] delete:', error.message)
    return NextResponse.json({ error: 'No se pudo eliminar el comprobante.' }, { status: 500 })
  }
  if (!adj) return NextResponse.json({ error: 'Comprobante no encontrado' }, { status: 404 })

  await deleteFromR2(adj.path).catch((e) => console.error('[api/pestcontrol/adjuntos] R2 delete:', adj.path, e))
  return NextResponse.json({ ok: true })
}
