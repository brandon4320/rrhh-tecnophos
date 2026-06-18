import { cn } from '@/lib/utils'
import { EMPRESA_COLOR, EMPRESA_DOT, EMPRESA_LABEL, type Empresa } from '@/modules/comercial/tipos'

export function EmpresaBadge({ empresa, size = 'sm' }: { empresa: string | null; size?: 'xs' | 'sm' }) {
  if (!empresa) return null
  const color = EMPRESA_COLOR[empresa as Empresa] ?? 'bg-muted text-muted-foreground border-border'
  const label = EMPRESA_LABEL[empresa as Empresa] ?? empresa.toUpperCase()
  return (
    <span className={cn(
      'inline-flex items-center gap-1 rounded border font-medium leading-none',
      size === 'xs' ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-0.5 text-xs',
      color
    )}>
      <span className={cn('size-1.5 rounded-full shrink-0', EMPRESA_DOT[empresa as Empresa] ?? 'bg-muted-foreground')} />
      {label}
    </span>
  )
}
