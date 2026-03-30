import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { uploadToR2 } from '@/lib/r2/operations'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { data: perfil } = await supabase
    .from('perfiles').select('rol').eq('id', user.id).single()
  if (perfil?.rol !== 'admin')
    return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })

  const formData = await request.formData()
  const file = formData.get('file') as File
  const certId = formData.get('certId') as string
  const empleadoId = formData.get('empleadoId') as string
  const empresaSlug = formData.get('empresaSlug') as string

  if (!file || !certId || !empleadoId)
    return NextResponse.json({ error: 'Faltan datos' }, { status: 400 })

  const ext = file.name.split('.').pop()
  const path = `${empresaSlug}/${empleadoId}/${certId}/${Date.now()}.${ext}`
  const buffer = Buffer.from(await file.arrayBuffer())

  await uploadToR2(path, buffer, file.type)

  const { data: archivo } = await supabase
    .from('archivos')
    .insert({ certificado_id: certId, nombre: file.name, path, mime_type: file.type, size_bytes: file.size })
    .select()
    .single()

  return NextResponse.json({ archivo })
}
