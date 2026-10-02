'use client'

import { useEffect, useMemo, useState, useTransition } from 'react'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useTheme } from 'next-themes'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import { Monograma } from '@/components/ui/monograma'
import {
  Activity,
  Bell,
  Building2,
  CalendarClock,
  Check,
  ChevronsUpDown,
  Container,
  Ellipsis,
  ExternalLink,
  FolderOpen,
  Home,
  KeyRound,
  LayoutGrid,
  LogOut,
  Moon,
  Package,
  ShieldCheck,
  Sun,
  Truck,
  Upload,
  UserPlus,
  Users,
  type LucideIcon,
} from 'lucide-react'
import { ENLACES_ARCOR } from '@/modules/arcor/enlaces'

export interface EmpresaNav {
  id: string
  nombre: string
  slug: string
  total: number
}

/**
 * Portal del selector: todas las empresas juntas, una empresa real (RRHH) o una
 * entrada virtual (ARCOR).
 */
type Portal =
  | { tipo: 'todas'; id: 'todas'; slug: 'todas'; nombre: string; total: number; empresas: number }
  | (EmpresaNav & { tipo: 'empresa' })
  | { tipo: 'extra'; id: string; slug: string; nombre: string; subtitulo: string; logo: string; href: string }

interface Props {
  empresas: EmpresaNav[]
  /** Muestra la entrada virtual "Tecnophos - ARCOR" (ver modules/arcor/acceso.ts). */
  arcor?: boolean
  sesion: { nombre: string | null; email: string | null; rol: string }
  children: React.ReactNode
}

const STORAGE_KEY = 'empresa_activa'
const TODAS = 'todas'

/**
 * Pantallas que, sin `?empresa=`, muestran a TODAS las empresas. En ellas la
 * ausencia del filtro significa "todas", no "la última que elegiste": si no,
 * el selector decía ADC mientras la página listaba a todo el grupo.
 */
const RUTAS_GLOBALES = ['/dashboard', '/empleados', '/vencimientos', '/flota']

/** Pantallas que existen por empresa con `?empresa=slug`: cambiar de empresa te deja en la misma. */
const RUTAS_POR_EMPRESA = ['/empleados', '/vencimientos', '/flota', '/stock', '/documentos']

// Isologos por empresa (las 3 sedes Tecnophos comparten marca)
const LOGO_EMPRESA: Record<string, string> = {
  'tecnophos-bb': '/logo-tecnophos-iso.png',
  'tecnophos-rosario': '/logo-tecnophos-iso.png',
  'tecnophos-necochea': '/logo-tecnophos-iso.png',
  adc: '/logo-adc.png',
  serviwhite: '/logo-serviwhite-iso.png',
}

// Entrada virtual: no es una empresa de la tabla `empresas` (no tiene empleados ni
// legajos), es la observabilidad del sistema externo de certificados ARCOR.
const PORTAL_ARCOR: Portal = {
  tipo: 'extra',
  id: 'arcor',
  slug: 'arcor',
  nombre: 'Tecnophos - ARCOR',
  subtitulo: 'Certificados de fumigación',
  logo: '/logo-tecnophos-iso.png',
  href: '/arcor',
}

const ROL_LABEL: Record<string, string> = { admin: 'Administrador', usuario: 'Usuario' }

function LogoPortal({ portal, size }: { portal: Portal; size: 'sm' | 'md' }) {
  const caja = size === 'md' ? 'size-9' : 'size-7'
  if (portal.tipo === 'todas') {
    return (
      <span className={cn('inline-flex shrink-0 items-center justify-center rounded-lg border border-border bg-accent text-primary', caja)}>
        <Building2 className={size === 'md' ? 'size-[18px]' : 'size-4'} strokeWidth={1.75} />
      </span>
    )
  }
  const src = portal.tipo === 'extra' ? portal.logo : LOGO_EMPRESA[portal.slug]
  if (!src) return <Monograma nombre={portal.nombre} size={size} />
  return (
    <span className={cn('inline-flex shrink-0 items-center justify-center rounded-lg border border-border bg-white', caja, size === 'md' ? 'p-1' : 'p-0.5')}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={portal.nombre} className="max-h-full max-w-full object-contain" />
    </span>
  )
}

