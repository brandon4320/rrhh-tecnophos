import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getSignedDownloadUrl } from '@/lib/r2/operations'
import { nombreFirmado } from '@/modules/recibos/estampa'
import { confirmarIdentidad } from '@/modules/recibos/identidad'
import { nombreDePila, rotuloPeriodo, rotuloTipo } from '@/modules/recibos/reglas'
import { firmaGuardada, recibosPendientes } from '@/modules/recibos/servidor'

/**
 * Confirmación de los últimos 4 del CUIL para ver los recibos. PÚBLICA: la
 * autorización es el token del link, que se valida acá antes de tocar nada.
 *
 * No devuelve NADA del empleado hasta que los 4 dígitos coinciden: ni el
 * nombre, ni cuántos recibos tiene. Si no, el link solo serviría para saber de
 * quién es.
 */
export const dynamic = 'force-dynamic'

export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const admin = createAdminClient()

  const cuerpo = (await request.json().catch(() => null)) as { cuil4?: unknown } | null
  const quien = await confirmarIdentidad(admin, token, cuerpo?.cuil4)
  if ('error' in quien) return quien.error
  const { fila } = quien

  let recibos
  let firma
  try {
    ;[recibos, firma] = await Promise.all([
      recibosPendientes(admin, fila.empleado_id),
      firmaGuardada(admin, fila.empleado_id),
    ])
  } catch {
    return NextResponse.json({ error: 'El sistema no está disponible. Probá en unos minutos.' }, { status: 503 })
  }

  // Cada PDF se abre con una URL firmada de pocos minutos, nunca con un link
  // permanente. Si una falla, el recibo igual aparece: se ve que está y que no
  // se pudo abrir, en vez de desaparecer de la lista sin explicación.
  const conUrl = await Promise.all(
    recibos.map(async (r) => {
      const firmado = r.estado === 'firmado' && r.firmado_path
      const path = firmado ? r.firmado_path! : r.path
      const nombre = firmado ? nombreFirmado(r.nombre_archivo) : r.nombre_archivo
      return {
        id: r.id,
        estado: r.estado,
        tipo: rotuloTipo(r.tipo),
        periodo: rotuloPeriodo(r.periodo),
        nombre,
        url: await getSignedDownloadUrl(path, 300, nombre).catch(() => null),
      }
    })
  )

  return NextResponse.json({
    nombre: nombreDePila(fila.empleado.nombre),
    // Si ya dibujó la firma alguna vez, el celular se la muestra y le ofrece
    // reusarla, en vez de pedirle que la vuelva a hacer con el dedo en cada
    // recibo.
    firmaUrl: firma ? await getSignedDownloadUrl(firma.path, 300).catch(() => null) : null,
    recibos: conUrl,
  })
}
