// ============================================================
// Registro de módulos de la plataforma.
// Maneja el menú lateral y el control de acceso por módulo.
// Para sumar un módulo (ej. mantenimiento): agregá una entrada acá.
// ============================================================
import type { Rol } from '@/lib/auth/roles'

export type ModuloKey = 'rrhh' | 'limpieza' | 'mantenimiento' | 'comercial'

/** Empresas dueñas de un módulo (para mostrar marca en el menú). */
export type EmpresaMarca = 'tecnophos' | 'adc'

export interface ModuloDef {
  key: ModuloKey
  label: string
  /** Ruta base del módulo. */
  href: string
  /** Nombre de ícono de lucide-react. */
  icon: string
  /** Roles que pueden ver/entrar al módulo. */
  roles: readonly Rol[]
  /** Empresas a las que pertenece el módulo (se refleja en el menú). */
  empresas: readonly EmpresaMarca[]
  /** Si está disponible (false = "próximamente", no se muestra). */
  enabled: boolean
}

export const MODULOS: ModuloDef[] = [
  {
    key: 'rrhh',
    label: 'RRHH',
    href: '/dashboard',
    icon: 'IdCard',
    roles: ['admin', 'usuario'],
    empresas: ['tecnophos', 'adc'],
    enabled: true,
  },
  {
    // key/tablas internas siguen siendo "limpieza"; la etiqueta es genérica.
    key: 'limpieza',
    label: 'Operaciones',
    href: '/operaciones',
    icon: 'ClipboardList',
    roles: ['admin', 'admin_adc', 'supervisor', 'operario', 'admin_unipar'],
    empresas: ['adc'],
    enabled: true,
  },
  {
    key: 'mantenimiento',
    label: 'Mantenimiento',
    href: '/mantenimiento',
    icon: 'Wrench',
    roles: ['admin', 'usuario'],
    empresas: ['tecnophos', 'adc'],
    enabled: false,
  },
  {
    key: 'comercial',
    label: 'Gestión Comercial',
    href: '/comercial',
    icon: 'BriefcaseBusiness',
    roles: ['admin', 'direccion', 'gerente_comercial', 'vendedor', 'asistente_comercial'],
    empresas: ['tecnophos', 'adc'],
    enabled: true,
  },
]

/** Módulos visibles para un rol dado. */
export function modulosPara(rol: Rol | null | undefined): ModuloDef[] {
  if (!rol) return []
  return MODULOS.filter((m) => m.enabled && m.roles.includes(rol))
}

/** ¿Este rol puede acceder a este módulo? */
export function puedeAccederModulo(rol: Rol | null | undefined, key: ModuloKey): boolean {
  if (!rol) return false
  const m = MODULOS.find((x) => x.key === key)
  return !!m && m.enabled && m.roles.includes(rol)
}
