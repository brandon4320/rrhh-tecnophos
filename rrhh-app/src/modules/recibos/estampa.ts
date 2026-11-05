// ============================================================
// Cómo se dibuja la firma arriba del recibo. Puro, sin I/O, con tests.
//
// Acá no se abre ningún PDF: solo se decide QUÉ rectángulo ocupa la firma
// dentro del recuadro que midió el lector (ver archivo.ts::CajaFirma) y cómo
// se llama el PDF firmado. Quien dibuja de verdad es firma-pdf.ts, que es el
// único que carga pdf-lib.
//
// ⚠ Todas las coordenadas de este archivo son las de pdf-lib: puntos, origen
// ABAJO a la izquierda (una A4 son 595 × 842). Ver migración 32.
// ============================================================
import { diaClaveAR } from '@/lib/fechas-ar'
import type { CajaFirma } from './archivo'

/**
 * Tope de la imagen de la firma.
 *
 * Un garabato hecho con el dedo en un canvas de 600×200 pesa menos de 50 KB.
 * El tope está para que nadie use este campo —que es público, sin login— para
 * subir cualquier cosa, y queda muy por debajo del límite de 4,5 MB por
 * request de Vercel.
 */
export const MAX_FIRMA_BYTES = 300 * 1024

/** Los 8 bytes con los que empieza todo PNG. */
const MAGIA_PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]

/**
 * ¿Esto es un PNG de verdad?
 *
 * Se mira el contenido y no lo que diga el data URL, que lo escribe el
 * navegador de quien firma. pdf-lib abre la imagen como PNG y fallaría recién
 * al estampar, con la firma ya guardada en R2.
 */
export function esPng(bytes: Uint8Array): boolean {
  if (bytes.length < MAGIA_PNG.length) return false
  return MAGIA_PNG.every((b, i) => bytes[i] === b)
}

/**
 * Los bytes de la firma a partir del `data:image/png;base64,...` que manda el
 * canvas. Devuelve el motivo en castellano cuando no sirve, porque ese texto
 * se le muestra a quien está firmando desde el celular.
 */
export function leerFirmaPng(v: unknown): { bytes: Uint8Array } | { error: string } {
  if (typeof v !== 'string' || !v) return { error: 'Falta la firma.' }
  const m = /^data:image\/png;base64,([A-Za-z0-9+/=]+)$/.exec(v.trim())
  if (!m) return { error: 'La firma no se pudo leer. Probá de nuevo.' }

  // El base64 crece un tercio: se corta ANTES de reservar la memoria.
  if (m[1].length > Math.ceil((MAX_FIRMA_BYTES * 4) / 3) + 4) {
    return { error: 'La firma es demasiado grande.' }
  }

  let bytes: Uint8Array
  try {
    bytes = Uint8Array.from(Buffer.from(m[1], 'base64'))
  } catch {
    return { error: 'La firma no se pudo leer. Probá de nuevo.' }
  }
  if (bytes.length > MAX_FIRMA_BYTES) return { error: 'La firma es demasiado grande.' }
  if (!esPng(bytes)) return { error: 'La firma no se pudo leer. Probá de nuevo.' }
  return { bytes }
}

/**
 * Las medidas que declara el PNG en su cabecera (IHDR), o null si no las trae.
 *
 * Se leen acá y no al estampar porque la firma se guarda UNA vez y se reusa en
 * cada recibo: tener el alto y el ancho en la fila evita abrir el PNG de nuevo
 * solo para saber cuánto mide.
 */
export function medidasPng(bytes: Uint8Array): { ancho: number; alto: number } | null {
  // 8 bytes de firma + 4 de largo + 'IHDR' + ancho y alto, de 4 bytes cada uno.
  if (!esPng(bytes) || bytes.length < 24) return null
  if (String.fromCharCode(...bytes.slice(12, 16)) !== 'IHDR') return null
  const leer = (i: number) =>
    ((bytes[i] << 24) | (bytes[i + 1] << 16) | (bytes[i + 2] << 8) | bytes[i + 3]) >>> 0
  const ancho = leer(16)
  const alto = leer(20)
  if (!ancho || !alto) return null
  return { ancho, alto }
}

// ------------------------------------------------------------
// Dónde entra la firma
// ------------------------------------------------------------

/** Alto de la línea "Firmado el …", en puntos. */
export const ALTO_LEYENDA = 6.5

/** Debajo de esto no entra la leyenda sin comerse la firma: va solo el dibujo. */
const ALTO_MINIMO_CON_LEYENDA = 26

