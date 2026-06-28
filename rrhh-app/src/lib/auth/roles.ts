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
  // --- módulo comercial ---
  'direccion', // dirección general: ve todo, puede editar
  'gerente_comercial', // gestiona equipo comercial completo
  'vendedor', // ve y opera solo lo propio
  'asistente_comercial', // carga datos operativos, no cierra proyectos
] as const

export type Rol = (typeof ROLES)[number]

/** Roles que acceden al dominio RRHH. */
export const RRHH_ROLES = ['admin', 'usuario'] as const satisfies readonly Rol[]

/** Roles internos del servicio de limpieza (operan el módulo). */
export const LIMPIEZA_INTERNOS = ['admin', 'admin_adc', 'supervisor', 'operario'] as const satisfies readonly Rol[]

/** Roles que pueden ESCRIBIR en el módulo limpieza. */
export const LIMPIEZA_ESCRITURA = ['admin', 'admin_adc', 'supervisor'] as const satisfies readonly Rol[]

/** Todos los roles del módulo comercial. */
export const COMERCIAL_ROLES = [
  'admin', 'direccion', 'gerente_comercial', 'vendedor', 'asistente_comercial',
] as const satisfies readonly Rol[]

/** Roles con visión global y gestión de equipo. */
export const COMERCIAL_GESTION = [
  'admin', 'direccion', 'gerente_comercial',
] as const satisfies readonly Rol[]

/** Roles de dirección (lectura total + edición). */
export const COMERCIAL_DIRECCION = [
  'admin', 'direccion',
] as const satisfies readonly Rol[]

/** Roles que pueden crear y editar empleados/legajos. */
export const LEGAJO_ESCRITURA = [
  'admin', 'admin_adc', 'admin_unipar', 'direccion',
] as const satisfies readonly Rol[]

export function esSuperAdmin(rol: Rol | null | undefined, empresaAcceso: string | null | undefined): boolean {
  return rol === 'admin' && empresaAcceso == null
}

export function tieneRol(rol: Rol | null | undefined, permitidos: readonly Rol[]): boolean {
  return rol != null && permitidos.includes(rol)
}
