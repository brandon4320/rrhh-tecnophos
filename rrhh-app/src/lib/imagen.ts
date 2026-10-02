// ============================================================
// Compresión de imágenes en el navegador antes de subirlas.
// Una foto de celular pesa 4-8 MB y, mientras el PUT directo a R2 no ande
// (CORS pendiente, AGENTS.md §8), todo pasa por Vercel con tope de 4 MB.
// A 2400 px de lado y JPEG 80% un certificado escaneado o fotografiado se
// sigue leyendo perfecto y queda en 400 KB - 1,5 MB.
// La parte pura (qué comprimir, a qué tamaño, cómo se llama) tiene tests;
// la que toca canvas solo corre en el browser y ante cualquier problema
// devuelve el archivo original: comprimir nunca puede impedir una subida.
// ============================================================

export const MAX_LADO_IMAGEN = 2400
export const CALIDAD_JPEG = 0.8
/** Por debajo de esto (y sin pasarse de lado) no vale la pena recomprimir. */
export const UMBRAL_COMPRESION_BYTES = 1.5 * 1024 * 1024

const MIME_COMPRIMIBLES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']

/** true para JPG/PNG/WEBP (por mime o, si el browser no lo informa, por extensión). */
export function esImagenComprimible(file: { type: string; name: string }): boolean {
  if (MIME_COMPRIMIBLES.includes((file.type || '').toLowerCase())) return true
  return !file.type && /\.(jpe?g|png|webp)$/i.test(file.name)
}

/** Medidas finales manteniendo la proporción; nunca agranda. */
export function medidasDestino(ancho: number, alto: number, maxLado = MAX_LADO_IMAGEN): { ancho: number; alto: number } {
  const lado = Math.max(ancho, alto)
  if (!(lado > 0)) return { ancho, alto }
  const escala = Math.min(1, maxLado / lado)
  return { ancho: Math.max(1, Math.round(ancho * escala)), alto: Math.max(1, Math.round(alto * escala)) }
}

/** "foto.PNG" → "foto.jpg" (el resultado siempre es JPEG). */
export function nombreJpg(nombre: string): string {
  const base = nombre.replace(/\.[^./\\]+$/, '')
  return `${base || 'imagen'}.jpg`
}

/** Decide si hace falta recomprimir: archivo pesado o lado mayor al máximo. */
export function convieneComprimir(bytes: number, ancho: number, alto: number, maxLado = MAX_LADO_IMAGEN): boolean {
  return bytes > UMBRAL_COMPRESION_BYTES || Math.max(ancho, alto) > maxLado
}

async function decodificar(file: File): Promise<{ fuente: CanvasImageSource; ancho: number; alto: number; cerrar: () => void }> {
  if (typeof createImageBitmap === 'function') {
    // 'from-image' respeta la orientación EXIF (las fotos de celular no quedan acostadas).
    const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' })
    return { fuente: bmp, ancho: bmp.width, alto: bmp.height, cerrar: () => bmp.close() }
  }
  const url = URL.createObjectURL(file)
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => {
      const i = new Image()
      i.onload = () => res(i)
      i.onerror = () => rej(new Error('formato'))
      i.src = url
    })
    return { fuente: img, ancho: img.naturalWidth, alto: img.naturalHeight, cerrar: () => {} }
  } finally {
    URL.revokeObjectURL(url)
  }
}

/**
 * Devuelve una versión JPEG más liviana de la imagen, o el MISMO archivo si no
 * es una imagen comprimible, si ya es liviana, si el resultado no pesa menos o
 * si algo falla (formato raro, memoria, browser viejo).
 */
export async function comprimirImagen(
  file: File,
  opts: { maxLado?: number; calidad?: number } = {}
): Promise<File> {
  if (typeof document === 'undefined' || !esImagenComprimible(file)) return file
  const maxLado = opts.maxLado ?? MAX_LADO_IMAGEN
  const calidad = opts.calidad ?? CALIDAD_JPEG
  try {
    const img = await decodificar(file)
    try {
      if (!convieneComprimir(file.size, img.ancho, img.alto, maxLado)) return file
      const { ancho, alto } = medidasDestino(img.ancho, img.alto, maxLado)
      const canvas = document.createElement('canvas')
      canvas.width = ancho
      canvas.height = alto
      const ctx = canvas.getContext('2d')
      if (!ctx) return file
      // JPEG no tiene transparencia: fondo blanco para que un PNG no quede con negro.
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, ancho, alto)
      ctx.drawImage(img.fuente, 0, 0, ancho, alto)
      const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/jpeg', calidad))
      if (!blob || blob.size >= file.size) return file
      return new File([blob], nombreJpg(file.name), { type: 'image/jpeg', lastModified: file.lastModified })
    } finally {
      img.cerrar()
    }
  } catch {
    return file
  }
}
