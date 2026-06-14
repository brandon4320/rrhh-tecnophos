// ============================================================
// Reglas de negocio CRÍTICAS del servicio de limpieza (UNIPAR).
// Funciones puras (sin I/O) para poder testearlas. Ver reglas.test.ts
// ============================================================

export type EstadoAsistencia = 'presente' | 'ausente' | 'tarde' | 'reemplazo' | 'no_trabaja'

/** Dotación mínima contractual: 13 operarios. */
export const DOTACION_MINIMA = 13

/** Estados que cuentan como "presente" para la dotación del día. */
const ESTADOS_PRESENTES: EstadoAsistencia[] = ['presente', 'tarde', 'reemplazo']

export function contarPresentes(estados: EstadoAsistencia[]): number {
  return estados.filter((e) => ESTADOS_PRESENTES.includes(e)).length
}

/** Regla: alertar si la dotación presente es menor a la mínima. */
export function dotacionInsuficiente(presentes: number, minima: number = DOTACION_MINIMA): boolean {
  return presentes < minima
}

/** El Taller de Ánodos requiere 2 repasos por día (hasta las 15:00). */
export const REPASOS_TALLER_ANODOS = 2

/** Regla: al cierre, alertar si faltan repasos del Taller de Ánodos. */
export function faltanRepasosTallerAnodos(repasosRegistrados: number): boolean {
  return repasosRegistrados < REPASOS_TALLER_ANODOS
}

/** Regla de stock: alerta cuando el stock actual cae por debajo del mínimo. */
export function stockEnAlerta(actualPct: number, minimoPct: number): boolean {
  return actualPct < minimoPct
}
