// ============================================================
// Envío de WhatsApp (solo servidor).
//
// Hoy el canal es WAHA (WhatsApp HTTP API), el mismo motor que ya corre en el
// servidor de PendienteAI. Se activa con tres variables de entorno; sin ellas
// el sistema NO falla: registra el aviso como "sin canal" y se ve en Gestión.
//
//   WHATSAPP_WAHA_URL      https://… (sin barra final)
//   WHATSAPP_WAHA_KEY      la API key de WAHA
//   WHATSAPP_WAHA_SESSION  sesión de WAHA (por defecto "default")
//
// El número que manda los mensajes es el que esté vinculado a esa sesión:
// conviene un chip propio de la empresa, no un celular personal.
// ============================================================

export type ResultadoEnvio = { ok: true } | { ok: false; error: string }

export function hayCanalWhatsApp(): boolean {
  return Boolean(process.env.WHATSAPP_WAHA_URL && process.env.WHATSAPP_WAHA_KEY)
}

/** `telefono` en formato internacional sin "+": 5492914123456. */
export async function enviarWhatsApp(telefono: string, texto: string): Promise<ResultadoEnvio> {
  const url = process.env.WHATSAPP_WAHA_URL
  const key = process.env.WHATSAPP_WAHA_KEY
  if (!url || !key) return { ok: false, error: 'Sin canal de WhatsApp configurado' }

  try {
    const res = await fetch(`${url.replace(/\/$/, '')}/api/sendText`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Api-Key': key },
      body: JSON.stringify({
        session: process.env.WHATSAPP_WAHA_SESSION || 'default',
        chatId: `${telefono}@c.us`,
        text: texto,
      }),
      signal: AbortSignal.timeout(10_000),
    })
    if (!res.ok) {
      const cuerpo = await res.text().catch(() => '')
      return { ok: false, error: `WAHA respondió ${res.status}${cuerpo ? `: ${cuerpo.slice(0, 200)}` : ''}` }
    }
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Error de red al enviar el WhatsApp' }
  }
}
