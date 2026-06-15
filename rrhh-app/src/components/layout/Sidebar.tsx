'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Empresa, Perfil } from '@/types'
import type { User } from '@supabase/supabase-js'
import { cn } from '@/lib/utils'
import { ThemeToggle } from '@/components/theme-toggle'
import {
  Home,
  LayoutDashboard,
  Users,
  CalendarClock,
  UserPlus,
  ShieldCheck,
  LogOut,
  type LucideIcon,
} from 'lucide-react'

const EMPRESA_COLORS: Record<string, string> = {
  'tecnophos-bb': 'bg-indigo-500',
  'tecnophos-rosario': 'bg-sky-500',
  'tecnophos-necochea': 'bg-emerald-500',
  adc: 'bg-amber-500',
}

interface Props {
  empresas: Empresa[]
  perfil: Perfil | null
  user: User
}

export default function Sidebar({ empresas, perfil, user }: Props) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + '/')

  const itemBase = 'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors'
  const itemInactive = 'text-slate-400 hover:bg-white/5 hover:text-white'
  const itemActive = 'bg-primary/15 text-white ring-1 ring-inset ring-primary/30'

  const navItem = (href: string, label: string, Icon: LucideIcon) => (
    <Link href={href} className={cn(itemBase, isActive(href) ? itemActive : itemInactive)}>
      <Icon className="size-4 shrink-0" strokeWidth={1.75} />
      {label}
    </Link>
  )

  return (
    <aside className="flex h-full w-64 shrink-0 flex-col border-r border-white/10 bg-sidebar">
      <div className="flex h-16 items-center border-b border-white/10 px-5">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo-tecnophos.svg" alt="Tecnophos" className="h-8 w-auto" />
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
        {navItem('/', 'Inicio', Home)}
        {navItem('/dashboard', 'Dashboard', LayoutDashboard)}
        {navItem('/empleados', 'Empleados', Users)}
        {navItem('/vencimientos', 'Vencimientos', CalendarClock)}

        <p className="px-3 pb-1 pt-5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
          Empresas
        </p>
        {empresas.map((emp) => (
          <Link
            key={emp.id}
            href={`/empresa/${emp.slug}`}
            className={cn(
              itemBase,
              pathname.startsWith(`/empresa/${emp.slug}`) ? itemActive : itemInactive
            )}
          >
            <span className={cn('size-2 shrink-0 rounded-full', EMPRESA_COLORS[emp.slug] ?? 'bg-slate-500')} />
            <span className="truncate">{emp.nombre}</span>
          </Link>
        ))}

        {perfil?.rol === 'admin' && (
          <>
            <p className="px-3 pb-1 pt-5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              Admin
            </p>
            {navItem('/admin/empleados/nuevo', 'Nuevo empleado', UserPlus)}
            {navItem('/admin/usuarios', 'Usuarios', ShieldCheck)}
          </>
        )}
      </nav>

      <div className="border-t border-white/10 p-3">
        <div className="flex items-center gap-3 px-1 py-1.5">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary/20">
            <span className="text-xs font-semibold text-blue-200">
              {(perfil?.nombre ?? user.email ?? 'U')[0].toUpperCase()}
            </span>
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-white">{perfil?.nombre ?? user.email}</p>
            <p className="truncate text-xs capitalize text-slate-400">{perfil?.rol ?? 'usuario'}</p>
          </div>
          <ThemeToggle className="text-slate-400 hover:bg-white/10 hover:text-white" />
          <button
            onClick={handleLogout}
            title="Cerrar sesión"
            className="inline-flex size-8 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-white/10 hover:text-white"
          >
            <LogOut className="size-4" strokeWidth={1.75} />
          </button>
        </div>
      </div>
    </aside>
  )
}
