// ============================================================
// A quién pertenece cada liquidación. Puro, sin I/O, con tests.
//
// Es la decisión más peligrosa de todo el circuito: si una liquidación se le
// asigna a la persona equivocada, esa persona ve el sueldo de otro y no hay
// forma de deshacerlo una vez que salió el mail.
//
// ────────────────────────────────────────────────────────────
// ★ UN ARCHIVO = UNA LIQUIDACIÓN. Y SI NO LO ES, NO SE MANDA.
//
// Decisión de Agustín (04/11/2026): quien liquida va a exportar un PDF por
// liquidación, así que este sistema NO parte archivos ni arma el recibo de
// nadie recortando hojas de otro. Toma un documento, ve de quién es y le manda
// el link a esa persona.
//
// Pero esa decisión vive FUERA de acá —es una configuración del sistema de
// sueldos— y lo que había en el NAS ese mismo día era lo contrario: la
// liquidación de octubre de ADC eran 44 personas en UN SOLO archivo de 44
// hojas, y el legajo del nombre del archivo no coincidía con el contenido en
// 45 de 45 casos.
//
// Así que la verificación se queda, no como partidor sino como ALARMA: un
// archivo con más de una persona se rechaza y se avisa. El día que esa
// configuración cambie o una corrida salga mal, el costo sería mandarle a cada
// uno el sueldo de los demás, y eso no se deshace.
// ────────────────────────────────────────────────────────────
//
// La identidad es el par (base de liquidación, legajo), NUNCA el legajo solo:
// en Jaque el legajo 1 de ADC y el legajo 1 de Tecnophos son dos personas
// distintas. La base sale de la carpeta de empresa; el legajo, de adentro de la
// hoja.
//
// Como la carpeta es un dato frágil —alcanza con mover un archivo para que todo
// el lote se resuelva mal pero sin un solo error visible— cada documento se
// verifica además contra el nombre y el CUIL impresos, que también salen de
// adentro.
// ============================================================
import { soloDigitos } from './reglas'

/**
 * Las bases de Jaque, su carpeta en el NAS y qué empresas de Gestión cubren.
 *
 * Una base NO es una empresa: Tecnophos liquida las tres sedes con un solo
 * juego de legajos. Espejo de BASES en la herramienta de emparejamiento.
 */
export const BASES_SUELDOS: Record<
  string,
  { etiqueta: string; carpeta: string; empresas: readonly string[] }
> = {
  '1': {
    etiqueta: 'Tecnophos',
    carpeta: 'TECNOPHOS_SERVICES_SA',
    empresas: ['tecnophos-bb', 'tecnophos-rosario', 'tecnophos-necochea'],
  },
  '3-ADC': {
    etiqueta: 'ADC S.R.L',
    carpeta: 'ADC_SRL',
    empresas: ['adc'],
  },
}

export function esBaseConocida(base: string | null | undefined): boolean {
  return !!base && Object.prototype.hasOwnProperty.call(BASES_SUELDOS, base)
}

/**
 * De qué base es una carpeta del NAS. Una carpeta que no está en la lista
 * devuelve null y sus PDF no se tocan: nunca se adivina.
 */
export function baseDeCarpeta(carpeta: string | null | undefined): string | null {
  const limpia = (carpeta ?? '').trim().toUpperCase()
  const par = Object.entries(BASES_SUELDOS).find(([, b]) => b.carpeta === limpia)
  return par ? par[0] : null
}

/**
 * El período que representa una carpeta de liquidación: "20261001" es la
 * primera corrida de octubre de 2026.
 *
 * El número del final es el ORDEN de la corrida dentro del mes, no el tipo:
 * en agosto de 2026 la corrida 01 de Tecnophos tenía 3 personas y la 02 tenía
 * 51. O sea que la liquidación general no siempre es la 01 y hay que mirar
 * TODAS las carpetas del mes.
 */
export function periodoDeCarpeta(carpeta: string | null | undefined): string | null {
  const m = /^(\d{4})(\d{2})(\d{2})$/.exec((carpeta ?? '').trim())
  if (!m) return null
  const anio = Number(m[1])
  const mes = Number(m[2])
  if (anio < 2000 || anio > 2100 || mes < 1 || mes > 12) return null
  return `${m[1]}-${m[2]}-01`
}

/**
 * Qué clase de liquidación es, según lo que dice el recibo en "Período
 * Abonado".
 *
 * Es texto que ESCRIBE A MANO quien liquida, con todo lo que eso implica: en
 * los recibos reales conviven "OCTUBRE 2026", "SEPTIMEBRE 2026" (sí, con el
 * error de tipeo, 45 hojas), "nov", "LIQ FINAL SEPTIEMBRE" y "AJUSTE AGOSTO".
 * Por eso el mes se reconoce por sus TRES primeras letras: un mes mal escrito
 * no puede convertir un sueldo en "Otro".
 *
 * El orden importa: "LIQ FINAL SEPTIEMBRE" también contiene un mes.
 */
