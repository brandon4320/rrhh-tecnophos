import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getSignedDownloadUrl } from '@/lib/r2/operations'
import { guardarFirmaDibujada, rutaFirmaDe } from '@/modules/recibos/firma-servidor'
import { confirmarIdentidad } from '@/modules/recibos/identidad'

/**
 * Dejar la firma guardada, sin firmar ningún recibo.
 *
 * Es lo que hace falta para el onboarding: se le manda el link a todo el
 * mundo ANTES de que haya recibos cargados, cada uno dibuja su firma una vez
 * y queda lista. Después, el día que Ger termina las liquidaciones, firmar
 * cada recibo es un toque.
 *
 * PÚBLICA, con la misma puerta que el resto: el token del link más los
 * últimos 4 del CUIL, que se vuelven a pedir en cada llamada y cuentan para
 * el bloqueo por fuerza bruta.
 */
export const dynamic = 'force-dynamic'

export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const admin = createAdminClient()

  const cuerpo = (await request.json().catch(() => null)) as
    | { cuil4?: unknown; firma?: unknown }
    | null

  const quien = await confirmarIdentidad(admin, token, cuerpo?.cuil4)
  if ('error' in quien) return quien.error
  const empleadoId = quien.fila.empleado_id

  const r = await guardarFirmaDibujada(admin, empleadoId, cuerpo?.firma)
  if ('error' in r) return NextResponse.json({ error: r.error }, { status: r.status })

  return NextResponse.json({
    ok: true,
    firmaUrl: await getSignedDownloadUrl(rutaFirmaDe(empleadoId), 300).catch(() => null),
  })
}
