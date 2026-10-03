import { NextRequest, NextResponse } from 'next/server'
import { GetObjectCommand } from '@aws-sdk/client-s3'
import { sesionApi } from '@/lib/auth/session'
import { RRHH_ROLES } from '@/lib/auth/roles'
import { r2, R2_BUCKET } from '@/lib/r2/client'

const UUID = /^[0-9a-f-]{36}$/i
/** Vercel corta las respuestas en ~4,5 MB: más grande que esto no se intenta por acá. */
const MAX_BYTES = 4_000_000

/**
 * Plan B de "Armar carpeta": si el navegador no pudo bajar un archivo directo de R2
 * (URL firmada), lo pide acá y el server se lo pasa. Misma regla que /api/carpeta:
 * solo lo que la RLS deja ver (archivos de certificados o documentación mensual).
 * ?id=<uuid>&tipo=a|m
 */
export async function GET(request: NextRequest) {
  const s = await sesionApi(RRHH_ROLES, 'No tenés permisos para descargar documentación.')
  if ('error' in s) return s.error
  const { supabase } = s

  const id = request.nextUrl.searchParams.get('id') ?? ''
  const tipo = request.nextUrl.searchParams.get('tipo')
  if (!UUID.test(id) || (tipo !== 'a' && tipo !== 'm')) return NextResponse.json({ error: 'Pedido inválido' }, { status: 400 })

  const { data } = tipo === 'a'
    ? await supabase.from('archivos').select('path').eq('id', id).maybeSingle()
    : await supabase.from('documentos_mensuales').select('path').eq('id', id).maybeSingle()
  if (!data?.path) return NextResponse.json({ error: 'No encontrado o sin permiso' }, { status: 404 })

  const obj = await r2.send(new GetObjectCommand({ Bucket: R2_BUCKET, Key: data.path }))
  if ((obj.ContentLength ?? 0) > MAX_BYTES) return NextResponse.json({ error: 'Demasiado grande para este camino' }, { status: 413 })
  const bytes = await obj.Body?.transformToByteArray()
  if (!bytes) return NextResponse.json({ error: 'Archivo vacío' }, { status: 404 })
  return new NextResponse(Buffer.from(bytes), {
    headers: { 'Content-Type': obj.ContentType ?? 'application/octet-stream', 'Cache-Control': 'private, no-store' },
  })
}
