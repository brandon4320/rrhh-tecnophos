'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { ThemeToggle } from '@/components/theme-toggle'
import { AdcLogo } from '@/components/brand/AdcLogo'
import {
  House, CheckSquare, CalendarDays, FolderKanban,
  Building2, Users, Plane, BarChart3, Settings2,
  UsersRound, ArrowLeft, X, Plus, type LucideIcon,
} from 'lucide-react'

interface NavItem { href: string; label: string; icon: LucideIcon; roles?: string[] }

const BOTTOM_NAV: NavItem[] = [
  { href: '/comercial',           label: 'Hoy',       icon: House },
  { href: '/comercial/tareas',    label: 'Tareas',    icon: CheckSquare },
  { href: '/comercial/agenda',    label: 'Agenda',    icon: CalendarDays },
  { href: '/comercial/proyectos', label: 'Proyectos', icon: FolderKanban },
]

const SIDEBAR_NAV: NavItem[] = [
  { href: '/comercial',               label: 'Hoy',           icon: House },
  { href: '/comercial/tareas',        label: 'Tareas',        icon: CheckSquare },
  { href: '/comercial/agenda',        label: 'Agenda',        icon: CalendarDays },
  { href: '/comercial/proyectos',     label: 'Proyectos',     icon: FolderKanban },
  { href: '/comercial/clientes',      label: 'Clientes',      icon: Building2 },
  { href: '/comercial/contactos',     label: 'Contactos',     icon: Users },
  { href: '/comercial/viajes',        label: 'Viajes',        icon: Plane },
  { href: '/comercial/equipo',        label: 'Equipo',        icon: UsersRound, roles: ['admin', 'direccion', 'gerente_comercial'] },
  { href: '/comercial/reportes',      label: 'Reportes',      icon: BarChart3,  roles: ['admin', 'direccion', 'gerente_comercial'] },
  { href: '/comercial/configuracion', label: 'Configuración', icon: Settings2,  roles: ['admin', 'direccion', 'gerente_comercial'] },
]

const MORE_NAV: NavItem[] = [
  { href: '/comercial/clientes',      label: 'Clientes',    icon: Building2 },
  { href: '/comercial/contactos',     label: 'Contactos',   icon: Users },
  { href: '/comercial/viajes',        label: 'Viajes',      icon: Plane },
  { href: '/comercial/equipo',        label: 'Equipo',      icon: UsersRound, roles: ['admin', 'direccion', 'gerente_comercial'] },
  { href: '/comercial/reportes',      label: 'Reportes',    icon: BarChart3,  roles: ['admin', 'direccion', 'gerente_comercial'] },
  { href: '/comercial/configuracion', label: 'Config.',     icon: Settings2,  roles: ['admin', 'direccion', 'gerente_comercial'] },
]

