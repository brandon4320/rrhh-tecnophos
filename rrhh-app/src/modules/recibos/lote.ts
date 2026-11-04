// ============================================================
// A quién pertenece cada PDF de liquidación. Puro, sin I/O, con tests.
//
// Es la decisión más peligrosa de todo el circuito: si un PDF se le asigna a la
// persona equivocada, esa persona ve el sueldo de otro y no hay forma de
// deshacerlo una vez que salió el mail.
//
// La identidad es el par (base de liquidación, legajo), NUNCA el legajo solo:
// en Jaque el legajo 1 de ADC y el legajo 1 de Tecnophos son dos personas
// distintas. La base sale de la carpeta donde apareció el PDF y el legajo viene
// escrito en el archivo (confirmado por el contador, 04/11/2026).
//
// Como la carpeta es un dato frágil —alcanza con que alguien mueva un archivo
// para que TODO el lote se resuelva mal pero sin errores— cada PDF se verifica
// además contra el nombre y el CUIL que trae impresos. Un legajo que coincide
// pero con otro nombre no se manda.
// ============================================================
import { soloDigitos } from './reglas'

/**
 * Las bases de Jaque y qué empresas de Gestión cubren.
 *
 * Una base NO es una empresa: Tecnophos liquida las tres sedes con un solo
 * juego de legajos. Espejo de BASES en la herramienta de emparejamiento.
 */
export const BASES_SUELDOS: Record<string, { etiqueta: string; empresas: readonly string[] }> = {
  '1': { etiqueta: 'Tecnophos', empresas: ['tecnophos-bb', 'tecnophos-rosario', 'tecnophos-necochea'] },
  '3-ADC': { etiqueta: 'ADC S.R.L', empresas: ['adc'] },
}

export function esBaseConocida(base: string | null | undefined): boolean {
  return !!base && Object.prototype.hasOwnProperty.call(BASES_SUELDOS, base)
}

/** El empleado como lo necesita esta decisión. */
export interface EmpleadoPadron {
  id: string
  nombre: string
  apellido: string | null
  cuil: string | null
  email: string | null
  base_sueldos: string | null
  legajo: number | null
}

/** Lo que se pudo leer de un PDF. `nombre` y `cuil` pueden faltar. */
export interface PdfLeido {
  archivo: string
  base: string
  legajo: number | null
  nombre?: string | null
  cuil?: string | null
}

export type MotivoProblema =
  | 'base_desconocida'
  | 'sin_legajo'
  | 'legajo_desconocido'
  | 'ambiguo'
  | 'cuil_no_coincide'
  | 'nombre_no_coincide'
  | 'empleado_sin_cuil'
  | 'empleado_sin_mail'

export const TEXTO_PROBLEMA: Record<MotivoProblema, string> = {
  base_desconocida: 'El PDF no salió de una carpeta conocida.',
  sin_legajo: 'No se pudo leer el número de legajo en el archivo.',
  legajo_desconocido: 'No hay nadie con ese legajo en esa empresa.',
  ambiguo: 'Hay más de una persona con ese legajo.',
  cuil_no_coincide: 'El CUIL del PDF no es el de la persona de ese legajo.',
  nombre_no_coincide: 'El nombre del PDF no es el de la persona de ese legajo.',
  empleado_sin_cuil: 'La persona no tiene CUIL cargado y no podría confirmar su identidad.',
  empleado_sin_mail: 'La persona no tiene mail cargado.',
}

export interface Asignado { pdf: PdfLeido; empleado: EmpleadoPadron }
export interface Problema { pdf: PdfLeido; motivo: MotivoProblema; empleado?: EmpleadoPadron }
export type Resolucion =
  | { ok: true; empleado: EmpleadoPadron }
  | { ok: false; motivo: MotivoProblema; empleado?: EmpleadoPadron }

