// ============================================================
// GET /api/externo/trazabilidad/carnet?id=<uuid del archivo>
// Devuelve { url, nombre, mime }: URL firmada de R2 de 5 minutos para la imagen
// o el PDF de un carnet de aplicador del recorte. Cualquier otro archivo
// (médicos, cursos, recibos, otros carnets…) responde 404. Mismo token que
// /aplicadores. El portal la baja y la muestra; no la guarda.
// ============================================================
import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getSignedDownloadUrl } from '@/lib/r2/operations'
import { archivoCarnet, tokenValido } from '@/modules/integracion-trazabilidad/servidor'

export const dynamic = 'force-dynamic'

const UUID = /^[0-9a-f-]{36}$/i

export async function GET(req: Request) {
  const admin = createAdminClient()
  try {
    if (!(await tokenValido(admin, req))) return NextResponse.json({ error: 'Token inválido' }, { status: 401 })
  } catch (e) {
    console.error('[externo/trazabilidad] token', e)
    return NextResponse.json({ error: 'No disponible' }, { status: 503 })
  }
  const id = new URL(req.url).searchParams.get('id') ?? ''
  if (!UUID.test(id)) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })
  try {
    const archivo = await archivoCarnet(admin, id)
    if (!archivo) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })
    const url = await getSignedDownloadUrl(archivo.path, 300, archivo.nombre)
    return NextResponse.json({ url, nombre: archivo.nombre, mime: archivo.mime }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (e) {
    console.error('[externo/trazabilidad] carnet', e)
    return NextResponse.json({ error: 'No disponible' }, { status: 503 })
  }
}
