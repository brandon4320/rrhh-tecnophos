// Orden de las tablas: tocar el título de una columna ordena por ella y tocarlo de nuevo invierte
// (como la tabla del Pipeline del CRM). El orden viaja en la URL (`?orden=campo` o `?orden=-campo`
// para descendente), así sobrevive al volver de un legajo y se puede compartir.
import type { EstadoVencimiento } from '@/types'

export type Direccion = 'asc' | 'desc'
export interface Orden<C extends string> {
  campo: C
  dir: Direccion
}

/** `nombre` → asc, `-nombre` → desc. Un campo desconocido vuelve al orden por defecto. */
export function leerOrden<C extends string>(valor: string | null | undefined, campos: readonly C[], porDefecto: Orden<C>): Orden<C> {
  if (!valor) return porDefecto
  const desc = valor.startsWith('-')
  const campo = (desc ? valor.slice(1) : valor) as C
  return campos.includes(campo) ? { campo, dir: desc ? 'desc' : 'asc' } : porDefecto
}

export function escribirOrden<C extends string>(orden: Orden<C>): string {
  return orden.dir === 'desc' ? `-${orden.campo}` : orden.campo
}

/** Misma columna: invierte. Otra: arranca ascendente (o como diga `primeraDir`, p. ej. números de mayor a menor). */
export function alternarOrden<C extends string>(actual: Orden<C>, campo: C, primeraDir: Direccion = 'asc'): Orden<C> {
  if (actual.campo === campo) return { campo, dir: actual.dir === 'asc' ? 'desc' : 'asc' }
  return { campo, dir: primeraDir }
}

const texto = new Intl.Collator('es', { sensitivity: 'base', numeric: true })

/** Compara textos en castellano (sin importar mayúsculas ni acentos) o números; lo vacío va siempre al final. */
export function comparar(a: string | number | null | undefined, b: string | number | null | undefined, dir: Direccion = 'asc'): number {
  const vacioA = a === null || a === undefined || a === ''
  const vacioB = b === null || b === undefined || b === ''
  if (vacioA || vacioB) return vacioA === vacioB ? 0 : vacioA ? 1 : -1
  const r = typeof a === 'number' && typeof b === 'number' ? a - b : texto.compare(String(a), String(b))
  return dir === 'asc' ? r : -r
}

/** Urgencia del estado: ascendente = lo más urgente primero. */
export const RANGO_ESTADO: Record<EstadoVencimiento, number> = { vencido: 0, proximo: 1, sin_fecha: 2, vigente: 3 }
