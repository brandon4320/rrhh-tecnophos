import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sesionApi } from '@/lib/auth/session'
import { RRHH_ROLES } from '@/lib/auth/roles'
import { SIN_PERMISO_RECIBOS } from '@/modules/documentos/reglas'
import { enviarMail, hayCanalMail, urlApp } from '@/lib/mail'
import { linkDeFirma, mailOnboarding } from '@/modules/recibos/mail'
import { crearToken } from '@/modules/recibos/servidor'
import {
  candidatosOnboarding, marcarMailError, puedeRecibir, reservarMail, revocarToken, TANDA,
} from '@/modules/recibos/onboarding-servidor'

/**
 * Manda el mail de onboarding de la firma a una TANDA de empleados.
 *
 * ── Por qué de a tandas ──────────────────────────────────────
 * Son ~94 mails y cada uno es un ida y vuelta SMTP con Gmail. Todos juntos en
 * una sola request se pasarían del tiempo de la función y la tanda quedaría
 * cortada por la mitad sin que nadie sepa dónde. De a {@link TANDA}, la
 * pantalla va llamando y muestra el avance; si una tanda falla, se ve cuál y
 * se reintenta solo esa.
 *
 * ── Quién puede ──────────────────────────────────────────────
 * `perfiles.ve_recibos`, el permiso de la migración 23. No hay uno nuevo: quien
 * manda el link es quien después va a leer lo que se firmó. Se chequea a mano
 * porque el envío escribe con el cliente ADMIN (`recibo_mails` y
 * `recibo_tokens` no tienen policies de escritura para nadie). La LISTA, en
 * cambio, se vuelve a leer con el cliente de SESIÓN: así la RLS recorta por
 * `empresa_acceso` y nadie puede mandarle un mail a un empleado de una empresa
 * que no ve, aunque mande el id a mano.
 */
export const dynamic = 'force-dynamic'
export const maxDuration = 60

/** Lo que se le cuenta a la pantalla de cada id que mandó. */
type Resultado =
  | { id: string; estado: 'enviado' }
  | { id: string; estado: 'omitido'; motivo: string }
  | { id: string; estado: 'error'; motivo: string }

const UUID = /^[0-9a-f-]{36}$/i

export async function POST(request: Request) {
  const s = await sesionApi(RRHH_ROLES, 'No tenés permisos para esto.')
  if ('error' in s) return s.error
  const { supabase, sesion } = s
  if (!sesion.veRecibos) {
    return NextResponse.json({ error: SIN_PERMISO_RECIBOS }, { status: 403 })
  }

  const cuerpo = (await request.json().catch(() => null)) as { ids?: unknown } | null
  const ids = Array.isArray(cuerpo?.ids) ? cuerpo.ids.filter((x): x is string => typeof x === 'string' && UUID.test(x)) : []
  if (!ids.length) {
    return NextResponse.json({ error: 'No se entendió a quién mandarle el mail.' }, { status: 400 })
  }
  if (ids.length > TANDA) {
    return NextResponse.json({ error: `De a ${TANDA} como máximo.` }, { status: 400 })
  }

  // Antes de tocar nada: si no hay casilla o no hay URL pública, no se empieza.
  // Un link a localhost en el mail de 94 personas no se arregla después.
  if (!hayCanalMail()) {
    return NextResponse.json(
      { error: 'Falta configurar la casilla de mail (GMAIL_USER y GMAIL_APP_PASSWORD).' },
      { status: 503 }
    )
  }
  const base = urlApp()
  if (!base) {
    return NextResponse.json(
      { error: 'Falta configurar la dirección pública del sistema (NEXT_PUBLIC_APP_URL).' },
      { status: 503 }
    )
  }

  // La lista se relee acá, con la sesión: lo que mandó la pantalla puede estar
  // viejo (otro ya mandó el mail) o directamente inventado.
  const lista = await candidatosOnboarding(supabase)
  if (lista.error) {
    console.error('[onboarding] leer candidatos:', lista.error.message)
    return NextResponse.json({ error: 'El sistema no está disponible. Probá en unos minutos.' }, { status: 503 })
  }
  const porId = new Map(lista.data.map((c) => [c.id, c]))

  const admin = createAdminClient()
  const resultados: Resultado[] = []

  for (const id of ids) {
    const c = porId.get(id)
    if (!c) {
      resultados.push({ id, estado: 'omitido', motivo: 'No está en tu lista' })
      continue
    }
    if (c.enviadoAt) {
      resultados.push({ id, estado: 'omitido', motivo: 'Ya se le mandó' })
      continue
    }
    if (!puedeRecibir(c) || !c.email) {
      resultados.push({ id, estado: 'omitido', motivo: !c.email ? 'Sin mail cargado' : 'Sin CUIL cargado' })
      continue
    }

    // ── El link ──
    // El token en claro existe SOLO desde acá hasta que sale el mail: en la
    // base va su sha256. Nunca se loguea.
    let token: { token: string; id: string }
    try {
      token = await crearToken(admin, c.id)
    } catch (e) {
      console.error('[onboarding] crear token:', c.id, e)
      resultados.push({ id, estado: 'error', motivo: 'No se pudo generar el link' })
      continue
    }

    const armado = mailOnboarding({ nombre: c.nombre, link: linkDeFirma(base, token.token) })

    // ── La reserva ──
    // Antes de mandar, para que dos clics no manden dos mails (ver
    // `reservarMail`).
    let reserva
    try {
      reserva = await reservarMail(admin, {
        empleadoId: c.id,
        destinatario: c.email,
        asunto: armado.asunto,
        tokenId: token.id,
      })
    } catch (e) {
      console.error('[onboarding] reservar mail:', c.id, e)
      await revocarToken(admin, token.id)
      resultados.push({ id, estado: 'error', motivo: 'No se pudo registrar el envío' })
      continue
    }
    if ('duplicado' in reserva) {
      await revocarToken(admin, token.id)
      resultados.push({ id, estado: 'omitido', motivo: 'Ya se le mandó hoy' })
      continue
    }

    // ── El mail ──
    const envio = await enviarMail({
      para: c.email,
      asunto: armado.asunto,
      texto: armado.texto,
      html: armado.html,
    })
    if (!envio.ok) {
      // La fila pasa a 'error', y con eso libera el índice único: se puede
      // reintentar hoy mismo.
      //
      // ★ El token NO se revoca, aunque la tentación sea limpiarlo. Un error
      // de SMTP no prueba que el mail no haya llegado: si la conexión se corta
      // después de que el servidor aceptó el mensaje, se reporta como fallo
      // igual. Revocarlo sería dejar a esa persona con un mail en la mano y un
      // link que le dice "no sirve". Y dejarlo vivo no expone nada: el token
      // en claro no existe en ningún otro lado que ese mail, así que si de
      // verdad no salió, no lo tiene nadie y se vence solo.
      await marcarMailError(admin, reserva.id, envio.error)
      resultados.push({ id, estado: 'error', motivo: envio.error })
      continue
    }

    resultados.push({ id, estado: 'enviado' })
  }

  return NextResponse.json({
    resultados,
    enviados: resultados.filter((r) => r.estado === 'enviado').length,
    errores: resultados.filter((r) => r.estado === 'error').length,
    omitidos: resultados.filter((r) => r.estado === 'omitido').length,
  })
}
