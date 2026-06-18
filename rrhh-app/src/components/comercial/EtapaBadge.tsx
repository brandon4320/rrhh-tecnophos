import { cn } from '@/lib/utils'
import { ETAPA_LABEL, type EtapaProyecto } from '@/modules/comercial/tipos'

const COLORES: Record<EtapaProyecto, string> = {
  nuevo:                'bg-slate-500/10 text-slate-600 border-slate-500/20 dark:text-slate-400',
  contactado:           'bg-sky-500/10 text-sky-700 border-sky-500/20 dark:text-sky-400',
  reunion_agendada:     'bg-blue-500/10 text-blue-700 border-blue-500/20 dark:text-blue-400',
  relevamiento:         'bg-indigo-500/10 text-indigo-700 border-indigo-500/20 dark:text-indigo-400',
  cotizacion_pendiente: 'bg-violet-500/10 text-violet-700 border-violet-500/20 dark:text-violet-400',
  cotizacion_enviada:   'bg-purple-500/10 text-purple-700 border-purple-500/20 dark:text-purple-400',
  seguimiento:          'bg-amber-500/10 text-amber-700 border-amber-500/20 dark:text-amber-400',
  negociacion:          'bg-orange-500/10 text-orange-700 border-orange-500/20 dark:text-orange-400',
  ganado:               'bg-emerald-500/10 text-emerald-700 border-emerald-500/20 dark:text-emerald-400',
  perdido:              'bg-red-500/10 text-red-700 border-red-500/20 dark:text-red-400',
  pausado:              'bg-neutral-500/10 text-neutral-500 border-neutral-500/20',
}

export function EtapaBadge({ etapa, className }: { etapa: EtapaProyecto; className?: string }) {
  return (
    <span className={cn('inline-flex items-center rounded border px-2 py-0.5 text-xs font-medium', COLORES[etapa], className)}>
      {ETAPA_LABEL[etapa]}
    </span>
  )
}
