// ============================================================
// Envío de mails (solo servidor).
//
// El canal es la casilla sueldostecnophos@gmail.com por SMTP, con una
// contraseña de aplicación (la casilla tiene verificación en dos pasos, así
// que la clave de la cuenta no sirve para esto y no está en ningún lado).
//
//   GMAIL_USER          sueldostecnophos@gmail.com
//   GMAIL_APP_PASSWORD  contraseña de aplicación de 16 letras
//   NEXT_PUBLIC_APP_URL https://… (sin barra final), para armar los links
//
// Sin las variables el sistema NO falla a la mitad: `hayCanalMail()` dice que
// no y la pantalla de envío avisa antes de empezar. Es el mismo criterio que
// `lib/whatsapp.ts`.
//
// ★ nodemailer es un CLIENTE de SMTP, no una plataforma de envío masivo: no
//   maneja listas, bajas ni rebotes. Para lo que hacemos acá —el link personal
//   de cada empleado, una vez por mes— es exactamente lo que hace falta. Lo
//   que SÍ hay que tener presente: si una dirección está mal, el rebote vuelve
//   a la casilla de Gmail y el sistema no se entera. Alguien tiene que mirar
//   la casilla después de un envío grande.
//
// El límite real lo pone Gmail (~500 destinatarios por día en una casilla
// común), no esta función. Con 94 empleados sobra, pero el envío va por tandas
// igual: ver `/api/recibos/onboarding`.
// ============================================================
import nodemailer, { type Transporter } from 'nodemailer'

/** Lo que ve quien recibe en vez de la dirección pelada. */
export const REMITENTE = 'Gestión de Recursos'

export type ResultadoMail = { ok: true } | { ok: false; error: string }

/**
 * Un archivo que viaja en el mail. Los bytes van en el mensaje, no un link:
 * la copia del recibo firmado tiene que seguir estando dentro de un año,
 * cuando el link ya venció y el token no existe más.
 */
export interface Adjunto {
  nombre: string
  contenido: Uint8Array
  tipo: string
}

export interface Mail {
  para: string
  asunto: string
  texto: string
  html: string
  adjuntos?: Adjunto[]
}

export function hayCanalMail(): boolean {
  return Boolean(process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD)
}

/**
 * La URL pública de la app, para armar los links de los mails.
 *
 * Tiene que estar sí o sí: un mail con un link relativo o apuntando a
 * localhost es peor que no mandarlo, porque la persona lo abre, no funciona y
 * ya desconfía del circuito. Por eso devuelve null en vez de inventar un
 * valor por defecto, y quien lo llama corta el envío.
 */
export function urlApp(): string | null {
  const v = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/+$/, '')
  if (!v || !/^https?:\/\//i.test(v)) return null
  return v
}

// Una sola conexión para toda la tanda: `pool` reusa el socket SMTP en vez de
// abrir y cerrar uno por mail, que con Gmail además es lo que dispara los
// límites por minuto. El transporte se arma una vez por proceso.
let transporte: Transporter | null = null

function obtenerTransporte(usuario: string, clave: string): Transporter {
  if (!transporte) {
    transporte = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 465,
      secure: true, // SSL directo, no STARTTLS
      auth: { user: usuario, pass: clave },
      pool: true,
      maxConnections: 1,
      maxMessages: 50,
      // Topes explícitos. Sin esto, nodemailer espera MINUTOS a un socket que
      // no contesta, y eso ya no es solo una tanda lenta: el mail de la copia
      // firmada sale DENTRO de la request de firmar, así que un Gmail que se
      // cuelga dejaría a la persona mirando la rueda después de haber firmado.
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 20_000,
    })
  }
  return transporte
}

/**
 * Manda UN mail. Nunca lanza: devuelve el error como texto para que el que
 * llama pueda registrarlo en `recibo_mails` y seguir con el resto de la tanda
 * (un mail que rebota no puede frenar a los otros 93).
 */
export async function enviarMail(m: Mail): Promise<ResultadoMail> {
  const usuario = process.env.GMAIL_USER
  const clave = process.env.GMAIL_APP_PASSWORD
  if (!usuario || !clave) return { ok: false, error: 'Sin casilla de mail configurada' }

  try {
    await obtenerTransporte(usuario, clave).sendMail({
      from: { name: REMITENTE, address: usuario },
      to: m.para,
      subject: m.asunto,
      text: m.texto,
      html: m.html,
      attachments: m.adjuntos?.map((a) => ({
        filename: a.nombre,
        content: Buffer.from(a.contenido),
        contentType: a.tipo,
      })),
      // Quien conteste el mail le escribe a la casilla de sueldos, que es
      // donde alguien lee. Sin esto contestarían a una casilla que nadie abre.
      replyTo: usuario,
    })
    return { ok: true }
  } catch (e) {
    // ⚠ El mensaje de nodemailer se registra y se muestra. Nunca incluye la
    // contraseña (un fallo de auth dice "Invalid login" y el usuario), pero se
    // recorta igual por las dudas de que un servidor conteste cualquier cosa.
    const texto = e instanceof Error ? e.message : 'Error desconocido al enviar el mail'
    return { ok: false, error: texto.slice(0, 300) }
  }
}
