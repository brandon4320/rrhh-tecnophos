import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSignedUploadUrl } from '@/lib/r2/operations'
import { esTipoRecibo, periodoDesdeMes } from '@/lib/recibos'
import { normalizarCarpeta, pathDocumento, validarArchivoDocumento } from '@/modules/documentos/reglas'

/**
 * Devuelve una URL prefirmada para subir DIRECTO a R2 desde el navegador.
 * Evita el límite de 4.5MB por request de Vercel (los escaneos/fotos grandes
 * rebotaban con 413 antes de llegar a la app).
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { data: perfil } = await supabase
    .from('perfiles')
    .select('rol')
    .eq('id', user.id)
    .single()

  if (!['admin', 'usuario'].includes(perfil?.rol ?? '')) {
    return NextResponse.json({ error: 'No tenés permisos para subir archivos.' }, { status: 403 })
  }

  const body = await request.json().catch(() => null)
  const certId = (body?.certId as string) || ''
  const nombre = (body?.nombre as string) || ''
  const mimeType = (body?.mimeType as string) || 'application/octet-stream'
  const empleadoId = (body?.empleadoId as string) || ''
  const empresaSlug = (body?.empresaSlug as string) || 'docs'

  // Comprobantes de sueldo: se cuelgan del EMPLEADO, no de un certificado.
  // Misma regla: solo se firma si el empleado es visible por RLS para este usuario.
  if (body?.recurso === 'recibo') {
    const periodo = periodoDesdeMes(body?.periodo)
    const tipo = esTipoRecibo(body?.tipo) ? body.tipo : 'mensual'
    if (!empleadoId || !nombre || !periodo) {
      return NextResponse.json({ error: 'Faltan datos' }, { status: 400 })
    }
    const { data: emp } = await supabase.from('empleados').select('id').eq('id', empleadoId).maybeSingle()
    if (!emp) return NextResponse.json({ error: 'Empleado no encontrado o sin permiso.' }, { status: 403 })
    const ext = nombre.split('.').pop() || 'bin'
    const path = `recibos/${empresaSlug}/${empleadoId}/${periodo}-${tipo}-${Date.now()}.${ext}`
    const url = await getSignedUploadUrl(path, mimeType, 300)
    return NextResponse.json({ url, path })
  }

  // Documentación mensual: se cuelga de la EMPRESA (F931, ART, SVO…), no de un
  // certificado ni de un empleado. Solo se firma si la empresa es visible por RLS.
  if (body?.recurso === 'documento') {
    const empresaId = String(body?.empresaId ?? '')
    const periodo = periodoDesdeMes(body?.periodo)
    if (!empresaId || !nombre || !periodo) {
      return NextResponse.json({ error: 'Faltan datos' }, { status: 400 })
    }
    // Misma regla que el browser (extensión/mime, 25 MB): no se firma lo que no se aceptaría.
    const sizeBytes = Number.isInteger(body?.sizeBytes) && body.sizeBytes > 0 ? (body.sizeBytes as number) : 1
    const invalido = validarArchivoDocumento({ name: nombre, type: mimeType, size: sizeBytes })
    if (invalido) return NextResponse.json({ error: invalido }, { status: 400 })
    const { data: emp } = await supabase.from('empresas').select('id').eq('id', empresaId).maybeSingle()
    if (!emp) return NextResponse.json({ error: 'Empresa no encontrada o sin permiso.' }, { status: 403 })
    const path = pathDocumento(empresaId, periodo, normalizarCarpeta(body?.carpeta), nombre)
    const url = await getSignedUploadUrl(path, mimeType, 300)
    return NextResponse.json({ url, path })
  }

  if (!certId || !nombre) {
    return NextResponse.json({ error: 'Faltan datos' }, { status: 400 })
  }

  // El certificado tiene que ser visible para este usuario (RLS scopea por
  // empresa) — si no, no firmamos nada.
  const { data: cert } = await supabase
    .from('certificados')
    .select('id')
    .eq('id', certId)
    .maybeSingle()
  if (!cert) return NextResponse.json({ error: 'Certificado no encontrado o sin permiso.' }, { status: 403 })

  const ext = nombre.split('.').pop() || 'bin'
  const path = `${empresaSlug}/${empleadoId || 'general'}/${certId}/${Date.now()}.${ext}`

  const url = await getSignedUploadUrl(path, mimeType, 300)
  return NextResponse.json({ url, path })
}
