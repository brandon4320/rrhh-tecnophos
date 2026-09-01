// ============================================================
// Roles y permisos — única fuente de verdad de autorización.
// Espejo del CHECK constraint de `perfiles.rol` en la base.
// ============================================================

export const ROLES = [
  'admin', // super admin de la plataforma (empresa_acceso = null)
  'usuario', // usuario RRHH (scopeado por empresa_acceso)
  // Los roles del servicio de limpieza (admin_adc, supervisor, operario,
  // admin_unipar) se eliminaron en 2026-09: ese sistema ahora es un deploy
  // externo (unipar-app.vercel.app). Pueden quedar usuarios legacy en la DB
  // con esos roles: no matchean ningún módulo y no ven nada.
  // --- módulo comercial ---
  'direccion', // dirección general: ve todo, puede editar
  'gerente_comercial', // gestiona equipo comercial completo
  'vendedor', // ve y opera solo lo propio
  'asistente_comercial', // carga datos operativos, no cierra proyectos
] as const

export type Rol = (typeof ROLES)[number]

/** Roles que acceden al dominio RRHH. */
export const RRHH_ROLES = ['admin', 'usuario'] as const satisfies readonly Rol[]

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

/** Roles que pueden crear y editar empleados/legajos.
 *  Debe coincidir con app_es_rrhh() en la DB (admin/usuario), de lo
 *  contrario el insert pasa el guard de UI pero lo rechaza la RLS. */
export const LEGAJO_ESCRITURA = [
  'admin', 'usuario',
] as const satisfies readonly Rol[]

export function esSuperAdmin(rol: Rol | null | undefined, empresaAcceso: string | null | undefined): boolean {
  return rol === 'admin' && empresaAcceso == null
}

export function tieneRol(rol: Rol | null | undefined, permitidos: readonly Rol[]): boolean {
  return rol != null && permitidos.includes(rol)
}
