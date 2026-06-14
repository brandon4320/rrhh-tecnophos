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

export type Archivo = Tables<'archivos'> & {
  /** URL firmada (presigned) generada en runtime. */
  url?: string
}

export type Certificado = Tables<'certificados'> & {
  tipo?: TipoCertificado | null
  empleado?: Empleado | null
  empresa?: Empresa | null
  vehiculo?: Vehiculo | null
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
  vencido: 'bg-red-100 text-red-800 border-red-200',
  proximo: 'bg-amber-100 text-amber-800 border-amber-200',
  vigente: 'bg-green-100 text-green-800 border-green-200',
  sin_fecha: 'bg-gray-100 text-gray-600 border-gray-200',
}
