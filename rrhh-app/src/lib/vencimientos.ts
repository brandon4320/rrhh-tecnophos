// ============================================================
// Reglas compartidas por /dashboard, /vencimientos y el Resumen de empresa:
// ventana de alerta para los filtros gruesos en la DB, a dónde lleva cada
// certificado (link profundo) y cómo se llama su titular.
// Puras (sin React ni Supabase): se usan en server components y tienen tests.
// ============================================================
import { diaClaveAR } from './fechas-ar'

/** Ventana de alerta máxima que admite un certificado (input "Alerta, días antes"). */
export const ALERTA_DIAS_MAX = 365

/**
 * Ventana de alerta "habitual": hoy TODOS los certificados tienen alerta_dias = 30
 * (o null, que vale 30). El filtro grueso de la DB trae hasta hoy + esto (+1 de
 * holgura) y, aparte, los pocos con una alerta más larga (ver `alertaLarga`), así
 * el payload es el de un mes y no el de un año entero sin perder ningún "por vencer".
 */
export const VENTANA_ALERTA_HABITUAL = 31

/** 'YYYY-MM-DD' de hoy en Argentina más `n` días (negativo = hacia atrás). */
export function fechaMasDias(n: number, ahora: Date = new Date()): string {
  const d = new Date(diaClaveAR(ahora) + 'T12:00:00Z')
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

/** Une dos listas sin repetir ids (la segunda no pisa a la primera). */
export function unirPorId<T extends { id: string }>(a: T[], b: T[]): T[] {
  const vistos = new Set(a.map((x) => x.id))
  return [...a, ...b.filter((x) => !vistos.has(x.id))]
}

type EmpresaRef = { slug?: string | null; nombre?: string | null } | null | undefined

/** Forma mínima de un certificado con su dueño (excluyente: uno solo viene). */
export interface CertConDueno {
  id: string
  empleado?: { id: string; nombre?: string | null; apellido?: string | null; empresa?: EmpresaRef } | null
  vehiculo?: { id: string; patente?: string | null; empresa?: EmpresaRef } | null
  equipo?: { id: string; nombre?: string | null; empresa?: EmpresaRef } | null
  empresa?: EmpresaRef
}

/**
 * Link profundo al certificado: el legajo con ESA tarjeta abierta, o la
 * documentación de la empresa con el vehículo / ítem desplegado.
 * null si no hay a dónde ir (dueño sin empresa visible).
 */
export function hrefCertificado(c: CertConDueno): string | null {
  if (c.empleado?.id) return `/legajo/${c.empleado.id}?cert=${c.id}`
  if (c.vehiculo?.id) {
    const slug = c.vehiculo.empresa?.slug
    return slug ? `/empresa/${slug}?vista=documentacion&veh=${c.vehiculo.id}` : null
  }
  if (c.equipo?.id) {
    const slug = c.equipo.empresa?.slug
    return slug ? `/empresa/${slug}?vista=documentacion&equipo=${c.equipo.id}` : null
  }
  return c.empresa?.slug ? `/empresa/${c.empresa.slug}?vista=documentacion` : null
}

/** Nombre legible del titular: la persona, "Vehículo ABC123", el ítem o la empresa. */
export function titularCertificado(c: CertConDueno): string {
  if (c.empleado) return [c.empleado.nombre, c.empleado.apellido].filter(Boolean).join(' ') || 'Empleado'
  if (c.vehiculo) return `Vehículo ${c.vehiculo.patente ?? ''}`.trim()
  if (c.equipo) return c.equipo.nombre ?? 'Activo'
  return c.empresa?.nombre ?? '—'
}

/** Empresa del certificado, venga por donde venga el dueño. */
export function empresaDeCertificado(c: CertConDueno): { nombre: string | null; slug: string | null } {
  const e = c.empleado?.empresa ?? c.vehiculo?.empresa ?? c.equipo?.empresa ?? c.empresa ?? null
  return { nombre: e?.nombre ?? null, slug: e?.slug ?? null }
}
