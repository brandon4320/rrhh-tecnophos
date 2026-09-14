import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSignedUploadUrl } from '@/lib/r2/operations'
import { esPeriodoFuturo, esTipoRecibo, periodoDesdeMes, validarArchivoRecibo } from '@/lib/recibos'
import { normalizarCarpeta, pathDocumento, sanitizarNombreArchivo, validarArchivoDocumento } from '@/modules/documentos/reglas'

/** Extensión segura para la clave en R2 (el nombre viene del cliente). */
function extensionDe(nombre: string): string {
  const limpio = sanitizarNombreArchivo(nombre)
  const ext = limpio.includes('.') ? limpio.split('.').pop()! : ''
  return ext && ext.length <= 10 ? ext.toLowerCase() : 'bin'
}

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
  const sizeBytes = Number.isInteger(body?.sizeBytes) && body.sizeBytes > 0 ? (body.sizeBytes as number) : 1

  // Comprobantes de sueldo: se cuelgan del EMPLEADO, no de un certificado.
  // Misma regla: solo se firma si el empleado es visible por RLS para este usuario.
  if (body?.recurso === 'recibo') {
    const periodo = periodoDesdeMes(body?.periodo)
    const tipo = esTipoRecibo(body?.tipo) ? body.tipo : 'mensual'
    if (!empleadoId || !nombre || !periodo) {
      return NextResponse.json({ error: 'Faltan datos' }, { status: 400 })
    }
    if (esPeriodoFuturo(periodo)) return NextResponse.json({ error: 'El período no puede ser un mes futuro.' }, { status: 400 })
    // Misma regla que el browser (PDF/imagen, 15 MB declarados): no se firma lo que no se aceptaría.
    const invalido = validarArchivoRecibo({ name: nombre, type: mimeType, size: sizeBytes })
    if (invalido) return NextResponse.json({ error: invalido }, { status: 400 })
    // El slug de la empresa sale del empleado (RLS), no del body.
    const { data: emp } = await supabase
      .from('empleados').select('id, empresa:empresas(slug)').eq('id', empleadoId).maybeSingle()
    if (!emp) return NextResponse.json({ error: 'Empleado no encontrado o sin permiso.' }, { status: 403 })
    // Antes de subir 10 MB a R2: si ya hay comprobante de ese período y tipo, se avisa acá
    // (si no, el objeto quedaría huérfano en el bucket al fallar el registro).
    const { data: dup } = await supabase
      .from('recibos_sueldo').select('id').eq('empleado_id', empleadoId).eq('periodo', periodo).eq('tipo', tipo).maybeSingle()
    if (dup) {
      return NextResponse.json({ error: 'Ya hay un comprobante de ese período y tipo para este empleado. Eliminalo primero si querés reemplazarlo.' }, { status: 409 })
    }
    const slug = (emp as { empresa?: { slug?: string } | null }).empresa?.slug || 'docs'
    const path = `recibos/${slug}/${empleadoId}/${periodo}-${tipo}-${Date.now()}.${extensionDe(nombre)}`
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
    if (esPeriodoFuturo(periodo)) return NextResponse.json({ error: 'El período no puede ser un mes futuro.' }, { status: 400 })
    // Misma regla que el browser (extensión/mime, 25 MB): no se firma lo que no se aceptaría.
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

  // El slug que viene del body solo se usa si es una empresa real visible por RLS
  // (`recibos/` y `documentos/` son prefijos reservados para otras tablas; ver /api/archivo).
  const slugBody = typeof body?.empresaSlug === 'string' ? body.empresaSlug : ''
  let empresaSlug = 'docs'
  if (/^[a-z0-9][a-z0-9-]*$/.test(slugBody) && !['recibos', 'documentos'].includes(slugBody)) {
    const { data: e } = await supabase.from('empresas').select('slug').eq('slug', slugBody).maybeSingle()
    if (e?.slug) empresaSlug = e.slug
  }
  const path = `${empresaSlug}/${empleadoId || 'general'}/${certId}/${Date.now()}.${extensionDe(nombre)}`

  const url = await getSignedUploadUrl(path, mimeType, 300)
  return NextResponse.json({ url, path })
}
