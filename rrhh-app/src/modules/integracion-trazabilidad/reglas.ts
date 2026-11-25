// ============================================================
// Integración con el Portal de Trazabilidad (trazabilidad.tecnophos.com.ar):
// QUÉ se le muestra. Decisión de Brandon (25/11/2026): el portal toma de acá los
// carnets de aplicador, así no se cargan dos veces. Sale lo mínimo para armar la
// cuadrilla de una fumigación: nombre, sede, número y vencimiento del carnet, y
// la imagen del carnet (que el portal muestra solo a Tecnophos, o al cliente si
// Brandon lo autoriza). Nada más del legajo: ni DNI/CUIL, ni médicos, ni cursos,
// ni sueldos. Este archivo es el único lugar donde se amplía o achica el recorte.
// ============================================================

export type Marca = 'tecnophos' | 'adc'
export type Base = 'bahia_blanca' | 'rosario' | 'necochea'

/** Empresas de RRHH cuyos aplicadores ve el portal, con su marca y su base. Serviwhite no entra. */
export const EMPRESAS_TRAZABILIDAD: Record<string, { marca: Marca; base: Base | null }> = {
  'tecnophos-bb': { marca: 'tecnophos', base: 'bahia_blanca' },
  'tecnophos-rosario': { marca: 'tecnophos', base: 'rosario' },
  'tecnophos-necochea': { marca: 'tecnophos', base: 'necochea' },
  adc: { marca: 'adc', base: null },
}

/** Tipo de certificado que cuenta como carnet de aplicador (tipos_certificado.nombre). */
export const TIPO_CARNET_APLICADOR = 'Carnet de Aplicador'

const normal = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase()

export function esCarnetAplicador(nombreTipo: string | null | undefined): boolean {
  return !!nombreTipo && normal(nombreTipo) === normal(TIPO_CARNET_APLICADOR)
}

export function empresaDe(slug: string | null | undefined) {
  return (slug && EMPRESAS_TRAZABILIDAD[slug]) || null
}

export function slugsDe(marca: Marca | null): string[] {
  return Object.entries(EMPRESAS_TRAZABILIDAD).filter(([, e]) => !marca || e.marca === marca).map(([s]) => s)
}

export function leerMarca(v: string | null): Marca | null | 'invalida' {
  if (!v) return null
  return v === 'tecnophos' || v === 'adc' ? v : 'invalida'
}

/** Solo imágenes o PDF del carnet: nada de otros formatos que el portal no muestra. */
export function mimeMostrable(mime: string | null | undefined): boolean {
  return !!mime && /^(image\/(jpeg|png|webp)|application\/pdf)$/.test(mime)
}

export interface Carnet {
  certificadoId: string
  numero: string | null
  /** 'AAAA-MM-DD' o null si no tiene vencimiento cargado. */
  vence: string | null
  /** Último archivo del carnet (imagen o PDF), para pedirlo aparte. */
  archivoId: string | null
}

export interface Aplicador {
  empleadoId: string
  nombre: string
  marca: Marca
  base: Base | null
  carnet: Carnet
}

/** Si una persona tiene más de un carnet cargado, vale el que vence más tarde (el vigente o el más reciente). */
export function elegirCarnet<T extends { vence: string | null }>(carnets: T[]): T | null {
  if (!carnets.length) return null
  return [...carnets].sort((a, b) => (b.vence ?? '').localeCompare(a.vence ?? ''))[0]
}
