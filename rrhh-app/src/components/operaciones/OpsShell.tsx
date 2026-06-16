'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { ThemeToggle } from '@/components/theme-toggle'
import {
  Home,
  Users,
  MapPin,
  CalendarCheck,
  CalendarRange,
  ClipboardList,
  Clock,
  FileText,
  Package,
  MessageSquare,
  Menu,
  X,
  ArrowLeft,
  type LucideIcon,
} from 'lucide-react'

const NAV: { href: string; label: string; icon: LucideIcon }[] = [
  { href: '/operaciones', label: 'Resumen', icon: Home },
  { href: '/operaciones/personal', label: 'Personal', icon: Users },
  { href: '/operaciones/areas', label: 'Sitios y áreas', icon: MapPin },
  { href: '/operaciones/cronograma', label: 'Cronograma', icon: CalendarRange },
  { href: '/operaciones/asistencia', label: 'Asistencia', icon: CalendarCheck },
  { href: '/operaciones/asignaciones', label: 'Asignación', icon: ClipboardList },
  { href: '/operaciones/tiempos', label: 'Tiempos', icon: Clock },
  { href: '/operaciones/reportes', label: 'Reporte diario', icon: FileText },
  { href: '/operaciones/stock', label: 'Consumibles', icon: Package },
  { href: '/operaciones/feedback', label: 'Feedback UNIPAR', icon: MessageSquare },
]

export function OpsShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)

  const isActive = (href: string) =>
    href === '/operaciones' ? pathname === href : pathname.startsWith(href)

  const sidebar = (
    <div className="flex h-full flex-col bg-sidebar">
      <div className="flex h-16 items-center justify-between gap-2 border-b border-white/10 px-4">
        <div className="min-w-0">
          <p className="font-semibold leading-tight text-white">Operaciones</p>
          <p className="truncate text-xs text-slate-400">Contrato UNIPAR · Bahía Blanca</p>
        </div>
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label="Cerrar menú"
          className="inline-flex size-9 items-center justify-center rounded-md text-slate-400 hover:bg-white/10 hover:text-white lg:hidden"
        >
          <X className="size-5" />
        </button>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
        {NAV.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            onClick={() => setOpen(false)}
            className={cn(
              'flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors',
              isActive(href)
                ? 'bg-primary/15 text-white ring-1 ring-inset ring-primary/30'
                : 'text-slate-400 hover:bg-white/5 hover:text-white'
            )}
          >
            <Icon className="size-4 shrink-0" strokeWidth={1.75} />
            {label}
          </Link>
        ))}
      </nav>

      <div className="flex items-center justify-between border-t border-white/10 p-3">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm text-slate-400 transition-colors hover:bg-white/10 hover:text-white"
        >
          <ArrowLeft className="size-4" strokeWidth={1.75} />
          Inicio
        </Link>
        <ThemeToggle className="text-slate-400 hover:bg-white/10 hover:text-white" />
      </div>
    </div>
  )

  return (
    <div className="flex min-h-[100dvh] bg-background">
      {/* Sidebar desktop */}
      <aside className="hidden w-64 shrink-0 border-r border-white/10 lg:block">{sidebar}</aside>

      {/* Drawer móvil */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/60 lg:hidden"
          onClick={() => setOpen(false)}
          aria-hidden
        />
      )}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 w-72 transform shadow-xl transition-transform duration-200 lg:hidden',
          open ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {sidebar}
      </aside>

      {/* Contenido */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b bg-card px-4 lg:hidden">
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label="Abrir menú"
            className="inline-flex size-9 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <Menu className="size-5" />
          </button>
          <span className="font-semibold">Operaciones</span>
          <div className="ml-auto">
            <ThemeToggle />
          </div>
        </header>

        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-5xl p-4 sm:p-6 lg:p-8">{children}</div>
        </main>
      </div>
    </div>
  )
}
