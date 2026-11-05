import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { downloadFromR2, getSignedDownloadUrl, uploadToR2 } from '@/lib/r2/operations'
import { leerCajaFirma } from '@/modules/recibos/archivo'
import { leerFirmaPng, medidasPng, nombreFirmado, rutaFirmado } from '@/modules/recibos/estampa'
import { ErrorEstampa, estamparFirma } from '@/modules/recibos/firma-pdf'
import { confirmarIdentidad } from '@/modules/recibos/identidad'
import {
  firmaGuardada, guardarFirma, marcarFirmado, reciboParaFirmar,
} from '@/modules/recibos/servidor'

/**
 * Firmar UN recibo. PÚBLICA, igual que la pantalla: la autorización es el
 * token del link más los últimos 4 del CUIL, que se vuelven a pedir en cada
 * llamada (ver confirmarIdentidad — también cuentan para el bloqueo).
 *
 * Es de a uno a propósito. Cada liquidación es un documento aparte y firmar
 * "todo junto" dejaría una sola fecha para varias cosas distintas; de a uno,
 * cada recibo tiene su propia constancia y un error en uno no arrastra al
 * resto.
 *
 * ★ El original NUNCA se pisa. El PDF firmado se guarda aparte (migración 31):
 * si alguna vez hay una discusión tienen que estar los dos.
 *
 * Orden: R2 primero, fila después. Un PDF firmado en R2 sin su fila es un
 * archivo de más que nadie mira; una fila que dice "firmado" sin su archivo es
 * una constancia que no existe.
 */
export const dynamic = 'force-dynamic'

const UUID = /^[0-9a-f-]{36}$/i
const MAX_AGENTE = 300

function noDisponible() {
  return NextResponse.json({ error: 'El sistema no está disponible. Probá en unos minutos.' }, { status: 503 })
}