/** Palabras del nombre, comparables: sin acentos, sin signos, sin "de"/"la". */
function palabras(nombre: string | null | undefined): string[] {
  return (nombre ?? '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toUpperCase().replace(/[^A-Z ]+/g, ' ')
    .split(/\s+/)
    .filter((p) => p.length > 2)
}

/**
 * ¿Los dos nombres son de la misma persona?
 *
 * Se piden DOS palabras en común (apellido y nombre de pila) justamente para
 * que dos hermanos no se confundan: dos personas con el mismo apellido y
 * distinto nombre de pila tienen que dar distinto.
 */
export function mismaPersona(a: string | null | undefined, b: string | null | undefined): boolean {
  const pa = palabras(a)
  const pb = palabras(b)
  if (!pa.length || !pb.length) return false
  const comunes = new Set(pa.filter((p) => pb.includes(p))).size
  return comunes >= Math.min(2, pa.length, pb.length)
}

/** "APELLIDO NOMBRE", como lo imprime la liquidación. */
export function nombreCompleto(e: Pick<EmpleadoPadron, 'nombre' | 'apellido'>): string {
  return [e.apellido, e.nombre].filter(Boolean).join(' ').trim()
}

/**
 * De quién es este PDF.
 *
 * Que la persona esté dada de baja NO es un problema: la liquidación final es
 * justo el caso de alguien que ya no trabaja, y también la tiene que firmar
 * (decisión de Agustín, 04/11/2026).
 */
export function resolverDestino(pdf: PdfLeido, padron: readonly EmpleadoPadron[]): Resolucion {
  if (!esBaseConocida(pdf.base)) return { ok: false, motivo: 'base_desconocida' }
  if (pdf.legajo == null) return { ok: false, motivo: 'sin_legajo' }

  const candidatos = padron.filter((e) => e.base_sueldos === pdf.base && e.legajo === pdf.legajo)
  if (candidatos.length === 0) return { ok: false, motivo: 'legajo_desconocido' }
  // La base lo impide con un índice único, pero si alguna vez entra por otro
  // lado, acá se corta en vez de elegir uno al azar.
  if (candidatos.length > 1) return { ok: false, motivo: 'ambiguo' }

  const empleado = candidatos[0]

  // El CUIL es la verificación fuerte: no se repite y no depende de cómo esté
  // escrito el nombre.
  const cuilPdf = soloDigitos(pdf.cuil)
  if (cuilPdf.length === 11 && cuilPdf !== soloDigitos(empleado.cuil)) {
    return { ok: false, motivo: 'cuil_no_coincide', empleado }
  }
  if (pdf.nombre && !mismaPersona(pdf.nombre, nombreCompleto(empleado))) {
    return { ok: false, motivo: 'nombre_no_coincide', empleado }
  }

  // Sin CUIL no puede confirmar su identidad en la pantalla; sin mail no hay
  // a dónde mandarle el link.
  if (soloDigitos(empleado.cuil).length !== 11) return { ok: false, motivo: 'empleado_sin_cuil', empleado }
  if (!empleado.email) return { ok: false, motivo: 'empleado_sin_mail', empleado }

  return { ok: true, empleado }
}

/**
 * Motivos que no son "este archivo tiene algo raro" sino "el lote entero está
 * mal armado": si aparecen, lo más probable es que las carpetas se hayan
 * mezclado y los que SÍ resolvieron también estén mal.
 */
const MOTIVOS_QUE_CORTAN: readonly MotivoProblema[] = ['cuil_no_coincide', 'ambiguo']

/** Nombres distintos tolerados antes de sospechar que se mezclaron las carpetas. */
export function topeNombresDistintos(total: number): number {
  return Math.max(3, Math.ceil(total * 0.1))
}

export interface RevisionLote {
  asignados: Asignado[]
  problemas: Problema[]
  /** Si es false, no se manda NINGÚN mail de este lote. */
  puedeEnviar: boolean
  motivoCorte: string | null
}

/**
 * Revisa un lote completo antes de mandar nada.
 *
 * Un PDF con problema nunca se manda — eso ya protege a esa persona. El corte
 * del lote entero existe para otra cosa: para cuando el patrón de errores dice
 * que la asignación está sistemáticamente mal y los que "funcionaron" también
 * son sospechosos. Un archivo suelto que no se pudo leer no justifica dejar a
 * las otras 92 personas sin su recibo.
 */
export function revisarLote(pdfs: readonly PdfLeido[], padron: readonly EmpleadoPadron[]): RevisionLote {
  const asignados: Asignado[] = []
  const problemas: Problema[] = []

  for (const pdf of pdfs) {
    const r = resolverDestino(pdf, padron)
    if (r.ok) asignados.push({ pdf, empleado: r.empleado })
    else problemas.push({ pdf, motivo: r.motivo, empleado: r.empleado })
  }

  const grave = problemas.find((p) => MOTIVOS_QUE_CORTAN.includes(p.motivo))
  if (grave) {
    return { asignados, problemas, puedeEnviar: false, motivoCorte: TEXTO_PROBLEMA[grave.motivo] }
  }

  const distintos = problemas.filter((p) => p.motivo === 'nombre_no_coincide').length
  const tope = topeNombresDistintos(pdfs.length)
  if (distintos >= tope) {
    return {
      asignados,
      problemas,
      puedeEnviar: false,
      motivoCorte: `${distintos} archivos tienen un nombre que no coincide con su legajo. Puede que se hayan mezclado las carpetas.`,
    }
  }

  return { asignados, problemas, puedeEnviar: true, motivoCorte: null }
}

/**
 * Los PDF que le tocan a cada persona, para armar UN mail por persona con
 * todos sus documentos adentro.
 */
export function agruparPorEmpleado(
  asignados: readonly Asignado[]
): { empleado: EmpleadoPadron; pdfs: PdfLeido[] }[] {
  const porId = new Map<string, { empleado: EmpleadoPadron; pdfs: PdfLeido[] }>()
  for (const a of asignados) {
    const actual = porId.get(a.empleado.id)
    if (actual) actual.pdfs.push(a.pdf)
    else porId.set(a.empleado.id, { empleado: a.empleado, pdfs: [a.pdf] })
  }
  return [...porId.values()]
}
