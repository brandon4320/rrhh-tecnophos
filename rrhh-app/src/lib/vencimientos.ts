// ============================================================
// Reglas compartidas por /dashboard, /vencimientos y el Resumen de empresa:
// ventana de alerta para los filtros gruesos en la DB, a dónde lleva cada
// certificado (link profundo) y cómo se llama su titular.
// Puras (sin React ni Supabase): se usan en server components y tienen tests.
// ============================================================
import { diaClaveAR } from './fechas-ar'
import { esPala } from '@/modules/palas/reglas'

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
  empleado?: { id: string; nombre?: string | null; apellido?: string | null; activo?: boolean | null; empresa?: EmpresaRef } | null
  vehiculo?: { id: string; patente?: string | null; activo?: boolean | null; empresa?: EmpresaRef } | null
  equipo?: { id: string; nombre?: string | null; categoria?: string | null; activo?: boolean | null; empresa?: EmpresaRef } | null
  empresa?: EmpresaRef
}

/**
 * El dueño del certificado está dado de baja, así que el certificado no se
 * cuenta ni se lista.
 *
 * ★ Vale para los TRES dueños, no solo para las personas. Durante un tiempo
 * cada pantalla filtraba a mano `empleado.activo === false` y se olvidaba de
 * vehículos e ítems: una camioneta sacada de la flota seguía reclamando su VTV
 * en /vencimientos, en el dashboard y en el contador de la sidebar, sin forma
 * de resolverlo desde ninguna pantalla (la camioneta ya no se ve). Por eso la
 * regla vive acá y la usan los cinco lugares que leen certificados.
 *
 * `activo` null cuenta como activo: es como está cargado lo viejo.
 *
 * ⚠ Hay que pedir la columna `activo` en el select de cada dueño. Si no viene,
 * esto devuelve false y el filtro no hace nada — silenciosamente.
 */
export function duenoDeBaja(c: {
  empleado?: { activo?: boolean | null } | null
  vehiculo?: { activo?: boolean | null } | null
  equipo?: { activo?: boolean | null } | null
}): boolean {
  return (
    c.empleado?.activo === false ||
    c.vehiculo?.activo === false ||
    c.equipo?.activo === false
  )
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
    if (!slug) return null
    // Una pala no vive en Habilitaciones sino en Recursos → Palas cargadoras.
    return esPala(c.equipo.categoria)
      ? `/palas?empresa=${slug}&pala=${c.equipo.id}`
      : `/empresa/${slug}?vista=documentacion&equipo=${c.equipo.id}`
  }
  return c.empresa?.slug ? `/empresa/${c.empresa.slug}?vista=documentacion` : null
}

/** Nombre legible del titular: la persona, "Vehículo ABC123", el ítem o la empresa. */
export function titularCertificado(c: CertConDueno): string {
  if (c.empleado) return [c.empleado.nombre, c.empleado.apellido].filter(Boolean).join(' ') || 'Empleado'
  if (c.vehiculo) return `Vehículo ${c.vehiculo.patente ?? ''}`.trim()
  if (c.equipo) {
    const nombre = c.equipo.nombre ?? ''
    if (!esPala(c.equipo.categoria)) return nombre || 'Activo'
    // Si ya se llama "Pala 1", prefijar daría "Pala Pala 1".
    return /^pala/i.test(nombre.trim()) ? nombre.trim() : `Pala ${nombre}`.trim()
  }
  return c.empresa?.nombre ?? '—'
}

/** Empresa del certificado, venga por donde venga el dueño. */
export function empresaDeCertificado(c: CertConDueno): { nombre: string | null; slug: string | null } {
  const e = c.empleado?.empresa ?? c.vehiculo?.empresa ?? c.equipo?.empresa ?? c.empresa ?? null
  return { nombre: e?.nombre ?? null, slug: e?.slug ?? null }
}
