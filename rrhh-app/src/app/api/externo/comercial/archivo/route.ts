// ============================================================
// GET /api/externo/comercial/archivo?tipo=certificado|mensual&id=<uuid>
// Devuelve { url, nombre }: una URL firmada de R2 de 5 minutos (inline, con el
// nombre original) para un archivo que ENTRE en el recorte de la integración
// comercial. Cualquier otro archivo (personal, vehículos, recibos, F931…)
// responde 404. Mismo token que /documentos.
// ============================================================
import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getSignedDownloadUrl } from '@/lib/r2/operations'
import { archivoComercial, tokenValido } from '@/modules/integracion-comercial/servidor'

export const dynamic = 'force-dynamic'

const UUID = /^[0-9a-f-]{36}$/i

export async function GET(req: Request) {
  const admin = createAdminClient()
  try {
    if (!(await tokenValido(admin, req))) return NextResponse.json({ error: 'Token inválido' }, { status: 401 })
  } catch (e) {
    console.error('[externo/comercial] token', e)
    return NextResponse.json({ error: 'No disponible' }, { status: 503 })
  }
  const q = new URL(req.url).searchParams
  const tipo = q.get('tipo')
  const id = q.get('id') ?? ''
  if ((tipo !== 'certificado' && tipo !== 'mensual') || !UUID.test(id)) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })
  try {
    const archivo = await archivoComercial(admin, tipo, id)
    if (!archivo) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })
    const url = await getSignedDownloadUrl(archivo.path, 300, archivo.nombre)
    return NextResponse.json({ url, nombre: archivo.nombre }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (e) {
    console.error('[externo/comercial] archivo', e)
    return NextResponse.json({ error: 'No disponible' }, { status: 503 })
  }
}
