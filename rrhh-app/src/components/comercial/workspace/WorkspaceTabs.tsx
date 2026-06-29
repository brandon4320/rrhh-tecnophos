import Link from 'next/link'
import { cn } from '@/lib/utils'
import { CalendarDays, FolderKanban, LayoutGrid, UsersRound } from 'lucide-react'

const TABS = [
  { key: 'hoy',       label: 'Hoy',          icon: CalendarDays, soloGestion: false },
  { key: 'proyectos', label: 'Por proyecto', icon: FolderKanban, soloGestion: false },
  { key: 'comercial', label: 'Por comercial', icon: UsersRound,  soloGestion: true },
  { key: 'tablero',   label: 'Tablero',      icon: LayoutGrid,   soloGestion: false },
] as const

export function WorkspaceTabs({ vista, esGestion }: { vista: string; esGestion: boolean }) {
  return (
    <div className="flex gap-1 overflow-x-auto border-b border-border no-scrollbar">
      {TABS.filter((t) => !t.soloGestion || esGestion).map((t) => {
        const active = vista === t.key
        return (
          <Link
            key={t.key}
            href={`/comercial?vista=${t.key}`}
            className={cn(
              'flex items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-medium transition-colors',
              active
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            )}
          >
            <t.icon className="size-4" strokeWidth={1.75} />
            {t.label}
          </Link>
        )
      })}
    </div>
  )
}
