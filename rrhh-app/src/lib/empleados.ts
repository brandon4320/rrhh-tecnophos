// ============================================================
// Reglas puras de empleados (sin I/O).
// 59 de los 89 empleados activos tienen el nombre COMPLETO en `nombre`
// (muchos como "APELLIDO NOMBRE", en mayúsculas) y `apellido` vacío: dos
// cargas de la misma persona casi nunca coinciden letra por letra.
// ============================================================
import { palabrasDe } from './texto'

/** Clave de identidad de un nombre: palabras sin acentos/mayúsculas, ordenadas. */
export function claveNombre(nombre: string | null | undefined, apellido?: string | null): string {
  return palabrasDe(`${nombre ?? ''} ${apellido ?? ''}`).sort().join(' ')
}

/**
 * Primer empleado con el mismo nombre que el que se quiere cargar, sin importar
 * mayúsculas, acentos, orden de las palabras ni si el apellido está en su campo
 * o pegado al nombre. Incluye a los dados de baja: re-cargar a alguien que se
 * fue y volvió duplica su legajo en vez de reactivarlo.
 */
export function buscarDuplicado<T extends { nombre: string | null; apellido: string | null }>(
  existentes: T[],
  nombre: string,
  apellido?: string | null
): T | undefined {
  const clave = claveNombre(nombre, apellido)
  if (!clave) return undefined
  return existentes.find((e) => claveNombre(e.nombre, e.apellido) === clave)
}
