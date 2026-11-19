'use client'

import { useEffect, useMemo, useRef, useState, useSyncExternalStore, useTransition } from 'react'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useTheme } from 'next-themes'
import { cerrarSesion } from '@/app/actions/sesion'
import { cn } from '@/lib/utils'
import { paramEmpresas, slugsDe } from '@/lib/empresas-vistas'
import {
  ArrowSquareOut,
  Bell,
  Bulldozer,
  CaretRight,
  CaretUpDown,
  Certificate,
  Check,
  ClockCountdown,
  ClockCounterClockwise,
  DotsThree,
  DotsThreeOutline,
  FileZip,
  FolderSimple,
  House,
  IdentificationBadge,
  Users,
  MagnifyingGlass,
  Moon,
  Package,
  Pulse,
  ShippingContainer,
  SignOut,
  Sparkle,
  SquaresFour,
  Sun,
  Truck,
  UploadSimple,
  UserPlus,
  type Icon,
} from '@phosphor-icons/react'
import { ENLACES_ARCOR } from '@/modules/arcor/enlaces'
import { IconoEmpresa, IconosEmpresas, nombreCorto } from '@/components/ui/empresa'
import { Hoja, HojaCabecera, BotonIcono } from '@/components/ui/hoja'
import { Paleta, type PantallaPaleta } from '@/components/layout/Paleta'

