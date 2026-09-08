import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { deleteFromR2, uploadToR2 } from '@/lib/r2/operations'
import { tieneRol, LEGAJO_ESCRITURA, type Rol } from '@/lib/auth/roles'
import { esTipoRecibo, periodoDesdeMes, validarArchivoRecibo } from '@/lib/recibos'

/**
 * Comprobantes de sueldo (tabla recibos_sueldo).
 *  POST JSON      → registra la fila de un archivo que YA subió directo a R2 (/api/upload-url recurso 'recibo')
 *  POST multipart → fallback para archivos chicos: sube vía Vercel y registra (mismo criterio que /api/upload)
 *  DELETE ?id=    → borra la fila (gated por RLS) y DESPUÉS el objeto en R2 — nunca al revés.
 * Toda escritura pasa por el cliente de sesión: la RLS (recibos_rrhh_all) es la que decide.
 */

async function sesionEscritura() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: NextResponse.json({ error: 'No autorizado' }, { status: 401 }) }
  const { data: perfil } = await supabase.from('perfiles').select('rol').eq('id', user.id).single()
  if (!tieneRol(perfil?.rol as Rol | null, LEGAJO_ESCRITURA)) {
    return { error: NextResponse.json({ error: 'No tenés permisos para cargar comprobantes.' }, { status: 403 }) }
  }
  return { supabase, user }
}

function errorInsert(message: string) {
  // 23505 = unique_violation (empleado_id, periodo, tipo)
  if (message.includes('recibos_sueldo_empleado_id_periodo_tipo_key') || message.includes('duplicate key')) {
    return NextResponse.json({ error: 'Ya hay un comprobante de ese período y tipo para este empleado. Eliminalo primero si querés reemplazarlo.' }, { status: 409 })
  }
  return NextResponse.json({ error: message }, { status: 500 })
}

export async function POST(request: NextRequest) {
  const s = await sesionEscritura()
  if ('error' in s) return s.error
  const { supabase, user } = s

  // ── Modo registro (JSON): el archivo ya está en R2 ──
  if (request.headers.get('content-type')?.includes('application/json')) {
    const body = await request.json().catch(() => null)
    const empleadoId = String(body?.empleadoId ?? '')
    const periodo = periodoDesdeMes(body?.periodo)
    const tipo = body?.tipo ?? 'mensual'
    const path = String(body?.path ?? '')
    const nombre = String(body?.nombre ?? '')
    if (!empleadoId || !periodo || !path || !nombre) return NextResponse.json({ error: 'Faltan datos' }, { status: 400 })
    if (!esTipoRecibo(tipo)) return NextResponse.json({ error: 'Tipo inválido' }, { status: 400 })
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
        mime_type: (body?.mimeType as string) || null,
        size_bytes: typeof body?.sizeBytes === 'number' ? body.sizeBytes : null,
        notas: (String(body?.notas ?? '').trim() || null),
        origen: 'manual',
        uploaded_by: user.id,
      })
      .select()
      .single()
    if (error) return errorInsert(error.message)
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
  const invalido = validarArchivoRecibo(file)
  if (invalido) return NextResponse.json({ error: invalido }, { status: 400 })

  // El empleado tiene que ser visible por RLS para este usuario
  const { data: emp } = await supabase.from('empleados').select('id').eq('id', empleadoId).maybeSingle()
  if (!emp) return NextResponse.json({ error: 'Empleado no encontrado o sin permiso.' }, { status: 403 })

  const ext = file.name.split('.').pop() || 'bin'
  const path = `recibos/${empresaSlug}/${empleadoId}/${periodo}-${tipo}-${Date.now()}.${ext}`
  await uploadToR2(path, Buffer.from(await file.arrayBuffer()), file.type || 'application/octet-stream')

  const { data, error } = await supabase
    .from('recibos_sueldo')
    .insert({
      empleado_id: empleadoId, periodo, tipo, nombre_archivo: file.name, path,
      mime_type: file.type || null, size_bytes: file.size, notas, origen: 'manual', uploaded_by: user.id,
    })
    .select()
    .single()
  if (error) {
    await deleteFromR2(path).catch(() => {})
    return errorInsert(error.message)
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
  const { data: recibo } = await supabase
    .from('recibos_sueldo').delete().eq('id', id).select('path').maybeSingle()
  if (!recibo) return NextResponse.json({ error: 'Comprobante no encontrado' }, { status: 404 })

  await deleteFromR2(recibo.path)
  return NextResponse.json({ ok: true })
}
