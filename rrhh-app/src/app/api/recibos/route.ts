import { NextRequest, NextResponse } from 'next/server'
import { deleteFromR2, uploadToR2 } from '@/lib/r2/operations'
import { sesionApi } from '@/lib/auth/session'
import { LEGAJO_ESCRITURA } from '@/lib/auth/roles'
import { esPeriodoFuturo, esTipoRecibo, periodoDesdeMes, validarArchivoRecibo } from '@/lib/recibos'

/**
 * Comprobantes de sueldo (tabla recibos_sueldo).
 *  POST JSON      → registra la fila de un archivo que YA subió directo a R2 (/api/upload-url recurso 'recibo')
 *  POST multipart → fallback para archivos chicos: sube vía Vercel y registra (mismo criterio que /api/upload)
 *  DELETE ?id=    → borra la fila (gated por RLS) y DESPUÉS el objeto en R2 — nunca al revés.
 * Toda escritura pasa por el cliente de sesión: la RLS (recibos_rrhh_all) es la que decide.
 */

/** Sesión + rol de escritura, vía getSesion() (AGENTS.md §5). */
function sesionEscritura() {
  return sesionApi(LEGAJO_ESCRITURA, 'No tenés permisos para cargar comprobantes.')
}

function errorInsert(error: { code?: string; message: string }) {
  console.error('[api/recibos] insert:', error.message)
  // 23505 = unique_violation. Solo la clave natural (empleado, período, tipo) es un 409 "ya existe";
  // un choque en el índice de path es otra cosa (no minteamos ese path) y se trata como error.
  if (error.message.includes('recibos_sueldo_empleado_id_periodo_tipo_key')) {
    return NextResponse.json({ error: 'Ya hay un comprobante de ese período y tipo para este empleado. Eliminalo primero si querés reemplazarlo.' }, { status: 409 })
  }
  return NextResponse.json({ error: `No se pudo registrar el comprobante: ${error.message}` }, { status: 500 })
}

