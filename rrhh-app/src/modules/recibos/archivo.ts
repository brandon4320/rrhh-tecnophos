// ============================================================
// Dónde queda guardado el PDF de una liquidación y con qué nombre se ve.
// Puro, sin I/O, con tests.
//
// Lo separa de carga.ts que acá no se decide NADA: la decisión de si el PDF
// entra o no ya está tomada. Esto es solamente el lugar y el rótulo.
// ============================================================
import { labelPeriodo, TIPO_RECIBO_LABEL, type TipoRecibo } from '@/lib/recibos'

/**
 * Tope de lo que se acepta por archivo.
 *
 * Una liquidación individual pesa menos de 100 KB. El tope está para que un
 * PDF de lote —44 personas en un archivo— no entre nunca por accidente, y
 * queda por debajo del límite de 4.5 MB por request de Vercel, que cortaría
 * la subida ANTES de llegar a la app y daría un error ilegible.
 */
export const MAX_RECIBO_SUBIDA_BYTES = 4 * 1024 * 1024

/**
 * Slugs de empresa que ya significan otra cosa en R2 (migraciones 18 y 20).
 * `GET /api/archivo` elige la tabla dueña por el prefijo del path, así que un
 * recibo guardado bajo `recibos/documentos/...` se buscaría en la tabla
 * equivocada.
 */
const SLUGS_RESERVADOS = ['recibos', 'documentos', 'docs', 'flota']

/** La carpeta de la empresa dentro de `recibos/`. Lo que no sirve cae en 'docs'. */
export function carpetaEmpresa(slug: string | null | undefined): string {
  const s = (slug ?? '').trim().toLowerCase()
  if (!/^[a-z0-9][a-z0-9-]*$/.test(s) || SLUGS_RESERVADOS.includes(s)) return 'docs'
  return s
}

/**
 * La clave del objeto en R2.
 *
 * Lleva el hash y no la hora: así el mismo PDF cae siempre en el mismo lugar.
 * Si una corrida se corta a la mitad y se vuelve a correr, se reescribe el
 * mismo objeto con los mismos bytes en vez de dejar una copia huérfana por
 * cada intento.
 */
export function rutaDeRecibo(
  slug: string | null | undefined,
  empleadoId: string,
  periodo: string,
  tipo: string,
  hash: string
): string {
  // Un hash que no es un hash no se "limpia" hasta que entre: se reemplaza
  // entero. Limpiarlo dejaría una clave armada con las letras que zafaron.
  const limpio = (hash ?? '').trim().toLowerCase()
  const corto = /^[0-9a-f]{64}$/.test(limpio) ? limpio.slice(0, 16) : 'sinhash'
  const t = (tipo ?? '').replace(/[^a-z_]/gi, '').toLowerCase() || 'otro'
  return `recibos/${carpetaEmpresa(slug)}/${empleadoId}/${periodo.slice(0, 10)}-${t}-${corto}.pdf`
}

/**
 * Cómo se llama el archivo en el legajo y en la pantalla de firma.
 *
 * El nombre del NAS no sirve: son códigos de Jaque que no le dicen nada a
 * nadie. El número de recibo va adentro porque es lo que identifica a la
 * liquidación cuando hay más de una en el mismo mes, y es el dato por el que
 * pregunta la contadora.
 */
export function nombreDeRecibo(tipo: string, periodo: string, recibo?: string | null): string {
  const rotulo = TIPO_RECIBO_LABEL[tipo as TipoRecibo] ?? 'Comprobante'
  // Solo letras y números: el nombre termina en un header de descarga y en el
  // nombre con el que se guarda el archivo, así que no puede traer un punto ni
  // una barra.
  const num = (recibo ?? '').trim().replace(/[^0-9A-Za-z]/g, '').slice(0, 20)
  return `${rotulo} - ${labelPeriodo(periodo)}${num ? ` - recibo ${num}` : ''}.pdf`
}

