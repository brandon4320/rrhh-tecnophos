// ============================================================
// Integración con el Sistema de Gestión Comercial: QUÉ se le muestra.
// Decisión de Brandon (15/10/2026): los comerciales ven las habilitaciones y
// certificados de la EMPRESA y la documentación mensual de ART y Seguro de
// Vida. Nada del personal (cursos, médicos, carnets), ni F931, ni recibos.
// Este archivo es el único lugar donde se amplía o achica ese recorte.
// ============================================================

export type Marca = 'tecnophos' | 'adc'

/** Empresas de RRHH que ve el comercial, y a qué marca pertenecen. Serviwhite no entra. */
export const EMPRESAS_COMERCIAL: Record<string, Marca> = {
  'tecnophos-bb': 'tecnophos',
  'tecnophos-rosario': 'tecnophos',
  'tecnophos-necochea': 'tecnophos',
  adc: 'adc',
}

/** Carpetas de la documentación mensual que se comparten (exactas, sin subcarpetas). */
export const CARPETAS_MENSUALES = ['ART', 'SVO'] as const
export type CarpetaMensual = (typeof CARPETAS_MENSUALES)[number]

/** Cuántos meses de ART/SVO se devuelven por empresa (el último y algunos anteriores). */
export const MESES_MENSUALES = 3

export function marcaDe(slug: string | null | undefined): Marca | null {
  return (slug && EMPRESAS_COMERCIAL[slug]) || null
}

export function slugsDe(marca: Marca | null): string[] {
  return Object.entries(EMPRESAS_COMERCIAL)
    .filter(([, m]) => !marca || m === marca)
    .map(([s]) => s)
}

export function leerMarca(v: string | null): Marca | null | 'invalida' {
  if (!v) return null
  return v === 'tecnophos' || v === 'adc' ? v : 'invalida'
}

/** Un certificado es "de la empresa" si no cuelga de una persona, un vehículo ni un equipo. */
export function esDeEmpresa(c: { empleado_id: string | null; vehiculo_id: string | null; equipo_id: string | null }): boolean {
  return !c.empleado_id && !c.vehiculo_id && !c.equipo_id
}

export function esCarpetaMensual(carpeta: string | null | undefined): carpeta is CarpetaMensual {
  return !!carpeta && (CARPETAS_MENSUALES as readonly string[]).includes(carpeta)
}

/** De cada (empresa, carpeta) quedan los últimos `meses` períodos con archivos, más nuevos primero. */
export function ultimosPeriodos<T extends { empresa: string; carpeta: string; periodo: string }>(filas: T[], meses = MESES_MENSUALES): T[] {
  const periodos = new Map<string, string[]>()
  for (const f of filas) {
    const k = `${f.empresa}|${f.carpeta}`
    const lista = periodos.get(k) ?? []
    if (!lista.includes(f.periodo)) lista.push(f.periodo)
    periodos.set(k, lista)
  }
  const quedan = new Map([...periodos].map(([k, l]) => [k, new Set(l.sort().reverse().slice(0, meses))]))
  return filas
    .filter((f) => quedan.get(`${f.empresa}|${f.carpeta}`)?.has(f.periodo))
    .sort((a, b) => b.periodo.localeCompare(a.periodo) || a.empresa.localeCompare(b.empresa) || a.carpeta.localeCompare(b.carpeta))
}