export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const admin = createAdminClient()

  const cuerpo = (await request.json().catch(() => null)) as
    | { cuil4?: unknown; reciboId?: unknown; firma?: unknown }
    | null

  const quien = await confirmarIdentidad(admin, token, cuerpo?.cuil4)
  if ('error' in quien) return quien.error
  const empleadoId = quien.fila.empleado_id

  const reciboId = typeof cuerpo?.reciboId === 'string' ? cuerpo.reciboId : ''
  if (!UUID.test(reciboId)) {
    return NextResponse.json({ error: 'No se entendió qué recibo firmar.' }, { status: 400 })
  }

  // El recibo se busca junto al empleado del token: un id de otra persona no
  // aparece, aunque el link sea válido.
  let recibo
  try {
    recibo = await reciboParaFirmar(admin, empleadoId, reciboId)
  } catch (e) {
    console.error('[firma] leer recibo:', e)
    return noDisponible()
  }
  if (!recibo) return NextResponse.json({ error: 'Ese recibo no está en tu lista.' }, { status: 404 })

  if (recibo.estado === 'anulado') {
    return NextResponse.json(
      { error: 'Ese recibo quedó sin efecto porque se corrigió. Firmá el nuevo.' },
      { status: 409 }
    )
  }

  // Ya firmado: se contesta como si hubiera salido bien. Pasa de verdad cuando
  // el celular reintenta porque se cortó la señal, y volver a estampar pisaría
  // la fecha de la firma de verdad.
  if (recibo.estado === 'firmado' && recibo.firmado_path) {
    const nombre = nombreFirmado(recibo.nombre_archivo)
    return NextResponse.json({
      ok: true,
      yaEstaba: true,
      recibo: {
        id: recibo.id,
        estado: 'firmado',
        nombre,
        url: await getSignedDownloadUrl(recibo.firmado_path, 300, nombre).catch(() => null),
      },
    })
  }

  // ------------------------------------------------------------
  // La firma: la que acaba de dibujar, o la que ya tenía guardada
  // ------------------------------------------------------------
  const rutaFirma = `firmas/${empleadoId}.png`
  let png: Uint8Array

  if (cuerpo?.firma !== undefined && cuerpo?.firma !== null) {
    const leida = leerFirmaPng(cuerpo.firma)
    if ('error' in leida) return NextResponse.json({ error: leida.error }, { status: 400 })
    png = leida.bytes
    const medidas = medidasPng(png)
    try {
      // Antes de estampar: si se guarda la firma y después falla el estampado,
      // la persona no tiene que volver a dibujarla con el dedo.
      await uploadToR2(rutaFirma, png, 'image/png')
      await guardarFirma(admin, empleadoId, {
        path: rutaFirma,
        ancho: medidas?.ancho ?? null,
        alto: medidas?.alto ?? null,
      })
    } catch (e) {
      console.error('[firma] guardar firma:', e)
      return noDisponible()
    }
  } else {
    let guardada
    try {
      guardada = await firmaGuardada(admin, empleadoId)
    } catch (e) {
      console.error('[firma] leer firma guardada:', e)
      return noDisponible()
    }
    if (!guardada) {
      return NextResponse.json({ error: 'Dibujá tu firma para poder firmar.', sinFirma: true }, { status: 400 })
    }
    try {
      png = await downloadFromR2(guardada.path)
    } catch (e) {
      console.error('[firma] bajar firma guardada:', e)
      return noDisponible()
    }
  }

  // ------------------------------------------------------------
  // Estampar
  // ------------------------------------------------------------
  // Pasa por el mismo validador que usa la carga: una posición a medias en la
  // base se trata como si no hubiera, y se estampa en el lugar de siempre.
  const caja = leerCajaFirma({
    pagina: recibo.firma_pagina,
    x: recibo.firma_x,
    y: recibo.firma_y,
    ancho: recibo.firma_ancho,
    alto: recibo.firma_alto,
  })

  let firmado: Uint8Array
  try {
    const original = await downloadFromR2(recibo.path)
    firmado = await estamparFirma(original, png, caja)
  } catch (e) {
    if (e instanceof ErrorEstampa) {
      console.error('[firma] estampar:', recibo.id, e.message)
      return NextResponse.json(
        { error: 'No se pudo firmar este recibo. Avisale a administración.' },
        { status: 422 }
      )
    }
    console.error('[firma] bajar/estampar:', e)
    return noDisponible()
  }

  const destino = rutaFirmado(recibo.path)
  try {
    await uploadToR2(destino, firmado, 'application/pdf')
  } catch (e) {
    console.error('[firma] guardar firmado:', e)
    return noDisponible()
  }

  try {
    const marcado = await marcarFirmado(admin, recibo.id, {
      firmadoPath: destino,
      ip: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || null,
      agente: request.headers.get('user-agent')?.slice(0, MAX_AGENTE) || null,
    })
    // No se marcó porque dejó de estar pendiente mientras estampábamos. Son
    // dos cosas muy distintas y hay que mirar cuál pasó: si otro pedido lo
    // firmó (doble toque, reintento por señal) está todo bien; si en el medio
    // entró una corrección y quedó anulado, decirle "listo, firmaste" sería
    // mentirle sobre un papel que ya no vale.
    if (!marcado) {
      const ahora = await reciboParaFirmar(admin, empleadoId, recibo.id)
      if (ahora?.estado !== 'firmado') {
        return NextResponse.json(
          { error: 'Ese recibo quedó sin efecto porque se corrigió. Firmá el nuevo.' },
          { status: 409 }
        )
      }
    }
  } catch (e) {
    console.error('[firma] marcar firmado:', e)
    return noDisponible()
  }

  const nombre = nombreFirmado(recibo.nombre_archivo)
  return NextResponse.json({
    ok: true,
    recibo: {
      id: recibo.id,
      estado: 'firmado',
      nombre,
      url: await getSignedDownloadUrl(destino, 300, nombre).catch(() => null),
    },
  })
}
