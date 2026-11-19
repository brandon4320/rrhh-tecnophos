'use client'

/* Empleados (overhaul 18/11/2026, demo aprobada empleados.html).
 * Comportamiento de antes → dónde queda:
 * [x] Búsqueda por palabras sin acentos, ?q=, autofoco, ↑↓ Enter, Esc limpia → igual + "/" enfoca
 * [x] Activos · N / Dados de baja · N (?baja=1) → segmentado con conteos
 * [x] Select de sector (?sector=, solo si hay más de uno) → filtro "Sector es …" con conteo por sector
 * [x] Select de estado (?estado=) → las 4 tarjetas de arriba filtran + chip "Estado es … ×"
 * [x] Orden por columna (?orden=, certificados de mayor a menor) → igual, con aria-sort
 * [x] Columnas Nombre, Empresa, Sector, Certificados, Estado → igual + rayita de empresa, puntos por
 *     certificado y "Próximo vencimiento"
 * [x] Toda la fila abre el legajo → hoja lateral (?legajo=, zona gris aprobada); el link sigue siendo
 *     /legajo/<id> (clic medio / pestaña nueva) y "Legajo completo" en la hoja
 * [x] Reactivar (bajas, con puedeEditar) → igual en la fila, con aviso
 * [x] Nuevo empleado (con puedeEditar, trae la empresa si hay una sola) → hoja de alta (zona gris
 *     aprobada; /admin/empleados/nuevo sigue existiendo)
 * [x] Vacíos: con filtros / búsqueda / sin bajas / sin activos → igual, con ilustración y "Limpiar filtros"
 */

import { useEffect, useMemo, useRef, useState, useTransition, type KeyboardEvent } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import {
  ArrowSquareOut, ArrowUpRight, CalendarBlank, CaretDown, CaretUp, Check, CheckCircle, CircleDashed, DotsThree, FunnelSimple,
  HourglassHigh, MagnifyingGlass, Plus, UserMinus, UserPlus, UsersFour, WarningCircle, X,
} from '@phosphor-icons/react'
import { RANGO_ESTADO, alternarOrden, comparar, escribirOrden, leerOrden, type Orden } from '@/lib/orden'
import { createClient } from '@/lib/supabase/client'
import { coincide } from '@/lib/texto'
import { mensajeError } from '@/lib/errores'
import { cn } from '@/lib/utils'
import type { EstadoVencimiento } from '@/types'
import { AvatarPersona, Cuadro, IconoEmpresa, colorEmpresa } from '@/components/ui/empresa'
import { Bloques, Chip, Contar, EstadoTexto, Linea, Rayitas, Vacio, posicionPunto } from '@/components/ui/datos'
import { Hoja, HojaCabecera } from '@/components/ui/hoja'
import { Skeleton } from '@/components/ui/skeleton'
import LegajoClient from '../legajo/[id]/LegajoClient'
import NuevoEmpleadoForm from '../admin/empleados/nuevo/NuevoEmpleadoForm'

export interface FilaEmpleado {
  id: string
  nombre: string
  apellido: string | null
  nombreCompleto: string
  sector: string | null
  empresaNombre: string | null
  activo: boolean
  certificados: number
  estado: EstadoVencimiento
  empresaSlug: string | null
  /** Estado de cada certificado (hasta 8), para los puntos de la columna. */
  puntos: EstadoVencimiento[]
  /** El vencimiento más cercano (o el más atrasado). */
  proximo: { tipo: string; fecha: string; dias: number; alerta: number } | null
}

type PropsLegajo = React.ComponentProps<typeof LegajoClient> & { key: string; renovar: boolean; cargar: boolean }

interface Props {
  filas: FilaEmpleado[]
  empresaSel: { id: string; nombre: string; slug: string } | null
  /** "ADC S.R.L., Serviwhite" o "todas las empresas": lo tildado en el selector del menú. */
  alcance: string
  puedeEditar: boolean
  /** Curva de lo que vence (9 semanas), personas con algo esta semana y certificados vencidos. */
  resumen: { curva: number[]; semana: number; certsVencidos: number }
  empresas: { id: string; nombre: string; slug: string }[]
  sectores: string[]
  nombreEmpresas: string
  /** ?nuevo=1: la hoja de alta arranca abierta. */
  abrirAlta: boolean
  /** ?legajo=<id>: el legajo que trajo el server para la hoja. */
  legajo: PropsLegajo | null
}

const CAMPOS = ['nombre', 'empresa', 'sector', 'certificados', 'proximo', 'estado'] as const
type Campo = (typeof CAMPOS)[number]
const ORDEN_INICIAL: Orden<Campo> = { campo: 'nombre', dir: 'asc' }
const ESTADOS: EstadoVencimiento[] = ['vencido', 'proximo', 'vigente', 'sin_fecha']
const NOM_EST: Record<EstadoVencimiento, string> = { vencido: 'Con vencidos', proximo: 'Por vencer', vigente: 'Al día', sin_fecha: 'Sin datos' }
const COLOR_PUNTO: Record<EstadoVencimiento, string> = { vencido: 'var(--rojo-g)', proximo: 'var(--ambar-g)', vigente: 'var(--verde-g)', sin_fecha: 'var(--muted)' }
const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
const fCorta = (f: string) => { const [y, m, d] = f.split('-'); return `${Number(d)} ${MESES[Number(m) - 1]}${y !== String(new Date().getFullYear()) ? ` ${y}` : ''}` }

function valorDe(f: FilaEmpleado, campo: Campo): string | number | null {
  if (campo === 'nombre') return f.nombreCompleto
  if (campo === 'empresa') return f.empresaNombre
  if (campo === 'sector') return f.sector?.trim() || null
  if (campo === 'certificados') return f.certificados
  if (campo === 'proximo') return f.proximo?.fecha ?? null
  return RANGO_ESTADO[f.estado]
}