const MESES_CORTOS = /\b(ENE|FEB|MAR|ABR|MAY|JUN|JUL|AGO|SEP|SET|OCT|NOV|DIC)/

export function tipoDeConcepto(concepto: string | null | undefined): string {
  const t = (concepto ?? '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toUpperCase()
  if (/LIQ\w*\s+FINAL|FINAL\w*\s+LIQ/.test(t)) return 'liquidacion_final'
  if (/\bSAC\b|AGUINALDO/.test(t)) return 'sac'
  if (/AJUSTE|VACACIONES|PREMIO|GRATIFICACION/.test(t)) return 'otro'
  if (MESES_CORTOS.test(t)) return 'mensual'
  return 'otro'
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

/** Una hoja suelta de un PDF del NAS, ya leída. */
export interface Hoja {
  archivo: string
  /** Número de hoja dentro de ese PDF, desde 1. */
  pagina: number
  base: string
  periodo: string
  legajo: number | null
  /** Número de recibo impreso. Junto con el legajo identifica la liquidación. */
  recibo?: string | null
  cuil?: string | null
  nombre?: string | null
  concepto?: string | null
  /** Huella del texto de la hoja, para reconocer copias idénticas. */
  huella?: string | null
}

/**
 * Una liquidación: todas las hojas con el mismo legajo y número de recibo.
 *
 * ★ Una misma liquidación aparece VARIAS VECES en el NAS. En octubre de 2026
 * Tecnophos tenía 54 recibos en 57 archivos y 108 hojas: cada recibo estaba
 * una vez en su archivo individual y otra vez adentro de un archivo por lotes,
 * con el texto exactamente igual. No son original y duplicado: es el mismo
 * papel exportado dos veces. Por eso las copias se descartan y queda UNA.
 *
 * Con un PDF por liquidación esto queda casi siempre en una sola hoja, pero la
 * deduplicación sigue haciendo falta: alcanza con que alguien vuelva a correr
 * la exportación de un mes para que aparezcan de nuevo los mismos recibos.
 */
export interface DocumentoLeido {
  /** Todas las copias encontradas de esta liquidación. */
  hojas: Hoja[]
  base: string
  /** Período de la carpeta, 'YYYY-MM-01'. */
  periodo: string
  legajo: number | null
  cuil?: string | null
  nombre?: string | null
  /** Número de recibo impreso; junto con el legajo identifica al documento. */
  recibo?: string | null
  /** Lo que dice "Período Abonado": OCTUBRE 2026, LIQ FINAL AGOSTO 2026, AJUSTE… */
  concepto?: string | null
  /** Legajos distintos encontrados en sus hojas. Más de uno = mal cortado. */
  legajosEnLasHojas?: number[]
  /** Las copias traían textos distintos: no son la misma liquidación. */
  copiasDistintas?: boolean
}

/**
 * Junta las hojas sueltas en liquidaciones, descartando las copias.
 *
 * La clave es (base, legajo, número de recibo): dos hojas con eso igual son el
 * mismo papel, aunque estén en archivos distintos — que es exactamente lo que
 * pasa en Tecnophos. Si las copias NO tienen el mismo texto, algo anda mal y
 * el documento queda marcado en vez de elegir una al azar.
 *
 * Las hojas sin legajo o sin número de recibo quedan cada una por su cuenta:
 * sin clave no se pueden agrupar, y juntarlas sería mezclar gente.
 */
export function armarDocumentos(hojas: readonly Hoja[]): DocumentoLeido[] {
  const porClave = new Map<string, DocumentoLeido>()
  const sueltas: DocumentoLeido[] = []

  const nuevo = (h: Hoja): DocumentoLeido => ({
    hojas: [h], base: h.base, periodo: h.periodo, legajo: h.legajo,
    cuil: h.cuil, nombre: h.nombre, recibo: h.recibo, concepto: h.concepto,
    legajosEnLasHojas: h.legajo == null ? [] : [h.legajo],
  })

  for (const h of hojas) {
    const recibo = (h.recibo ?? '').trim()
    if (h.legajo == null || !recibo) {
      sueltas.push(nuevo(h))
      continue
    }
    const clave = `${h.base}|${h.legajo}|${recibo}`
    const actual = porClave.get(clave)
    if (!actual) {
      porClave.set(clave, nuevo(h))
      continue
    }
    actual.hojas.push(h)
    // Dos copias del mismo recibo tienen que decir lo mismo.
    const huellas = new Set(actual.hojas.map((x) => x.huella ?? '').filter(Boolean))
    if (huellas.size > 1) actual.copiasDistintas = true
  }

  return [...porClave.values(), ...sueltas]
}

export type MotivoProblema =
  | 'base_desconocida'
  | 'sin_legajo'
  | 'sin_hojas'
  | 'varias_personas'
  | 'copias_distintas'
  | 'legajo_desconocido'
  | 'ambiguo'
  | 'cuil_no_coincide'
  | 'nombre_no_coincide'
  | 'empleado_sin_cuil'
  | 'empleado_sin_mail'

export const TEXTO_PROBLEMA: Record<MotivoProblema, string> = {
  base_desconocida: 'El PDF no salió de una carpeta de empresa conocida.',
  sin_legajo: 'No se pudo leer el número de legajo en la hoja.',
  sin_hojas: 'El documento quedó sin ninguna hoja.',
  varias_personas: 'El documento tiene hojas de más de una persona.',
  copias_distintas: 'El mismo recibo aparece repetido con contenido distinto.',
  legajo_desconocido: 'No hay nadie con ese legajo en esa empresa.',
  ambiguo: 'Hay más de una persona con ese legajo.',
  cuil_no_coincide: 'El CUIL del recibo no es el de la persona de ese legajo.',
  nombre_no_coincide: 'El nombre del recibo no es el de la persona de ese legajo.',
  empleado_sin_cuil: 'La persona no tiene CUIL cargado y no podría confirmar su identidad.',
  empleado_sin_mail: 'La persona no tiene mail cargado.',
}

export interface Asignado {
  documento: DocumentoLeido
  empleado: EmpleadoPadron
  /** El CUIL confirmó quién es, pero el nombre está escrito distinto. */
  nombreDistinto?: boolean
}
export interface Problema { documento: DocumentoLeido; motivo: MotivoProblema; empleado?: EmpleadoPadron }
export type Resolucion =
  | { ok: true; empleado: EmpleadoPadron; nombreDistinto?: boolean }
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
 * De quién es esta liquidación.
 *
 * Que la persona esté dada de baja NO es un problema: la liquidación final es
 * justo el caso de alguien que ya no trabaja, y también la tiene que firmar
 * (decisión de Agustín, 04/11/2026).
 */
export function resolverDestino(doc: DocumentoLeido, padron: readonly EmpleadoPadron[]): Resolucion {
  if (!esBaseConocida(doc.base)) return { ok: false, motivo: 'base_desconocida' }
  if (!doc.hojas?.length) return { ok: false, motivo: 'sin_hojas' }

  // ★ Si el corte dejó hojas de dos personas en el mismo documento, no se
  // manda: es exactamente la filtración que todo esto trata de evitar.
  const enLasHojas = new Set(doc.legajosEnLasHojas ?? [])
  if (doc.legajo != null) enLasHojas.add(doc.legajo)
  if (enLasHojas.size > 1) return { ok: false, motivo: 'varias_personas' }

  // Dos copias del mismo recibo que dicen cosas distintas: no se elige una.
  if (doc.copiasDistintas) return { ok: false, motivo: 'copias_distintas' }

  if (doc.legajo == null) return { ok: false, motivo: 'sin_legajo' }

  const candidatos = padron.filter((e) => e.base_sueldos === doc.base && e.legajo === doc.legajo)
  if (candidatos.length === 0) return { ok: false, motivo: 'legajo_desconocido' }
  // La base lo impide con un índice único, pero si alguna vez entra por otro
  // lado, acá se corta en vez de elegir uno al azar.
  if (candidatos.length > 1) return { ok: false, motivo: 'ambiguo' }

  const empleado = candidatos[0]
  const cuilEmpleado = soloDigitos(empleado.cuil)

  // ★ Esto va ANTES de comparar los CUIL. Si no, a una persona sin CUIL
  // cargado el recibo le daría "el CUIL no coincide" —comparar contra vacío
  // siempre da distinto— y ese motivo frena el lote ENTERO por una alarma de
  // carpetas mezcladas que no existe. Que falte un dato en Gestión es un
  // problema de ese documento, no del lote.
  if (cuilEmpleado.length !== 11) return { ok: false, motivo: 'empleado_sin_cuil', empleado }

  // El CUIL es la verificación fuerte: no se repite y no depende de cómo esté
  // escrito el nombre.
  const cuilLeido = soloDigitos(doc.cuil)
  const cuilConfirma = cuilLeido.length === 11 && cuilLeido === cuilEmpleado
  if (cuilLeido.length === 11 && !cuilConfirma) {
    return { ok: false, motivo: 'cuil_no_coincide', empleado }
  }

  // ★ El nombre es la verificación de RESPALDO, no una segunda barrera.
  //
  // Si el CUIL ya confirmó quién es, el nombre escrito distinto no prueba
  // nada en contra: pasa todo el tiempo —apellido de casada, un segundo
  // nombre que figura en un lado y no en el otro, una letra cambiada— y
  // frenar por eso deja a una persona sin su recibo a cambio de nada. Se
  // anota para que la oficina corrija el dato, y sigue.
  //
  // Esto apareció corriendo octubre de verdad: un recibo con el nombre
  // escrito distinto y el CUIL correcto quedaba retenido sin motivo.
  const nombreDistinto = !!doc.nombre && !mismaPersona(doc.nombre, nombreCompleto(empleado))
  if (nombreDistinto && !cuilConfirma) {
    return { ok: false, motivo: 'nombre_no_coincide', empleado }
  }

  // Sin mail no hay a dónde mandarle el link.
  if (!empleado.email) return { ok: false, motivo: 'empleado_sin_mail', empleado }

  return nombreDistinto ? { ok: true, empleado, nombreDistinto } : { ok: true, empleado }
}

/**
 * Motivos que no son "este documento tiene algo raro" sino "el lote entero
 * está mal armado": si aparecen, lo más probable es que las carpetas se hayan
 * mezclado o que el corte por hojas esté fallando, y los que SÍ resolvieron
 * también son sospechosos.
 */
const MOTIVOS_QUE_CORTAN: readonly MotivoProblema[] = [
  'cuil_no_coincide', 'ambiguo', 'varias_personas', 'copias_distintas',
]

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
 * Un documento con problema nunca se manda — eso ya protege a esa persona. El
 * corte del lote entero existe para otra cosa: para cuando el patrón de
 * errores dice que la asignación está sistemáticamente mal y los que
 * "funcionaron" también son sospechosos. Un documento suelto que no se pudo
 * leer no justifica dejar a las otras 92 personas sin su recibo.
 */
export function revisarLote(
  documentos: readonly DocumentoLeido[],
  padron: readonly EmpleadoPadron[]
): RevisionLote {
  const asignados: Asignado[] = []
  const problemas: Problema[] = []

  for (const documento of documentos) {
    const r = resolverDestino(documento, padron)
    if (r.ok) asignados.push({ documento, empleado: r.empleado, nombreDistinto: r.nombreDistinto })
    else problemas.push({ documento, motivo: r.motivo, empleado: r.empleado })
  }

  const grave = problemas.find((p) => MOTIVOS_QUE_CORTAN.includes(p.motivo))
  if (grave) {
    return { asignados, problemas, puedeEnviar: false, motivoCorte: TEXTO_PROBLEMA[grave.motivo] }
  }

  const distintos = problemas.filter((p) => p.motivo === 'nombre_no_coincide').length
  if (distintos >= topeNombresDistintos(documentos.length)) {
    return {
      asignados,
      problemas,
      puedeEnviar: false,
      motivoCorte: `${distintos} recibos tienen un nombre que no coincide con su legajo. Puede que se hayan mezclado las carpetas.`,
    }
  }

  return { asignados, problemas, puedeEnviar: true, motivoCorte: null }
}

/**
 * Las liquidaciones que le tocan a cada persona, para armar UN mail por
 * persona con todos sus documentos adentro. Si en el mes le salieron tres,
 * firma tres.
 */
export function agruparPorEmpleado(
  asignados: readonly Asignado[]
): { empleado: EmpleadoPadron; documentos: DocumentoLeido[] }[] {
  const porId = new Map<string, { empleado: EmpleadoPadron; documentos: DocumentoLeido[] }>()
  for (const a of asignados) {
    const actual = porId.get(a.empleado.id)
    if (actual) actual.documentos.push(a.documento)
    else porId.set(a.empleado.id, { empleado: a.empleado, documentos: [a.documento] })
  }
  return [...porId.values()]
}

/**
 * Conciliación: quién de la nómina esperada se quedó sin ninguna liquidación.
 *
 * "No hubo errores" no quiere decir que estén todos — un archivo que nunca se
 * exportó no da ningún error. Esto es lo que convierte el silencio en alarma.
 */
export function faltantes(
  esperados: readonly EmpleadoPadron[],
  asignados: readonly Asignado[]
): EmpleadoPadron[] {
  const con = new Set(asignados.map((a) => a.empleado.id))
  return esperados.filter((e) => !con.has(e.id))
}
