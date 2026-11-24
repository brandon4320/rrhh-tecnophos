// ============================================================
// Guardar la firma dibujada. Lo usan DOS rutas y por eso vive acá:
//
//  · el onboarding, donde la persona entra solo a dejarla cargada, y
//  · el firmado de un recibo, cuando dibuja una nueva en el momento.
//
// Si cada ruta lo hiciera por su cuenta, el día que cambie dónde se guarda
// una quedaría escribiendo en otro lado.
// ============================================================
import { uploadToR2 } from '@/lib/r2/operations'
import { leerFirmaPng, medidasPng } from './estampa'
import { guardarFirma, type Admin } from './servidor'

/** Una firma por persona, siempre en la misma clave: volver a dibujar pisa la anterior. */
export function rutaFirmaDe(empleadoId: string): string {
  return `firmas/${empleadoId}.png`
}

export type ResultadoFirma = { bytes: Uint8Array } | { error: string; status: number }

/**
 * Valida el PNG que mandó el canvas, lo sube a R2 y lo deja apuntado en
 * `firmas_empleado`.
 *
 * R2 primero, fila después, igual que el resto del módulo: un PNG sin fila es
 * un archivo que nadie mira; una fila sin PNG es una firma que no existe y
 * rompe el estampado del próximo recibo.
 */
export async function guardarFirmaDibujada(
  admin: Admin,
  empleadoId: string,
  dataUrl: unknown
): Promise<ResultadoFirma> {
  const leida = leerFirmaPng(dataUrl)
  if ('error' in leida) return { error: leida.error, status: 400 }

  const medidas = medidasPng(leida.bytes)
  const path = rutaFirmaDe(empleadoId)
  try {
    await uploadToR2(path, leida.bytes, 'image/png')
    await guardarFirma(admin, empleadoId, {
      path,
      ancho: medidas?.ancho ?? null,
      alto: medidas?.alto ?? null,
    })
  } catch (e) {
    console.error('[firma] guardar firma:', e)
    return { error: 'El sistema no está disponible. Probá en unos minutos.', status: 503 }
  }
  return { bytes: leida.bytes }
}
