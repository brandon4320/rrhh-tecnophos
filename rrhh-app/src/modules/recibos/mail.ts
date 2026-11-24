// ============================================================
// El texto de los mails del circuito de firma. PURO: no toca la base, no
// manda nada, no lee variables de entorno. Así se puede mirar el mail entero
// en un test sin casilla de por medio, que es la única forma de revisar lo
// que les va a llegar a 94 personas antes de que les llegue.
//
// Qué tiene de particular escribir HTML para un mail:
//
//   · tablas y estilos EN LÍNEA. Outlook no entiende flex, grid, ni una hoja
//     de estilos; una clase de Tailwind no llega a destino.
//   · nada de variables CSS ni `prefers-color-scheme`: los colores van
//     escritos. Son los de Gestión (AGENTS.md §7) copiados a mano.
//   · el link va SIEMPRE también como texto suelto, porque hay clientes que
//     no pintan el botón y porque el que desconfía quiere leer a dónde va.
//   · versión de texto plano además de la HTML: no es un adorno, un mail sin
//     ella puntúa peor en los filtros de spam.
// ============================================================
import { DIAS_VIGENCIA, nombreDePila } from './reglas'

const TINTA = '#17161f'
const TEXTO_2 = '#55526a'
const TEXTO_3 = '#6a677c'
const PRIMARY = '#4f46e5'
const FONDO = '#f5f4fa'
const BORDE = '#eceaf3'
const FUENTE = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif"

export interface MailArmado {
  asunto: string
  texto: string
  html: string
}

/** `<` `&` y compañía: el nombre viene de la base y se mete adentro del HTML. */
export function escaparHtml(v: string): string {
  return v
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/** `https://gestion…/firma/<token>` */
export function linkDeFirma(urlApp: string, token: string): string {
  return `${urlApp.replace(/\/+$/, '')}/firma/${encodeURIComponent(token)}`
}

/**
 * El mail del onboarding: se manda UNA vez, antes de que haya ningún recibo
 * cargado, para que la persona deje su firma guardada.
 *
 * Tiene que ser corto (pedido de Brandon, 24/11/2026): para qué es, qué tiene
 * que hacer, y qué pasa cuando firma. Nada más. Un mail largo sobre un
 * circuito nuevo que nadie pidió se cierra sin leer, y este es el único que
 * explica de qué va todo lo demás.
 */
export function mailOnboarding(opciones: {
  nombre: string | null | undefined
  link: string
  dias?: number
}): MailArmado {
  const pila = nombreDePila(opciones.nombre)
  const hola = pila ? `Hola ${pila},` : 'Hola,'
  const dias = opciones.dias ?? DIAS_VIGENCIA
  const link = opciones.link

  const parrafos = [
    'Desde ahora los recibos de sueldo se firman de forma electrónica.',
    'Entrá al link y dejá tu firma guardada. Te va a pedir los últimos 4 números de tu CUIL para confirmar que sos vos.',
  ]
  const despues = [
    'Después, cada vez que tengas un recibo nuevo te avisamos por mail y lo firmás con un toque.',
    'Cuando firmes, te llega un mail con la confirmación y queda una copia en el sistema, a la que también accede la empresa.',
  ]
  const pie = `El link es personal: no lo compartas. Vence en ${dias} días.`

  const texto = [
    hola,
    '',
    ...parrafos,
    '',
    link,
    '',
    ...despues,
    '',
    pie,
    '',
    'Gestión de Recursos',
  ].join('\n')

  const p = (t: string, color = TEXTO_2) =>
    `<p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:${color};">${escaparHtml(t)}</p>`

  const html = `<!doctype html>
<html lang="es"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Tu firma para los recibos de sueldo</title>
</head>
<body style="margin:0;padding:0;background:${FONDO};">
<!-- Lo que se ve en la lista de mails, antes de abrirlo. El bloque oculto
     evita que el cliente complete ese renglón con el principio del cuerpo. -->
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">Dejá tu firma guardada una vez y después firmás cada recibo con un toque.</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${FONDO};">
  <tr><td align="center" style="padding:28px 16px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;background:#ffffff;border:1px solid ${BORDE};border-radius:20px;">
      <tr><td style="padding:32px 28px;font-family:${FUENTE};">

        <p style="margin:0 0 20px;font-size:13px;font-weight:600;letter-spacing:.04em;text-transform:uppercase;color:${TEXTO_3};">Gestión de Recursos</p>

        <h1 style="margin:0 0 18px;font-size:22px;line-height:1.3;font-weight:600;letter-spacing:-0.02em;color:${TINTA};">Tu firma para los recibos de sueldo</h1>

        ${p(hola, TINTA)}
        ${parrafos.map((t) => p(t)).join('\n        ')}

        <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:22px 0;">
          <tr><td style="border-radius:10px;background:${PRIMARY};">
            <a href="${escaparHtml(link)}" style="display:inline-block;padding:12px 24px;font-family:${FUENTE};font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;">Dejar mi firma</a>
          </td></tr>
        </table>

        <!-- El mismo link en texto: hay clientes que no pintan el botón. -->
        <p style="margin:0 0 20px;font-size:13px;line-height:1.5;color:${TEXTO_3};word-break:break-all;">Si el botón no funciona, copiá esta dirección:<br><a href="${escaparHtml(link)}" style="color:${PRIMARY};">${escaparHtml(link)}</a></p>

        <hr style="border:none;border-top:1px solid ${BORDE};margin:22px 0;">

        ${despues.map((t) => p(t)).join('\n        ')}

        <p style="margin:18px 0 0;font-size:13px;line-height:1.5;color:${TEXTO_3};">${escaparHtml(pie)}</p>

      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`

  return { asunto: 'Tu firma para los recibos de sueldo', texto, html }
}
