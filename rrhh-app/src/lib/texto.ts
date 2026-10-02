// ============================================================
// Búsqueda de texto como la espera la gente: sin acentos, sin mayúsculas
// y por palabras en cualquier orden ("perez juan" encuentra "Juan Pérez",
// "camisa 44" encuentra "Camisa ADC T 44").
// ============================================================

/** Minúsculas y sin acentos. */
export function normalizarTexto(s: string | null | undefined): string {
  return (s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
}

/** Palabras de la búsqueda, ya normalizadas. */
export function palabrasDe(busqueda: string): string[] {
  return normalizarTexto(busqueda).split(/\s+/).filter(Boolean)
}

/** true si TODAS las palabras de la búsqueda aparecen en alguno de los campos. */
export function coincide(busqueda: string, ...campos: (string | null | undefined)[]): boolean {
  const palabras = palabrasDe(busqueda)
  if (palabras.length === 0) return true
  const texto = normalizarTexto(campos.filter(Boolean).join(' '))
  return palabras.every((p) => texto.includes(p))
}