/** Reemplaza parámetros de la URL sin navegar (la búsqueda sobrevive al volver atrás). */
function reemplazarParam(clave: string | Record<string, string | null>, valor?: string | null) {
  try {
    const url = new URL(window.location.href)
    const cambios = typeof clave === 'string' ? { [clave]: valor ?? null } : clave
    for (const [k, v] of Object.entries(cambios)) {
      if (v) url.searchParams.set(k, v)
      else url.searchParams.delete(k)
    }
    window.history.replaceState(null, '', url)
  } catch { /* la URL es cosmética */ }
}

export default function EmpleadosClient({ filas: filasServer, empresaSel, alcance, puedeEditar, resumen, empresas, sectores: sectoresAlta, nombreEmpresas, abrirAlta, legajo }: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()
  // Las filas salen SIEMPRE de las props (cambiar de empresa o router.refresh las
  // renueva); lo único local es lo reactivado acá, para verlo al instante.
  const [reactivados, setReactivados] = useState<ReadonlySet<string>>(() => new Set())
  const filas = useMemo(
    () => (reactivados.size ? filasServer.map((f) => (reactivados.has(f.id) ? { ...f, activo: true } : f)) : filasServer),
    [filasServer, reactivados]
  )
  // La búsqueda se lee de la URL al montar: al volver de un legajo sigue escrita.
  const [busqueda, setBusqueda] = useState(() => searchParams.get('q') ?? '')
  const [verBajas, setVerBajas] = useState(() => searchParams.get('baja') === '1')
  // Orden y filtros también de la URL (al volver de un legajo quedan como estaban).
  const [orden, setOrden] = useState(() => leerOrden(searchParams.get('orden'), CAMPOS, ORDEN_INICIAL))
  const [sector, setSector] = useState(() => searchParams.get('sector') ?? '')
  const [estado, setEstado] = useState<EstadoVencimiento | ''>(() => (ESTADOS as string[]).includes(searchParams.get('estado') ?? '') ? (searchParams.get('estado') as EstadoVencimiento) : '')
  const [seleccion, setSeleccion] = useState(0)
  const [reactivando, setReactivando] = useState<string | null>(null)
  const [menuSector, setMenuSector] = useState(false)
  const [menuFila, setMenuFila] = useState<{ id: string; x: number; y: number } | null>(null)
  // Hojas: el legajo (?legajo=) y el alta (?nuevo=1).
  const [abierto, setAbierto] = useState<string | null>(() => searchParams.get('legajo'))
  const [alta, setAlta] = useState(abrirAlta && puedeEditar)
  const [, startTransition] = useTransition()
  const buscador = useRef<HTMLInputElement>(null)

  const activos = useMemo(() => filas.filter((f) => f.activo).length, [filas])
  const bajas = filas.length - activos

  // Sectores de lo que se está mirando (activos o bajas), sin repetir mayúsculas/minúsculas.
  const sectores = useMemo(() => {
    const vistos = new Map<string, { s: string; n: number }>()
    for (const f of filas) {
      const s = f.sector?.trim()
      if (f.activo !== verBajas && s) {
        const k = s.toLocaleLowerCase('es')
        const v = vistos.get(k)
        if (v) v.n++
        else vistos.set(k, { s, n: 1 })
      }
    }
    return [...vistos.values()].sort((a, b) => comparar(a.s, b.s))
  }, [filas, verBajas])

  const visibles = useMemo(
    () =>
      filas
        .filter(
          (f) =>
            f.activo !== verBajas &&
            (!sector || f.sector?.trim().toLocaleLowerCase('es') === sector.toLocaleLowerCase('es')) &&
            (!estado || f.estado === estado) &&
            coincide(busqueda, f.nombre, f.apellido, f.sector, f.empresaNombre)
        )
        // Empate: por nombre, así el orden no salta entre iguales.
        .sort((a, b) => comparar(valorDe(a, orden.campo), valorDe(b, orden.campo), orden.dir) || comparar(a.nombreCompleto, b.nombreCompleto)),
    [filas, verBajas, busqueda, sector, estado, orden]
  )

  function alternar(campo: Campo) {
    // Los números (certificados) arrancan de mayor a menor; el resto, de la A a la Z / lo más urgente primero.
    const nuevo = alternarOrden(orden, campo, campo === 'certificados' ? 'desc' : 'asc')
    setOrden(nuevo)
    setSeleccion(0)
    reemplazarParam('orden', nuevo.campo === ORDEN_INICIAL.campo && nuevo.dir === ORDEN_INICIAL.dir ? null : escribirOrden(nuevo))
  }

  function cambiarSector(v: string) {
    setSector(v)
    setSeleccion(0)
    setMenuSector(false)
    reemplazarParam('sector', v || null)
  }

  function cambiarEstado(v: EstadoVencimiento | '') {
    setEstado(v)
    setSeleccion(0)
    reemplazarParam('estado', v || null)
  }
  const sel = Math.min(seleccion, visibles.length - 1)

  function cambiarBusqueda(v: string) {
    setBusqueda(v)
    setSeleccion(0)
    reemplazarParam('q', v.trim() ? v : null)
  }

  function cambiarVista(bajasSi: boolean) {
    setVerBajas(bajasSi)
    setSeleccion(0)
    reemplazarParam('baja', bajasSi ? '1' : null)
  }

  function limpiarFiltros() {
    setSector('')
    setEstado('')
    setBusqueda('')
    setSeleccion(0)
    reemplazarParam({ sector: null, estado: null, q: null })
  }

  function mover(i: number) {
    const fila = visibles[i]
    if (!fila) return
    setSeleccion(i)
    document.getElementById(`emp-${fila.id}`)?.scrollIntoView({ block: 'nearest' })
  }

  /** Abre el legajo en la hoja: se ve al instante y los datos llegan del server (?legajo=). */
  function abrir(id: string, extra: Record<string, string> = {}) {
    setAbierto(id)
    setMenuFila(null)
    const url = new URL(window.location.href)
    url.searchParams.set('legajo', id)
    for (const k of ['cert', 'renovar', 'cargar']) url.searchParams.delete(k)
    for (const [k, v] of Object.entries(extra)) url.searchParams.set(k, v)
    startTransition(() => router.push(`${url.pathname}${url.search}`, { scroll: false }))
  }
  function cerrarLegajo() {
    setAbierto(null)
    reemplazarParam({ legajo: null, cert: null, renovar: null, cargar: null })
  }
  function navegar(dir: 1 | -1) {
    const i = visibles.findIndex((f) => f.id === abierto)
    const sig = visibles[i + dir]
    if (!sig) return
    abrir(sig.id)
    setSeleccion(i + dir)
    document.getElementById(`emp-${sig.id}`)?.scrollIntoView({ block: 'nearest' })
  }
  function cerrarAlta() {
    setAlta(false)
    reemplazarParam('nuevo', null)
  }

  function onTeclado(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      mover(Math.min(sel + 1, visibles.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      mover(Math.max(sel - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const fila = visibles[sel]
      if (fila) abrir(fila.id)
    } else if (e.key === 'Escape' && busqueda) {
      e.preventDefault()
      cambiarBusqueda('')
    }
  }

  // Autofoco solo en escritorio: en el celular abriría el teclado tapando la lista.
  useEffect(() => {
    if (window.matchMedia('(min-width: 768px) and (hover: hover)').matches && !searchParams.get('legajo')) buscador.current?.focus({ preventScroll: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo al entrar
  }, [])

  // "/" enfoca el buscador; con la hoja abierta, ↑↓ recorren los legajos sin cerrarla.
  useEffect(() => {
    function teclado(e: globalThis.KeyboardEvent) {
      const enCampo = /INPUT|SELECT|TEXTAREA/.test((document.activeElement as HTMLElement | null)?.tagName ?? '')
      if (e.key === '/' && !enCampo && !abierto && !alta) { e.preventDefault(); buscador.current?.focus() }
      if (abierto && !enCampo && (e.key === 'ArrowDown' || e.key === 'ArrowUp') && !document.querySelector('[data-menu-abierto]')) {
        e.preventDefault()
        navegar(e.key === 'ArrowDown' ? 1 : -1)
      }
    }
    document.addEventListener('keydown', teclado)
    return () => document.removeEventListener('keydown', teclado)
  })

  async function reactivar(fila: FilaEmpleado) {
    setReactivando(fila.id)
    setMenuFila(null)
    const supabase = createClient()
    const { data, error } = await supabase
      .from('empleados')
      .update({ activo: true, updated_at: new Date().toISOString() })
      .eq('id', fila.id)
      .select('id')
    setReactivando(null)
    if (error || !data?.length) {
      toast.error(error ? mensajeError(error, 'reactivar al empleado') : 'No se pudo reactivar: no tenés permiso sobre este legajo.')
      return
    }
    setReactivados((prev) => new Set(prev).add(fila.id))
    toast.success(`${fila.nombreCompleto} está activo de nuevo`, { description: 'Vuelve a contar en Vencimientos e Inicio' })
    router.refresh()
  }

  // ── Cifras de arriba (sobre los activos de las empresas que se miran) ──
  const act = filas.filter((f) => f.activo)
  const n = act.length
  const cuenta = (e: EstadoVencimiento) => act.filter((f) => f.estado === e).length
  const cVen = cuenta('vencido'), cProx = cuenta('proximo'), cOk = cuenta('vigente'), cSin = cuenta('sin_fecha')
  const glob = resumen.curva.length > 2 ? posicionPunto(resumen.curva, 2, 84, 0) : null
  const filtrosActivos = [estado && `«${NOM_EST[estado]}»`, sector && `«${sector}»`, busqueda.trim() && `«${busqueda.trim()}»`].filter(Boolean)
  const vencidosVisibles = visibles.filter((f) => f.estado === 'vencido' && f.activo).length
  const filaMenu = menuFila ? filas.find((f) => f.id === menuFila.id) : null
  const legajoListo = legajo && abierto && legajo.empleado.id === abierto ? legajo : null
  const empresaInicial = empresaSel?.id ?? (empresas.length === 1 ? empresas[0].id : '')

  const kpiCls = (k: EstadoVencimiento) => cn('flex min-w-0 cursor-pointer flex-col rounded-2xl border border-border bg-bandeja p-1 text-left transition-[border-color,box-shadow]', estado === k ? 'border-primary shadow-[0_0_0_3px_color-mix(in_oklch,var(--primary)_14%,transparent)]' : 'hover:border-border-strong')
  const pieKpi = 'flex min-h-11 items-center gap-1 px-[17px] py-2 text-xs font-medium md:min-h-9'
  const cols = 'xl:grid-cols-[minmax(190px,1.4fr)_minmax(170px,1.1fr)_minmax(110px,.8fr)_104px_minmax(150px,1fr)_120px_64px] md:max-xl:grid-cols-[minmax(180px,1.4fr)_minmax(140px,1fr)_104px_minmax(140px,1fr)_120px_64px]'

  return (
    <div className="flex flex-col gap-7 px-4 pt-2 pb-20 text-sm md:px-7 md:pt-6 md:pb-10">
      {/* ── Cabecera ── */}
      <div className="flex flex-col items-start gap-4 md:flex-row md:items-end">
        <div className="min-w-0">
          <h1 className="text-[32px] leading-[1.15] font-medium tracking-[-0.03em]">Empleados</h1>
          <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-texto-2" title={alcance}>
            <button type="button" onClick={() => { cambiarVista(false); cambiarEstado('') }} className="cursor-pointer rounded-md hover:underline hover:underline-offset-[3px] max-md:min-h-11"><b className="font-medium text-foreground">{activos}</b> activos</button>
            <span className="text-muted-foreground">·</span>
            {cVen > 0 && (
              <>
                <button type="button" onClick={() => { cambiarVista(false); cambiarEstado('vencido') }} className="cursor-pointer rounded-md text-danger hover:underline hover:underline-offset-[3px] max-md:min-h-11"><b className="font-medium">{cVen}</b> con vencidos</button>
                <span className="text-muted-foreground">·</span>
              </>
            )}
            <button type="button" onClick={() => { cambiarVista(false); cambiarEstado('proximo') }} className="cursor-pointer rounded-md hover:underline hover:underline-offset-[3px] max-md:min-h-11"><b className="font-medium text-foreground">{cProx}</b> por vencer</button>
            <span className="text-muted-foreground">·</span>
            <span>{nombreEmpresas}</span>
          </p>
        </div>
        {puedeEditar && (
          <div className="ml-auto hidden md:flex">
            <button type="button" data-principal onClick={() => setAlta(true)} className="inline-flex h-[38px] cursor-pointer items-center gap-2 rounded-xl bg-primary pr-4 pl-3 text-sm font-medium whitespace-nowrap text-primary-foreground shadow-principal transition-[background-color,transform] hover:bg-primary-hover active:scale-[0.97] dark:bg-foreground dark:text-card">
              <UserPlus size={17} aria-hidden />Nuevo empleado
            </button>
          </div>
        )}
      </div>

      {/* ── Las tarjetas de arriba son el filtro por estado ── */}
      <section aria-label="Estado de la documentación del personal">
        <div className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pt-0.5 pb-3 [scrollbar-width:none] md:mx-0 md:grid md:grid-cols-2 md:gap-[14px] md:overflow-visible md:p-0 xl:grid-cols-[1.25fr_repeat(3,minmax(0,1fr))] [&>*]:min-w-0 max-md:[&>*]:shrink-0 max-md:[&>*]:basis-[84%] max-md:[&>*]:snap-center">
          <button
            type="button"
            aria-pressed={estado === 'proximo'}
            onClick={() => { cambiarVista(false); cambiarEstado(estado === 'proximo' ? '' : 'proximo') }}
            className={cn('relative flex min-h-[228px] cursor-pointer flex-col overflow-hidden rounded-2xl p-6 text-left text-white shadow-heroe', estado === 'proximo' && 'shadow-[0_0_0_3px_color-mix(in_oklch,var(--primary)_30%,transparent),var(--sombra-heroe)]')}
            style={{ background: 'radial-gradient(120% 140% at 100% 0%, #6d63ff 0%, transparent 55%), linear-gradient(150deg, #3730a3, #4f46e5 60%, #4338ca)' }}
          >
            <span aria-hidden className="pointer-events-none absolute inset-0 [background-image:radial-gradient(rgb(255_255_255/.10)_1px,transparent_1.2px)] [background-size:14px_14px] [mask:linear-gradient(200deg,#000,transparent_60%)]" />
            <div className="relative z-[1] flex w-full items-center justify-between">
              <span className="grid size-10 place-items-center rounded-xl border border-white/25 bg-white/15 backdrop-blur-[6px]"><HourglassHigh size={20} aria-hidden /></span>
              <span className="flex h-6 items-center gap-1 rounded-full border border-white/25 bg-white/15 px-2 text-xs font-medium backdrop-blur-[6px]"><CalendarBlank size={13} aria-hidden />{resumen.semana} esta semana</span>
            </div>
            <span className="relative mt-4 block text-[13px] font-medium text-white/90">Personas con algo por vencer</span>
            <span className="relative mt-1 block text-[40px] leading-[1.05] font-semibold tracking-[-0.035em]"><Contar valor={cProx} /></span>
            <span className="relative mt-1 block text-xs text-white/90">En los próximos 30 días</span>
            {resumen.curva.length > 2 && (
              <span className="absolute inset-x-0 bottom-0 block">
                <Linea valores={resumen.curva} color="#fff" rellenoBlanco alto={84} pad={0} punto={2} />
                {glob && (
                  <span className="absolute z-[2] -translate-x-1/2 -translate-y-[calc(100%+12px)] rounded-lg bg-white px-2 py-0.5 text-xs font-medium whitespace-nowrap text-[#312e81] shadow-[0_6px_14px_-6px_rgb(23_22_31/.4)]" style={{ left: `clamp(90px, ${glob.left}%, calc(100% - 90px))`, top: glob.top }}>
                    En 2 semanas · {resumen.curva[2]}
                  </span>
                )}
              </span>
            )}
          </button>

          <button type="button" aria-pressed={estado === 'vencido'} onClick={() => { cambiarVista(false); cambiarEstado(estado === 'vencido' ? '' : 'vencido') }} className={kpiCls('vencido')}>
            <span className="flex items-center gap-2 py-2 pr-3 pl-[17px] text-[13px] font-medium text-texto-2"><WarningCircle size={16} className="text-muted-foreground" aria-hidden />Con vencidos</span>
            <span className="block w-full flex-1 rounded-interno border border-border bg-card p-4 shadow-min">
              <span className="block text-[32px] leading-[1.05] font-semibold tracking-[-0.035em]"><Contar valor={cVen} /></span>
              <span className="mt-1 block text-xs text-muted-foreground">{plural(resumen.certsVencidos, 'certificado vencido', 'certificados vencidos')}</span>
              <Bloques className="mt-6" colores={Array.from({ length: 10 }, (_, i) => (i < Math.max(cVen ? 1 : 0, Math.round((cVen / Math.max(1, n)) * 10)) ? 'var(--rojo-g)' : null))} />
            </span>
            {cVen
              ? <span className={cn(pieKpi, 'w-full text-danger')}><WarningCircle size={14} aria-hidden />Requiere atención<span className="ml-auto inline-flex items-center gap-1">Filtrar<FunnelSimple size={14} aria-hidden /></span></span>
              : <span className={cn(pieKpi, 'w-full text-muted-foreground')}><CheckCircle size={14} aria-hidden />Nadie con vencidos</span>}
          </button>

          <button type="button" aria-pressed={estado === 'vigente'} onClick={() => { cambiarVista(false); cambiarEstado(estado === 'vigente' ? '' : 'vigente') }} className={kpiCls('vigente')}>
            <span className="flex items-center gap-2 py-2 pr-3 pl-[17px] text-[13px] font-medium text-texto-2"><CheckCircle size={16} className="text-muted-foreground" aria-hidden />Al día</span>
            <span className="block w-full flex-1 rounded-interno border border-border bg-card p-4 shadow-min">
              <span className="block text-[32px] leading-[1.05] font-semibold tracking-[-0.035em]"><Contar valor={cOk} /><small className="ml-1 text-xl font-normal tracking-[-0.01em] text-muted-foreground">de {n}</small></span>
              <span className="mt-1 block text-xs text-muted-foreground">{Math.round((cOk / Math.max(1, n)) * 100)} % del personal sin pendientes</span>
              <Rayitas pct={(cOk / Math.max(1, n)) * 100} color="var(--verde-g)" />
            </span>
            <span className={cn(pieKpi, 'w-full text-muted-foreground')}><UsersFour size={14} aria-hidden />{plural(n, 'persona activa', 'personas activas')}<span className="ml-auto inline-flex items-center gap-1">Filtrar<FunnelSimple size={14} aria-hidden /></span></span>
          </button>

          <button type="button" aria-pressed={estado === 'sin_fecha'} onClick={() => { cambiarVista(false); cambiarEstado(estado === 'sin_fecha' ? '' : 'sin_fecha') }} className={kpiCls('sin_fecha')}>
            <span className="flex items-center gap-2 py-2 pr-3 pl-[17px] text-[13px] font-medium text-texto-2"><CircleDashed size={16} className="text-muted-foreground" aria-hidden />Sin datos</span>
            <span className="block w-full flex-1 rounded-interno border border-border bg-card p-4 shadow-min">
              <span className="block text-[32px] leading-[1.05] font-semibold tracking-[-0.035em]"><Contar valor={cSin} /></span>
              <span className="mt-1 block text-xs text-muted-foreground">Sin vencimientos cargados</span>
              <Bloques className="mt-6" colores={Array.from({ length: 10 }, (_, i) => (i < (Math.round((cSin / Math.max(1, n)) * 10) || (cSin ? 1 : 0)) ? 'var(--decorativo)' : null))} />
            </span>
            <span className={cn(pieKpi, 'w-full text-muted-foreground')}><Plus size={14} aria-hidden />Cargar lo que falta<span className="ml-auto inline-flex items-center gap-1">Filtrar<FunnelSimple size={14} aria-hidden /></span></span>
          </button>
        </div>
      </section>

      {/* ── Lista ── */}
      <section className="min-w-0 md:rounded-2xl md:border md:border-border md:bg-card" aria-label="Lista de empleados">
        <div className="flex flex-wrap items-center gap-2 pb-3 md:px-4 md:pt-4">
          <div role="group" aria-label="Activos o dados de baja" className="order-1 flex w-full gap-0.5 rounded-xl bg-muted p-[3px] md:w-auto">
            {[{ si: false, t: 'Activos', k: activos }, { si: true, t: 'Dados de baja', k: bajas }].map((x) => (
              <button key={x.t} type="button" aria-pressed={verBajas === x.si} onClick={() => { cambiarVista(x.si); setSector(''); reemplazarParam('sector', null) }} className={cn('inline-flex h-11 flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-[9px] px-3 text-[13px] font-medium whitespace-nowrap transition-colors md:h-7 md:flex-none', verBajas === x.si ? 'bg-card text-foreground shadow-[0_1px_2px_rgb(23_22_31/.1),0_0_0_1px_var(--border)] dark:bg-foreground dark:text-card' : 'text-texto-2 hover:text-foreground')}>
                {x.t} <span className={verBajas === x.si ? 'text-muted-foreground dark:text-card/70' : 'text-muted-foreground'}>{x.k}</span>
              </button>
            ))}
          </div>
          <label className="order-2 flex h-12 w-full min-w-0 flex-[1_1_100%] items-center gap-2 rounded-xl border border-border-strong bg-card pr-2 pl-3 transition-[border-color,box-shadow] focus-within:border-primary focus-within:shadow-[0_0_0_3px_color-mix(in_oklch,var(--primary)_16%,transparent)] md:h-9 md:max-w-[360px] md:min-w-[240px] md:flex-1">
            <MagnifyingGlass size={17} className="text-muted-foreground" aria-hidden />
            <input
              ref={buscador}
              type="search"
              value={busqueda}
              onChange={(e) => cambiarBusqueda(e.target.value)}
              onKeyDown={onTeclado}
              placeholder="Buscar por nombre, sector o empresa"
              aria-label="Buscar empleados"
              autoComplete="off"
              className="h-full min-w-0 flex-1 border-0 bg-transparent text-base outline-none [&::-webkit-search-cancel-button]:hidden md:text-sm"
            />
            <kbd className="hidden rounded-md border border-border px-1 font-mono text-[11px] text-muted-foreground md:inline">/</kbd>
          </label>
          {sectores.length > 1 && (
            <span className="relative order-3">
              <button
                type="button"
                aria-haspopup="menu"
                aria-expanded={menuSector}
                onClick={() => setMenuSector(!menuSector)}
                className={cn('inline-flex h-11 cursor-pointer items-center gap-1.5 rounded-full border px-3 text-[13px] font-medium whitespace-nowrap transition-colors md:h-9', sector ? 'border-[color-mix(in_oklch,var(--primary)_30%,transparent)] bg-accent text-accent-foreground' : 'border-border bg-card text-texto-2 hover:bg-hover hover:text-foreground')}
              >
                {sector ? <>Sector es {sector}</> : <><FunnelSimple size={15} className="text-muted-foreground" aria-hidden />Sector</>}
              </button>
              {sector && (
                <button type="button" aria-label="Quitar filtro de sector" onClick={() => cambiarSector('')} className="absolute top-1/2 right-1.5 grid size-5 -translate-y-1/2 cursor-pointer place-items-center rounded-full text-accent-foreground hover:bg-[color-mix(in_oklch,var(--primary)_14%,transparent)]">
                  <X size={12} aria-hidden />
                </button>
              )}
              {menuSector && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setMenuSector(false)} />
                  <div role="menu" data-menu-abierto className="absolute top-[calc(100%+6px)] left-0 z-50 max-h-[60dvh] min-w-[240px] overflow-y-auto rounded-2xl border border-border bg-popover p-1.5 shadow-flotante">
                    <div className="px-2 pt-1.5 pb-1 text-xs font-medium text-muted-foreground">Sector</div>
                    {[{ s: '', n: null }, ...sectores].map((x) => (
                      <button key={x.s || 'todos'} type="button" role="menuitemradio" aria-checked={sector === x.s} onClick={() => cambiarSector(x.s)} className="flex min-h-10 w-full cursor-pointer items-center gap-2 rounded-[10px] px-2 text-left text-sm font-medium hover:bg-muted">
                        <span className="min-w-0 flex-1 truncate">{x.s || 'Todos los sectores'}</span>
                        <span className="text-xs text-muted-foreground">{x.n}</span>
                        {sector === x.s && <Check size={14} className="text-accent-foreground" aria-hidden />}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </span>
          )}
          {estado && (
            <button type="button" onClick={() => cambiarEstado('')} aria-label={`Quitar filtro: estado ${NOM_EST[estado]}`} className="order-3 inline-flex h-11 cursor-pointer items-center gap-1.5 rounded-full border border-[color-mix(in_oklch,var(--primary)_30%,transparent)] bg-accent px-3 text-[13px] font-medium text-accent-foreground md:h-9">
              Estado es {NOM_EST[estado]}<X size={12} aria-hidden />
            </button>
          )}
          <span className="order-4 ml-auto hidden text-[13px] whitespace-nowrap text-muted-foreground md:inline" aria-live="polite">
            Mostrando <b className="font-medium text-foreground">{visibles.length}</b> de {verBajas ? bajas : activos}
          </span>
        </div>

        <div role="table" aria-label="Empleados" className="md:px-2 md:pb-2">
          <div role="row" className={cn('sticky top-0 z-[4] hidden h-9 items-center gap-x-3 rounded-xl bg-bandeja px-3 text-xs font-medium text-texto-2 md:grid', cols)}>
            {([['nombre', 'Nombre'], ['empresa', 'Empresa'], ['sector', 'Sector'], ['certificados', 'Certificados'], ['proximo', 'Próximo vencimiento'], ['estado', 'Estado']] as const).map(([k, t]) => {
              const on = orden.campo === k
              return (
                <span key={k} role="columnheader" aria-sort={on ? (orden.dir === 'asc' ? 'ascending' : 'descending') : 'none'} className={cn('flex min-w-0 items-center whitespace-nowrap', k === 'certificados' && 'justify-end', k === 'sector' && 'max-xl:hidden')}>
                  <button type="button" onClick={() => alternar(k)} className={cn('-mx-1 inline-flex cursor-pointer items-center gap-1 rounded-md px-1 py-0.5 hover:bg-muted hover:text-foreground', on && 'text-foreground')}>
                    {t}{on && (orden.dir === 'asc' ? <CaretUp size={12} aria-hidden /> : <CaretDown size={12} aria-hidden />)}
                  </button>
                </span>
              )
            })}
            <span role="columnheader" className="sr-only">Acciones</span>
          </div>

          <div role="rowgroup">
            {visibles.length === 0 ? (
              <Vacio
                titulo={filtrosActivos.length ? 'Nadie con esos filtros' : verBajas ? 'Nadie dado de baja' : 'Sin empleados activos'}
                accion={filtrosActivos.length ? <button type="button" onClick={limpiarFiltros} className="inline-flex h-11 cursor-pointer items-center gap-1.5 rounded-xl border border-border bg-card px-4 text-sm font-medium shadow-min hover:bg-hover md:h-[38px]"><X size={15} aria-hidden />Limpiar filtros</button> : undefined}
              >
                {filtrosActivos.length
                  ? `No hay ${verBajas ? 'bajas' : 'empleados activos'} con ${filtrosActivos.join(' y ')} en las empresas que mirás.`
                  : verBajas ? 'No hay empleados dados de baja.' : 'No hay empleados activos.'}
              </Vacio>
            ) : (
              visibles.map((emp, i) => {
                const p = emp.proximo
                return (
                  <div
                    key={emp.id}
                    id={`emp-${emp.id}`}
                    role="row"
                    onMouseEnter={() => setSeleccion(i)}
                    style={{ '--e': colorEmpresa(emp.empresaSlug), '--i': Math.min(i, 24) } as React.CSSProperties}
                    className={cn(
                      'relative mb-2 grid min-h-[72px] grid-cols-[44px_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-0.5 rounded-[16px] bg-card py-3 pr-4 pl-3 transition-colors [grid-template-areas:"av_nom_est""av_meta_est"] before:absolute before:top-5 before:bottom-5 before:left-0 before:w-[3px] before:rounded-[2px] before:bg-[var(--e)] md:mb-0 md:min-h-[52px] md:gap-y-0 md:rounded-none md:border-t md:border-divisor md:px-3 md:py-0 md:[grid-template-areas:none] md:first:border-t-0 md:before:top-[14px] md:before:bottom-[14px] md:before:left-[3px] md:hover:bg-hover',
                      cols,
                      i === sel && 'md:bg-hover',
                      abierto === emp.id && 'bg-sel shadow-[inset_2px_0_0_var(--primary)] md:bg-sel'
                    )}
                  >
                    <span className="grid place-items-center [grid-area:av] md:hidden"><AvatarPersona nombre={emp.nombreCompleto} slug={emp.empresaSlug} /></span>
                    <span role="cell" className="flex min-w-0 items-center gap-3 font-medium [grid-area:nom] md:[grid-area:auto]">
                      <span className="hidden md:inline"><AvatarPersona nombre={emp.nombreCompleto} slug={emp.empresaSlug} tamano={32} /></span>
                      {/* El link se estira a toda la fila (after:inset-0): clic medio abre /legajo/<id> en otra
                          pestaña; el clic de siempre abre la hoja. */}
                      <Link
                        href={`/legajo/${emp.id}`}
                        onClick={(e) => { if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return; e.preventDefault(); abrir(emp.id) }}
                        className="truncate after:absolute after:inset-0 focus:outline-none focus-visible:underline"
                      >
                        {emp.nombreCompleto}
                      </Link>
                    </span>
                    <span role="cell" className="flex min-w-0 items-center gap-2 text-xs text-texto-2 [grid-area:meta] md:text-[13px] md:[grid-area:auto]">
                      {emp.empresaSlug && <span className="hidden md:inline"><IconoEmpresa slug={emp.empresaSlug} nombre={emp.empresaNombre ?? ''} /></span>}
                      <span className="truncate" title={emp.empresaNombre ?? undefined}>{emp.empresaNombre ?? '—'}</span>
                    </span>
                    <span role="cell" className="hidden truncate text-[13px] text-texto-2 xl:block">{emp.sector ?? '—'}</span>
                    <span role="cell" className="hidden items-center justify-end gap-2 text-[13px] md:flex">
                      <span className="flex gap-[2px]" aria-hidden>{emp.puntos.map((e, k) => <i key={k} className="h-3 w-1.5 rounded-[2px]" style={{ background: COLOR_PUNTO[e] }} />)}</span>
                      {emp.certificados}
                    </span>
                    <span role="cell" className="hidden min-w-0 flex-col text-[13px] text-texto-2 md:flex">
                      {p ? (
                        <>
                          <span className={cn(p.dias < 0 && 'font-medium text-danger', p.dias >= 0 && p.dias <= p.alerta && 'font-medium text-warning')}>
                            {p.dias < 0 ? `Venció hace ${plural(-p.dias, 'día', 'días')}` : p.dias === 0 ? 'Hoy' : p.dias <= p.alerta ? `En ${plural(p.dias, 'día', 'días')}` : fCorta(p.fecha)}
                          </span>
                          <small className="truncate text-xs text-muted-foreground">{p.tipo}</small>
                        </>
                      ) : <span className="text-muted-foreground">—</span>}
                    </span>
                    <span role="cell" className="justify-self-end [grid-area:est] md:justify-self-start md:[grid-area:auto]">
                      {!emp.activo ? <span className="inline-flex items-center gap-1.5 text-[13px] whitespace-nowrap text-texto-2"><UserMinus size={14} className="text-muted-foreground" aria-hidden />Dado de baja</span>
                        : emp.estado === 'vencido' ? <Chip tono="ro">Vencido</Chip>
                        : emp.estado === 'proximo' ? <Chip tono="am">Por vencer</Chip>
                        : <EstadoTexto estado={emp.estado} />}
                    </span>
                    <span role="cell" className="relative z-[1] hidden items-center justify-end gap-1 md:flex">
                      {!emp.activo && puedeEditar ? (
                        <button type="button" onClick={() => reactivar(emp)} disabled={reactivando === emp.id} className="inline-flex h-7 cursor-pointer items-center rounded-lg border border-border bg-card px-2.5 text-[13px] font-medium shadow-min hover:bg-hover disabled:opacity-50">
                          {reactivando === emp.id ? 'Reactivando…' : 'Reactivar'}
                        </button>
                      ) : (
                        <button type="button" onClick={() => abrir(emp.id)} aria-label={`Abrir legajo de ${emp.nombreCompleto}`} className={cn('grid size-7 cursor-pointer place-items-center rounded-lg text-muted-foreground transition-[opacity,transform] hover:bg-card hover:text-foreground hover:shadow-min', i === sel ? 'opacity-100' : 'opacity-0 focus-visible:opacity-100')}>
                          <ArrowUpRight size={15} aria-hidden />
                        </button>
                      )}
                      <button
                        type="button"
                        aria-haspopup="menu"
                        aria-expanded={menuFila?.id === emp.id}
                        aria-label={`Más acciones para ${emp.nombreCompleto}`}
                        onClick={(e) => { const r = e.currentTarget.getBoundingClientRect(); setMenuFila(menuFila?.id === emp.id ? null : { id: emp.id, x: Math.max(8, r.right - 240), y: Math.min(window.innerHeight - 220, r.bottom + 6) }) }}
                        className="grid size-7 cursor-pointer place-items-center rounded-lg text-muted-foreground hover:bg-card hover:text-foreground hover:shadow-min"
                      >
                        <DotsThree size={17} aria-hidden />
                      </button>
                    </span>
                  </div>
                )
              })
            )}
          </div>
        </div>
        <div className="sticky bottom-0 z-[3] flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3 text-[13px] text-muted-foreground md:rounded-t-none md:rounded-b-2xl md:border-0 md:border-t md:border-divisor md:px-5">
          <span><b className="font-medium text-foreground">{plural(visibles.length, verBajas ? 'baja' : 'empleado', verBajas ? 'bajas' : 'empleados')}</b>{vencidosVisibles ? <> · <span className="font-medium text-danger">{vencidosVisibles} con vencidos</span></> : null}</span>
          <span className="ml-auto hidden items-center gap-3 md:flex">
            <span><kbd className="rounded-md border border-border px-1 font-mono text-[11px]">↑</kbd> <kbd className="rounded-md border border-border px-1 font-mono text-[11px]">↓</kbd> para moverte</span>
            <span><kbd className="rounded-md border border-border px-1 font-mono text-[11px]">Enter</kbd> abre el legajo</span>
          </span>
        </div>
      </section>

      {/* Menú ⋯ de una fila */}
      {filaMenu && menuFila && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setMenuFila(null)} />
          <div role="menu" data-menu-abierto className="fixed z-50 w-[240px] rounded-2xl border border-border bg-popover p-1.5 shadow-flotante" style={{ left: menuFila.x, top: menuFila.y }}>
            <button type="button" role="menuitem" onClick={() => abrir(filaMenu.id)} className="flex min-h-10 w-full cursor-pointer items-center gap-2 rounded-[10px] px-2 text-left text-sm font-medium hover:bg-muted"><ArrowUpRight size={17} className="text-muted-foreground" />Abrir legajo<kbd className="ml-auto font-mono text-[11px] text-muted-foreground">Enter</kbd></button>
            {puedeEditar && filaMenu.activo && <button type="button" role="menuitem" onClick={() => abrir(filaMenu.id, { cargar: '1' })} className="flex min-h-10 w-full cursor-pointer items-center gap-2 rounded-[10px] px-2 text-left text-sm font-medium hover:bg-muted"><Plus size={17} className="text-muted-foreground" />Agregar certificado</button>}
            <Link role="menuitem" href={`/legajo/${filaMenu.id}`} className="flex min-h-10 w-full items-center gap-2 rounded-[10px] px-2 text-sm font-medium hover:bg-muted"><ArrowSquareOut size={17} className="text-muted-foreground" />Legajo completo</Link>
            {!filaMenu.activo && puedeEditar && (
              <>
                <div role="separator" className="mx-1 my-1 h-px bg-divisor" />
                <button type="button" role="menuitem" onClick={() => reactivar(filaMenu)} className="flex min-h-10 w-full cursor-pointer items-center gap-2 rounded-[10px] px-2 text-left text-sm font-medium hover:bg-muted"><Check size={17} className="text-muted-foreground" />Reactivar</button>
              </>
            )}
          </div>
        </>
      )}

      {/* Celular: la acción principal en una píldora */}
      {puedeEditar && (
        <button type="button" onClick={() => setAlta(true)} className="fixed inset-x-4 bottom-[calc(92px+env(safe-area-inset-bottom))] z-[29] flex h-[54px] cursor-pointer items-center justify-center gap-2 rounded-full bg-primary text-base font-medium text-primary-foreground shadow-[0_12px_24px_-12px_rgb(79_70_229/.6)] transition-[transform,opacity] duration-300 md:hidden dark:bg-foreground dark:text-card dark:shadow-none in-data-capa:pointer-events-none in-data-capa:translate-y-5 in-data-capa:opacity-0">
          <UserPlus size={18} aria-hidden />Nuevo empleado
        </button>
      )}

      {/* Legajo en hoja lateral (?legajo=) */}
      <Hoja abierta={!!abierto} onCerrar={cerrarLegajo} etiqueta={{ id: `legajo-${abierto ?? ''}` }}>
        {legajoListo ? (
          <LegajoClient
            key={legajoListo.key}
            empleado={legajoListo.empleado}
            certificados={legajoListo.certificados}
            tiposCertificado={legajoListo.tiposCertificado}
            empresas={legajoListo.empresas}
            recibos={legajoListo.recibos}
            veRecibos={legajoListo.veRecibos}
            epp={legajoListo.epp}
            isAdmin={legajoListo.isAdmin}
            canEdit={legajoListo.canEdit}
            certInicial={legajoListo.certInicial}
            renovarInicial={legajoListo.renovar}
            abrirCarga={legajoListo.cargar}
            modo="hoja"
            onCerrar={cerrarLegajo}
            onNav={navegar}
          />
        ) : (
          <div className="flex flex-1 flex-col" aria-busy="true" aria-label="Cargando el legajo">
            <div className="flex items-center gap-3 border-b border-divisor px-5 pt-5 pb-3">
              <Skeleton className="size-12 rounded-full" />
              <div className="flex-1 space-y-2"><Skeleton className="h-3 w-40" /><Skeleton className="h-5 w-52" /></div>
              <button type="button" onClick={cerrarLegajo} aria-label="Cerrar" className="grid size-9 cursor-pointer place-items-center rounded-xl border border-border bg-card shadow-min"><X size={17} /></button>
            </div>
            <div className="space-y-4 p-5">
              <Skeleton className="h-[110px] w-full rounded-2xl" />
              <Skeleton className="h-8 w-72 rounded-xl" />
              {[0, 1, 2, 3].map((k) => <Skeleton key={k} className="h-14 w-full rounded-xl" />)}
            </div>
          </div>
        )}
      </Hoja>

      {/* Alta en hoja lateral (?nuevo=1); /admin/empleados/nuevo sigue existiendo */}
      {puedeEditar && (
        <Hoja abierta={alta} onCerrar={cerrarAlta} etiqueta={{ id: 'hoja-alta' }}>
          <HojaCabecera tituloId="hoja-alta" rotulo={empresaSel?.nombre ?? 'Gestión de Recursos'} titulo="Nuevo empleado" onCerrar={cerrarAlta} tile={<Cuadro color="var(--f-per)"><UserPlus size={18} /></Cuadro>} />
          <NuevoEmpleadoForm empresas={empresas} empresaInicial={empresaInicial} sectores={sectoresAlta} volverA="/empleados" onCancelar={cerrarAlta} />
        </Hoja>
      )}
    </div>
  )
}