/**
 * Qué número le toca a esta liquidación dentro de su período y tipo.
 *
 * La clave única es (empleado, período, tipo, secuencia) y cuenta también a
 * las anuladas: la corrección de un recibo no puede reusar el número del que
 * reemplaza, porque el reemplazado sigue existiendo como constancia.
 */
export function siguienteSecuencia(
  existentes: readonly { periodo: string; tipo: string; secuencia: number }[],
  periodo: string,
  tipo: string
): number {
  const propias = existentes.filter(
    (r) => r.periodo.slice(0, 10) === periodo.slice(0, 10) && r.tipo === tipo
  )
  const max = propias.reduce((m, r) => (Number.isInteger(r.secuencia) && r.secuencia > m ? r.secuencia : m), 0)
  return max + 1
}

/**
 * ¿Esto es un PDF de verdad?
 *
 * Se mira el contenido y no el nombre ni el content-type, que los pone quien
 * sube. Un archivo que no es PDF no se guarda: el estampado de la firma más
 * adelante lo abre como PDF y fallaría recién ahí, con el recibo ya cargado.
 */
export function esPdf(bytes: Uint8Array): boolean {
  // La cabecera va al principio, pero hay generadores que dejan basura antes;
  // los lectores aceptan el %PDF- dentro del primer KB y acá se hace igual.
  const hasta = Math.min(bytes.length, 1024)
  const firma = [0x25, 0x50, 0x44, 0x46, 0x2d] // %PDF-
  for (let i = 0; i + firma.length <= hasta; i++) {
    if (firma.every((b, j) => bytes[i + j] === b)) return true
  }
  return false
}

// ============================================================
// El vale de la corrida: qué liquidación es cada PDF.
//
// ★ Esto es lo que hace que el lector NO pueda mandarle el recibo de alguien a
// otra persona. El lector no dice de quién es el archivo que sube: dice "acá
// están los bytes". Gestión ya decidió —leyendo el texto que el lector le
// contó— a qué legajo corresponde cada huella, y al recibir el archivo lo
// reconoce por su propio sha256 y saca de ahí el dueño. Si el lector emparejara
// mal un archivo con un legajo, el sha no coincidiría con ninguno aprobado y el
// PDF se rechaza.
//
// El vale queda en `recibo_cargas.detalle.aprobados`, escrito por /lote.
// ============================================================

/** Una liquidación aprobada en una corrida, indexada por la huella de su PDF. */
export interface Aprobacion {
  empleadoId: string
  legajo: number | null
  recibo: string | null
  periodo: string
  tipo: string
  concepto: string | null
  /** Ruta relativa en el NAS, para dejar constancia de dónde salió. */
  archivo: string | null
  origenAt: string | null
  /**
   * La huella con la que se guarda, que puede NO ser la del archivo subido:
   * una misma liquidación llega en varias copias con bytes distintos y la que
   * manda es una sola (ver hashQueCuenta en carga.ts).
   */
  hash: string | null
  /** Dónde va la firma en este recibo. null = no se le estampa nada. */
  firma: CajaFirma | null
}

function texto(v: unknown): string | null {
  return typeof v === 'string' && v.trim() ? v.trim() : null
}

/**
 * Busca en el vale de una corrida la liquidación que corresponde a esta huella.
 *
 * Desconfía de lo que lee: `detalle` es jsonb y pudo quedar de una versión
 * vieja del código. Sin empleado ni período no hay aprobación —y sin
 * aprobación el archivo no se guarda— en vez de armar una fila a medias.
 */
