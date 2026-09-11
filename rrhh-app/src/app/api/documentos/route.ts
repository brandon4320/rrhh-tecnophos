import { NextRequest, NextResponse } from 'next/server'
import { deleteFromR2, uploadToR2 } from '@/lib/r2/operations'
import { sesionApi } from '@/lib/auth/session'
import { LEGAJO_ESCRITURA } from '@/lib/auth/roles'
import { periodoDesdeMes } from '@/lib/recibos'
import { normalizarCarpeta, pathDocumento, validarArchivoDocumento } from '@/modules/documentos/reglas'

/**
 * Documentación mensual por empresa (tabla documentos_mensuales).
 *  POST JSON      → registra la fila de un archivo que YA subió directo a R2 (/api/upload-url recurso 'documento')
 *  POST multipart → fallback para archivos chicos: sube vía Vercel y registra
 *  DELETE ?id=    → borra la fila (gated por RLS) y DESPUÉS el objeto en R2 — nunca al revés.
 * Toda escritura pasa por el cliente de sesión: la RLS (documentos_mensuales_rrhh_all) decide.
 * La carga automática futura NO pasa por acá: escribe en la tabla con origen='automatico'.
 */

const SIN_PERMISO = 'No tenés permisos para cargar documentación.'

function errorInsert(message: string) {
  console.error('[api/documentos] insert:', message)
  if (message.includes('duplicate key')) {
    return NextResponse.json({ error: 'Ese archivo ya está registrado. Recargá la página.' }, { status: 409 })
  }
  return NextResponse.json({ error: `No se pudo registrar el documento: ${message}` }, { status: 500 })
}

export async function POST(request: NextRequest) {
  const s = await sesionApi(LEGAJO_ESCRITURA, SIN_PERMISO)
  if ('error' in s) return s.error
  const { supabase, sesion } = s

  // ── Modo registro (JSON): el archivo ya está en R2 ──
  if (request.headers.get('content-type')?.includes('application/json')) {
    const body = await request.json().catch(() => null)
    const empresaId = String(body?.empresaId ?? '')
    const periodo = periodoDesdeMes(body?.periodo)
    const carpeta = normalizarCarpeta(body?.carpeta)
    const path = String(body?.path ?? '')
    const nombre = String(body?.nombre ?? '').trim()
    const mimeType = typeof body?.mimeType === 'string' ? body.mimeType : ''
    const sizeBytes = Number.isInteger(body?.sizeBytes) && body.sizeBytes > 0 ? (body.sizeBytes as number) : null
    if (!empresaId || !periodo || !path || !nombre) return NextResponse.json({ error: 'Faltan datos' }, { status: 400 })
    // Misma regla que en el browser: extensión/mime permitidos y tamaño declarado ≤ 25 MB.
    const invalido = validarArchivoDocumento({ name: nombre, type: mimeType, size: sizeBytes ?? 1 })
    if (invalido) return NextResponse.json({ error: invalido }, { status: 400 })
    // El path tiene que ser el que firmó /api/upload-url para ESTA empresa (evita registrar objetos ajenos).
    if (!path.startsWith(`documentos/${empresaId}/`)) return NextResponse.json({ error: 'Path inválido' }, { status: 400 })

    const { data, error } = await supabase
      .from('documentos_mensuales')
      .insert({
        empresa_id: empresaId,
        periodo,
        carpeta,
        nombre_archivo: nombre,
        path,
        mime_type: mimeType || null,
        size_bytes: sizeBytes,
        notas: String(body?.notas ?? '').trim() || null,
        origen: 'manual',
        uploaded_by: sesion.userId,
      })
      .select()
      .single()
    if (error) return errorInsert(error.message)
    return NextResponse.json({ documento: data })
  }

  // ── Fallback multipart (≤4MB): el PUT directo a R2 falló (p. ej. CORS) ──
  const fd = await request.formData()
  const file = fd.get('file') as File | null
  const empresaId = String(fd.get('empresaId') ?? '')
  const periodo = periodoDesdeMes(fd.get('periodo'))
  const carpeta = normalizarCarpeta(fd.get('carpeta'))
  const notas = String(fd.get('notas') ?? '').trim() || null
  if (!file || !empresaId || !periodo) return NextResponse.json({ error: 'Faltan datos' }, { status: 400 })
  const invalido = validarArchivoDocumento(file)
  if (invalido) return NextResponse.json({ error: invalido }, { status: 400 })

  // La empresa tiene que ser visible por RLS para este usuario
  const { data: emp } = await supabase.from('empresas').select('id').eq('id', empresaId).maybeSingle()
  if (!emp) return NextResponse.json({ error: 'Empresa no encontrada o sin permiso.' }, { status: 403 })

  const path = pathDocumento(empresaId, periodo, carpeta, file.name)
  try {
    await uploadToR2(path, Buffer.from(await file.arrayBuffer()), file.type || 'application/octet-stream')
  } catch (e) {
    console.error('[api/documentos] R2 upload:', e)
    return NextResponse.json({ error: 'No se pudo guardar el archivo en el almacenamiento.' }, { status: 502 })
  }

  const { data, error } = await supabase
    .from('documentos_mensuales')
    .insert({
      empresa_id: empresaId, periodo, carpeta, nombre_archivo: file.name, path,
      mime_type: file.type || null, size_bytes: file.size, notas, origen: 'manual', uploaded_by: sesion.userId,
    })
    .select()
    .single()
  if (error) {
    await deleteFromR2(path).catch(() => {})
    return errorInsert(error.message)
  }
  return NextResponse.json({ documento: data })
}

export async function DELETE(request: NextRequest) {
  const s = await sesionApi(LEGAJO_ESCRITURA, SIN_PERMISO)
  if ('error' in s) return s.error
  const { supabase } = s

  const id = request.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Falta id' }, { status: 400 })

  // Primero la fila (gated por RLS); si no la puede ver, no se borra nada y no tocamos R2.
  // Un error real de la DB no es "no encontrado": se distingue.
  const { data: doc, error } = await supabase
    .from('documentos_mensuales').delete().eq('id', id).select('path').maybeSingle()
  if (error) {
    console.error('[api/documentos] delete:', error.message)
    return NextResponse.json({ error: `No se pudo eliminar el documento: ${error.message}` }, { status: 500 })
  }
  if (!doc) return NextResponse.json({ error: 'Documento no encontrado' }, { status: 404 })

  // La fila ya no existe: si R2 falla queda un objeto huérfano, pero para el
  // usuario la operación se completó. Se loguea, no se reporta como fallo.
  await deleteFromR2(doc.path).catch((e) => console.error('[api/documentos] R2 delete:', doc.path, e))
  return NextResponse.json({ ok: true })
}
