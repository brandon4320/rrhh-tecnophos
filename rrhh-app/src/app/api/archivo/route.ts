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
  // y sea visible para el usuario vía RLS ANTES de firmar la URL. Sin esto
  // sería un IDOR sobre todo el bucket. Cada tabla con archivos en R2 tiene su
  // prefijo de clave (ver /api/upload-url), así que alcanza con UNA consulta a
  // la tabla dueña; todas tienen RLS por empresa: maybeSingle vacío = sin permiso.
  // OJO: por eso `recibos`, `documentos` y `flota` son slugs de empresa reservados.
  if (path.startsWith('flota/')) {
    // Fotos del checklist de flota: `flota/<vehiculo_id>/<mes>/<archivo>`. Las
    // sube el formulario del QR (sin sesión), así que no hay fila por archivo:
    // se autoriza por el vehículo. Si la RLS deja ver el vehículo, deja ver sus fotos.
    const m = /^flota\/([0-9a-f-]{36})\/\d{4}-\d{2}\/[0-9a-f-]{36}-[a-z_]+\.(jpg|png|webp)$/.exec(path)
    if (!m) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    const { data: vehiculo } = await supabase.from('vehiculos').select('id').eq('id', m[1]).maybeSingle()
    if (!vehiculo) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  } else {
    const tabla = path.startsWith('recibos/') ? 'recibos_sueldo'
      : path.startsWith('documentos/') ? 'documentos_mensuales'
      : 'archivos'
    const { data: fila } = await supabase.from(tabla).select('id').eq('path', path).maybeSingle()
    if (!fila) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

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
