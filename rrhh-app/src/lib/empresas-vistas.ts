// Qué empresas se están mirando. `?empresa=` admite una o varias separadas por coma
// (`?empresa=adc,serviwhite`), como el selector con casillas del CRM: sin el parámetro, o con todas,
// son todas. Las pantallas de cada empresa (Resumen de la empresa, Habilitaciones, Mensual, Stock,
// Palas, Armar carpeta) siguen pidiendo UNA; las generales (Resumen general, Empleados,
// Vencimientos, Flota) filtran por la lista.

/** Los slugs pedidos, sin repetidos y (si se pasan los válidos) solo los que existen. */
export function slugsDe(param: string | null | undefined, validos?: readonly string[]): string[] {
  if (!param) return []
  const lista = [...new Set(param.split(',').map((s) => s.trim()).filter(Boolean))]
  return validos ? lista.filter((s) => validos.includes(s)) : lista
}

/** El valor de `?empresa=` para una selección: null si son todas o ninguna. Sigue el orden de `todas`. */
export function paramEmpresas(elegidas: readonly string[], todas: readonly string[]): string | null {
  const orden = todas.filter((s) => elegidas.includes(s))
  if (orden.length === 0 || orden.length === todas.length) return null
  return orden.join(',')
}

/** Filtro para las pantallas generales: null = no filtrar (todas). */
export function filtroEmpresas(param: string | null | undefined, todas: readonly string[]): string[] | null {
  const slugs = slugsDe(param, todas)
  return slugs.length === 0 || slugs.length === todas.length ? null : slugs
}