export interface Estampa {
  /** El rectángulo donde va la imagen, ya escalada sin deformarse. */
  x: number
  y: number
  ancho: number
  alto: number
  /** Dónde arranca la línea de texto, o null si no entra. */
  leyenda: { x: number; y: number; tamanio: number } | null
}

/**
 * Mete la imagen de la firma dentro del recuadro.
 *
 * Tres decisiones que se ven acá:
 *
 *  · **Se apoya abajo.** El recuadro es el espacio libre ARRIBA de la palabra
 *    "Firma" impresa, así que una firma pegada al techo del recuadro queda
 *    flotando lejos de su renglón. Apoyada abajo se lee como una firma sobre
 *    la línea.
 *  · **La leyenda va arriba**, no entre la firma y el renglón: ahí apretaría
 *    justo donde el ojo espera el trazo.
 *  · **No se deforma nunca.** Se escala por el lado que primero toca el borde;
 *    una firma estirada a lo ancho no se parece a la de la persona.
 */
export function encajarFirma(caja: CajaFirma, anchoImg: number, altoImg: number): Estampa {
  const conLeyenda = caja.alto >= ALTO_MINIMO_CON_LEYENDA
  const reservado = conLeyenda ? ALTO_LEYENDA : 0
  const disponible = Math.max(caja.alto - reservado, 1)

  // Una imagen sin medidas no puede escalarse: ocupa el recuadro y listo. No
  // debería pasar (pdf-lib siempre las devuelve), pero una división por cero
  // acá dejaría NaN en las coordenadas y pdf-lib dibuja cualquier cosa.
  const w = anchoImg > 0 ? anchoImg : caja.ancho
  const h = altoImg > 0 ? altoImg : disponible

  const escala = Math.min(caja.ancho / w, disponible / h)
  const ancho = w * escala
  const alto = h * escala

  return {
    x: caja.x + (caja.ancho - ancho) / 2,
    y: caja.y,
    ancho,
    alto,
    leyenda: conLeyenda
      ? { x: caja.x, y: caja.y + caja.alto - ALTO_LEYENDA, tamanio: ALTO_LEYENDA }
      : null,
  }
}

/**
 * El recuadro para un recibo que no trae posición.
 *
 * Los PDF que entran por el circuito automático traen la suya, medida sobre el
 * papel. Los que carga la oficina a mano desde el legajo, no. Antes que dejar
 * a alguien con un recibo que no puede firmar nunca, se estampa abajo a la
 * derecha de la última hoja, que es donde está la firma en cualquier recibo de
 * sueldo. Puede quedar sobre algo impreso: es feo, pero la constancia queda y
 * el original nunca se pisa.
 */
export function cajaPorDefecto(anchoPagina: number, altoPagina: number, pagina: number): CajaFirma {
  const ancho = Math.min(150, anchoPagina / 3)
  const alto = Math.min(50, altoPagina / 8)
  const margen = Math.min(40, anchoPagina / 12)
  return {
    pagina,
    x: Math.max(0, anchoPagina - margen - ancho),
    y: margen,
    ancho,
    alto,
  }
}

/** "Firmado el 05/11/2026" — la fecha en hora argentina (AGENTS.md §9). */
export function leyendaFirma(fecha: Date = new Date()): string {
  const [a, m, d] = diaClaveAR(fecha).split('-')
  return `Firmado el ${d}/${m}/${a}`
}

// ------------------------------------------------------------
// Cómo se llama el firmado
// ------------------------------------------------------------

/**
 * La clave del PDF firmado en R2, derivada de la del original.
 *
 * Derivada y no nueva al azar: el original tiene índice único por `path`, así
 * que el firmado hereda esa unicidad sin ninguna cuenta aparte. Y el par queda
 * a la vista en el bucket: el mismo nombre con y sin `-firmado`.
 */
export function rutaFirmado(path: string): string {
  const p = (path ?? '').trim()
  if (!p) return ''
  return p.toLowerCase().endsWith('.pdf') ? `${p.slice(0, -4)}-firmado.pdf` : `${p}-firmado.pdf`
}

/** "Sueldo mensual - Octubre 2026.pdf" → "Sueldo mensual - Octubre 2026 (firmado).pdf" */
export function nombreFirmado(nombre: string): string {
  const n = (nombre ?? '').trim() || 'Recibo.pdf'
  return n.toLowerCase().endsWith('.pdf') ? `${n.slice(0, -4)} (firmado).pdf` : `${n} (firmado).pdf`
}
