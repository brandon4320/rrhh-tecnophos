// ============================================================
// El mail con la copia del recibo firmado (TRASPASO 3.4).
//
// Sale DENTRO de la request en la que la persona firma, y por eso todo acá
// está escrito alrededor de una sola regla:
//
//   ★ la firma ya está hecha; el mail no la puede deshacer.
//
// El PDF firmado está en R2 y el recibo está marcado antes de llegar acá. Si
// el mail falla —casilla sin configurar, Gmail caído, dirección que rebota—
// se registra y se sigue. Nunca lanza. Devolverle un error a quien acaba de
// firmar sería decirle que no firmó, y firmaría de nuevo.
//
// No hace falta un candado contra duplicados: quien llama es el único camino
// que logró pasar el recibo de `pendiente` a `firmado` con un UPDATE
// condicional (ver `marcarFirmado`), así que gana exactamente un pedido. Un
// reintento del celular sale por la rama `yaEstaba` y no vuelve a mandar nada.
// ============================================================
import { enviarMail, hayCanalMail } from '@/lib/mail'
import { nombreFirmado } from './estampa'
import { mailCopiaFirmada } from './mail'
import type { Admin } from './servidor'

export const TIPO_COPIA = 'copia_firmada'

/** Tope de lo que se adjunta. Un recibo pesa decenas de KB; Gmail corta en 25 MB. */
export const MAX_ADJUNTO = 8 * 1024 * 1024

export interface DatosCopia {
  empleadoId: string
  /** Puede no tener mail cargado: entonces no hay a dónde mandarlo. */
  email: string | null
  nombre: string | null
  reciboId: string
  tipo: string
  periodo: string
  nombreArchivo: string
  /** Los bytes del PDF ya estampado, los mismos que se subieron a R2. */
  pdf: Uint8Array
  firmadoAt: string
}

/**
 * Deja constancia del intento en `recibo_mails`. Con el cliente ADMIN: la
 * tabla no tiene policies de escritura para nadie (migración 31).
 *
 * Que quede la fila es la mitad del trabajo: sin ella, un mail que nunca salió
 * no se distingue de uno que llegó, y la persona se queda sin su copia sin que
 * nadie se entere.
 */
async function registrar(
  admin: Admin,
  d: DatosCopia,
  fila: { asunto: string; estado: 'enviado' | 'error'; error?: string }
): Promise<void> {
  const { error } = await admin.from('recibo_mails').insert({
    empleado_id: d.empleadoId,
    tipo: TIPO_COPIA,
    destinatario: d.email ?? '',
    asunto: fila.asunto,
    recibos: [d.reciboId],
    estado: fila.estado,
    error: fila.error?.slice(0, 500) ?? null,
  })
  if (error) console.error('[copia-firmada] no se pudo registrar el mail:', error.message)
}

export type ResultadoCopia =
  | { mandado: true }
  | { mandado: false; motivo: string }

/**
 * Manda la copia firmada. NUNCA lanza: el peor caso es `{ mandado: false }`.
 */
export async function enviarCopiaFirmada(admin: Admin, d: DatosCopia): Promise<ResultadoCopia> {
  // Antes que un mail que el servidor rechaza entero, se manda sin adjunto: la
  // confirmación de que firmó vale igual y la copia está en el sistema. El
  // cuerpo cambia solo, así no promete un archivo que no va.
  const adjunto = d.pdf.byteLength <= MAX_ADJUNTO
  if (!adjunto) console.error('[copia-firmada] PDF demasiado grande, va sin adjunto:', d.reciboId, d.pdf.byteLength)

  const armado = mailCopiaFirmada({
    nombre: d.nombre,
    tipo: d.tipo,
    periodo: d.periodo,
    firmadoAt: d.firmadoAt,
    adjunto,
  })

  try {
    const email = (d.email ?? '').trim()
    if (!email) {
      // Pasa de verdad: el link se puede haber entregado a mano. Se registra
      // igual, para que en el panel se vea quién firmó sin recibir su copia.
      await registrar(admin, d, { asunto: armado.asunto, estado: 'error', error: 'El empleado no tiene mail cargado' })
      return { mandado: false, motivo: 'sin mail' }
    }
    if (!hayCanalMail()) {
      await registrar(admin, d, { asunto: armado.asunto, estado: 'error', error: 'Sin casilla de mail configurada' })
      return { mandado: false, motivo: 'sin casilla' }
    }
    const envio = await enviarMail({
      para: email,
      asunto: armado.asunto,
      texto: armado.texto,
      html: armado.html,
      adjuntos: adjunto
        ? [{ nombre: nombreFirmado(d.nombreArchivo), contenido: d.pdf, tipo: 'application/pdf' }]
        : undefined,
    })

    if (!envio.ok) {
      await registrar(admin, d, { asunto: armado.asunto, estado: 'error', error: envio.error })
      return { mandado: false, motivo: envio.error }
    }

    await registrar(admin, d, { asunto: armado.asunto, estado: 'enviado' })
    return { mandado: true }
  } catch (e) {
    // Red de seguridad: ni un error inesperado puede salir de acá hacia la
    // request de firmar.
    const texto = e instanceof Error ? e.message : 'Error desconocido'
    console.error('[copia-firmada] falló el envío:', d.reciboId, texto)
    return { mandado: false, motivo: texto }
  }
}