export interface EmpresaNav {
  id: string
  nombre: string
  slug: string
  total: number
  /** Certificados vencidos de la empresa (personas activas, vehículos, equipos y habilitaciones). */
  vencidos: number
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

const ROL_LABEL: Record<string, string> = { admin: 'Administrador', usuario: 'Usuario' }

// Sin suscripción: el valor se vuelve a leer en cada render (localStorage no avisa cambios en la misma pestaña).
const sinSuscripcion = () => () => {}
function leerGuardada(): string | null {
  try { return localStorage.getItem(STORAGE_KEY) } catch { return null }
}

/** La casilla del menú (Casilla del CRM). */
function Casilla({ marcada }: { marcada: boolean }) {
  return (
    <span className={cn('flex size-[18px] shrink-0 items-center justify-center rounded-[5px] border-[1.5px] transition-colors duration-100', marcada ? 'border-primary bg-primary text-primary-foreground' : 'border-border-strong bg-card')} aria-hidden>
      {marcada && <Check size={11} weight="bold" />}
    </span>
  )
}

type Item = { key: string; label: string; href: string; icon: Icon; active: boolean; external?: boolean; cuenta?: number; ojo?: boolean }
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
  // Conteos del menú (con verbo: "3 vencidos" en rojo solo si hay que actuar).
  const empleadosVistos = empresasVistas.reduce((a, e) => a + e.total, 0)
  const vencidosVistos = empresasVistas.reduce((a, e) => a + e.vencidos, 0)

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
        { key: 'resumen', label: 'Resumen', href: '/arcor', icon: SquaresFour, active: pathname === '/arcor' },
        { key: 'actividad', label: 'Actividad', href: '/arcor/actividad', icon: Pulse, active: pathname.startsWith('/arcor/actividad') },
        { key: 'alertas', label: 'Alertas', href: '/arcor/alertas', icon: Bell, active: pathname.startsWith('/arcor/alertas') },
        { key: 'contenedores', label: 'Contenedores', href: '/arcor/contenedores', icon: ShippingContainer, active: pathname.startsWith('/arcor/contenedores') },
        // La operación (subir/corregir certificados) vive en el sistema externo: se abre aparte.
        { key: 'carga', label: 'Carga manual', href: ENLACES_ARCOR.cargar, icon: UploadSimple, active: false, external: true },
      ],
    })
  } else if (!una) {
    // Varias (o todas): solo lo que existe para el grupo. Habilitaciones, documentación
    // mensual y stock son de cada empresa: se ven tildando una sola.
    grupos.push(
      {
        titulo: null,
        items: [
          // "Resumen general" pasó a llamarse Inicio: junta el hub y el dashboard (overhaul 18/11).
          { key: 'resumen', label: 'Inicio', href: conVistas('/dashboard'), icon: House, active: pathname.startsWith('/dashboard') },
          { key: 'empleados', label: 'Empleados', href: conVistas('/empleados'), icon: IdentificationBadge, active: pathname.startsWith('/empleados'), cuenta: empleadosVistos },
          { key: 'vencimientos', label: 'Vencimientos', href: conVistas('/vencimientos'), icon: ClockCountdown, active: pathname.startsWith('/vencimientos'), cuenta: vencidosVistos, ojo: true },
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
          { key: 'resumen', label: 'Resumen', href: `/empresa/${activa.slug}`, icon: House, active: enEmpresa && !enDocumentacion },
          { key: 'empleados', label: 'Empleados', href: `/empleados?empresa=${activa.slug}`, icon: IdentificationBadge, active: pathname.startsWith('/empleados'), cuenta: empleadosVistos },
          { key: 'vencimientos', label: 'Vencimientos', href: `/vencimientos?empresa=${activa.slug}`, icon: ClockCountdown, active: pathname.startsWith('/vencimientos'), cuenta: vencidosVistos, ojo: true },
        ],
      },
      {
        titulo: 'Documentación',
        items: [
          // Habilitaciones de la empresa, programas de seguridad, vehículos y equipos.
          { key: 'documentacion', label: 'Habilitaciones', href: `/empresa/${activa.slug}?vista=documentacion`, icon: Certificate, active: enEmpresa && enDocumentacion },
          // Carpetas del mes: F931, ART, SVO, recibos…
          { key: 'documentos', label: 'Mensual', href: `/documentos?empresa=${activa.slug}`, icon: FolderSimple, active: pathname.startsWith('/documentos') },
          // ZIP con la documentación elegida de personas, vehículos y empresa, para mandar a una planta.
          { key: 'carpeta', label: 'Armar carpeta', href: `/carpeta?empresa=${activa.slug}`, icon: FileZip, active: pathname.startsWith('/carpeta') },
        ],
      },
      {
        titulo: 'Recursos',
        items: [
          { key: 'flota', label: 'Flota', href: `/flota?empresa=${activa.slug}`, icon: Truck, active: pathname.startsWith('/flota') },
          // Maquinaria pesada con ficha y documentación. Hoy solo ADC tiene palas, pero
          // la entrada va para todas: la pantalla funciona igual y así no hay un slug
          // escrito a mano en el menú que haya que recordar si mañana compran una.
          { key: 'palas', label: 'Palas cargadoras', href: `/palas?empresa=${activa.slug}`, icon: Bulldozer, active: pathname.startsWith('/palas') },
          { key: 'stock', label: 'Stock', href: `/stock?empresa=${activa.slug}`, icon: Package, active: pathname.startsWith('/stock') },
        ],
      }
    )
  }

  if (esAdmin) {
    grupos.push({
      titulo: 'Administración',
      items: [
        // El alta se abre en una hoja sobre Empleados (/admin/empleados/nuevo sigue existiendo).
        { key: 'nuevo-empleado', label: 'Nuevo empleado', href: una ? `/empleados?empresa=${una.slug}&nuevo=1` : '/empleados?nuevo=1', icon: UserPlus, active: pathname.startsWith('/admin/empleados') },
        { key: 'usuarios', label: 'Usuarios', href: '/admin/usuarios', icon: Users, active: pathname.startsWith('/admin/usuarios') },
        // Quién cargó o cambió cada cosa (tabla `auditoria`): solo el administrador general.
        ...(sesion.superAdmin ? [{ key: 'historial', label: 'Historial', href: '/admin/historial', icon: ClockCounterClockwise, active: pathname.startsWith('/admin/historial') }] : []),
      ],
    })
  }


  const oscuro = montado && resolvedTheme === 'dark'
  const alternarTema = () => setTheme(oscuro ? 'light' : 'dark')

  /** Título de la pantalla para las migas (el padre es la empresa elegida o el sistema). */
  const titulo = tituloDe(pathname, enDocumentacion, enArcor)
  const padre = enArcor ? 'Tecnophos - ARCOR' : una ? una.nombre : 'Gestión de Recursos'
  const hrefInicio = enArcor ? '/arcor' : una ? `/empresa/${una.slug}` : conVistas('/dashboard')
  const hrefVencidos = una ? `/vencimientos?empresa=${una.slug}&estado=vencido` : paramVistas ? `/vencimientos?estado=vencido&empresa=${paramVistas}` : '/vencimientos?estado=vencido'
  const hrefVencimientos = una ? `/vencimientos?empresa=${una.slug}` : conVistas('/vencimientos')

  // ⌘K: las pantallas son las del menú armado (mismas condiciones de rol) más Inicio y la cuenta.
  const pantallas: PantallaPaleta[] = [
    ...grupos.flatMap((g) => g.items).map((it) => ({ key: it.key, label: it.label, href: it.href, icon: it.icon, external: it.external })),
    { key: 'ia', label: 'Conectar una IA', href: '/cuenta/ia', icon: Sparkle },
  ].filter((p, i, l) => l.findIndex((x) => x.href === p.href) === i)
  const empresasPaleta = useMemo(
    () => new Map(empresasVistas.map((e) => [e.id, { slug: e.slug, corto: nombreCorto(e.nombre) }])),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- la lista cambia cuando cambian las vistas
    [vistas.join(','), empresas]
  )
  const [paleta, setPaleta] = useState(false)
  const [mas, setMas] = useState(false)
  useEffect(() => {
    function teclado(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setPaleta((x) => !x)
      }
    }
    document.addEventListener('keydown', teclado)
    return () => document.removeEventListener('keydown', teclado)
  }, [])
  // Esc cierra el menú abierto (selector o persona) sin cerrar la hoja de abajo.
  useEffect(() => {
    if (!selectorOpen && !menuUsuario) return
    function teclado(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault()
        setSelectorAbiertoEn(null)
        setUsuarioAbiertoEn(null)
      }
    }
    document.addEventListener('keydown', teclado)
    return () => document.removeEventListener('keydown', teclado)
  }, [selectorOpen, menuUsuario])

  // Menú lateral de la demo: filas de 36 px, el activo es una pastilla blanca con borde y el
  // ícono relleno (nunca el color de marca); conteo gris a la derecha, rojo si hay que actuar.
  // Por debajo de 1280 px la barra pasa a riel de íconos (68 px).
  const itemCls = (active: boolean) =>
    cn(
      'flex h-9 items-center gap-2 rounded-xl px-3 font-medium transition-[background-color,color] duration-150 max-xl:w-11 max-xl:justify-center max-xl:px-0',
      active ? 'bg-card text-foreground shadow-min outline outline-1 -outline-offset-1 outline-border' : 'text-texto-2 hover:bg-muted hover:text-foreground'
    )
  const opCls = 'flex min-h-10 w-full cursor-pointer items-center gap-2 rounded-[10px] px-2 text-left text-sm font-medium text-foreground transition-colors hover:bg-muted'
  const nombreSel = enArcor ? 'Tecnophos - ARCOR' : una ? una.nombre : `${empresasVistas.length} empresas`
  const detalleSel = enArcor || una ? 'Gestión de Recursos' : `${empleadosVistos} ${empleadosVistos === 1 ? 'empleado' : 'empleados'}`
  const persona = sesion.nombre ?? sesion.email ?? 'Usuario'
  const iniciales = persona.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]).join('').toUpperCase()

  function itemMenu(it: Item) {
    const Ico = it.icon
    const conteo = it.cuenta != null && it.cuenta > 0 ? it.cuenta : null
    const nombre = conteo ? `${it.label}, ${it.ojo ? `${conteo} ${conteo === 1 ? 'vencido' : 'vencidos'}` : conteo}` : it.label
    const cuerpo = (
      <>
        <Ico size={17} weight={it.active ? 'fill' : 'regular'} className={cn('shrink-0', it.active ? 'text-foreground' : 'text-muted-foreground')} aria-hidden />
        <span className="min-w-0 flex-1 truncate max-xl:hidden">{it.label}</span>
        {conteo && <span className={cn('text-xs font-medium max-xl:hidden', it.ojo ? 'text-danger' : 'text-muted-foreground')}>{conteo}</span>}
        {it.external && <ArrowSquareOut size={14} className="shrink-0 text-muted-foreground max-xl:hidden" aria-hidden />}
      </>
    )
    if (it.external)
      return <a key={it.key} href={it.href} target="_blank" rel="noopener noreferrer" className={itemCls(false)} aria-label={nombre} title={it.label}>{cuerpo}</a>
    return <Link key={it.key} href={it.href} className={itemCls(it.active)} aria-current={it.active ? 'page' : undefined} aria-label={nombre} title={it.label}>{cuerpo}</Link>
  }

  const menuEmpresas = (
    <>
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
            title={fija ? 'Siempre se mira al menos una' : undefined}
            onClick={() => !fija && tildar(e.slug)}
            className={cn(opCls, fija && 'cursor-default hover:bg-transparent')}
          >
            <Casilla marcada={marcada} />
            <IconoEmpresa slug={e.slug} nombre={e.nombre} tamano={24} />
            <span className="min-w-0 flex-1 truncate">{e.nombre}</span>
          </button>
        )
      })}
      {arcor && (
        <>
          <div role="separator" className="mx-1 my-1 h-px bg-divisor" />
          <button type="button" role="menuitem" aria-current={enArcor || undefined} onClick={irArcor} className={opCls}>
            <IconoEmpresa slug="arcor" nombre="ARCOR" tamano={24} />
            <span className="min-w-0 flex-1 truncate">Tecnophos - ARCOR</span>
            {enArcor && <Check size={15} className="shrink-0 text-accent-foreground" aria-hidden />}
          </button>
        </>
      )}
    </>
  )

  return (
    <div className="min-h-dvh bg-panel md:bg-lienzo md:p-5 print:bg-white print:p-0">
      <div className="mx-auto max-w-[1480px] md:grid md:grid-cols-[68px_minmax(0,1fr)] md:gap-2 md:rounded-app md:border md:border-border md:bg-background md:p-2 md:shadow-app xl:grid-cols-[248px_minmax(0,1fr)] print:block print:border-0 print:bg-white print:p-0 print:shadow-none">
        {/* ── Barra lateral, directo sobre el fondo ── */}
        <aside className="sticky top-7 hidden h-[calc(100dvh-58px)] min-h-[600px] flex-col gap-4 self-start px-1.5 py-2 max-xl:items-center max-xl:px-1 md:flex print:hidden">
          {/* Marca: el mismo ícono del grupo que el CRM, "Sistema de" chico + el nombre. */}
          <Link href="/" className="flex items-center gap-2 rounded-xl px-2 py-1 max-xl:p-0" aria-label="Gestión de Recursos, inicio">
            {/* eslint-disable-next-line @next/next/no-img-element -- svg chico, sin optimizar */}
            <img src="/logo-grupo.svg" alt="" width={32} height={32} className="shrink-0 select-none" draggable={false} />
            <span className="max-xl:hidden">
              <small className="block text-xs leading-tight text-muted-foreground">Sistema de</small>
              <b className="block text-base leading-tight font-medium tracking-[-0.01em]">Gestión de Recursos</b>
            </span>
          </Link>

          {/* Selector de empresas, el mismo del CRM: íconos encimados y casillas para mirar una o
              varias. Todo lo de abajo es de lo tildado acá. ARCOR va aparte, debajo de una raya. */}
          {empresas.length > 0 && (
            <div className="relative w-full max-xl:w-auto">
              {(() => {
                const cara = (
                  <>
                    {enArcor ? <IconoEmpresa slug="arcor" nombre="ARCOR" tamano={28} /> : <IconosEmpresas lista={empresasVistas} />}
                    <span className="min-w-0 flex-1 truncate text-sm font-medium max-xl:hidden" title={empresasVistas.map((e) => e.nombre).join(', ')}>
                      {nombreSel}
                      <small className="block text-xs font-normal text-muted-foreground">{detalleSel}</small>
                    </span>
                  </>
                )
                const clase = 'flex h-12 w-full items-center gap-2 rounded-xl border border-border bg-card pr-3 pl-2 text-left shadow-min max-xl:size-[52px] max-xl:justify-center max-xl:p-0'
                if (empresas.length === 1 && !arcor) return <div className={clase}>{cara}</div>
                return (
                  <button
                    type="button"
                    onClick={() => setSelectorOpen(!selectorOpen)}
                    aria-haspopup="menu"
                    aria-expanded={selectorOpen}
                    aria-label={`${una || enArcor ? 'Empresa' : 'Empresas'}: ${enArcor ? 'Tecnophos - ARCOR' : empresasVistas.map((e) => e.nombre).join(', ')}. Cambiar`}
                    className={cn(clase, 'cursor-pointer transition-colors duration-150 hover:bg-hover')}
                  >
                    {cara}
                    <CaretUpDown size={16} className="shrink-0 text-muted-foreground max-xl:hidden" aria-hidden />
                  </button>
                )
              })()}

              {selectorOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setSelectorOpen(false)} />
                  <div role="menu" data-menu-abierto className="absolute top-[calc(100%+6px)] left-0 z-50 max-h-[70dvh] w-full min-w-[260px] overflow-y-auto rounded-2xl border border-border bg-popover p-1.5 shadow-flotante max-xl:w-[280px]">
                    {menuEmpresas}
                  </div>
                </>
              )}
            </div>
          )}

          <button
            type="button"
            onClick={() => setPaleta(true)}
            aria-label="Buscar (⌘K)"
            className="flex h-9 w-full cursor-pointer items-center gap-2 rounded-xl border border-border bg-card px-3 text-sm text-muted-foreground transition-colors hover:text-texto-2 max-xl:w-11 max-xl:justify-center max-xl:px-0"
          >
            <MagnifyingGlass size={17} aria-hidden />
            <span className="max-xl:hidden">Buscar</span>
            <kbd className="ml-auto rounded-md border border-border bg-card px-1 font-mono text-[11px] text-muted-foreground max-xl:hidden">⌘K</kbd>
          </button>

          <nav className="-mx-1.5 flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-1.5 text-sm max-xl:items-center" aria-label="Menú principal">
            {grupos.map((g, i) => (
              <div key={g.titulo ?? `grupo-${i}`} className="flex flex-col gap-0.5">
                {g.titulo && <h6 className="px-3 pb-1 text-[11px] font-medium tracking-[0.06em] text-muted-foreground uppercase max-xl:hidden">{g.titulo}</h6>}
                {g.items.map(itemMenu)}
              </div>
            ))}
          </nav>

          {/* La persona: un solo botón que abre Inicio, IA, tema y salir */}
          <div className="relative mt-auto w-full max-xl:w-auto">
            {menuUsuario && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setMenuUsuario(false)} />
                <div role="menu" data-menu-abierto className="absolute bottom-[calc(100%+6px)] left-0 z-50 w-full min-w-[240px] rounded-2xl border border-border bg-popover p-1.5 shadow-flotante">
                  <Link href="/" role="menuitem" className={opCls}><House size={17} className="text-muted-foreground" aria-hidden />Inicio</Link>
                  <Link href="/cuenta/ia" role="menuitem" className={opCls}><Sparkle size={17} className="text-muted-foreground" aria-hidden />Conectar una IA</Link>
                  <button type="button" role="menuitem" onClick={alternarTema} className={opCls}>
                    {oscuro ? <Sun size={17} className="text-muted-foreground" aria-hidden /> : <Moon size={17} className="text-muted-foreground" aria-hidden />}
                    {oscuro ? 'Modo claro' : 'Modo oscuro'}
                  </button>
                  <div role="separator" className="mx-1 my-1 h-px bg-divisor" />
                  <button type="button" role="menuitem" onClick={handleLogout} className={cn(opCls, 'text-danger')}>
                    <SignOut size={17} aria-hidden />
                    Cerrar sesión
                  </button>
                </div>
              </>
            )}
            <button
              type="button"
              onClick={() => setMenuUsuario(!menuUsuario)}
              aria-haspopup="menu"
              aria-expanded={menuUsuario}
              aria-label={`${persona}, ${ROL_LABEL[sesion.rol] ?? sesion.rol}. Opciones`}
              className="flex w-full cursor-pointer items-center gap-3 rounded-xl p-2 text-left transition-colors hover:bg-muted max-xl:justify-center max-xl:p-1"
            >
              <span className="grid size-9 shrink-0 place-items-center rounded-full bg-accent text-[13px] font-medium text-accent-foreground">{iniciales || '?'}</span>
              <span className="min-w-0 flex-1 max-xl:hidden">
                <b className="block truncate text-sm leading-tight font-medium">{persona}</b>
                <small className="block truncate text-xs text-muted-foreground">{ROL_LABEL[sesion.rol] ?? sesion.rol}</small>
              </span>
              <DotsThree size={17} className="shrink-0 text-muted-foreground max-xl:hidden" aria-hidden />
            </button>
          </div>
        </aside>

        {/* ── Panel: el área de trabajo ── */}
        <main
          aria-busy={navegando}
          className={cn(
            'relative min-w-0 overflow-clip bg-panel pb-[calc(96px+env(safe-area-inset-bottom))] transition-opacity md:rounded-2xl md:border md:border-border md:pb-0 print:overflow-visible print:border-0 print:pb-0',
            navegando && 'opacity-60'
          )}
        >
          {/* Clima: un degradé muy suave del acento arriba del panel */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 h-[260px] md:h-[320px] print:hidden"
            style={{
              background:
                'radial-gradient(70% 120% at 85% -20%, color-mix(in oklch, var(--primary) 10%, transparent), transparent 60%), radial-gradient(50% 90% at 10% -30%, color-mix(in oklch, var(--e2) 6%, transparent), transparent 60%)',
            }}
          />
          {navegando && (
            <div className="pointer-events-none absolute inset-x-0 top-0 z-40 h-0.5 overflow-hidden" role="progressbar" aria-label="Cargando">
              <div className="h-full w-1/3 animate-[navegando_1s_ease-in-out_infinite] bg-primary" />
            </div>
          )}
          {/* Barra de arriba: migas a la izquierda; buscar y avisos a la derecha. */}
          <header className="relative flex h-[60px] items-center gap-3 px-4 md:h-[58px] md:border-b md:border-border md:px-7 print:hidden">
            <div className="flex min-w-0 items-center gap-2 text-sm font-medium text-muted-foreground">
              <Link href={hrefInicio} className="truncate transition-colors hover:text-foreground max-md:hidden">{padre}</Link>
              <CaretRight size={12} className="shrink-0 max-md:hidden" aria-hidden />
              <b className="truncate font-medium text-foreground">{titulo}</b>
            </div>
            <div className="ml-auto flex items-center gap-2">
              <BotonIcono etiqueta="Buscar" onClick={() => setPaleta(true)} borde>
                <MagnifyingGlass size={17} />
              </BotonIcono>
              {!enArcor && (
                <Link
                  href={hrefVencidos}
                  aria-label={`Avisos, ${vencidosVistos} ${vencidosVistos === 1 ? 'vencido' : 'vencidos'}`}
                  title="Vencidos"
                  className="relative grid size-11 shrink-0 place-items-center rounded-xl border border-border bg-card text-texto-2 shadow-min transition-colors hover:bg-hover hover:text-foreground md:size-9"
                >
                  <Bell size={17} aria-hidden />
                  {vencidosVistos > 0 && <span className="absolute top-2 right-2.5 size-[7px] rounded-full bg-danger outline-2 outline-card" />}
                </Link>
              )}
            </div>
          </header>
          <div className="relative">{children}</div>
        </main>
      </div>

      {/* ── Celular: barra inferior y "Más" ── */}
      {!enArcor && (
        <nav aria-label="Secciones" className="fixed inset-x-4 bottom-[calc(16px+env(safe-area-inset-bottom))] z-30 flex h-16 items-center justify-around rounded-full border border-border bg-[color-mix(in_oklch,var(--card)_92%,transparent)] px-2 shadow-flotante backdrop-blur-[14px] md:hidden print:hidden">
          {[
            { key: 'inicio', label: una ? 'Resumen' : 'Inicio', href: hrefInicio, icon: House, on: pathname.startsWith('/dashboard') || (!!una && pathname === `/empresa/${una.slug}` && !enDocumentacion) },
            { key: 'empleados', label: 'Empleados', href: una ? `/empleados?empresa=${una.slug}` : conVistas('/empleados'), icon: IdentificationBadge, on: pathname.startsWith('/empleados') },
            { key: 'vencimientos', label: 'Vencimientos', href: hrefVencimientos, icon: ClockCountdown, on: pathname.startsWith('/vencimientos') },
          ].map((t) => (
            <Link key={t.key} href={t.href} aria-current={t.on ? 'page' : undefined} aria-label={t.label} className={cn('inline-flex h-11 min-w-14 items-center justify-center gap-1.5 rounded-full px-3 text-[13px] font-medium', t.on ? 'bg-accent text-accent-foreground' : 'text-muted-foreground')}>
              <t.icon size={20} weight={t.on ? 'fill' : 'regular'} aria-hidden />
              {t.on && <span>{t.label}</span>}
            </Link>
          ))}
          <button type="button" onClick={() => setMas(true)} aria-label="Más: empresas, recursos y administración" className="inline-flex h-11 min-w-14 cursor-pointer items-center justify-center rounded-full px-3 text-muted-foreground">
            <DotsThreeOutline size={20} aria-hidden />
          </button>
        </nav>
      )}
      <Hoja abierta={mas} onCerrar={() => setMas(false)} etiqueta={{ id: 'hoja-mas' }}>
        <HojaCabecera tituloId="hoja-mas" rotulo="Gestión de Recursos" titulo="Más" onCerrar={() => setMas(false)} />
        <div className="flex flex-1 flex-col gap-6 overflow-y-auto overscroll-contain p-4">
          {empresas.length > 1 && (
            <section>
              <h4 className="mb-3 text-base font-medium tracking-[-0.01em]">Empresas</h4>
              <div className="overflow-hidden rounded-[16px] border border-border [&>*+*]:border-t [&>*+*]:border-divisor">{menuEmpresas}</div>
            </section>
          )}
          {grupos.slice(1).map((g, i) => (
            <section key={g.titulo ?? i}>
              <h4 className="mb-3 text-base font-medium tracking-[-0.01em]">{g.titulo ? g.titulo[0] + g.titulo.slice(1).toLowerCase() : 'Menú'}</h4>
              <div className="overflow-hidden rounded-[16px] border border-border">
                {g.items.map((it) => {
                  const Ico = it.icon
                  const fila = (
                    <>
                      <Ico size={17} className="text-muted-foreground" aria-hidden />
                      <span className="min-w-0 flex-1 truncate font-medium">{it.label}</span>
                      {it.external ? <ArrowSquareOut size={14} className="text-muted-foreground" aria-hidden /> : <CaretRight size={14} className="text-muted-foreground" aria-hidden />}
                    </>
                  )
                  const cls = 'flex min-h-[60px] items-center gap-3 border-t border-divisor px-4 text-[13px] first:border-t-0'
                  return it.external
                    ? <a key={it.key} href={it.href} target="_blank" rel="noopener noreferrer" className={cls}>{fila}</a>
                    : <Link key={it.key} href={it.href} onClick={() => setMas(false)} className={cls}>{fila}</Link>
                })}
              </div>
            </section>
          ))}
          <section>
            <h4 className="mb-3 text-base font-medium tracking-[-0.01em]">Cuenta</h4>
            <div className="overflow-hidden rounded-[16px] border border-border [&>*+*]:border-t [&>*+*]:border-divisor">
              <button type="button" onClick={alternarTema} className="flex min-h-[60px] w-full cursor-pointer items-center gap-3 px-4 text-left text-[13px] font-medium">
                {oscuro ? <Sun size={17} className="text-muted-foreground" aria-hidden /> : <Moon size={17} className="text-muted-foreground" aria-hidden />}
                {oscuro ? 'Modo claro' : 'Modo oscuro'}
              </button>
              <Link href="/cuenta/ia" onClick={() => setMas(false)} className="flex min-h-[60px] items-center gap-3 px-4 text-[13px] font-medium"><Sparkle size={17} className="text-muted-foreground" aria-hidden />Conectar una IA</Link>
              <button type="button" onClick={handleLogout} className="flex min-h-[60px] w-full cursor-pointer items-center gap-3 px-4 text-left text-[13px] font-medium text-danger"><SignOut size={17} aria-hidden />Cerrar sesión</button>
            </div>
          </section>
        </div>
      </Hoja>
      <Paleta abierta={paleta} onCerrar={() => setPaleta(false)} pantallas={pantallas} empresas={empresasPaleta} hrefPersona={(id) => `/empleados?legajo=${id}`} />
    </div>
  )
}

