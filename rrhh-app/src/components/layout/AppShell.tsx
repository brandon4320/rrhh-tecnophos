'use client'

import { useEffect, useMemo, useRef, useState, useSyncExternalStore, useTransition } from 'react'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useTheme } from 'next-themes'
import { cerrarSesion } from '@/app/actions/sesion'
import { cn } from '@/lib/utils'
import { Monograma } from '@/components/ui/monograma'
import { paramEmpresas, slugsDe } from '@/lib/empresas-vistas'
import {
  Activity,
  Bell,
  Bot,
  CalendarClock,
  Check,
  ChevronsUpDown,
  Container,
  Ellipsis,
  ExternalLink,
  FolderOpen,
  FolderDown,
  History,
  Home,
  KeyRound,
  LayoutGrid,
  LogOut,
  Moon,
  Package,
  ShieldCheck,
  Sun,
  Forklift,
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

interface Props {
  empresas: EmpresaNav[]
  /** Muestra la entrada virtual "Tecnophos - ARCOR" (ver modules/arcor/acceso.ts). */
  arcor?: boolean
  /** superAdmin: admin sin empresa asignada (ve el Historial; misma regla que la RLS de `auditoria`). */
  sesion: { nombre: string | null; email: string | null; rol: string; superAdmin?: boolean }
  children: React.ReactNode
}

/** Lo último elegido en el selector (slugs separados por coma; versiones viejas guardaban un slug o "todas"). */
const STORAGE_KEY = 'empresa_activa'

/**
 * Pantallas generales: sin `?empresa=` muestran a TODAS las empresas y con `?empresa=a,b` a las
 * tildadas. En ellas la ausencia del filtro significa "todas", no "lo último que elegiste".
 */
const RUTAS_GLOBALES = ['/dashboard', '/empleados', '/vencimientos', '/flota']

/** Pantallas que existen por empresa con `?empresa=slug`: cambiar de empresa te deja en la misma. */
const RUTAS_POR_EMPRESA = ['/empleados', '/vencimientos', '/flota', '/stock', '/documentos', '/carpeta', '/palas']

/** Lo tildado se aplica después de un momento quieto (así prender dos no recarga dos veces), como en el CRM. */
const ESPERA_SELECTOR = 650

// Íconos de las marcas, los mismos del CRM (public/icono-*.png). Las 3 sedes de Tecnophos comparten el suyo.
function iconoDe(slug: string): string | null {
  if (slug.startsWith('tecnophos') || slug === 'arcor') return '/icono-tecnophos.png'
  if (slug === 'adc') return '/icono-adc.png'
  if (slug === 'serviwhite') return '/icono-serviwhite.png'
  return null
}

const ROL_LABEL: Record<string, string> = { admin: 'Administrador', usuario: 'Usuario' }

// Sin suscripción: el valor se vuelve a leer en cada render (localStorage no avisa cambios en la misma pestaña).
const sinSuscripcion = () => () => {}
function leerGuardada(): string | null {
  try { return localStorage.getItem(STORAGE_KEY) } catch { return null }
}

/** El ícono de la empresa en un cuadradito blanco (IconoEmpresa del CRM). */
function IconoEmpresa({ slug, nombre, tamano = 24 }: { slug: string; nombre: string; tamano?: number }) {
  const src = iconoDe(slug)
  if (!src) return <Monograma nombre={nombre} size="sm" className="rounded-[7px]" />
  return (
    <span className="grid shrink-0 place-items-center overflow-hidden rounded-[7px] border border-border bg-white" style={{ width: tamano, height: tamano }}>
      {/* eslint-disable-next-line @next/next/no-img-element -- ícono chico, sin optimizar */}
      <img src={src} alt="" draggable={false} className="size-[82%] select-none object-contain" />
    </span>
  )
}

/** Los íconos de las elegidas encimados, como los avatares de un equipo (IconosEmpresas del CRM). */
function IconosEmpresas({ lista, tamano = 24 }: { lista: { slug: string; nombre: string }[]; tamano?: number }) {
  // Un ícono por marca: las tres sedes de Tecnophos se ven como una.
  const unicos = lista.filter((e, i) => lista.findIndex((x) => (iconoDe(x.slug) ?? x.slug) === (iconoDe(e.slug) ?? e.slug)) === i)
  return (
    <span className="flex shrink-0 items-center" aria-hidden>
      {unicos.map((e, i) => (
        <span key={e.slug} className="relative rounded-[8px] bg-card p-px" style={{ marginLeft: i ? -tamano * 0.32 : 0, zIndex: unicos.length - i }}>
          <IconoEmpresa slug={e.slug} nombre={e.nombre} tamano={tamano} />
        </span>
      ))}
    </span>
  )
}

/** La casilla del menú (Casilla del CRM). */
function Casilla({ marcada }: { marcada: boolean }) {
  return (
    <span className={cn('flex size-[18px] shrink-0 items-center justify-center rounded-[5px] border transition-colors duration-100', marcada ? 'border-primary bg-primary text-primary-foreground' : 'border-border-strong bg-card')} aria-hidden>
      {marcada && <Check className="size-3" strokeWidth={3} />}
    </span>
  )
}

type Item = { key: string; label: string; href: string; icon: LucideIcon; active: boolean; external?: boolean }
type Grupo = { titulo: string | null; items: Item[] }

export default function AppShell({ empresas, arcor = false, sesion, children }: Props) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const empresaEnQuery = searchParams.get('empresa')
  const router = useRouter()
  const { resolvedTheme, setTheme } = useTheme()
  // En el server no hay tema ni localStorage: lo que depende de eso espera al navegador.
  const montado = useSyncExternalStore(sinSuscripcion, () => true, () => false)
  const guardada = useSyncExternalStore(sinSuscripcion, leerGuardada, () => null)
  // Cada menú queda abierto en la pantalla donde se abrió: cambiar de pantalla lo cierra solo.
  const [selectorAbiertoEn, setSelectorAbiertoEn] = useState<string | null>(null)
  const [usuarioAbiertoEn, setUsuarioAbiertoEn] = useState<string | null>(null)
  const selectorOpen = selectorAbiertoEn === pathname
  const menuUsuario = usuarioAbiertoEn === pathname
  const setSelectorOpen = (abrir: boolean) => setSelectorAbiertoEn(abrir ? pathname : null)
  const setMenuUsuario = (abrir: boolean) => setUsuarioAbiertoEn(abrir ? pathname : null)
  // Lo tildado en el menú, a la vista YA (optimista). `desde` es la URL al tildar: cuando cambia
  // (llegó la navegación) deja de valer y manda otra vez la URL.
  const [tildadas, setTildadas] = useState<{ lista: string[]; desde: string } | null>(null)
  const espera = useRef<number | undefined>(undefined)
  // `navegando`: el cambio está en curso (la pantalla vieja sigue hasta que llega la nueva):
  // se atenúa y aparece una barra arriba para que se note.
  const [navegando, startTransition] = useTransition()
  const urlActual = `${pathname}?${searchParams.toString()}`

  useEffect(() => () => window.clearTimeout(espera.current), [])

  const todos = useMemo(() => empresas.map((e) => e.slug), [empresas])
  const enArcor = pathname.startsWith('/arcor')
  const slugEnPath = pathname.startsWith('/empresa/') ? pathname.split('/')[2] : null

  // Lo que dice la URL: la empresa de la ruta, las del `?empresa=`, o todas en una pantalla general.
  // null = la URL no dice nada (Usuarios, un legajo…): vale lo último elegido.
  const elegidasUrl = useMemo<string[] | null>(() => {
    if (slugEnPath && todos.includes(slugEnPath)) return [slugEnPath]
    const pedidas = slugsDe(empresaEnQuery, todos)
    if (pedidas.length) return pedidas
    if (RUTAS_GLOBALES.includes(pathname)) return todos
    return null
  }, [slugEnPath, empresaEnQuery, pathname, todos])

  // Recordar lo que dice la URL, para las pantallas que no dicen nada.
  const recordar = elegidasUrl?.join(',') ?? null
  useEffect(() => {
    if (!recordar) return
    try { localStorage.setItem(STORAGE_KEY, recordar) } catch { /* sin preferencia */ }
  }, [recordar])
  const preferidas = guardada === 'todas' ? todos : slugsDe(guardada, todos)

  const elegidas = elegidasUrl ?? (preferidas.length ? preferidas : todos)
  const vistas = tildadas && tildadas.desde === urlActual ? tildadas.lista : elegidas
  const empresasVistas = empresas.filter((e) => vistas.includes(e.slug))
  const una = vistas.length === 1 ? empresas.find((e) => e.slug === vistas[0]) ?? null : null
  // El `?empresa=` de las pantallas generales con lo que se mira (null = todas).
  const paramVistas = paramEmpresas(vistas, todos)
  const conVistas = (ruta: string) => (paramVistas ? `${ruta}?empresa=${paramVistas}` : ruta)

  function handleLogout() {
    startTransition(() => cerrarSesion())
  }

  /** La URL actual con otro `?empresa=` (null = sin filtro), conservando los demás filtros. */
  function conEmpresa(valor: string | null): string {
    const sp = new URLSearchParams(searchParams.toString())
    sp.delete('empresa')
    if (valor) sp.set('empresa', valor)
    const q = sp.toString()
    return q ? `${pathname}?${q}` : pathname
  }

  /** A dónde ir con estas empresas: la MISMA pantalla si existe para ellas; si no, su portada. */
  function destino(lista: string[]): string {
    if (lista.length === 1 && !enArcor) {
      const slug = lista[0]
      if (RUTAS_POR_EMPRESA.includes(pathname)) return conEmpresa(slug)
      if (slugEnPath && searchParams.get('vista') === 'documentacion') return `/empresa/${slug}?vista=documentacion`
      return `/empresa/${slug}`
    }
    if (lista.length === 1) return `/empresa/${lista[0]}`
    const valor = paramEmpresas(lista, todos)
    if (RUTAS_GLOBALES.includes(pathname)) return conEmpresa(valor)
    return valor ? `/dashboard?empresa=${valor}` : '/dashboard'
  }

  /** Tildar o destildar una empresa. La última tildada no se saca: siempre se mira al menos una. */
  function tildar(slug: string) {
    const base = vistas
    const nuevas = base.includes(slug) ? base.filter((x) => x !== slug) : todos.filter((x) => x === slug || base.includes(x))
    if (!nuevas.length) return
    setTildadas({ lista: nuevas, desde: urlActual })
    window.clearTimeout(espera.current)
    espera.current = window.setTimeout(() => {
      const ir = destino(nuevas)
      if (ir === urlActual.replace(/\?$/, '') || (enArcor === false && nuevas.join() === elegidas.join())) {
        setTildadas(null)
        return
      }
      startTransition(() => router.push(ir))
    }, ESPERA_SELECTOR)
  }

  function irArcor() {
    setSelectorOpen(false)
    startTransition(() => router.push('/arcor'))
  }

  const esAdmin = sesion.rol === 'admin'

  // `usePathname()` no incluye la query: Resumen y Habilitaciones comparten pathname
  // y se distinguen por ?vista= (mismo criterio que `empresa/[slug]/page.tsx`).
  const enEmpresa = !!una && pathname === `/empresa/${una.slug}`
  const enDocumentacion = searchParams.get('vista') === 'documentacion'

  const grupos: Grupo[] = []
  if (enArcor && arcor) {
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
  } else if (!una) {
    // Varias (o todas): solo lo que existe para el grupo. Habilitaciones, documentación
    // mensual y stock son de cada empresa: se ven tildando una sola.
    grupos.push(
      {
        titulo: null,
        items: [
          { key: 'resumen', label: 'Resumen general', href: conVistas('/dashboard'), icon: LayoutGrid, active: pathname.startsWith('/dashboard') },
          { key: 'empleados', label: 'Empleados', href: conVistas('/empleados'), icon: Users, active: pathname.startsWith('/empleados') },
          { key: 'vencimientos', label: 'Vencimientos', href: conVistas('/vencimientos'), icon: CalendarClock, active: pathname.startsWith('/vencimientos') },
        ],
      },
      {
        titulo: 'Recursos',
        items: [
          { key: 'flota', label: 'Flota', href: conVistas('/flota'), icon: Truck, active: pathname.startsWith('/flota') },
        ],
      }
    )
  } else {
    const activa = una
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
          // ZIP con la documentación elegida de personas, vehículos y empresa, para mandar a una planta.
          { key: 'carpeta', label: 'Armar carpeta', href: `/carpeta?empresa=${activa.slug}`, icon: FolderDown, active: pathname.startsWith('/carpeta') },
        ],
      },
      {
        titulo: 'Recursos',
        items: [
          { key: 'flota', label: 'Flota', href: `/flota?empresa=${activa.slug}`, icon: Truck, active: pathname.startsWith('/flota') },
          // Maquinaria pesada con ficha y documentación. Hoy solo ADC tiene palas, pero
          // la entrada va para todas: la pantalla funciona igual y así no hay un slug
          // escrito a mano en el menú que haya que recordar si mañana compran una.
          { key: 'palas', label: 'Palas cargadoras', href: `/palas?empresa=${activa.slug}`, icon: Forklift, active: pathname.startsWith('/palas') },
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
        // Quién cargó o cambió cada cosa (tabla `auditoria`): solo el administrador general.
        ...(sesion.superAdmin ? [{ key: 'historial', label: 'Historial', href: '/admin/historial', icon: History, active: pathname.startsWith('/admin/historial') }] : []),
      ],
    })
  }

  const oscuro = montado && resolvedTheme === 'dark'

  // Mismo menú que el CRM (components/shell/Shell.tsx de comercial-tecnophos): filas de 40px,
  // activo en lavanda con el texto del acento, el resto en texto-2 con un gris suave al pasar.
  const itemCls = (active: boolean) =>
    cn(
      'flex h-10 items-center gap-2.5 rounded-[10px] px-3 text-sm font-medium transition-colors duration-150',
      active ? 'bg-accent text-accent-foreground' : 'text-texto-2 hover:bg-muted hover:text-foreground'
    )
  const iconCls = 'size-[18px] shrink-0'
  const tituloCls = 'px-3 pb-1 text-xs font-medium text-muted-foreground'
  const accionMenu = 'flex h-10 w-full items-center gap-2.5 rounded-[10px] px-3 text-left text-sm font-medium text-foreground transition-colors hover:bg-muted'

  return (
    <div className="flex h-dvh overflow-hidden bg-background print:block print:h-auto print:overflow-visible">
      {/* ── Sidebar única ── */}
      <aside className="flex w-[248px] shrink-0 flex-col border-r border-border bg-card px-3.5 py-5 print:hidden">
        {/* Marca: el mismo ícono del grupo que el CRM, con el nombre del sistema. */}
        <Link href="/" className="flex items-center gap-2.5 rounded-xl px-1.5 py-1" aria-label="Gestión de Recursos — inicio">
          {/* eslint-disable-next-line @next/next/no-img-element -- svg chico, sin optimizar */}
          <img src="/logo-grupo.svg" alt="" width={30} height={30} className="shrink-0 select-none" draggable={false} />
          <span className="text-[15px] font-semibold tracking-[-0.015em]">Gestión de Recursos</span>
        </Link>

        {/* Selector de empresas, el mismo del CRM (components/shell/SelectorEmpresa.tsx de
            comercial-tecnophos): los íconos encimados y, al abrir, casillas para mirar una o varias.
            Todo lo de abajo es de lo tildado acá. ARCOR va aparte, debajo de una raya. */}
        {empresas.length > 0 && (
          <div className="relative mt-3">
            {(() => {
              const nombre = enArcor ? 'Tecnophos - ARCOR' : una ? una.nombre : `${empresasVistas.length} empresas`
              const cara = (
                <>
                  {enArcor ? <IconoEmpresa slug="arcor" nombre="ARCOR" /> : <IconosEmpresas lista={empresasVistas} />}
                  <span className="min-w-0 flex-1 truncate text-[13.5px] font-medium" title={empresasVistas.map((e) => e.nombre).join(', ')}>{nombre}</span>
                </>
              )
              const clase = 'flex h-11 w-full items-center gap-2.5 rounded-xl border border-border bg-card px-2.5 text-left shadow-[0_1px_2px_rgb(23_22_31/0.04)]'
              if (empresas.length === 1 && !arcor) return <div className={clase}>{cara}</div>
              return (
                <button
                  type="button"
                  onClick={() => setSelectorOpen(!selectorOpen)}
                  aria-haspopup="menu"
                  aria-expanded={selectorOpen}
                  aria-label={`${una || enArcor ? 'Empresa' : 'Empresas'}: ${enArcor ? 'Tecnophos - ARCOR' : empresasVistas.map((e) => e.nombre).join(', ')}. Cambiar`}
                  className={cn(clase, 'cursor-pointer transition-[background-color,transform] duration-150 hover:bg-muted active:scale-[0.98]')}
                >
                  {cara}
                  <ChevronsUpDown className={cn('size-4 shrink-0 text-muted-foreground transition-colors', selectorOpen && 'text-foreground')} strokeWidth={1.75} aria-hidden />
                </button>
              )
            })()}

            {selectorOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setSelectorOpen(false)} />
                <div role="menu" className="absolute left-0 z-50 mt-2 max-h-[70dvh] w-[280px] overflow-y-auto rounded-[14px] border border-border bg-popover p-1.5 shadow-flotante">
                  {empresas.map((e) => {
                    const marcada = !enArcor && vistas.includes(e.slug)
                    // La última tildada no se puede sacar: siempre se mira al menos una.
                    const fija = marcada && vistas.length === 1
                    return (
                      <button
                        key={e.id}
                        type="button"
                        role="menuitemcheckbox"
                        aria-checked={marcada}
                        aria-disabled={fija || undefined}
                        onClick={() => !fija && tildar(e.slug)}
                        className={cn(
                          'flex w-full items-center gap-2.5 rounded-[10px] px-2.5 py-2 text-left text-sm transition-colors duration-100',
                          fija ? 'cursor-default' : 'cursor-pointer hover:bg-muted'
                        )}
                      >
                        <Casilla marcada={marcada} />
                        <span className="flex h-7 min-w-0 flex-1 items-center gap-2.5">
                          <IconoEmpresa slug={e.slug} nombre={e.nombre} />
                          <span className="truncate font-medium">{e.nombre}</span>
                        </span>
                      </button>
                    )
                  })}
                  {arcor && (
                    <>
                      <div role="separator" className="my-1 h-px bg-border" />
                      <button
                        type="button"
                        role="menuitem"
                        aria-current={enArcor || undefined}
                        onClick={irArcor}
                        className="flex w-full cursor-pointer items-center gap-2.5 rounded-[10px] px-2.5 py-2 text-left text-sm transition-colors duration-100 hover:bg-muted"
                      >
                        <span className="flex h-7 min-w-0 flex-1 items-center gap-2.5">
                          <IconoEmpresa slug="arcor" nombre="ARCOR" />
                          <span className="truncate font-medium">Tecnophos - ARCOR</span>
                        </span>
                        {enArcor && <Check className="size-4 shrink-0 text-accent-foreground" strokeWidth={2} aria-hidden />}
                      </button>
                    </>
                  )}
                </div>
              </>
            )}
          </div>
        )}

        <nav className="mt-4 flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto" aria-label="Menú principal">
          {grupos.map((g, i) => (
            <div key={g.titulo ?? `grupo-${i}`} className="flex flex-col gap-0.5">
              <p className={tituloCls}>{g.titulo ?? 'Menú'}</p>
              {g.items.map((it) =>
                it.external ? (
                  <a key={it.key} href={it.href} target="_blank" rel="noopener noreferrer" className={itemCls(false)}>
                    <it.icon className={iconCls} strokeWidth={1.75} aria-hidden />
                    <span className="flex-1">{it.label}</span>
                    <ExternalLink className="size-3.5 shrink-0 text-muted-foreground" strokeWidth={1.75} aria-hidden />
                  </a>
                ) : (
                  <Link key={it.key} href={it.href} className={itemCls(it.active)} aria-current={it.active ? 'page' : undefined}>
                    <it.icon className={iconCls} strokeWidth={1.75} aria-hidden />
                    {it.label}
                  </Link>
                )
              )}
            </div>
          ))}
        </nav>

        {/* Usuario: un solo botón que abre Inicio, tema y salir */}
        <div className="relative mt-3">
          {menuUsuario && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setMenuUsuario(false)} />
              <div className="absolute inset-x-0 bottom-full z-50 mb-2 space-y-0.5 rounded-xl border border-border bg-popover p-1.5 shadow-flotante">
                <Link href="/" className={accionMenu}>
                  <Home className="size-4 text-muted-foreground" strokeWidth={1.75} />
                  Inicio
                </Link>
                <Link href="/cuenta/ia" className={accionMenu}>
                  <Bot className="size-4 text-muted-foreground" strokeWidth={1.75} />
                  Conectar una IA
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
            onClick={() => setMenuUsuario(!menuUsuario)}
            aria-expanded={menuUsuario}
            className="flex w-full cursor-pointer items-center gap-2.5 rounded-xl border border-border p-2.5 text-left transition-colors hover:bg-muted"
          >
            <Monograma nombre={sesion.nombre ?? sesion.email} size="sm" variant="accent" redondo />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13px] font-semibold">{sesion.nombre ?? sesion.email}</span>
              <span className="block truncate text-xs text-muted-foreground">{ROL_LABEL[sesion.rol] ?? sesion.rol}</span>
            </span>
            <Ellipsis className="size-4 shrink-0 text-muted-foreground" strokeWidth={1.75} />
          </button>
        </div>
      </aside>

      <main
        aria-busy={navegando}
        className={cn('relative flex-1 overflow-y-auto transition-opacity print:overflow-visible', navegando && 'opacity-60')}
      >
        {navegando && (
          <div className="pointer-events-none sticky top-0 z-40 h-0.5 w-full overflow-hidden bg-primary/15" role="progressbar" aria-label="Cargando">
            <div className="h-full w-1/3 animate-[navegando_1s_ease-in-out_infinite] bg-primary" />
          </div>
        )}
        {children}
      </main>
    </div>
  )
}
