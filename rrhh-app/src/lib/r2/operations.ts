import { PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { r2, R2_BUCKET } from './client'

export async function uploadToR2(
  path: string,
  file: Buffer | Uint8Array,
  contentType: string
): Promise<{ path: string }> {
  await r2.send(new PutObjectCommand({
    Bucket: R2_BUCKET,
    Key: path,
    Body: file,
    ContentType: contentType,
  }))
  return { path }
}

export async function deleteFromR2(path: string): Promise<void> {
  await r2.send(new DeleteObjectCommand({
    Bucket: R2_BUCKET,
    Key: path,
  }))
}

export async function getSignedDownloadUrl(
  path: string,
  expiresIn = 120,
  /** Si se pasa, el archivo se abre en el navegador con este nombre (no con la clave de R2). */
  nombreInline?: string
): Promise<string> {
  return getSignedUrl(
    r2,
    new GetObjectCommand({
      Bucket: R2_BUCKET,
      Key: path,
      ...(nombreInline ? { ResponseContentDisposition: `inline; filename*=UTF-8''${encodeURIComponent(nombreInline)}` } : {}),
    }),
    { expiresIn }
  )
}

/**
 * URL prefirmada para que el navegador suba DIRECTO a R2 (PUT).
 * Evita el límite de 4.5MB por request de las funciones de Vercel.
 */
export async function getSignedUploadUrl(
  path: string,
  contentType: string,
  expiresIn = 300
): Promise<string> {
  return getSignedUrl(
    r2,
    new PutObjectCommand({ Bucket: R2_BUCKET, Key: path, ContentType: contentType }),
    { expiresIn }
  )
}

/**
 * Baja un archivo de R2 a memoria.
 *
 * Es para lo que el server TIENE que abrir —hoy, estampar la firma en el PDF
 * del recibo—, no para pasárselo al navegador: para eso está la URL firmada,
 * que no hace pasar los bytes por la función.
 */
export async function downloadFromR2(path: string): Promise<Uint8Array> {
  const obj = await r2.send(new GetObjectCommand({ Bucket: R2_BUCKET, Key: path }))
  const bytes = await obj.Body?.transformToByteArray()
  if (!bytes) throw new Error(`el archivo ${path} vino vacío`)
  return bytes
}
