// ============================================================
// Tipos de dominio del módulo ARCOR. Las tablas arcor_* no están en
// types/database.ts (mismo criterio que comercial_*): interfaces explícitas
// + cliente casteado en db.ts.
// ============================================================
import type { EstadoContenedor, Lugar, Origen, Severidad } from './reglas'

export interface ContenedorRow {
  id: string
  fecha: string // 'YYYY-MM-DD'
  contenedor: string
  booking: string | null
  oe: string | null
  lugar: Lugar
  observaciones: string | null
  estado: EstadoContenedor
  origen: Origen | null
  mes: string
  publicado: boolean
  hash_imagen: string | null
  created_at: string
  updated_at: string
}

export interface EventoRow {
  id: string
  ts: string
  tipo: string
  severidad: Severidad
  titulo: string
  detalle: Record<string, unknown> | null
  origen: string | null
  clave_alerta: string | null
  resuelto_en: string | null
  created_at: string
}

export interface EstadoRow {
  clave: string
  /** JSON libre que escribe el servicio; cada página lo castea a su forma conocida (EstadoWhatsapp, etc.). */
  valor: unknown
  updated_at: string
}

/** Valores conocidos de arcor_estado (los escribe el servicio / n8n). */
export interface EstadoWhatsapp { estado: string; ok: boolean }
export interface EstadoClaude {
  presupuesto_usd: number
  gastado_usd: number
  restante_usd: number
  porcentaje_usado: number | null
  llamadas: number
  usd_por_certificado: number | null
  certificados_restantes_estimados: number | null
  modelo?: string
}
export interface EstadoHeartbeat { ts: string; origen: string; items: number }
export interface EstadoPublicaciones {
  pendientes: number
  vencidas: { contenedor: string; operacion: string; creado: string; estado: string }[]
  revisar: { contenedor: string; estado: string; detalle?: string | null }[]
  publicadas?: { contenedor: string; documento?: string | null }[]
  errores?: string[]
}

// ── Payload del ingest (POST /api/arcor/ingest) ───────────────────────────
export interface IngestContenedor {
  kind: 'contenedor'
  fecha: string
  contenedor: string
  lugar?: string | null
  estado: EstadoContenedor
  origen?: Origen | null
  booking?: string | null
  oe?: string | null
  observaciones?: string | null
  mes?: string | null
  publicado?: boolean
  hash_imagen?: string | null
  /** Backfill: no generar evento de actividad. */
  sin_evento?: boolean
}

export interface IngestEvento {
  kind: 'evento'
  tipo: string
  titulo: string
  severidad?: Severidad
  detalle?: Record<string, unknown> | null
  origen?: string | null
  clave_alerta?: string | null
  /** Cierra la alerta abierta de clave_alerta (si la hay) y registra la resolución. */
  resolver?: boolean
  ts?: string | null
}

export interface IngestEstado {
  kind: 'estado'
  clave: string
  valor: Record<string, unknown>
}

export type IngestItem = IngestContenedor | IngestEvento | IngestEstado
