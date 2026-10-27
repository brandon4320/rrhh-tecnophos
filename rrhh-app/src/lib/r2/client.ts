import { S3Client } from '@aws-sdk/client-s3'

// ============================================================
// Cliente de R2.
//
// ⚠ El endpoint es `https://<account id>.r2.cloudflarestorage.com`, y el account
// id de Cloudflare son 32 hexadecimales. Si ahí va cualquier otra cosa —el NOMBRE
// del bucket, por ejemplo— el host directamente no existe y Cloudflare contesta:
//
//     403 NotEntitled — "Please enable R2 through the Cloudflare Dashboard"
//
// Ese mensaje MIENTE: parece que R2 está deshabilitado o impago en la cuenta, y
// en realidad es que el host está mal armado. Pasó en producción entre el 23 y el
// 27/10/2026: `CLOUDFLARE_ACCOUNT_ID` quedó cargada con `brandon4320` (que es el
// bucket) y `R2_BUCKET_NAME` con `adc`. Durante cuatro días no se pudo subir NI
// ABRIR ningún adjunto del sistema —certificados, documentación mensual, recibos,
// fotos de flota— y el síntoma apuntaba a Cloudflare en vez de a una variable.
//
// Por eso el account id se valida por forma y, si no sirve, se usa el de la cuenta
// donde están los archivos. Una variable mal cargada no puede volver a dejar al
// sistema entero sin archivos. El id NO es una credencial: viaja en cada URL
// prefirmada que la app le entrega al navegador; sin las claves no abre nada.
// ============================================================

/** Cuenta de Cloudflare donde vive el bucket con todos los archivos. */
const CUENTA_R2 = '93425192771e2150d664dc69b32a286a'

/**
 * El bucket NO se toma del entorno: los ~1.800 archivos ya subidos viven en este
 * y sus `path` están guardados en la base. Apuntar a otro no es cambiar una
 * variable, es migrar los archivos.
 */
export const R2_BUCKET = 'brandon4320'

function accountId(): string {
  const delEntorno = process.env.CLOUDFLARE_ACCOUNT_ID?.trim()
  if (delEntorno && /^[0-9a-f]{32}$/i.test(delEntorno)) return delEntorno
  if (delEntorno) {
    console.error(
      `[r2] CLOUDFLARE_ACCOUNT_ID no tiene forma de account id ("${delEntorno}"): ` +
        'se usa el de la cuenta donde están los archivos. Corregila en Vercel.'
    )
  }
  return CUENTA_R2
}

export const r2 = new S3Client({
  region: 'auto',
  endpoint: `https://${accountId()}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
})
