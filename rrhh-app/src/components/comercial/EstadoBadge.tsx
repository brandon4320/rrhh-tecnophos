import { cn } from '@/lib/utils'
import type { EstadoProyecto, EstadoTarea, EstadoEvento, EstadoViaje } from '@/modules/comercial/tipos'

type BadgeEstado = EstadoProyecto | EstadoTarea | EstadoEvento | EstadoViaje | string

const COLORES: Record<string, string> = {
  // proyecto
  abierto:   'bg-blue-500/10 text-blue-600 border-blue-500/20 dark:text-blue-400',
  ganado:    'bg-emerald-500/10 text-emerald-700 border-emerald-500/20 dark:text-emerald-400',
  perdido:   'bg-red-500/10 text-red-700 border-red-500/20 dark:text-red-400',
  pausado:   'bg-amber-500/10 text-amber-700 border-amber-500/20 dark:text-amber-400',
  cancelado: 'bg-neutral-500/10 text-neutral-500 border-neutral-500/20',
  // tarea
  pendiente:           'bg-slate-500/10 text-slate-600 border-slate-500/20 dark:text-slate-400',
  en_proceso:          'bg-blue-500/10 text-blue-600 border-blue-500/20 dark:text-blue-400',
  esperando_respuesta: 'bg-purple-500/10 text-purple-700 border-purple-500/20 dark:text-purple-400',
  bloqueada:           'bg-red-500/10 text-red-700 border-red-500/20 dark:text-red-400',
  completada:          'bg-emerald-500/10 text-emerald-700 border-emerald-500/20 dark:text-emerald-400',
  // evento
  programado:   'bg-blue-500/10 text-blue-600 border-blue-500/20 dark:text-blue-400',
  realizado:    'bg-emerald-500/10 text-emerald-700 border-emerald-500/20 dark:text-emerald-400',
  reprogramado: 'bg-amber-500/10 text-amber-700 border-amber-500/20 dark:text-amber-400',
  no_realizado: 'bg-red-500/10 text-red-700 border-red-500/20 dark:text-red-400',
  // viaje
  planificado: 'bg-blue-500/10 text-blue-600 border-blue-500/20 dark:text-blue-400',
  en_curso:    'bg-emerald-500/10 text-emerald-700 border-emerald-500/20 dark:text-emerald-400',
  finalizado:  'bg-neutral-500/10 text-neutral-500 border-neutral-500/20',
}

const LABELS: Record<string, string> = {
  abierto: 'Abierto', ganado: 'Ganado', perdido: 'Perdido', pausado: 'Pausado', cancelado: 'Cancelado',
  pendiente: 'Pendiente', en_proceso: 'En proceso', esperando_respuesta: 'Esperando', bloqueada: 'Bloqueada', completada: 'Completada',
  programado: 'Programado', realizado: 'Realizado', reprogramado: 'Reprogramado', no_realizado: 'No realizado',
  planificado: 'Planificado', en_curso: 'En curso', finalizado: 'Finalizado',
}

export function EstadoBadge({ estado, className }: { estado: BadgeEstado; className?: string }) {
  return (
    <span className={cn('inline-flex items-center rounded border px-2 py-0.5 text-xs font-medium', COLORES[estado] ?? 'bg-muted text-muted-foreground border-border', className)}>
      {LABELS[estado] ?? estado}
    </span>
  )
}
