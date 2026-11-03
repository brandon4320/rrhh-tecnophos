// ============================================================
// Reglas del link de firma de recibos de sueldo. Puras, sin I/O, con tests.
//
// Es la única puerta del sistema que se abre SIN login, así que todo lo que
// decide si alguien entra o no vive acá y se prueba acá.
// ============================================================

/** Días que vale un link desde que se manda. */
export const DIAS_VIGENCIA = 30

/**
 * Intentos de los últimos 4 del CUIL antes de bloquear.
 * Son 10.000 combinaciones: sin un tope se prueban en minutos.
 */
export const INTENTOS_MAX = 5

/** Cuánto dura el bloqueo después de agotar los intentos. */
export const BLOQUEO_MINUTOS = 60

/**
 * Un solo mensaje para "no existe", "venció" y "lo revocaron".
 * Si cada caso dijera algo distinto, se podría averiguar qué tokens existen.
 */
export const MENSAJE_LINK_INVALIDO =
  'Este link no es válido o ya venció. Pedile uno nuevo a administración.'

export const MENSAJE_CUIL_INCORRECTO = 'Los números no coinciden. Fijate en tu CUIL e intentá de nuevo.'

export const MENSAJE_BLOQUEADO =
  'Por seguridad quedó bloqueado un rato por varios intentos fallidos. Probá más tarde.'

export type EstadoToken = 'vigente' | 'invalido' | 'bloqueado'

export interface TokenFila {
  vence_at: string
  revocado: boolean
  bloqueado_hasta: string | null
  intentos: number
}

/**
 * Qué se puede hacer con este link ahora mismo.
 *
 * `invalido` junta vencido y revocado a propósito: hacia afuera son lo mismo
 * (ver MENSAJE_LINK_INVALIDO). El bloqueo se distingue porque quien lo disparó
 * ya sabe que el link existe, y decirle "probá más tarde" evita que siga
 * golpeando.
 */
export function estadoToken(fila: TokenFila, ahora: Date = new Date()): EstadoToken {
  if (fila.revocado) return 'invalido'
  if (new Date(fila.vence_at).getTime() <= ahora.getTime()) return 'invalido'
  if (fila.bloqueado_hasta && new Date(fila.bloqueado_hasta).getTime() > ahora.getTime()) return 'bloqueado'
  return 'vigente'
}

/** Solo los dígitos: el CUIL se guarda así y así se compara. */
export function soloDigitos(v: string | null | undefined): string {
  return (v ?? '').replace(/\D/g, '')
}

/**
 * ¿Los 4 números que escribió coinciden con el final de su CUIL?
 *
 * Se compara contra los últimos 4 del CUIL completo, no contra el "número" del
 * medio: es lo que la persona ve en su recibo y en su DNI.
 */
export function coincideUltimos4(cuil: string | null | undefined, escrito: string): boolean {
  const c = soloDigitos(cuil)
  const e = soloDigitos(escrito)
  if (c.length !== 11 || e.length !== 4) return false
  return c.slice(-4) === e
}

export interface ResultadoIntento {
  ok: boolean
  intentos: number
  /** Si quedó bloqueado, hasta cuándo. */
  bloqueadoHasta: Date | null
  mensaje: string | null
}

/**
 * Qué pasa después de un intento. Devuelve el estado nuevo del token para que
 * el server lo guarde; no toca la base.
 *
 * Un acierto REINICIA el contador: si no, alguien que se equivoca cuatro veces
 * a lo largo del mes queda a un error de perder el acceso a su propio recibo.
 */
export function evaluarIntento(
  acierto: boolean,
  intentosPrevios: number,
  ahora: Date = new Date()
): ResultadoIntento {
  if (acierto) return { ok: true, intentos: 0, bloqueadoHasta: null, mensaje: null }

  const intentos = intentosPrevios + 1
  if (intentos >= INTENTOS_MAX) {
    return {
      ok: false,
      intentos,
      bloqueadoHasta: new Date(ahora.getTime() + BLOQUEO_MINUTOS * 60_000),
      mensaje: MENSAJE_BLOQUEADO,
    }
  }
  return { ok: false, intentos, bloqueadoHasta: null, mensaje: MENSAJE_CUIL_INCORRECTO }
}

/** Cuándo vence un link que se manda ahora. */
export function vencimientoDesde(ahora: Date = new Date()): Date {
  return new Date(ahora.getTime() + DIAS_VIGENCIA * 24 * 60 * 60 * 1000)
}

/**
 * ¿Entra hoy en la ventana de envío del aviso mensual? (del 2 al 5)
 *
 * El día se decide en hora ARGENTINA: a las 21:00 de acá ya es el día
 * siguiente en UTC y la ventana se correría de lugar (AGENTS.md §9).
 */
export const VENTANA_ENVIO = { desde: 2, hasta: 5 } as const

export function enVentanaDeEnvio(diaDelMes: number): boolean {
  return diaDelMes >= VENTANA_ENVIO.desde && diaDelMes <= VENTANA_ENVIO.hasta
}

/** Rótulo de cada tipo de recibo, para el mail y la pantalla. */
export const TIPO_RECIBO_LABEL: Record<string, string> = {
  mensual: 'Sueldo mensual',
  sac: 'Aguinaldo',
  liquidacion_final: 'Liquidación final',
  otro: 'Otro',
}

export function rotuloTipo(tipo: string): string {
  return TIPO_RECIBO_LABEL[tipo] ?? tipo
}

/** "Octubre 2026" a partir del período (primer día del mes). */
export function rotuloPeriodo(periodo: string): string {
  const d = new Date(`${periodo.slice(0, 10)}T12:00:00`)
  const m = d.toLocaleDateString('es-AR', { month: 'long', timeZone: 'America/Argentina/Buenos_Aires' })
  return `${m.charAt(0).toUpperCase()}${m.slice(1)} ${d.getFullYear()}`
}

/**
 * El primer nombre, con mayuscula solo al principio: "LUCIANA MARILIN" -> "Luciana".
 *
 * En Gestion los nombres se guardan en MAYUSCULAS porque asi los lleva la
 * oficina, pero esta pantalla la ve el empleado y "Hola LUCIANA MARILIN" grita.
 */
export function nombreDePila(nombre: string | null | undefined): string {
  const primero = (nombre ?? '').trim().split(/\s+/)[0] ?? ''
  if (!primero) return ''
  return primero.charAt(0).toUpperCase() + primero.slice(1).toLowerCase()
}
