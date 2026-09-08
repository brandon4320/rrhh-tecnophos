// ============================================================
// Quién ve la sección Tecnophos - ARCOR. Único punto de verdad en la UI;
// espeja la RLS de las tablas arcor_* (app_es_rrhh() and app_ve_todas_empresas()).
// Si cambia acá, cambia la migración — y al revés.
// ============================================================
import type { Rol } from '@/lib/auth/roles'
import { puedeAccederModulo } from '@/config/modules'

export function puedeVerArcor(s: { rol: Rol; empresaAcceso: string | null }): boolean {
  return puedeAccederModulo(s.rol, 'arcor') && s.empresaAcceso == null
}
