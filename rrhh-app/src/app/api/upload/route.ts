import { NextRequest, NextResponse } from 'next/server'
import { deleteFromR2, uploadToR2 } from '@/lib/r2/operations'
import { sesionApi } from '@/lib/auth/session'
import { LEGAJO_ESCRITURA } from '@/lib/auth/roles'
import { mensajeError } from '@/lib/errores'

/** Prefijos de clave que pertenecen a OTRAS tablas (ver /api/archivo): nunca como slug acá. */
const PREFIJOS_RESERVADOS = ['recibos', 'documentos', 'flota']

function slugSeguro(v: string): string {
  return /^[a-z0-9][a-z0-9-]*$/.test(v) && !PREFIJOS_RESERVADOS.includes(v) ? v : 'docs'
}

function errorRegistro(error: { code?: string; message?: string }) {
  // Nunca el texto crudo de Postgres al usuario (AGENTS.md §10): queda en el log.
  console.error('[api/upload] insert:', error.message)
  return NextResponse.json({ error: mensajeError(error, 'registrar el archivo') }, { status: 500 })
}

export async function POST(request: NextRequest) {
  // RRHH (admin o usuario) puede adjuntar; la RLS de archivos valida igual a nivel base.
  const s = await sesionApi(LEGAJO_ESCRITURA, 'No tenés permisos para subir archivos.')
  if ('error' in s) return s.error
  const { supabase, sesion } = s

  // Modo registro (JSON): el archivo ya se subió directo a R2 con URL
  // prefirmada (/api/upload-url); acá solo insertamos la fila (gated por RLS).
  if (request.headers.get('content-type')?.includes('application/json')) {
    const body = await request.json().catch(() => null)
    const certId = (body?.certId as string) || ''
    const path = (body?.path as string) || ''
    const nombre = (body?.nombre as string) || ''
    if (!certId || !path || !nombre) {
      return NextResponse.json({ error: 'Faltan datos' }, { status: 400 })
    }
    // El path tiene que ser el que firmó /api/upload-url para ESTE certificado
    // (`<empresaSlug>/<empleadoId|general>/<certId>/<ms>.ext`). Sin esto se podía
    // registrar como propio un objeto ajeno del bucket y hacer que /api/archivo lo
    // firmara. Las rutas de recibos y documentación mensual ya validaban igual.
    if (!path.includes(`/${certId}/`) || PREFIJOS_RESERVADOS.some((p) => path.startsWith(`${p}/`))) {
      return NextResponse.json({ error: 'Path inválido' }, { status: 400 })
    }

    const { data: archivo, error } = await supabase
      .from('archivos')
      .insert({
        certificado_id: certId,
        nombre,
        path,
        mime_type: (body?.mimeType as string) || null,
        size_bytes: typeof body?.sizeBytes === 'number' ? body.sizeBytes : null,
        uploaded_by: sesion.userId,
      })
      .select()
      .single()

    if (error) return errorRegistro(error)
    return NextResponse.json({ archivo })
  }

  // Fallback multipart (≤4MB): el PUT directo a R2 falló (p. ej. CORS sin configurar).
  const formData = await request.formData()
  const file = formData.get('file') as File | null
  const certId = String(formData.get('certId') ?? '')
  // empleadoId/empresaSlug son opcionales: sirve para certificados de empleado, vehículo y empresa.
  // Van a la clave de R2, así que se sanean (antes podían colarse "/" o un prefijo reservado).
  const empleadoIdRaw = String(formData.get('empleadoId') ?? '')
  const empleadoId = /^[0-9a-f-]{36}$/i.test(empleadoIdRaw) ? empleadoIdRaw : ''
  const empresaSlug = slugSeguro(String(formData.get('empresaSlug') ?? ''))

  if (!file || !certId || !/^[0-9a-f-]{36}$/i.test(certId)) {
    return NextResponse.json({ error: 'Faltan datos' }, { status: 400 })
  }

  // El certificado tiene que ser visible por RLS antes de escribir nada en R2
  // (si no, el objeto quedaría huérfano al rechazarse el insert).
  const { data: cert } = await supabase.from('certificados').select('id').eq('id', certId).maybeSingle()
  if (!cert) return NextResponse.json({ error: 'Certificado no encontrado o sin permiso.' }, { status: 403 })

  const ext = (file.name.split('.').pop() || 'bin').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 10) || 'bin'
  const path = `${empresaSlug}/${empleadoId || 'general'}/${certId}/${Date.now()}.${ext}`
  const buffer = Buffer.from(await file.arrayBuffer())

  // Responder siempre JSON: si R2 falla, que el cliente reciba el motivo
  try {
    await uploadToR2(path, buffer, file.type)
  } catch (e) {
    console.error('[api/upload] R2 upload:', e)
    return NextResponse.json({ error: 'No se pudo guardar el archivo en el almacenamiento.' }, { status: 502 })
  }

  const { data: archivo, error } = await supabase
    .from('archivos')
    .insert({
      certificado_id: certId,
      nombre: file.name,
      path,
      mime_type: file.type,
      size_bytes: file.size,
      uploaded_by: sesion.userId,
    })
    .select()
    .single()

  if (error) {
    await deleteFromR2(path).catch(() => {})
    return errorRegistro(error)
  }
  return NextResponse.json({ archivo })
}
