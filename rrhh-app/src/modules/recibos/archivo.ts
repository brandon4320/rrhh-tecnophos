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
  }
}
