import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { uploadToR2 } from '@/lib/r2/operations'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { data: perfil } = await supabase
    .from('perfiles')
    .select('rol')
    .eq('id', user.id)
    .single()

  // RRHH (admin o usuario) puede adjuntar; la RLS de archivos valida igual a nivel base.
  if (!['admin', 'usuario'].includes(perfil?.rol ?? '')) {
    return NextResponse.json(
      { error: 'No tenés permisos para subir archivos.' },
      { status: 403 }
    )
  }

  const formData = await request.formData()
  const file = formData.get('file') as File
  const certId = formData.get('certId') as string
  // empleadoId/empresaSlug son opcionales: sirve para certificados de empleado, vehículo y empresa.
  const empleadoId = (formData.get('empleadoId') as string) || ''
  const empresaSlug = (formData.get('empresaSlug') as string) || 'docs'

  if (!file || !certId)
    return NextResponse.json({ error: 'Faltan datos' }, { status: 400 })

  const ext = file.name.split('.').pop()
  const path = `${empresaSlug}/${empleadoId || 'general'}/${certId}/${Date.now()}.${ext}`
  const buffer = Buffer.from(await file.arrayBuffer())

  await uploadToR2(path, buffer, file.type)

  const { data: archivo, error } = await supabase
    .from('archivos')
    .insert({
      certificado_id: certId,
      nombre: file.name,
      path,
      mime_type: file.type,
      size_bytes: file.size,
      uploaded_by: user.id,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ archivo })
}
