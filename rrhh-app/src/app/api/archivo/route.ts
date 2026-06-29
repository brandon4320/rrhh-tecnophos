import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSignedDownloadUrl, deleteFromR2 } from '@/lib/r2/operations'

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const path = request.nextUrl.searchParams.get('path')
  if (!path) return NextResponse.json({ error: 'Falta path' }, { status: 400 })

  // El path es atacable por query string: verificamos que el archivo exista
  // y sea visible para el usuario vía RLS (archivos_rrhh_all scopea por empresa)
  // ANTES de firmar la URL. Sin esto sería un IDOR sobre todo el bucket.
  const { data: archivo } = await supabase
    .from('archivos').select('id').eq('path', path).maybeSingle()
  if (!archivo) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const url = await getSignedDownloadUrl(path, 120)
  return NextResponse.json({ url })
}

export async function DELETE(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const id = request.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Falta id' }, { status: 400 })

  // Borramos primero la fila (gated por RLS): si el usuario no puede verla,
  // no se borra nada y no tocamos R2. Recién con la fila borrada eliminamos
  // el objeto físico, evitando destruir archivos de otra empresa.
  const { data: archivo } = await supabase
    .from('archivos').delete().eq('id', id).select('path').maybeSingle()
  if (!archivo) return NextResponse.json({ error: 'Archivo no encontrado' }, { status: 404 })

  await deleteFromR2(archivo.path)

  return NextResponse.json({ ok: true })
}
