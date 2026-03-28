export type Rol = 'admin' | 'usuario'

export interface Empresa {
  id: string
  nombre: string
  slug: string
  color: string
  created_at: string
}

export interface TipoCertificado {
  id: string
  nombre: string
  descripcion?: string
  aplica_personal: boolean
  aplica_empresa: boolean
  aplica_vehiculo: boolean
  orden: number
}

export interface Empleado {
  id: string
  nombre: string
  apellido?: string
  empresa_id: string
  sector?: string
  activo: boolean
  created_at: string
  updated_at: string
  empresa?: Empresa
}

export interface Vehiculo {
  id: string
  patente: string
  empresa_id: string
  descripcion?: string
  activo: boolean
  empresa?: Empresa
}

export interface Certificado {
  id: string
  tipo_id?: string
  tipo_nombre_custom?: string
  empleado_id?: string
  empresa_id?: string
  vehiculo_id?: string
  fecha_vencimiento?: string
  fecha_emision?: string
  numero_documento?: string
  notas?: string
  alerta_dias: number
  created_at: string
  updated_at: string
  tipo?: TipoCertificado
  empleado?: Empleado
  empresa?: Empresa
  vehiculo?: Vehiculo
  archivos?: Archivo[]
}

export interface Archivo {
  id: string
  certificado_id: string
  nombre: string
  path: string
  mime_type?: string
  size_bytes?: number
  uploaded_at: string
  url?: string
}

export interface Perfil {
  id: string
  nombre?: string
  rol: Rol
  empresa_acceso?: string
  created_at: string
}

export type EstadoVencimiento = 'vencido' | 'proximo' | 'vigente' | 'sin_fecha'

export function getEstadoVencimiento(
  fecha?: string,
  alertaDias = 30
): EstadoVencimiento {
  if (!fecha) return 'sin_fecha'
  const hoy = new Date()
  const vencimiento = new Date(fecha)
  const diffDias = Math.floor((vencimiento.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24))
  if (diffDias < 0) return 'vencido'
  if (diffDias <= alertaDias) return 'proximo'
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
