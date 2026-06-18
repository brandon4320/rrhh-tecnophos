// ============================================================
// Reglas de negocio del módulo Gestión Comercial — funciones puras.
// Sin side effects, sin dependencias externas, totalmente testeables.
// ============================================================
import { PROB_POR_ETAPA, type EtapaProyecto, type ProyectoBase, type TareaBase } from './tipos'

export const DIAS_SIN_MOVIMIENTO_DEFAULT = 7

// --- Validaciones de proyecto abierto ---

export function requiereProximaAccion(proyecto: Pick<ProyectoBase, 'estado' | 'proxima_accion' | 'proxima_accion_fecha'>): boolean {
  if (proyecto.estado !== 'abierto') return false
  return !proyecto.proxima_accion || !proyecto.proxima_accion_fecha
}

export function validarProyectoAbierto(proyecto: Pick<ProyectoBase, 'estado' | 'responsable_id' | 'proxima_accion' | 'proxima_accion_fecha'>): string[] {
  const errores: string[] = []
  if (!proyecto.responsable_id) errores.push('El proyecto debe tener un responsable.')
  if (proyecto.estado === 'abierto') {
    if (!proyecto.proxima_accion) errores.push('El proyecto debe tener una próxima acción definida.')
    if (!proyecto.proxima_accion_fecha) errores.push('La próxima acción debe tener fecha.')
  }
  return errores
}

// --- Cierre ganado ---

export function puedeCerrarProyectoGanado(proyecto: Pick<ProyectoBase, 'estado' | 'valor_estimado' | 'moneda'>): boolean {
  return proyecto.estado === 'abierto' && proyecto.valor_estimado != null && !!proyecto.moneda
}

export function validarCierreGanado(proyecto: Pick<ProyectoBase, 'estado' | 'valor_estimado' | 'moneda'>): string[] {
  const errores: string[] = []
  if (proyecto.estado !== 'abierto') errores.push('Solo se puede cerrar como ganado un proyecto abierto.')
  if (proyecto.valor_estimado == null) errores.push('El proyecto debe tener un valor estimado para cerrar como ganado.')
  if (!proyecto.moneda) errores.push('El proyecto debe tener moneda definida para cerrar como ganado.')
  return errores
}

// --- Cierre perdido ---

export function puedeCerrarProyectoPerdido(proyecto: Pick<ProyectoBase, 'estado' | 'motivo_perdida_id'>): boolean {
  return proyecto.estado === 'abierto' && !!proyecto.motivo_perdida_id
}

export function validarCierrePerdido(proyecto: Pick<ProyectoBase, 'estado' | 'motivo_perdida_id'>): string[] {
  const errores: string[] = []
  if (proyecto.estado !== 'abierto') errores.push('Solo se puede cerrar como perdido un proyecto abierto.')
  if (!proyecto.motivo_perdida_id) errores.push('Debe seleccionar un motivo de pérdida.')
  return errores
}

// --- Tareas ---

export function estaTareaVencida(tarea: Pick<TareaBase, 'fecha_vencimiento' | 'estado'>, hoy: Date = new Date()): boolean {
  if (tarea.estado === 'completada' || tarea.estado === 'cancelada') return false
  if (!tarea.fecha_vencimiento) return false
  return new Date(tarea.fecha_vencimiento) < hoy
}

// --- Movimiento de proyectos ---

export function estaProyectoSinMovimiento(
  proyecto: Pick<ProyectoBase, 'estado' | 'ultima_actividad_at'>,
  hoy: Date = new Date(),
  dias: number = DIAS_SIN_MOVIMIENTO_DEFAULT
): boolean {
  if (proyecto.estado !== 'abierto') return false
  if (!proyecto.ultima_actividad_at) return true
  const diff = (hoy.getTime() - new Date(proyecto.ultima_actividad_at).getTime()) / (1000 * 60 * 60 * 24)
  return diff > dias
}

// --- Probabilidad ---

export function calcularProbabilidadPorEtapa(etapa: EtapaProyecto): number {
  return PROB_POR_ETAPA[etapa] ?? 0
}

// --- Consistencia etapa / estado ---

export function etapaEsConsistente(etapa: EtapaProyecto, estado: string): boolean {
  if (etapa === 'ganado') return estado === 'ganado'
  if (etapa === 'perdido') return estado === 'perdido'
  if (etapa === 'pausado') return estado === 'pausado'
  return estado === 'abierto'
}
