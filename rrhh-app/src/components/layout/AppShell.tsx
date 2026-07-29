'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import { ThemeToggle } from '@/components/theme-toggle'
import { Monograma } from '@/components/ui/monograma'
import {
  Home,
  LayoutDashboard,
  Users,
  CalendarClock,
  ShieldCheck,
  UserPlus,
  LogOut,
  ChevronsUpDown,
  Check,
  type LucideIcon,
} from 'lucide-react'

export interface EmpresaNav {
  id: string
  nombre: string
  slug: string
  total: number
  sectores: { nombre: string; count: number }[]
}

interface Props {
  empresas: EmpresaNav[]
  sesion: { nombre: string | null; email: string | null; rol: string }
  children: React.ReactNode
}

const STORAGE_KEY = 'empresa_activa'

export default function AppShell({ empresas, sesion, children }: Props) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()
  const [selectorOpen, setSelectorOpen] = useState(false)
  const [preferida, setPreferida] = useState<string | null>(null)

  // Empresa activa: URL (/empresa/[slug] o ?empresa=) → última usada → primera
  useEffect(() => {
    try {
      const url = new URL(window.location.href)
      const porQuery = url.searchParams.get('empresa')
      if (porQuery) {
        setPreferida(porQuery)
        localStorage.setItem(STORAGE_KEY, porQuery)
        return
      }
      const guardada = localStorage.getItem(STORAGE_KEY)
      if (guardada) setPreferida(guardada)
    } catch { /* SSR/privacidad: sin preferencia */ }
  }, [pathname])

  const slugEnPath = pathname.startsWith('/empresa/') ? pathname.split('/')[2] : null

  const activa = useMemo(() => {
    const porPath = slugEnPath && empresas.find((e) => e.slug === slugEnPath)
    if (porPath) return porPath
    const porPref = preferida && empresas.find((e) => e.slug === preferida)
    if (porPref) return porPref
    return empresas[0] ?? null
  }, [slugEnPath, preferida, empresas])

  useEffect(() => {
    if (slugEnPath && empresas.some((e) => e.slug === slugEnPath)) {
      try { localStorage.setItem(STORAGE_KEY, slugEnPath) } catch { /* no-op */ }
    }
  }, [slugEnPath, empresas])

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  function cambiarEmpresa(slug: string) {
    try { localStorage.setItem(STORAGE_KEY, slug) } catch { /* no-op */ }
    setPreferida(slug)
    setSelectorOpen(false)
    router.push(`/empresa/${slug}`)
  }

  const esAdmin = sesion.rol === 'admin'
  const isActive = (href: string) => pathname === href || pathname.startsWith(href + '/')

  // Ítems del rail (accesos globales)
  const railItems: { href: string; label: string; icon: LucideIcon }[] = [
    { href: '/dashboard', label: 'Resumen general', icon: LayoutDashboard },
    { href: '/empleados', label: 'Empleados', icon: Users },
    { href: '/vencimientos', label: 'Vencimientos', icon: CalendarClock },
  ]

  // Vistas de la empresa activa (panel)
  const vistas = activa
    ? [
        { key: 'resumen', label: 'Resumen', href: `/empresa/${activa.slug}`, active: pathname === `/empresa/${activa.slug}` },
        { key: 'empleados', label: 'Empleados', href: `/empleados?empresa=${activa.slug}`, active: false },
        { key: 'vencimientos', label: 'Vencimientos', href: `/vencimientos?empresa=${activa.slug}`, active: false },
        { key: 'documentacion', label: 'Documentación', href: `/empresa/${activa.slug}?vista=documentacion`, active: false },
      ]
    : []

  return (
    <div className="flex h-dvh overflow-hidden bg-background">
      {/* ── Rail oscuro ── */}
      <aside className="flex w-16 shrink-0 flex-col items-center border-r border-sidebar-border bg-sidebar py-4">
        <Link
          href="/"
          title="Inicio"
          className="mb-6 flex size-10 items-center justify-center rounded-xl bg-sidebar-primary text-sm font-bold text-white transition-opacity hover:opacity-90"
        >
          G
        </Link>

        <nav className="flex flex-1 flex-col items-center gap-1.5">
          {railItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              title={item.label}
              className={cn(
                'flex size-10 items-center justify-center rounded-xl transition-colors',
                isActive(item.href)
                  ? 'bg-sidebar-accent text-white'
                  : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-white'
              )}
            >
              <item.icon className="size-[18px]" strokeWidth={1.75} />
            </Link>
          ))}
          {esAdmin && (
            <>
              <div className="my-2 h-px w-8 bg-sidebar-border" />
              <Link
                href="/admin/empleados/nuevo"
                title="Nuevo empleado"
                className={cn(
                  'flex size-10 items-center justify-center rounded-xl transition-colors',
                  isActive('/admin/empleados')
                    ? 'bg-sidebar-accent text-white'
                    : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-white'
                )}
              >
                <UserPlus className="size-[18px]" strokeWidth={1.75} />
              </Link>
              <Link
                href="/admin/usuarios"
                title="Usuarios"
                className={cn(
                  'flex size-10 items-center justify-center rounded-xl transition-colors',
                  isActive('/admin/usuarios')
                    ? 'bg-sidebar-accent text-white'
                    : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-white'
                )}
              >
                <ShieldCheck className="size-[18px]" strokeWidth={1.75} />
              </Link>
            </>
          )}
        </nav>

        <div className="flex flex-col items-center gap-2">
          <ThemeToggle className="text-sidebar-foreground hover:bg-sidebar-accent hover:text-white" />
          <button
            onClick={handleLogout}
            title="Cerrar sesión"
            className="flex size-8 items-center justify-center rounded-md text-sidebar-foreground transition-colors hover:bg-sidebar-accent hover:text-white"
          >
            <LogOut className="size-4" strokeWidth={1.75} />
          </button>
          <span
            title={sesion.nombre ?? sesion.email ?? ''}
            className="mt-1 flex size-9 items-center justify-center rounded-full bg-sidebar-accent text-xs font-semibold text-white"
          >
            {(sesion.nombre ?? sesion.email ?? 'U')[0].toUpperCase()}
          </span>
        </div>
      </aside>

      {/* ── Panel claro ── */}
      <aside className="hidden w-64 shrink-0 flex-col border-r border-border bg-card md:flex">
        <div className="px-5 pb-2 pt-5">
          <p className="text-base font-semibold tracking-tight">Gestión</p>
          <p className="text-xs text-muted-foreground">Tecnophos · ADC · Serviwhite</p>
        </div>

        {/* Empresa activa */}
        {activa && (
          <div className="relative px-3 pt-4">
            <p className="px-2 pb-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              Empresa activa
            </p>
            <button
              onClick={() => setSelectorOpen((v) => !v)}
              className="flex w-full items-center gap-3 rounded-xl border border-border bg-background px-3 py-2.5 text-left transition-colors hover:border-input"
            >
              <Monograma nombre={activa.nombre} variant="accent" size="md" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{activa.nombre}</span>
                <span className="block text-xs text-muted-foreground">
                  {activa.total} {activa.total === 1 ? 'empleado' : 'empleados'}
                </span>
              </span>
              <ChevronsUpDown className="size-4 shrink-0 text-muted-foreground" strokeWidth={1.75} />
            </button>

            {selectorOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setSelectorOpen(false)} />
                <div className="absolute left-3 right-3 z-50 mt-2 overflow-hidden rounded-xl border border-border bg-popover shadow-lg">
                  {empresas.map((e) => (
                    <button
                      key={e.id}
                      onClick={() => cambiarEmpresa(e.slug)}
                      className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-muted"
                    >
                      <Monograma nombre={e.nombre} size="sm" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm">{e.nombre}</span>
                        <span className="block text-[11px] text-muted-foreground">{e.total} empleados</span>
                      </span>
                      {e.id === activa.id && <Check className="size-4 shrink-0 text-primary" strokeWidth={2} />}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {/* Vistas de la empresa activa */}
        <nav className="flex-1 overflow-y-auto px-3 py-5">
          <p className="px-2 pb-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            Vistas
          </p>
          <div className="space-y-0.5">
            {vistas.map((v) => (
              <Link
                key={v.key}
                href={v.href}
                className={cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                  v.active
                    ? 'bg-accent text-accent-foreground'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                )}
              >
                <span
                  className={cn(
                    'size-1.5 shrink-0 rounded-full',
                    v.active ? 'bg-primary' : 'bg-muted-foreground/30'
                  )}
                />
                {v.label}
              </Link>
            ))}
          </div>

          {/* Sectores de la empresa activa */}
          {activa && activa.sectores.length > 0 && (
            <>
              <p className="px-2 pb-2 pt-6 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                Sectores
              </p>
              <div className="space-y-0.5">
                {activa.sectores.map((s) => (
                  <Link
                    key={s.nombre}
                    href={`/empresa/${activa.slug}`}
                    className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  >
                    <span className="size-1.5 shrink-0 rounded-full bg-muted-foreground/30" />
                    <span className="min-w-0 flex-1 truncate">{s.nombre}</span>
                    <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium tabular-nums">
                      {s.count}
                    </span>
                  </Link>
                ))}
              </div>
            </>
          )}
        </nav>
      </aside>

      <main className="flex-1 overflow-y-auto">{children}</main>
    </div>
  )
}
