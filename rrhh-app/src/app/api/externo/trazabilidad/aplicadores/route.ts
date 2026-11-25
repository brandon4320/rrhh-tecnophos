// ============================================================
// GET /api/externo/trazabilidad/aplicadores?marca=tecnophos|adc
// El Portal de Trazabilidad (Cloudflare) lee los aplicadores activos con su
// carnet de aplicador: nombre, sede, número, vencimiento e id del archivo.
// Nada más del legajo (el recorte está en modules/integracion-trazabilidad/reglas.ts).
//
// Auth: `Authorization: Bearer <token>`, sha256 en integraciones('trazabilidad').
// Si la DB falla o falta el hash responde 503 (no 401: eso es token equivocado).
// ============================================================
import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { leerMarca } from '@/modules/integracion-trazabilidad/reglas'
import { aplicadores, tokenValido } from '@/modules/integracion-trazabilidad/servidor'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const admin = createAdminClient()
  try {
    if (!(await tokenValido(admin, req))) return NextResponse.json({ error: 'Token inválido' }, { status: 401 })
  } catch (e) {
    console.error('[externo/trazabilidad] token', e)
    return NextResponse.json({ error: 'No disponible' }, { status: 503 })
  }
  const marca = leerMarca(new URL(req.url).searchParams.get('marca'))
  if (marca === 'invalida') return NextResponse.json({ error: 'marca: tecnophos o adc' }, { status: 400 })
  try {
    return NextResponse.json(await aplicadores(admin, marca), { headers: { 'Cache-Control': 'no-store' } })
  } catch (e) {
    console.error('[externo/trazabilidad] aplicadores', e)
    return NextResponse.json({ error: 'No se pudieron leer los aplicadores' }, { status: 503 })
  }
}
