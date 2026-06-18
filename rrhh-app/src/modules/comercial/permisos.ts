// ============================================================
// Permisos del módulo Gestión Comercial
// ============================================================
import type { Sesion } from '@/lib/auth/session'
import { tieneRol, COMERCIAL_GESTION, COMERCIAL_ROLES } from '@/lib/auth/roles'
import type { ProyectoBase } from './tipos'

export function puedeVerProyecto(sesion: Sesion, proyecto: Pick<ProyectoBase, 'responsable_id'>): boolean {
  if (tieneRol(sesion.rol, COMERCIAL_GESTION)) return true
  if (sesion.rol === 'asistente_comercial') return true
  if (sesion.rol === 'vendedor') return proyecto.responsable_id === sesion.userId
  return false
}

export function puedeEditarProyecto(sesion: Sesion, proyecto: Pick<ProyectoBase, 'responsable_id'>): boolean {
  if (tieneRol(sesion.rol, COMERCIAL_GESTION)) return true
  if (sesion.rol === 'vendedor') return proyecto.responsable_id === sesion.userId
  return false
}

export function puedeCerrarProyecto(sesion: Sesion, proyecto: Pick<ProyectoBase, 'responsable_id'>): boolean {
  if (tieneRol(sesion.rol, COMERCIAL_GESTION)) return true
  if (sesion.rol === 'vendedor') return proyecto.responsable_id === sesion.userId
  return false
}

export function puedeVerReportesComerciales(sesion: Sesion): boolean {
  return tieneRol(sesion.rol, COMERCIAL_GESTION)
}

export function puedeGestionarConfiguracionComercial(sesion: Sesion): boolean {
  return tieneRol(sesion.rol, COMERCIAL_GESTION)
}

export function puedeAccederComercial(sesion: Sesion): boolean {
  return tieneRol(sesion.rol, COMERCIAL_ROLES)
}

export function puedeVerEquipoComercial(sesion: Sesion): boolean {
  return tieneRol(sesion.rol, COMERCIAL_GESTION)
}

export function puedeAsignarTareas(sesion: Sesion): boolean {
  return tieneRol(sesion.rol, COMERCIAL_GESTION)
}