/** Nombre de la pantalla en las migas. */
function tituloDe(pathname: string, documentacion: boolean, arcor: boolean): string {
  if (arcor) {
    if (pathname.startsWith('/arcor/actividad')) return 'Actividad'
    if (pathname.startsWith('/arcor/alertas')) return 'Alertas'
    if (pathname.startsWith('/arcor/contenedores')) return 'Contenedores'
    return 'Resumen'
  }
  const TITULOS: [string, string][] = [
    ['/dashboard', 'Inicio'],
    ['/empleados', 'Empleados'],
    ['/vencimientos', 'Vencimientos'],
    ['/legajo', 'Legajo'],
    ['/documentos', 'Documentación mensual'],
    ['/carpeta', 'Armar carpeta'],
    ['/flota', 'Flota'],
    ['/palas', 'Palas cargadoras'],
    ['/stock', 'Stock'],
    ['/admin/empleados', 'Nuevo empleado'],
    ['/admin/usuarios', 'Usuarios'],
    ['/admin/historial', 'Historial'],
    ['/admin/ajustes', 'Ajustes'],
    ['/cuenta', 'Conectar una IA'],
  ]
  if (pathname.startsWith('/empresa/')) return documentacion ? 'Habilitaciones' : 'Resumen'
  return TITULOS.find(([p]) => pathname.startsWith(p))?.[1] ?? 'Gestión de Recursos'
}
