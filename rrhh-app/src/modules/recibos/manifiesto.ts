// ============================================================
// El manifiesto que manda el lector del NAS: qué liquidaciones encontró.
// Puro, sin I/O, con tests.
//
// Esto es ENTRADA NO CONFIABLE aunque venga con el token: un error del lector,
// una carpeta mal armada o una corrida a medias llegan por acá. Así que se
// valida todo y después Gestión vuelve a decidir por su cuenta de quién es
// cada cosa — el lector no asigna nada, solo cuenta lo que vio.
// ============================================================
import { baseDeCarpeta, esBaseConocida, periodoDeCarpeta, type Hoja } from './lote'

/** Topes para no quedar a merced de lo que mande el otro lado. */
export const LIMITES = {
  archivos: 3000,
  personasPorArchivo: 500,
  texto: 300,
} as const

export interface PersonaManifiesto {
  legajo: number | null
  recibo?: string | null
  cuil?: string | null
  nombre?: string | null
  concepto?: string | null
  paginas?: number[]
  huella?: string | null
}

export interface ArchivoManifiesto {
  corrida: string
  archivo: string
  sha256?: string | null
  origen_at?: string | null
  hojas?: number
  personas: PersonaManifiesto[]
}

export interface Manifiesto {
  base: string
  mes: string
  archivos: ArchivoManifiesto[]
}

export type MotivoArchivo =
  | 'sin_datos'
  | 'varias_personas'
  | 'varias_liquidaciones'
  | 'sin_legajo'
  | 'sin_numero_de_recibo'
  | 'sin_huella'

export const TEXTO_ARCHIVO: Record<MotivoArchivo, string> = {
  sin_datos: 'No se le pudo leer ningún recibo.',
  varias_personas: 'Tiene liquidaciones de más de una persona.',
  varias_liquidaciones: 'Tiene más de una liquidación de la misma persona.',
  sin_legajo: 'No se le pudo leer el número de legajo.',
  sin_numero_de_recibo: 'No se le pudo leer el número de recibo.',
  sin_huella: 'No trae la huella del archivo.',
}

export interface ArchivoRechazado {
  corrida: string
  archivo: string
  motivo: MotivoArchivo
  /** Cuántas personas distintas tenía, cuando es lo que importa. */
  personas?: number
}

function texto(v: unknown, max: number = LIMITES.texto): string | null {
  if (typeof v !== 'string') return null
  const t = v.trim()
  return t ? t.slice(0, max) : null
}

function entero(v: unknown): number | null {
  if (typeof v === 'number' && Number.isInteger(v) && v > 0 && v < 1_000_000) return v
  if (typeof v === 'string' && /^\d{1,6}$/.test(v.trim())) {
    const n = Number(v.trim())
    return n > 0 ? n : null
  }
  return null
}

export type Validacion =
  | { ok: true; manifiesto: Manifiesto }
  | { ok: false; error: string }

/**
 * ¿El cuerpo que llegó es un manifiesto que se pueda usar?
 *
 * Se rechaza entero y temprano: a medio procesar no se sabe si falta la mitad
 * de la gente o si el lector se cortó, y en ese caso mandar los mails de los
 * que sí llegaron dejaría a los otros esperando sin que nadie se entere.
 */
export function validarManifiesto(cuerpo: unknown): Validacion {
  if (!cuerpo || typeof cuerpo !== 'object') return { ok: false, error: 'Cuerpo vacío o mal formado.' }
  const c = cuerpo as Record<string, unknown>

  // La base puede venir como base ('1') o como la carpeta del NAS.
  const base = texto(c.base) ?? ''
  const resuelta = esBaseConocida(base) ? base : baseDeCarpeta(base)
  if (!resuelta) return { ok: false, error: `No conozco la empresa "${base.slice(0, 40)}".` }

  const mes = texto(c.mes) ?? ''
  if (!/^\d{6}$/.test(mes) || !periodoDeCarpeta(`${mes}01`)) {
    return { ok: false, error: 'El mes va como YYYYMM.' }
  }

  if (!Array.isArray(c.archivos)) return { ok: false, error: 'Falta la lista de archivos.' }
  if (c.archivos.length > LIMITES.archivos) {
    return { ok: false, error: `Son demasiados archivos (máximo ${LIMITES.archivos}).` }
  }

  const archivos: ArchivoManifiesto[] = []
  for (const bruto of c.archivos) {
    if (!bruto || typeof bruto !== 'object') return { ok: false, error: 'Hay un archivo mal formado.' }
    const a = bruto as Record<string, unknown>
    const archivo = texto(a.archivo)
    const corrida = texto(a.corrida)
    if (!archivo || !corrida) return { ok: false, error: 'Hay un archivo sin nombre o sin corrida.' }
    // La corrida tiene que ser de ESTE mes: si no, el período que se guardaría
    // no sería el que dice la carpeta.
    if (!corrida.startsWith(mes) || !periodoDeCarpeta(corrida)) {
      return { ok: false, error: `La corrida "${corrida.slice(0, 20)}" no es del mes ${mes}.` }
    }
    if (!Array.isArray(a.personas) || a.personas.length > LIMITES.personasPorArchivo) {
      return { ok: false, error: `El archivo "${archivo}" trae una lista de personas inválida.` }
    }

    const sha = texto(a.sha256, 64)
    archivos.push({
      corrida,
      archivo,
      sha256: sha && /^[0-9a-f]{64}$/i.test(sha) ? sha.toLowerCase() : null,
      origen_at: texto(a.origen_at, 40),
      hojas: entero(a.hojas) ?? undefined,
      personas: (a.personas as unknown[]).map((p) => {
        const q = (p && typeof p === 'object' ? p : {}) as Record<string, unknown>
        return {
          legajo: entero(q.legajo),
          recibo: texto(q.recibo, 40),
          cuil: (texto(q.cuil, 20) ?? '').replace(/\D/g, '') || null,
          nombre: texto(q.nombre),
          concepto: texto(q.concepto),
          huella: texto(q.huella, 80),
        }
      }),
    })
  }

  return { ok: true, manifiesto: { base: resuelta, mes, archivos } }
}