export function leerAprobacion(detalle: unknown, hash: string): Aprobacion | null {
  if (!detalle || typeof detalle !== 'object') return null
  const aprobados = (detalle as Record<string, unknown>).aprobados
  if (!aprobados || typeof aprobados !== 'object') return null
  const cruda = (aprobados as Record<string, unknown>)[hash]
  if (!cruda || typeof cruda !== 'object') return null

  const a = cruda as Record<string, unknown>
  const empleadoId = texto(a.empleadoId)
  const periodo = texto(a.periodo)
  const tipo = texto(a.tipo)
  if (!empleadoId || !periodo || !/^\d{4}-\d{2}-\d{2}/.test(periodo) || !tipo) return null

  return {
    empleadoId,
    legajo: Number.isInteger(a.legajo) ? (a.legajo as number) : null,
    recibo: texto(a.recibo),
    periodo: periodo.slice(0, 10),
    tipo,
    concepto: texto(a.concepto),
    archivo: texto(a.archivo),
    origenAt: texto(a.origenAt),
    hash: texto(a.hash) ?? hash,
    firma: leerCajaFirma(a.firma),
  }
}

/**
 * ¿Esa corrida quedó cortada?
 *
 * Cuando /lote corta el lote está diciendo que la asignación puede estar
 * sistemáticamente mal, y es justo ahí donde NO se quiere cargar un PDF en el
 * legajo de nadie. El lector ya respeta `puedeEnviar`, pero el vale queda
 * escrito igual: sin esta puerta, cualquiera que mande los bytes de un lote
 * cortado los carga lo mismo.
 *
 * Ante la duda NO corta: un detalle de una versión vieja, sin el dato, no
 * puede dejar sin cargar un mes entero.
 */
export function loteCortado(detalle: unknown): boolean {
  if (!detalle || typeof detalle !== 'object') return false
  return (detalle as Record<string, unknown>).puedeEnviar === false
}

// ============================================================
// Dónde va la firma en el recibo.
//
// La posición NO se adivina ni vive en el código: la BUSCA el lector, que abre
// el PDF y mide el lugar libre arriba de la palabra "Firma" impresa. Acá solo
// se la revisa antes de guardarla. Así el servidor no necesita abrir el PDF
// para saber dónde dibujar, y si mañana el recibo de aguinaldo tiene otro
// formato la firma lo sigue sola.
//
// ⚠ Las coordenadas llegan YA convertidas a las de pdf-lib: origen abajo a la
// izquierda, en puntos (una A4 son 595 × 842). La cuenta la hace el lector, que
// es el único que ve las de pymupdf (origen arriba). Ver migración 32.
// ============================================================

/** El recuadro donde entra la firma, como lo guarda `recibos_sueldo`. */
export interface CajaFirma {
  pagina: number
  x: number
  y: number
  ancho: number
  alto: number
}

/** Ninguna hoja de papel normal pasa de esto. Un valor mayor es un error. */
const MAX_PUNTOS = 5000

function numero(v: unknown): number | null {
  // Solo número o texto que sea un número. Sin esto `Number(null)` y
  // `Number([])` dan 0 y una caja a medias entraría como una caja en el 0.
  if (typeof v === 'number') return Number.isFinite(v) ? v : null
  if (typeof v !== 'string' || !v.trim()) return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

/**
 * La caja, si es una caja.
 *
 * Lo que no cierra se devuelve como null y no como error: sin posición el
 * recibo se carga igual y simplemente no se le estampa nada. Perder la firma
 * de uno es malo; perder el recibo entero porque el buscador midió raro, peor.
 * Además la migración 32 tiene un CHECK de "o está toda o no está ninguna":
 * mandar media caja haría fallar el insert completo.
 */
export function leerCajaFirma(v: unknown): CajaFirma | null {
  if (!v || typeof v !== 'object') return null
  const c = v as Record<string, unknown>
  const pagina = numero(c.pagina)
  const x = numero(c.x)
  const y = numero(c.y)
  const ancho = numero(c.ancho)
  const alto = numero(c.alto)
  if (pagina === null || x === null || y === null || ancho === null || alto === null) return null
  if (!Number.isInteger(pagina) || pagina < 1 || pagina > 1000) return null
  if (x < 0 || y < 0 || ancho <= 0 || alto <= 0) return null
  if (x + ancho > MAX_PUNTOS || y + alto > MAX_PUNTOS) return null
  return { pagina, x, y, ancho, alto }
}
