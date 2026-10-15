// ============================================================
// GET /api/externo/comercial/documentos?marca=tecnophos|adc
// El Sistema de Gestión Comercial (Cloudflare) lee la documentación de la
// empresa que RRHH comparte: habilitaciones/certificados de la empresa y los
// últimos meses de ART y Seguro de Vida. Nada del personal ni de sueldos
// (el recorte está en modules/integracion-comercial/reglas.ts).
//
// Auth: `Authorization: Bearer <token>`, sha256 en integraciones('comercial').
// Máquina a máquina: la ruta es pública en el proxy y valida su propio token.
// Si la DB falla o falta el hash responde 503 (no 401: eso es token equivocado).
// ============================================================
import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { leerMarca } from '@/modules/integracion-comercial/reglas'
import { documentosComercial, tokenValido } from '@/modules/integracion-comercial/servidor'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const admin = createAdminClient()
  try {
    if (!(await tokenValido(admin, req))) return NextResponse.json({ error: 'Token inválido' }, { status: 401 })
  } catch (e) {
    console.error('[externo/comercial] token', e)
    return NextResponse.json({ error: 'No disponible' }, { status: 503 })
  }
  const marca = leerMarca(new URL(req.url).searchParams.get('marca'))
  if (marca === 'invalida') return NextResponse.json({ error: 'marca: tecnophos o adc' }, { status: 400 })
  try {
    const datos = await documentosComercial(admin, marca)
    return NextResponse.json(datos, { headers: { 'Cache-Control': 'no-store' } })
  } catch (e) {
    console.error('[externo/comercial] documentos', e)
    return NextResponse.json({ error: 'No se pudo leer la documentación' }, { status: 503 })
  }
}
