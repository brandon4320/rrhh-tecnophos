import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getSignedDownloadUrl } from '@/lib/r2/operations'
import {
  MENSAJE_BLOQUEADO, MENSAJE_CUIL_INCORRECTO, MENSAJE_LINK_INVALIDO,
  coincideUltimos4, nombreDePila, rotuloPeriodo, rotuloTipo, soloDigitos,
} from '@/modules/recibos/reglas'
import {
  buscarToken, comparaSegura, estadoDe, evaluarIntento, recibosPendientes, registrarIntento,
} from '@/modules/recibos/servidor'

/**
 * Confirmación de los últimos 4 del CUIL para ver los recibos. PÚBLICA: la
 * autorización es el token del link, que se valida acá antes de tocar nada.
 *
 * No devuelve NADA del empleado hasta que los 4 dígitos coinciden: ni el
 * nombre, ni cuántos recibos tiene. Si no, el link solo serviría para saber de
 * quién es.
 */
export const dynamic = 'force-dynamic'

/** Siempre el mismo cuerpo para "no sirve": no se puede distinguir por qué. */
function invalido() {
  return NextResponse.json({ error: MENSAJE_LINK_INVALIDO }, { status: 403 })
}

export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const admin = createAdminClient()

  const cuerpo = (await request.json().catch(() => null)) as { cuil4?: unknown } | null
  const escrito = soloDigitos(typeof cuerpo?.cuil4 === 'string' ? cuerpo.cuil4 : '')
  if (escrito.length !== 4) {
    return NextResponse.json({ error: 'Escribí los últimos 4 números de tu CUIL.' }, { status: 400 })
  }

  let fila
  try {
    fila = await buscarToken(admin, token)
  } catch {
    // Una caída de la base no puede verse igual que un link vencido: el
    // empleado tiene que saber que es el sistema y no su link.
    return NextResponse.json({ error: 'El sistema no está disponible. Probá en unos minutos.' }, { status: 503 })
  }
  if (!fila) return invalido()

  const estado = estadoDe(fila)
  if (estado === 'invalido') return invalido()
  if (estado === 'bloqueado') return NextResponse.json({ error: MENSAJE_BLOQUEADO }, { status: 429 })

  const cuil = soloDigitos(fila.empleado.cuil)
  // Sin CUIL cargado no hay forma de confirmar quién es: no se muestra nada.
  const acierto = coincideUltimos4(cuil, escrito) && comparaSegura(cuil.slice(-4), escrito)

  const resultado = evaluarIntento(acierto, fila.intentos)
  await registrarIntento(admin, fila.id, resultado)

  if (!resultado.ok) {
    return NextResponse.json(
      { error: resultado.mensaje ?? MENSAJE_CUIL_INCORRECTO },
      { status: resultado.bloqueadoHasta ? 429 : 401 }
    )
  }

  const recibos = await recibosPendientes(admin, fila.empleado_id)

  // Cada PDF se abre con una URL firmada de pocos minutos, nunca con un link
  // permanente. Si una falla, el recibo igual aparece: se ve que está y que no
  // se pudo abrir, en vez de desaparecer de la lista sin explicación.
  const conUrl = await Promise.all(
    recibos.map(async (r) => ({
      id: r.id,
      tipo: rotuloTipo(r.tipo),
      periodo: rotuloPeriodo(r.periodo),
      nombre: r.nombre_archivo,
      url: await getSignedDownloadUrl(r.path, 300, r.nombre_archivo).catch(() => null),
    }))
  )

  return NextResponse.json({
    nombre: nombreDePila(fila.empleado.nombre),
    recibos: conUrl,
  })
}
