// ============================================================
// Tipos de dominio — derivados de los tipos generados de la DB
// (src/types/database.ts) para tener UNA sola fuente de verdad.
// Las relaciones anidadas se agregan encima como opcionales.
// ============================================================
import type { Tables } from './database'

export type { Rol } from '@/lib/auth/roles'

export type Empresa = Tables<'empresas'>
export type TipoCertificado = Tables<'tipos_certificado'>
export type Perfil = Tables<'perfiles'>

export type Empleado = Tables<'empleados'> & {
  empresa?: Empresa | null
}

export type Vehiculo = Tables<'vehiculos'> & {
  empresa?: Empresa | null
}

export type Equipo = Tables<'equipos'> & {
  empresa?: Empresa | null
}

export type Archivo = Tables<'archivos'> & {
  /** URL firmada (presigned) generada en runtime. */
  url?: string
}

export type Certificado = Tables<'certificados'> & {
  tipo?: TipoCertificado | null
  empleado?: Empleado | null
  empresa?: Empresa | null
  vehiculo?: Vehiculo | null
  equipo?: Equipo | null
  archivos?: Archivo[]
}

// ============================================================
// Estado de vencimiento (lógica de presentación)
// ============================================================
export type EstadoVencimiento = 'vencido' | 'proximo' | 'vigente' | 'sin_fecha'

export function getEstadoVencimiento(
  fecha?: string | null,
  alertaDias?: number | null
): EstadoVencimiento {
  if (!fecha) return 'sin_fecha'
  const dias = alertaDias ?? 30
  const hoy = new Date()
  const vencimiento = new Date(fecha)
  const diffDias = Math.floor((vencimiento.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24))
  if (diffDias < 0) return 'vencido'
  if (diffDias <= dias) return 'proximo'
  return 'vigente'
}

export const ESTADO_LABELS: Record<EstadoVencimiento, string> = {
  vencido: 'Vencido',
  proximo: 'Por vencer',
  vigente: 'Vigente',
  sin_fecha: 'Sin fecha',
}

export const ESTADO_COLORS: Record<EstadoVencimiento, string> = {
  vencido:
    'bg-red-100 text-red-700 border-red-200 dark:bg-red-500/15 dark:text-red-400 dark:border-red-500/30',
  proximo:
    'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-500/15 dark:text-amber-400 dark:border-amber-500/30',
  vigente:
    'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-400 dark:border-emerald-500/30',
  sin_fecha:
    'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-500/15 dark:text-slate-400 dark:border-slate-500/30',
}
