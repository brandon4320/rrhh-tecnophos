import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { deleteFromR2, uploadToR2 } from '@/lib/r2/operations'
import { tieneRol, LEGAJO_ESCRITURA, type Rol } from '@/lib/auth/roles'
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

async function sesionEscritura() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: NextResponse.json({ error: 'No autorizado' }, { status: 401 }) }
  const { data: perfil } = await supabase.from('perfiles').select('rol').eq('id', user.id).single()
  if (!tieneRol(perfil?.rol as Rol | null, LEGAJO_ESCRITURA)) {
    return { error: NextResponse.json({ error: 'No tenés permisos para cargar documentación.' }, { status: 403 }) }
  }
  return { supabase, user }
}

export async function POST(request: NextRequest) {
  const s = await sesionEscritura()
  if ('error' in s) return s.error
  const { supabase, user } = s

  // ── Modo registro (JSON): el archivo ya está en R2 ──
  if (request.headers.get('content-type')?.includes('application/json')) {
    const body = await request.json().catch(() => null)
    const empresaId = String(body?.empresaId ?? '')
    const periodo = periodoDesdeMes(body?.periodo)
    const carpeta = normalizarCarpeta(body?.carpeta)
    const path = String(body?.path ?? '')
    const nombre = String(body?.nombre ?? '').trim()
    if (!empresaId || !periodo || !path || !nombre) return NextResponse.json({ error: 'Faltan datos' }, { status: 400 })
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
        mime_type: (body?.mimeType as string) || null,
        size_bytes: typeof body?.sizeBytes === 'number' ? body.sizeBytes : null,
        notas: String(body?.notas ?? '').trim() || null,
        origen: 'manual',
        uploaded_by: user.id,
      })
      .select()
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
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
  await uploadToR2(path, Buffer.from(await file.arrayBuffer()), file.type || 'application/octet-stream')

  const { data, error } = await supabase
    .from('documentos_mensuales')
    .insert({
      empresa_id: empresaId, periodo, carpeta, nombre_archivo: file.name, path,
      mime_type: file.type || null, size_bytes: file.size, notas, origen: 'manual', uploaded_by: user.id,
    })
    .select()
    .single()
  if (error) {
    await deleteFromR2(path).catch(() => {})
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ documento: data })
}

export async function DELETE(request: NextRequest) {
  const s = await sesionEscritura()
  if ('error' in s) return s.error
  const { supabase } = s

  const id = request.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Falta id' }, { status: 400 })

  // Primero la fila (gated por RLS); si no la puede ver, no se borra nada y no tocamos R2.
  const { data: doc } = await supabase
    .from('documentos_mensuales').delete().eq('id', id).select('path').maybeSingle()
  if (!doc) return NextResponse.json({ error: 'Documento no encontrado' }, { status: 404 })

  await deleteFromR2(doc.path)
  return NextResponse.json({ ok: true })
}
