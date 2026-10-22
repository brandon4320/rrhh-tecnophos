// ============================================================
// Tipos de dominio — derivados de los tipos generados de la DB
// (src/types/database.ts) para tener UNA sola fuente de verdad.
// Las relaciones anidadas se agregan encima como opcionales.
// ============================================================
import type { Tables } from './database'
import { diaClaveAR } from '@/lib/fechas-ar'

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

/** Comprobante de sueldo de un empleado (tabla recibos_sueldo, archivo en R2). */
export type Recibo = Tables<'recibos_sueldo'>

/** Stock por empresa: catálogo + libro de movimientos (el stock actual se calcula). */
export type StockItem = Tables<'stock_items'>
export type StockMovimiento = Tables<'stock_movimientos'>

/** Documentación mensual de la empresa (F931, ART, SVO… por mes y carpeta, archivo en R2). */
export type DocumentoMensual = Tables<'documentos_mensuales'>

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

/** Días entre hoy y la fecha de vencimiento, normalizando ambas a mediodía
 *  local para evitar el corrimiento de un día en UTC-3 (Argentina). Negativo
 *  = ya venció. Acepta 'YYYY-MM-DD' o timestamps ISO (toma los primeros 10). */
export function diasHastaVencimiento(fecha: string): number {
  // "Hoy" es el día de Argentina, no el del servidor (Vercel corre en UTC: desde
  // las 21:00 AR ya era mañana y lo que vencía hoy salía "Vencido").
  const venc = new Date(fecha.slice(0, 10) + 'T12:00:00Z')
  const hoy = new Date(diaClaveAR(new Date()) + 'T12:00:00Z')
  return Math.round((venc.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24))
}

export function getEstadoVencimiento(
  fecha?: string | null,
  alertaDias?: number | null
): EstadoVencimiento {
  if (!fecha) return 'sin_fecha'
  const dias = alertaDias ?? 30
  const diffDias = diasHastaVencimiento(fecha)
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
    'bg-danger-subtle text-danger-text border-danger/20',
  proximo:
    'bg-warning-subtle text-warning-text border-warning/20',
  vigente:
    'bg-success-subtle text-success-text border-success/20',
  sin_fecha:
    'bg-muted text-texto-2 border-border',
}
