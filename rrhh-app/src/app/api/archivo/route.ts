import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSignedDownloadUrl, deleteFromR2 } from '@/lib/r2/operations'

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const path = request.nextUrl.searchParams.get('path')
  if (!path) return NextResponse.json({ error: 'Falta path' }, { status: 400 })

  const url = await getSignedDownloadUrl(path, 120)
  return NextResponse.json({ url })
}

export async function DELETE(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const id = request.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Falta id' }, { status: 400 })

  const { data: archivo } = await supabase
    .from('archivos').select('path').eq('id', id).single()
  if (!archivo) return NextResponse.json({ error: 'Archivo no encontrado' }, { status: 404 })

  await deleteFromR2(archivo.path)
  await supabase.from('archivos').delete().eq('id', id)

  return NextResponse.json({ ok: true })
}
