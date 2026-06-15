'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Empresa, Perfil } from '@/types'
import type { User } from '@supabase/supabase-js'
import { cn } from '@/lib/utils'
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

// Color identitario por empresa (etiqueta de dato, no el acento de la app).
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

  const navItem = (href: string, label: string, Icon: LucideIcon) => (
    <Link
      href={href}
      className={cn(
        'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
        isActive(href)
          ? 'bg-primary/15 text-blue-300 ring-1 ring-inset ring-primary/25'
          : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
      )}
    >
      <Icon className="size-4 shrink-0" />
      {label}
    </Link>
  )

  return (
    <aside className="flex h-full w-64 shrink-0 flex-col border-r bg-sidebar">
      <div className="flex h-16 items-center border-b px-5">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo-tecnophos.svg" alt="Tecnophos" className="h-8 w-auto" />
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
        {navItem('/', 'Inicio', Home)}
        {navItem('/dashboard', 'Dashboard', LayoutDashboard)}
        {navItem('/empleados', 'Todos los empleados', Users)}
        {navItem('/vencimientos', 'Vencimientos', CalendarClock)}

        <p className="px-3 pb-1 pt-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Empresas
        </p>
        {empresas.map((emp) => (
          <Link
            key={emp.id}
            href={`/empresa/${emp.slug}`}
            className={cn(
              'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
              pathname.startsWith(`/empresa/${emp.slug}`)
                ? 'bg-primary/15 text-blue-300 ring-1 ring-inset ring-primary/25'
                : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
            )}
          >
            <span className={cn('size-2.5 shrink-0 rounded-full', EMPRESA_COLORS[emp.slug] ?? 'bg-zinc-400')} />
            <span className="truncate">{emp.nombre}</span>
          </Link>
        ))}

        {perfil?.rol === 'admin' && (
          <>
            <p className="px-3 pb-1 pt-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Admin
            </p>
            {navItem('/admin/empleados/nuevo', 'Nuevo empleado', UserPlus)}
            {navItem('/admin/usuarios', 'Usuarios', ShieldCheck)}
          </>
        )}
      </nav>

      <div className="border-t p-3">
        <div className="flex items-center gap-3 px-2 py-2">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10">
            <span className="text-xs font-semibold text-primary">
              {(perfil?.nombre ?? user.email ?? 'U')[0].toUpperCase()}
            </span>
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-foreground">{perfil?.nombre ?? user.email}</p>
            <p className="truncate text-xs capitalize text-muted-foreground">{perfil?.rol ?? 'usuario'}</p>
          </div>
          <button
            onClick={handleLogout}
            title="Cerrar sesión"
            className="text-muted-foreground transition-colors hover:text-foreground"
          >
            <LogOut className="size-4" />
          </button>
        </div>
      </div>
    </aside>
  )
}