export function ComercialShell({ children, rol }: { children: React.ReactNode; rol: string; nombre?: string | null }) {
  const pathname = usePathname()
  const [moreOpen, setMoreOpen] = useState(false)

  const isActive = (href: string) =>
    href === '/comercial' ? pathname === href : pathname.startsWith(href)

  const sidebarNav = SIDEBAR_NAV.filter((i) => !i.roles || i.roles.includes(rol))
  const moreNav    = MORE_NAV.filter((i) => !i.roles || i.roles.includes(rol))
  const isMoreActive = moreNav.some((i) => isActive(i.href))

  const sidebar = (
    <div className="flex h-full flex-col bg-sidebar">
      <div className="flex h-16 items-center border-b border-white/10 px-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo-tecnophos.svg" alt="Tecnophos" className="h-5 w-auto" />
            <span className="h-4 w-px bg-white/15" />
            <AdcLogo variant="mark" className="h-5 w-auto text-white" />
          </div>
          <p className="mt-1 truncate text-xs text-slate-400">Gestión Comercial</p>
        </div>
      </div>
      <nav className="flex-1 space-y-0.5 overflow-y-auto px-2 py-3">
        {sidebarNav.map(({ href, label, icon: Icon }) => (
          <Link key={href} href={href}
            className={cn('flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors',
              isActive(href)
                ? 'bg-primary/15 text-white ring-1 ring-inset ring-primary/30'
                : 'text-slate-400 hover:bg-white/5 hover:text-white'
            )}>
            <Icon className="size-4 shrink-0" strokeWidth={1.75} />
            {label}
          </Link>
        ))}
      </nav>
      <div className="flex items-center justify-between border-t border-white/10 p-3">
        <Link href="/" className="inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm text-slate-400 hover:bg-white/10 hover:text-white">
          <ArrowLeft className="size-4" strokeWidth={1.75} />
          Inicio
        </Link>
        <ThemeToggle className="text-slate-400 hover:bg-white/10 hover:text-white" />
      </div>
    </div>
  )

  return (
    <div className="flex min-h-[100dvh] bg-background">
      <aside className="hidden w-60 shrink-0 border-r border-white/10 lg:block">{sidebar}</aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b bg-card px-4 lg:hidden">
          <span className="font-semibold">Gestión Comercial</span>
          <div className="flex items-center gap-1">
            <ThemeToggle />
            <Link href="/" className="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent">
              <ArrowLeft className="size-4" strokeWidth={1.75} />
            </Link>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-5xl p-4 pb-24 sm:p-5 lg:p-8 lg:pb-8">{children}</div>
        </main>
      </div>

      {/* FAB — nueva tarea rápida */}
      <Link href="/comercial/tareas/nueva"
        className="fixed bottom-[5.25rem] right-4 z-50 flex size-13 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg hover:bg-primary/90 active:scale-95 transition-all lg:hidden"
        aria-label="Nueva tarea">
        <Plus className="size-6" strokeWidth={2.5} />
      </Link>

      {/* Bottom nav mobile */}
      <nav className="fixed inset-x-0 bottom-0 z-40 flex h-[4.25rem] items-stretch border-t bg-card lg:hidden">
        {BOTTOM_NAV.map(({ href, label, icon: Icon }) => (
          <Link key={href} href={href}
            className={cn('flex flex-1 flex-col items-center justify-center gap-1 text-[10px] font-medium',
              isActive(href) ? 'text-primary' : 'text-muted-foreground'
            )}>
            <Icon className="size-[1.35rem]" strokeWidth={isActive(href) ? 2.2 : 1.75} />
            {label}
          </Link>
        ))}
        <button type="button" onClick={() => setMoreOpen((v) => !v)}
          className={cn('flex flex-1 flex-col items-center justify-center gap-1 text-[10px] font-medium',
            moreOpen || isMoreActive ? 'text-primary' : 'text-muted-foreground'
          )}>
          <svg viewBox="0 0 24 24" className="size-[1.35rem]" stroke="currentColor" fill="none" strokeWidth={moreOpen || isMoreActive ? 2.2 : 1.75}>
            <circle cx="5" cy="12" r="1.5" /><circle cx="12" cy="12" r="1.5" /><circle cx="19" cy="12" r="1.5" />
          </svg>
          Más
        </button>
      </nav>

      {/* Menú "Más" */}
      {moreOpen && (
        <>
          <div className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={() => setMoreOpen(false)} aria-hidden />
          <div className="fixed inset-x-0 bottom-[4.25rem] z-50 rounded-t-2xl border-t bg-card shadow-2xl lg:hidden">
            <div className="flex items-center justify-between border-b border-border px-5 py-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Más opciones</p>
              <button onClick={() => setMoreOpen(false)} className="p-1 text-muted-foreground hover:text-foreground">
                <X className="size-4" />
              </button>
            </div>
            <div className="grid grid-cols-3 gap-1 p-3">
              {moreNav.map(({ href, label, icon: Icon }) => (
                <Link key={href} href={href} onClick={() => setMoreOpen(false)}
                  className={cn('flex flex-col items-center gap-2 rounded-xl px-2 py-3.5 text-xs font-medium',
                    isActive(href) ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                  )}>
                  <Icon className="size-6" strokeWidth={1.75} />
                  {label}
                </Link>
              ))}
            </div>
            <div className="px-4 pb-5 pt-1">
              <Link href="/" onClick={() => setMoreOpen(false)} className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm text-muted-foreground hover:bg-accent hover:text-foreground">
                <ArrowLeft className="size-4" strokeWidth={1.75} />
                Volver al inicio
              </Link>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
