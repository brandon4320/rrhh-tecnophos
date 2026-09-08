import { ExternalLink, FileQuestionMark, Upload } from 'lucide-react'
import { ENLACES_ARCOR } from '@/modules/arcor/enlaces'
import { cn } from '@/lib/utils'

/**
 * Acciones operativas del sistema ARCOR, desde Gestión: cargar un certificado a
 * mano y resolver las lecturas dudosas. Abren el sistema externo en pestaña nueva
 * (tiene su propia página; Gestión solo observa). Reemplaza a la fila externa
 * "Certificados dudosos - ARCOR" que antes vivía en el hub.
 */
export function AccionesArcor({ revisar = 0, className }: { revisar?: number; className?: string }) {
  return (
    <div className={cn('flex flex-wrap items-center gap-2', className)}>
      <a
        href={ENLACES_ARCOR.revisar}
        target="_blank"
        rel="noopener noreferrer"
        className={cn(
          'inline-flex items-center gap-2 rounded-xl border bg-card px-4 py-2.5 text-sm font-medium transition-colors',
          revisar > 0
            ? 'border-danger/30 text-danger hover:bg-danger-subtle'
            : 'border-border text-muted-foreground hover:bg-muted hover:text-foreground'
        )}
      >
        <FileQuestionMark className="size-4" strokeWidth={1.75} />
        Revisar dudosas
        {revisar > 0 && (
          <span className="rounded-full bg-danger-subtle px-2 py-0.5 text-xs font-semibold tabular-nums text-danger">
            {revisar}
          </span>
        )}
        <ExternalLink className="size-3.5 opacity-60" strokeWidth={1.75} />
      </a>
      <a
        href={ENLACES_ARCOR.cargar}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
      >
        <Upload className="size-4" strokeWidth={2} />
        Carga manual
        <ExternalLink className="size-3.5 opacity-70" strokeWidth={1.75} />
      </a>
    </div>
  )
}
