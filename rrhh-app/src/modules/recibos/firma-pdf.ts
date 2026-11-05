// ============================================================
// El único archivo que abre un PDF. Dibuja la firma donde dice estampa.ts.
//
// Vive aparte porque es lo único que carga pdf-lib: así el resto del módulo
// —que es casi todo— se puede probar sin arrastrar una librería de PDF, y se
// ve de un vistazo cuánta superficie tiene acá un archivo que entra de afuera.
// ============================================================
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import type { CajaFirma } from './archivo'
import { cajaPorDefecto, encajarFirma, leyendaFirma } from './estampa'

/** Gris de la leyenda: se lee, pero no compite con el trazo de la firma. */
const GRIS = rgb(0.42, 0.42, 0.42)

export class ErrorEstampa extends Error {}

/**
 * Devuelve un PDF nuevo con la firma estampada. El original no se toca: los
 * bytes que entran no se modifican y el resultado se guarda aparte
 * (migración 31 — si alguna vez hay una discusión tienen que estar los dos).
 *
 * `caja` es lo que midió el lector sobre este mismo PDF. Si viene null —un
 * recibo que cargó la oficina a mano, que nunca pasó por el lector— se usa el
 * lugar de siempre de un recibo de sueldo (ver cajaPorDefecto).
 */
export async function estamparFirma(
  pdf: Uint8Array,
  firmaPng: Uint8Array,
  caja: CajaFirma | null,
  fecha: Date = new Date()
): Promise<Uint8Array> {
  let doc: PDFDocument
  try {
    doc = await PDFDocument.load(pdf)
  } catch (e) {
    throw new ErrorEstampa(`no se pudo abrir el PDF del recibo: ${(e as Error).message}`)
  }

  const paginas = doc.getPages()
  if (!paginas.length) throw new ErrorEstampa('el PDF del recibo no tiene páginas')

  // Una posición que apunta a una página que no existe se trae a la última en
  // vez de fallar: el lector midió sobre este archivo, así que si el número no
  // da es porque el PDF cambió, y la última hoja es donde va la firma.
  const indice = Math.min(Math.max((caja?.pagina ?? paginas.length) - 1, 0), paginas.length - 1)
  const pagina = paginas[indice]

  // ⚠ Las coordenadas medidas están en el marco que SE VE (pymupdf ya aplica la
  // rotación); pdf-lib dibuja en el marco sin rotar. Con una página rotada los
  // dos marcos no coinciden y la firma caería en cualquier lado. No pasa con
  // los recibos de Jaque —ninguno de los 252 que se midieron está rotado— así
  // que acá se corta en vez de estampar en un lugar que nadie revisó.
  if (pagina.getRotation().angle % 360 !== 0) {
    throw new ErrorEstampa('la hoja del recibo está rotada')
  }

  const { width, height } = pagina.getSize()
  const destino = caja ?? cajaPorDefecto(width, height, indice + 1)

  let imagen
  try {
    imagen = await doc.embedPng(firmaPng)
  } catch (e) {
    throw new ErrorEstampa(`no se pudo leer la imagen de la firma: ${(e as Error).message}`)
  }

  const e = encajarFirma(destino, imagen.width, imagen.height)
  pagina.drawImage(imagen, { x: e.x, y: e.y, width: e.ancho, height: e.alto })

  if (e.leyenda) {
    // La fuente se embebe recién acá: si no hay leyenda que escribir, el PDF
    // firmado no engorda con una tipografía que nadie usa.
    const fuente = await doc.embedFont(StandardFonts.Helvetica)
    pagina.drawText(leyendaFirma(fecha), {
      x: e.leyenda.x,
      y: e.leyenda.y,
      size: e.leyenda.tamanio,
      font: fuente,
      color: GRIS,
    })
  }

  return doc.save()
}
