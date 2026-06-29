import type { EmpresaMarca } from '@/config/modules'

const MARCA: Record<EmpresaMarca, { label: string; dot: string }> = {
  tecnophos: { label: 'Tecnophos', dot: '#1d4ed8' },
  adc: { label: 'ADC', dot: '#F26F21' },
}

interface Props {
  empresas: readonly EmpresaMarca[]
  className?: string
}

/** Chips que indican a qué empresa(s) pertenece un módulo. */
export function EmpresaPills({ empresas, className }: Props) {
  return (
    <div className={`flex flex-wrap items-center gap-1.5 ${className ?? ''}`}>
      {empresas.map((e) => {
        const m = MARCA[e]
        return (
          <span
            key={e}
            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/40 px-2 py-0.5 text-[11px] font-medium text-muted-foreground"
          >
            <span className="size-1.5 rounded-full" style={{ backgroundColor: m.dot }} />
            {m.label}
          </span>
        )
      })}
    </div>
  )
}