function subtituloDe(p: Portal): string {
  if (p.tipo === 'extra') return p.subtitulo
  const empleados = `${p.total} ${p.total === 1 ? 'empleado' : 'empleados'}`
  return p.tipo === 'todas' ? `${p.empresas} empresas · ${empleados}` : empleados
}

type Item = { key: string; label: string; href: string; icon: LucideIcon; active: boolean; external?: boolean }
type Grupo = { titulo: string | null; items: Item[] }

export default function AppShell({ empresas, arcor = false, sesion, children }: Props) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const empresaEnQuery = searchParams.get('empresa')
  const router = useRouter()
  const supabase = createClient()
  const { resolvedTheme, setTheme } = useTheme()
  const [montado, setMontado] = useState(false)
  const [selectorOpen, setSelectorOpen] = useState(false)
  const [menuUsuario, setMenuUsuario] = useState(false)
  const [preferida, setPreferida] = useState<string | null>(null)
  // Optimista: al elegir un portal la sidebar cambia YA, sin esperar la navegación.
  // `desde` es la URL al momento del click: cuando cambia (llegó la navegación, a
  // destino o superada por otro click) se suelta el override — así ARCOR nunca
  // queda pegado como activa fuera de /arcor.
  const [pendiente, setPendiente] = useState<{ slug: string; desde: string } | null>(null)
  const [, startTransition] = useTransition()
  const urlActual = `${pathname}?${searchParams.toString()}`

  useEffect(() => setMontado(true), [])

  const portales = useMemo<Portal[]>(() => {
    const lista: Portal[] = empresas.map((e) => ({ ...e, tipo: 'empresa' as const }))
    // "Todas" solo tiene sentido si el usuario ve más de una (quien está limitado
    // a una sede no necesita la opción).
    if (empresas.length > 1) {
      lista.unshift({
        tipo: 'todas', id: TODAS, slug: TODAS, nombre: 'Todas las empresas',
        total: empresas.reduce((acc, e) => acc + e.total, 0), empresas: empresas.length,
      })
    }
    if (arcor) lista.push(PORTAL_ARCOR)
    return lista
  }, [empresas, arcor])

  const portalTodas = portales.find((p) => p.tipo === 'todas') ?? null
  const enRutaGlobal = RUTAS_GLOBALES.includes(pathname)

  // Preferencia recordada: la empresa del query, o "todas" en una pantalla global
  // sin filtro, o lo último que quedó guardado.
  useEffect(() => {
    try {
      if (empresaEnQuery) {
        setPreferida(empresaEnQuery)
        localStorage.setItem(STORAGE_KEY, empresaEnQuery)
        return
      }
      if (enRutaGlobal && portalTodas) {
        setPreferida(TODAS)
        localStorage.setItem(STORAGE_KEY, TODAS)
        return
      }
      const guardada = localStorage.getItem(STORAGE_KEY)
      if (guardada) setPreferida(guardada)
    } catch { /* sin preferencia */ }
  }, [pathname, empresaEnQuery, enRutaGlobal, portalTodas])

  const slugEnPath = pathname.startsWith('/arcor')
    ? 'arcor'
    : pathname.startsWith('/empresa/')
      ? pathname.split('/')[2]
      : null

  // La navegación optimista llegó (la URL cambió): soltar el override.
  useEffect(() => {
    if (pendiente && urlActual !== pendiente.desde) setPendiente(null)
  }, [urlActual, pendiente])

  // Cualquier navegación cierra los menús abiertos.
  useEffect(() => {
    setMenuUsuario(false)
    setSelectorOpen(false)
  }, [pathname])

  const activa = useMemo<Portal | null>(() => {
    const porPendiente = pendiente && portales.find((e) => e.slug === pendiente.slug)
    if (porPendiente) return porPendiente
    const porPath = slugEnPath && portales.find((e) => e.slug === slugEnPath)
    if (porPath) return porPath
    if (empresaEnQuery) {
      const porQuery = portales.find((e) => e.slug === empresaEnQuery && e.tipo === 'empresa')
      if (porQuery) return porQuery
    }
    if (enRutaGlobal && portalTodas) return portalTodas
    // "Último usado" entre empresas o "todas": un portal virtual (ARCOR) recordado no
    // puede colonizar /empleados, /admin, etc. y dejar la sidebar sin las vistas de RRHH.
    const porPref = preferida && portales.find((e) => e.slug === preferida && e.tipo !== 'extra')
    if (porPref) return porPref
    return portalTodas ?? portales.find((e) => e.tipo === 'empresa') ?? portales[0] ?? null
  }, [pendiente, slugEnPath, empresaEnQuery, enRutaGlobal, portalTodas, preferida, portales])

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  /** A dónde ir al elegir un portal: la MISMA pantalla, si existe para el destino. */
  function destino(p: Portal): string {
    if (p.tipo === 'extra') return p.href
    const enDocumentacion = pathname.startsWith('/empresa/') && searchParams.get('vista') === 'documentacion'
    if (p.tipo === 'todas') return RUTAS_GLOBALES.includes(pathname) ? pathname : '/dashboard'
    if (RUTAS_POR_EMPRESA.includes(pathname)) return `${pathname}?empresa=${p.slug}`
    if (enDocumentacion) return `/empresa/${p.slug}?vista=documentacion`
    return `/empresa/${p.slug}`
  }

  function cambiarPortal(p: Portal) {
    if (p.tipo !== 'extra') {
      try { localStorage.setItem(STORAGE_KEY, p.slug) } catch { /* no-op */ }
      setPreferida(p.slug)
    }
    setPendiente({ slug: p.slug, desde: urlActual })
    setSelectorOpen(false)
    startTransition(() => router.push(destino(p)))
  }

  // Prefetch de los destinos al abrir el selector (solo el shell hasta el loading
  // boundary: barato y hace el cambio casi instantáneo).
  useEffect(() => {
    if (!selectorOpen) return
    for (const p of portales) router.prefetch(destino(p))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectorOpen, portales, router])

  const esAdmin = sesion.rol === 'admin'

  // `usePathname()` no incluye la query: Resumen y Habilitaciones comparten pathname
  // y se distinguen por ?vista= (mismo criterio que `empresa/[slug]/page.tsx`).
  const enEmpresa = activa?.tipo === 'empresa' && pathname === `/empresa/${activa.slug}`
  const enDocumentacion = searchParams.get('vista') === 'documentacion'
  const sinEmpresa = !empresaEnQuery

  const grupos: Grupo[] = []
  if (activa?.tipo === 'extra') {
    grupos.push({
      titulo: null,
      items: [
        { key: 'resumen', label: 'Resumen', href: '/arcor', icon: LayoutGrid, active: pathname === '/arcor' },
        { key: 'actividad', label: 'Actividad', href: '/arcor/actividad', icon: Activity, active: pathname.startsWith('/arcor/actividad') },
        { key: 'alertas', label: 'Alertas', href: '/arcor/alertas', icon: Bell, active: pathname.startsWith('/arcor/alertas') },
        { key: 'contenedores', label: 'Contenedores', href: '/arcor/contenedores', icon: Container, active: pathname.startsWith('/arcor/contenedores') },
        // La operación (subir/corregir certificados) vive en el sistema externo: se abre aparte.
        { key: 'carga', label: 'Carga manual', href: ENLACES_ARCOR.cargar, icon: Upload, active: false, external: true },
      ],
    })
  } else if (activa?.tipo === 'todas') {
    // Solo lo que existe para el grupo entero. Habilitaciones, documentación
    // mensual y stock son de cada empresa: se ven eligiendo una.
    grupos.push(
      {
        titulo: null,
        items: [
          { key: 'resumen', label: 'Resumen general', href: '/dashboard', icon: LayoutGrid, active: pathname.startsWith('/dashboard') },
          { key: 'empleados', label: 'Empleados', href: '/empleados', icon: Users, active: pathname.startsWith('/empleados') && sinEmpresa },
          { key: 'vencimientos', label: 'Vencimientos', href: '/vencimientos', icon: CalendarClock, active: pathname.startsWith('/vencimientos') && sinEmpresa },
        ],
      },
      {
        titulo: 'Recursos',
        items: [
          { key: 'flota', label: 'Flota', href: '/flota', icon: Truck, active: pathname.startsWith('/flota') },
        ],
      }
    )
  } else if (activa?.tipo === 'empresa') {
    grupos.push(
      {
        titulo: null,
        items: [
          { key: 'resumen', label: 'Resumen', href: `/empresa/${activa.slug}`, icon: LayoutGrid, active: enEmpresa && !enDocumentacion },
          { key: 'empleados', label: 'Empleados', href: `/empleados?empresa=${activa.slug}`, icon: Users, active: pathname.startsWith('/empleados') },
          { key: 'vencimientos', label: 'Vencimientos', href: `/vencimientos?empresa=${activa.slug}`, icon: CalendarClock, active: pathname.startsWith('/vencimientos') },
        ],
      },
      {
        titulo: 'Documentación',
        items: [
          // Habilitaciones de la empresa, programas de seguridad, vehículos y equipos.
          { key: 'documentacion', label: 'Habilitaciones', href: `/empresa/${activa.slug}?vista=documentacion`, icon: ShieldCheck, active: enEmpresa && enDocumentacion },
          // Carpetas del mes: F931, ART, SVO, recibos…
          { key: 'documentos', label: 'Mensual', href: `/documentos?empresa=${activa.slug}`, icon: FolderOpen, active: pathname.startsWith('/documentos') },
        ],
      },
      {
        titulo: 'Recursos',
        items: [
          { key: 'flota', label: 'Flota', href: `/flota?empresa=${activa.slug}`, icon: Truck, active: pathname.startsWith('/flota') },
          { key: 'stock', label: 'Stock', href: `/stock?empresa=${activa.slug}`, icon: Package, active: pathname.startsWith('/stock') },
        ],
      }
    )
  }

  if (esAdmin) {
    grupos.push({
      titulo: 'Administración',
      items: [
        { key: 'nuevo-empleado', label: 'Nuevo empleado', href: '/admin/empleados/nuevo', icon: UserPlus, active: pathname.startsWith('/admin/empleados') },
        { key: 'usuarios', label: 'Usuarios', href: '/admin/usuarios', icon: KeyRound, active: pathname.startsWith('/admin/usuarios') },
      ],
    })
  }

  const oscuro = montado && resolvedTheme === 'dark'

  // Activo: fondo acento + texto e ícono en el color primario. Hover: apenas un gris.
  // Antes los dos eran un fondo casi igual y no se sabía en qué pantalla estabas.
  const itemCls = (active: boolean) =>
    cn(
      'group flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
      active
        ? 'bg-accent font-medium text-primary'
        : 'text-muted-foreground hover:bg-muted/70 hover:text-foreground'
    )
  const iconCls = (active: boolean) =>
    cn('size-4 shrink-0', active ? 'text-primary' : 'text-muted-foreground/80 group-hover:text-foreground')
  const tituloCls = 'px-3 pb-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground/80'
  const accionMenu = 'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm text-foreground transition-colors hover:bg-muted'

  return (
    <div className="flex h-dvh overflow-hidden bg-background print:block print:h-auto print:overflow-visible">
      {/* ── Sidebar única ── */}
      <aside className="flex w-64 shrink-0 flex-col border-r border-border bg-card print:hidden">
        <div className="px-5 pb-1 pt-5">
          <p className="text-base font-semibold tracking-tight">Gestión</p>
          <p className="text-xs text-muted-foreground">Tecnophos · ADC · Serviwhite</p>
        </div>

        {/* Selector: todo lo de abajo es de lo elegido acá */}
        {activa && (
          <div className="relative px-3 pt-4">
            <p className={tituloCls}>Viendo</p>
            <button
              type="button"
              onClick={() => setSelectorOpen((v) => !v)}
              aria-expanded={selectorOpen}
              className="flex w-full items-center gap-3 rounded-xl border border-border bg-background px-3 py-2 text-left transition-colors hover:border-input"
            >
              <LogoPortal portal={activa} size="md" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{activa.nombre}</span>
                <span className="block truncate text-xs text-muted-foreground">{subtituloDe(activa)}</span>
              </span>
              <ChevronsUpDown className="size-4 shrink-0 text-muted-foreground" strokeWidth={1.75} />
            </button>

            {selectorOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setSelectorOpen(false)} />
                <div className="absolute left-3 right-3 z-50 mt-2 max-h-[70dvh] overflow-y-auto rounded-xl border border-border bg-popover shadow-lg">
                  {portales.map((p, i) => {
                    // Separadores: después de "Todas" y antes de las entradas virtuales.
                    const anterior = portales[i - 1]
                    const separa = !!anterior && (anterior.tipo === 'todas' || (p.tipo === 'extra' && anterior.tipo !== 'extra'))
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => cambiarPortal(p)}
                        className={cn(
                          'flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-muted',
                          separa && 'border-t border-border'
                        )}
                      >
                        <LogoPortal portal={p} size="sm" />
                        <span className="min-w-0 flex-1">
                          <span className={cn('block truncate text-sm', p.tipo === 'todas' && 'font-medium')}>{p.nombre}</span>
                          <span className="block truncate text-[11px] text-muted-foreground">{subtituloDe(p)}</span>
                        </span>
                        {p.id === activa.id && <Check className="size-4 shrink-0 text-primary" strokeWidth={2} />}
                      </button>
                    )
                  })}
                </div>
              </>
            )}
          </div>
        )}

        <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-4">
          {grupos.map((g, i) => (
            <div key={g.titulo ?? `grupo-${i}`}>
              {g.titulo && <p className={tituloCls}>{g.titulo}</p>}
              <div className="space-y-0.5">
                {g.items.map((it) =>
                  it.external ? (
                    <a key={it.key} href={it.href} target="_blank" rel="noopener noreferrer" className={itemCls(false)}>
                      <it.icon className={iconCls(false)} strokeWidth={1.75} />
                      <span className="flex-1">{it.label}</span>
                      <ExternalLink className="size-3.5 shrink-0 text-muted-foreground/60" strokeWidth={1.75} />
                    </a>
                  ) : (
                    <Link key={it.key} href={it.href} className={itemCls(it.active)} aria-current={it.active ? 'page' : undefined}>
                      <it.icon className={iconCls(it.active)} strokeWidth={1.75} />
                      {it.label}
                    </Link>
                  )
                )}
              </div>
            </div>
          ))}
        </nav>

        {/* Usuario: un solo botón que abre Inicio, tema y salir */}
        <div className="relative border-t border-border p-3">
          {menuUsuario && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setMenuUsuario(false)} />
              <div className="absolute bottom-full left-3 right-3 z-50 mb-2 space-y-0.5 rounded-xl border border-border bg-popover p-1.5 shadow-lg">
                <Link href="/" className={accionMenu}>
                  <Home className="size-4 text-muted-foreground" strokeWidth={1.75} />
                  Inicio · todos los módulos
                </Link>
                <button type="button" onClick={() => setTheme(oscuro ? 'light' : 'dark')} className={accionMenu}>
                  {oscuro
                    ? <Sun className="size-4 text-muted-foreground" strokeWidth={1.75} />
                    : <Moon className="size-4 text-muted-foreground" strokeWidth={1.75} />}
                  {oscuro ? 'Modo claro' : 'Modo oscuro'}
                </button>
                <div className="my-1 border-t border-border" />
                <button type="button" onClick={handleLogout} className={cn(accionMenu, 'text-danger hover:bg-danger-subtle')}>
                  <LogOut className="size-4" strokeWidth={1.75} />
                  Cerrar sesión
                </button>
              </div>
            </>
          )}
          <button
            type="button"
            onClick={() => setMenuUsuario((v) => !v)}
            aria-expanded={menuUsuario}
            className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-muted"
          >
            <Monograma nombre={sesion.nombre ?? sesion.email} size="sm" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium">{sesion.nombre ?? sesion.email}</span>
              <span className="block truncate text-[11px] text-muted-foreground">{ROL_LABEL[sesion.rol] ?? sesion.rol}</span>
            </span>
            <Ellipsis className="size-4 shrink-0 text-muted-foreground" strokeWidth={1.75} />
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto print:overflow-visible">{children}</main>
    </div>
  )
}
