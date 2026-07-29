'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import { ThemeToggle } from '@/components/theme-toggle'
import { Monograma } from '@/components/ui/monograma'
import {
  LayoutDashboard,
  ShieldCheck,
  UserPlus,
  LogOut,
  Home,
  ChevronsUpDown,
  Check,
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

// Isologos por empresa (las 3 sedes Tecnophos comparten marca)
const LOGO_EMPRESA: Record<string, string> = {
  'tecnophos-bb': '/logo-tecnophos-iso.png',
  'tecnophos-rosario': '/logo-tecnophos-iso.png',
  'tecnophos-necochea': '/logo-tecnophos-iso.png',
  adc: '/logo-adc.png',
  serviwhite: '/logo-serviwhite-iso.png',
}

function LogoEmpresa({ slug, nombre, size }: { slug: string; nombre: string; size: 'sm' | 'md' }) {
  const src = LOGO_EMPRESA[slug]
  const cls = size === 'md' ? 'size-9 p-1' : 'size-7 p-0.5'
  if (!src) return <Monograma nombre={nombre} size={size} />
  return (
    <span className={`inline-flex shrink-0 items-center justify-center rounded-lg border border-border bg-white ${cls}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={nombre} className="max-h-full max-w-full object-contain" />
    </span>
  )
}

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
    } catch { /* sin preferencia */ }
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

  const vistas = activa
    ? [
        { key: 'resumen', label: 'Resumen', href: `/empresa/${activa.slug}`, active: pathname === `/empresa/${activa.slug}` },
        { key: 'empleados', label: 'Empleados', href: `/empleados?empresa=${activa.slug}`, active: pathname.startsWith('/empleados') },
        { key: 'vencimientos', label: 'Vencimientos', href: `/vencimientos?empresa=${activa.slug}`, active: pathname.startsWith('/vencimientos') },
        { key: 'documentacion', label: 'Documentación', href: `/empresa/${activa.slug}?vista=documentacion`, active: false },
      ]
    : []

  const itemCls = (active: boolean) =>
    cn(
      'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
      active
        ? 'bg-accent text-accent-foreground'
        : 'text-muted-foreground hover:bg-muted hover:text-foreground'
    )

  return (
    <div className="flex h-dvh overflow-hidden bg-background">
      {/* ── Sidebar única (clara) ── */}
      <aside className="flex w-64 shrink-0 flex-col border-r border-border bg-card">
        <div className="px-5 pb-2 pt-5">
          <p className="text-base font-semibold tracking-tight">Gestión</p>
          <p className="text-xs text-muted-foreground">Tecnophos · ADC · Serviwhite</p>
        </div>

        {/* Vista global */}
        <div className="px-3 pt-3">
          <Link href="/dashboard" className={itemCls(pathname.startsWith('/dashboard'))}>
            <LayoutDashboard className="size-4 shrink-0" strokeWidth={1.75} />
            Dashboard general
          </Link>
        </div>

        {/* Empresa activa */}
        {activa && (
          <div className="relative px-3 pt-5">
            <p className="px-2 pb-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              Empresa activa
            </p>
            <button
              onClick={() => setSelectorOpen((v) => !v)}
              className="flex w-full items-center gap-3 rounded-xl border border-border bg-background px-3 py-2.5 text-left transition-colors hover:border-input"
            >
              <LogoEmpresa slug={activa.slug} nombre={activa.nombre} size="md" />
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
                      <LogoEmpresa slug={e.slug} nombre={e.nombre} size="sm" />
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

        <nav className="flex-1 overflow-y-auto px-3 py-5">
          <p className="px-2 pb-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            Vistas
          </p>
          <div className="space-y-0.5">
            {vistas.map((v) => (
              <Link key={v.key} href={v.href} className={itemCls(v.active)}>
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

          {esAdmin && (
            <>
              <p className="px-2 pb-2 pt-6 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                Administración
              </p>
              <div className="space-y-0.5">
                <Link href="/admin/empleados/nuevo" className={itemCls(pathname.startsWith('/admin/empleados'))}>
                  <UserPlus className="size-4 shrink-0" strokeWidth={1.75} />
                  Nuevo empleado
                </Link>
                <Link href="/admin/usuarios" className={itemCls(pathname.startsWith('/admin/usuarios'))}>
                  <ShieldCheck className="size-4 shrink-0" strokeWidth={1.75} />
                  Usuarios
                </Link>
              </div>
            </>
          )}
        </nav>

        {/* Footer: usuario + acciones */}
        <div className="border-t border-border p-3">
          <div className="flex items-center gap-2.5 px-1 py-1">
            <Monograma nombre={sesion.nombre ?? sesion.email} size="sm" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{sesion.nombre ?? sesion.email}</p>
              <p className="truncate text-[11px] capitalize text-muted-foreground">{sesion.rol}</p>
            </div>
            <Link
              href="/"
              title="Inicio (módulos)"
              className="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <Home className="size-4" strokeWidth={1.75} />
            </Link>
            <ThemeToggle />
            <button
              onClick={handleLogout}
              title="Cerrar sesión"
              className="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <LogOut className="size-4" strokeWidth={1.75} />
            </button>
          </div>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto">{children}</main>
    </div>
  )
}