export async function POST(request: NextRequest) {
  const s = await sesionEscritura()
  if ('error' in s) return s.error
  const { supabase, sesion } = s

  // ── Modo registro (JSON): el archivo ya está en R2 ──
  if (request.headers.get('content-type')?.includes('application/json')) {
    const body = await request.json().catch(() => null)
    const empleadoId = String(body?.empleadoId ?? '')
    const periodo = periodoDesdeMes(body?.periodo)
    const tipo = body?.tipo ?? 'mensual'
    const path = String(body?.path ?? '')
    const nombre = String(body?.nombre ?? '').trim()
    const mimeType = typeof body?.mimeType === 'string' ? body.mimeType : ''
    const sizeBytes = Number.isInteger(body?.sizeBytes) && body.sizeBytes > 0 ? (body.sizeBytes as number) : null
    if (!empleadoId || !periodo || !path || !nombre) return NextResponse.json({ error: 'Faltan datos' }, { status: 400 })
    if (!esTipoRecibo(tipo)) return NextResponse.json({ error: 'Tipo inválido' }, { status: 400 })
    if (esPeriodoFuturo(periodo)) return NextResponse.json({ error: 'El período no puede ser un mes futuro.' }, { status: 400 })
    // Misma regla que el browser y que la firma de la URL.
    const invalido = validarArchivoRecibo({ name: nombre, type: mimeType, size: sizeBytes ?? 1 })
    if (invalido) return NextResponse.json({ error: invalido }, { status: 400 })
    // El path tiene que ser el que firmó /api/upload-url para ESTE empleado (evita registrar objetos ajenos).
    if (!path.startsWith(`recibos/`) || !path.includes(`/${empleadoId}/`)) {
      return NextResponse.json({ error: 'Path inválido' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('recibos_sueldo')
      .insert({
        empleado_id: empleadoId,
        periodo,
        tipo,
        nombre_archivo: nombre,
        path,
        mime_type: mimeType || null,
        size_bytes: sizeBytes,
        notas: (String(body?.notas ?? '').trim() || null),
        origen: 'manual',
        uploaded_by: sesion.userId,
      })
      .select()
      .single()
    if (error) return errorInsert(error)
    return NextResponse.json({ recibo: data })
  }

  // ── Fallback multipart (≤4MB): el PUT directo a R2 falló (p. ej. CORS) ──
  const fd = await request.formData()
  const file = fd.get('file') as File | null
  const empleadoId = String(fd.get('empleadoId') ?? '')
  const periodo = periodoDesdeMes(fd.get('periodo'))
  const tipo = String(fd.get('tipo') ?? 'mensual')
  const notas = String(fd.get('notas') ?? '').trim() || null
  const empresaSlug = String(fd.get('empresaSlug') ?? 'docs')
  if (!file || !empleadoId || !periodo) return NextResponse.json({ error: 'Faltan datos' }, { status: 400 })
  if (!esTipoRecibo(tipo)) return NextResponse.json({ error: 'Tipo inválido' }, { status: 400 })
  if (esPeriodoFuturo(periodo)) return NextResponse.json({ error: 'El período no puede ser un mes futuro.' }, { status: 400 })
  const invalido = validarArchivoRecibo(file)
  if (invalido) return NextResponse.json({ error: invalido }, { status: 400 })

  // El empleado tiene que ser visible por RLS para este usuario
  const { data: emp } = await supabase.from('empleados').select('id').eq('id', empleadoId).maybeSingle()
  if (!emp) return NextResponse.json({ error: 'Empleado no encontrado o sin permiso.' }, { status: 403 })

  const ext = (file.name.split('.').pop() || 'bin').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 10) || 'bin'
  const slug = /^[a-z0-9][a-z0-9-]*$/.test(empresaSlug) && !['recibos', 'documentos'].includes(empresaSlug) ? empresaSlug : 'docs'
  const path = `recibos/${slug}/${empleadoId}/${periodo}-${tipo}-${Date.now()}.${ext}`
  try {
    await uploadToR2(path, Buffer.from(await file.arrayBuffer()), file.type || 'application/octet-stream')
  } catch (e) {
    console.error('[api/recibos] R2 upload:', e)
    return NextResponse.json({ error: 'No se pudo guardar el archivo en el almacenamiento.' }, { status: 502 })
  }

  const { data, error } = await supabase
    .from('recibos_sueldo')
    .insert({
      empleado_id: empleadoId, periodo, tipo, nombre_archivo: file.name, path,
      mime_type: file.type || null, size_bytes: file.size, notas, origen: 'manual', uploaded_by: sesion.userId,
    })
    .select()
    .single()
  if (error) {
    await deleteFromR2(path).catch(() => {})
    return errorInsert(error)
  }
  return NextResponse.json({ recibo: data })
}

export async function DELETE(request: NextRequest) {
  const s = await sesionEscritura()
  if ('error' in s) return s.error
  const { supabase } = s

  const id = request.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Falta id' }, { status: 400 })

  // Primero la fila (gated por RLS); si no la puede ver, no se borra nada y no tocamos R2.
  // Un error real de la DB no es "no encontrado": se distingue.
  const { data: recibo, error } = await supabase
    .from('recibos_sueldo').delete().eq('id', id).select('path').maybeSingle()
  if (error) {
    console.error('[api/recibos] delete:', error.message)
    return NextResponse.json({ error: `No se pudo eliminar el comprobante: ${error.message}` }, { status: 500 })
  }
  if (!recibo) return NextResponse.json({ error: 'Comprobante no encontrado' }, { status: 404 })

  // La fila ya no existe: si R2 falla queda un objeto huérfano, pero la operación se completó.
  await deleteFromR2(recibo.path).catch((e) => console.error('[api/recibos] R2 delete:', recibo.path, e))
  return NextResponse.json({ ok: true })
}
