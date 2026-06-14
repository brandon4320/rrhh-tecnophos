// ============================================================
// Roles y permisos — única fuente de verdad de autorización.
// Espejo del CHECK constraint de `perfiles.rol` en la base.
// ============================================================

export const ROLES = [
  'admin', // super admin de la plataforma (empresa_acceso = null)
  'usuario', // usuario RRHH (scopeado por empresa_acceso)
  'admin_adc', // admin del servicio de limpieza ADC
  'supervisor', // supervisor de limpieza
  'operario', // operario de limpieza
  'admin_unipar', // cliente externo (solo lectura de reportes + feedback)
] as const

export type Rol = (typeof ROLES)[number]

/** Roles que acceden al dominio RRHH. */
export const RRHH_ROLES = ['admin', 'usuario'] as const satisfies readonly Rol[]

/** Roles internos del servicio de limpieza (operan el módulo). */
export const LIMPIEZA_INTERNOS = ['admin', 'admin_adc', 'supervisor', 'operario'] as const satisfies readonly Rol[]

/** Roles que pueden ESCRIBIR en el módulo limpieza. */
export const LIMPIEZA_ESCRITURA = ['admin', 'admin_adc', 'supervisor'] as const satisfies readonly Rol[]

export function esSuperAdmin(rol: Rol | null | undefined, empresaAcceso: string | null | undefined): boolean {
  return rol === 'admin' && empresaAcceso == null
}

export function tieneRol(rol: Rol | null | undefined, permitidos: readonly Rol[]): boolean {
  return rol != null && permitidos.includes(rol)
}
