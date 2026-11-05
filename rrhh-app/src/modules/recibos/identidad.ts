// ============================================================
// La única puerta sin login del sistema: link + últimos 4 del CUIL.
//
// Vive acá y no en cada route handler porque la abren DOS rutas —ver los
// recibos y firmarlos— y el día que se afloje una sola de las dos, se afloja
// todo. Mismo molde que `sesionApi`: devuelve la respuesta ya armada cuando no
// hay que seguir.
// ============================================================
import { NextResponse } from 'next/server'
import type { createAdminClient } from '@/lib/supabase/admin'
import { MENSAJE_BLOQUEADO, MENSAJE_CUIL_INCORRECTO, MENSAJE_LINK_INVALIDO, coincideUltimos4, soloDigitos } from './reglas'
import { buscarToken, comparaSegura, estadoDe, evaluarIntento, registrarIntento, type TokenConEmpleado } from './servidor'

type Admin = ReturnType<typeof createAdminClient>

/** Siempre el mismo cuerpo para "no sirve": no se puede distinguir por qué. */
export function linkInvalido() {
  return NextResponse.json({ error: MENSAJE_LINK_INVALIDO }, { status: 403 })
}

/**
 * ¿Quién es? Valida el link y los 4 dígitos, y cuenta el intento.
 *
 * ⚠ Cada llamada cuenta para el bloqueo por fuerza bruta, también la de
 * firmar: son 10.000 combinaciones y el tope es lo único que las frena. Un
 * acierto reinicia el contador (ver `evaluarIntento`), así que firmar tres
 * recibos seguidos no acerca a nadie al bloqueo.
 */
export async function confirmarIdentidad(
  admin: Admin,
  token: string,
  cuil4: unknown
): Promise<{ error: NextResponse } | { fila: TokenConEmpleado }> {
  const escrito = soloDigitos(typeof cuil4 === 'string' ? cuil4 : '')
  if (escrito.length !== 4) {
    return { error: NextResponse.json({ error: 'Escribí los últimos 4 números de tu CUIL.' }, { status: 400 }) }
  }

  let fila
  try {
    fila = await buscarToken(admin, token)
  } catch {
    // Una caída de la base no puede verse igual que un link vencido: el
    // empleado tiene que saber que es el sistema y no su link.
    return {
      error: NextResponse.json(
        { error: 'El sistema no está disponible. Probá en unos minutos.' },
        { status: 503 }
      ),
    }
  }
  if (!fila) return { error: linkInvalido() }

  const estado = estadoDe(fila)
  if (estado === 'invalido') return { error: linkInvalido() }
  if (estado === 'bloqueado') {
    return { error: NextResponse.json({ error: MENSAJE_BLOQUEADO }, { status: 429 }) }
  }

  const cuil = soloDigitos(fila.empleado.cuil)
  // Sin CUIL cargado no hay forma de confirmar quién es: no se muestra nada.
  const acierto = coincideUltimos4(cuil, escrito) && comparaSegura(cuil.slice(-4), escrito)

  const resultado = evaluarIntento(acierto, fila.intentos)
  await registrarIntento(admin, fila.id, resultado)

  if (!resultado.ok) {
    return {
      error: NextResponse.json(
        { error: resultado.mensaje ?? MENSAJE_CUIL_INCORRECTO },
        { status: resultado.bloqueadoHasta ? 429 : 401 }
      ),
    }
  }

  return { fila }
}