export interface LecturaDelManifiesto {
  hojas: Hoja[]
  rechazados: ArchivoRechazado[]
}

/**
 * Qué archivos se pueden usar y cuáles no.
 *
 * ★ Acá se aplica la regla "un archivo = una liquidación", y se aplica del
 * lado del servidor aunque el lector ya la haya mirado: la marca que trae el
 * manifiesto es informativa, la que vale es esta.
 *
 * Un archivo con varias personas se RECHAZA, no se parte y no corta el lote.
 * No se parte porque armarle el recibo a alguien recortando hojas de otro es
 * justo lo que no queremos hacer nunca. Y no corta el lote porque, como no se
 * usa, no pone en riesgo a nadie: durante la transición al formato nuevo va a
 * quedar el archivo viejo de lote conviviendo con los individuales, y cortar
 * ahí dejaría sin recibo a gente que lo tiene perfectamente.
 *
 * Lo que sí se ve es en `faltantes`: si alguien quedó solo dentro del archivo
 * rechazado, aparece como que no tiene recibo.
 */
export function leerManifiesto(m: Manifiesto): LecturaDelManifiesto {
  const periodo = `${m.mes.slice(0, 4)}-${m.mes.slice(4, 6)}-01`
  const hojas: Hoja[] = []
  const rechazados: ArchivoRechazado[] = []

  for (const a of m.archivos) {
    const conLegajo = a.personas.filter((p) => p.legajo != null)
    const legajos = new Set(conLegajo.map((p) => p.legajo as number))

    let motivo: MotivoArchivo | null = null
    if (!a.personas.length) motivo = 'sin_datos'
    else if (legajos.size > 1) motivo = 'varias_personas'
    else if (!legajos.size) motivo = 'sin_legajo'
    else if (a.personas.length > 1) motivo = 'varias_liquidaciones'
    else if (!a.personas[0].recibo) motivo = 'sin_numero_de_recibo'
    // Sin huella no hay forma de reconocer que el mismo recibo ya está
    // cargado, y volver a correr el proceso duplicaría todo.
    else if (!a.sha256) motivo = 'sin_huella'

    if (motivo) {
      rechazados.push({ corrida: a.corrida, archivo: a.archivo, motivo, personas: legajos.size })
      continue
    }

    const p = a.personas[0]
    hojas.push({
      // ★ La ruta relativa, no el nombre pelado. En un mes puede haber varias
      // corridas y el nombre del archivo individual se repite entre ellas
      // (lleva el legajo y la fecha del período, que son los mismos). Con el
      // nombre solo, dos archivos distintos se pisarían y el lector no sabría
      // de qué carpeta sacar el PDF.
      archivo: `${a.corrida}/${a.archivo}`,
      pagina: 1,
      base: m.base,
      periodo,
      legajo: p.legajo,
      recibo: p.recibo,
      cuil: p.cuil,
      nombre: p.nombre,
      concepto: p.concepto,
      // El texto, no los bytes: ver el comentario de Hoja.huella.
      huella: p.huella,
      sha256: a.sha256,
    })
  }

  return { hojas, rechazados }
}

/**
 * La fecha de cada archivo, para desempatar correcciones.
 *
 * La clave es la ruta relativa `corrida/archivo`, la misma que lleva la hoja:
 * el nombre pelado se repite entre corridas del mismo mes.
 */
export function fechasPorArchivo(m: Manifiesto): Map<string, string | null> {
  const mapa = new Map<string, string | null>()
  for (const a of m.archivos) mapa.set(`${a.corrida}/${a.archivo}`, a.origen_at ?? null)
  return mapa
}
