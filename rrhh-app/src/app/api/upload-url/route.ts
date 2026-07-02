import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSignedUploadUrl } from '@/lib/r2/operations'

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
