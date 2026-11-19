'use client'

/* Inicio (overhaul 18/11/2026, demo aprobada inicio.html). Junta el hub (/) y el dashboard.
 * Comportamiento de antes → dónde queda:
 * [x] Fecha larga (hora AR) → cabecera, sin el año
 * [x] "Hola, {nombre}" del hub → "Buenas tardes, {nombre}" según la hora AR
 * [x] KPI Empleados → bandeja Empleados activos, mismo link (+ reparto por empresa y bajas)
 * [x] KPI Vencidos → bandeja Vencidos + subtítulo en rojo, mismo link ?estado=vencido
 * [x] KPI Por vencer → protagonista, mismo link ?estado=proximo
 * [x] KPI Al día → bandeja Al día, mismo link ?estado=vigente (la barra apilada y la
 *     "Distribución documental" viven en su reparto)
 * [x] Bloque Atención (N vencidos, el más urgente, "Revisar vencimientos") → bandeja Vencidos
 * [x] Vencimientos prioritarios con ?tab=todos|vencidos|proximos → tarjeta Vencimientos, mismo ?tab=
 * [x] Cada caso: titular, tipo · empresa, "Venció hace N", fecha, link profundo → igual + Renovar
 * [x] "N casos visibles de M alertas" + "Ver todos" → "8 de M alertas · Ver todas" (zona gris aprobada: 8)
 * [x] Vacío "Sin alertas en esta vista" → ilustración "Todo al día"
 * [x] Tabla Empresas con vencidos/próximos a /vencimientos?empresa=&estado= → tarjeta Empresas
 * [x] Hub: RRHH · sede → /empresa/slug → nombre de la empresa en la tarjeta Empresas
 * [x] Hub: otros sistemas por marca (ARCOR solo con puedeVerArcor) → sección Otros sistemas
 * [x] Hub: "No tenés portales asignados" → mismo texto cuando no hay empresas
 * [x] Hub: salir y tema → tarjeta de la persona del menú
 */

import { useState } from 'react'
import Link from 'next/link'
import {
  ArrowSquareOut, ArrowUpRight, ArrowsClockwise, Broom, Bug, Bulldozer, CalendarBlank, Certificate, CheckCircle,
  ClockCountdown, FireExtinguisher, FolderSimple, Handshake, HourglassHigh, IdentificationBadge, ListChecks,
  MapTrifold, Package, Plus, ShippingContainer, Sparkle, SquaresFour, Truck, UsersFour, WarningCircle, WhatsappLogo,
  Wrench,
} from '@phosphor-icons/react'
import { cn } from '@/lib/utils'
import { AvatarPersona, Cuadro, IconoEmpresa, colorEmpresa, nombreCorto } from '@/components/ui/empresa'
import { Bloques, Chip, Contar, Linea, Reparto, Vacio, posicionPunto } from '@/components/ui/datos'
import { CargarCertificado } from './CargarCertificado'
import type { AlertaInicio, DatosInicio, PasoRecurso, RecursoInicio, SistemaInicio, TipoTitular } from './tipos'

const VISIBLES = 8
const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
function fCorta(f: string, anioHoy: string) {
  const [y, m, d] = f.slice(0, 10).split('-')
  return `${Number(d)} ${MESES[Number(m) - 1]}${y !== anioHoy ? ` ${y}` : ''}`
}
function relVenc(d: number) {
  if (d < 0) return `Venció hace ${plural(-d, 'día', 'días')}`
  if (d === 0) return 'Vence hoy'
  if (d === 1) return 'Vence mañana'
  return `Vence en ${d} días`
}
const NOM_TIPO: Record<TipoTitular, [string, string]> = {
  persona: ['de una persona', 'de personas'],
  vehiculo: ['vehículo', 'vehículos'],
  equipo: ['equipo', 'equipos'],
  empresa: ['habilitación', 'habilitaciones'],
}

/** Contenedor de cada KPI: bandeja con rótulo arriba, tarjeta adentro y pie con acción (skill §1b.9). */
function Bandeja({ icono, rotulo, children, pie }: { icono: React.ReactNode; rotulo: string; children: React.ReactNode; pie: React.ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col rounded-2xl border border-border bg-bandeja p-1">
      <div className="flex items-center gap-2 py-2 pr-3 pl-[17px] text-[13px] font-medium text-texto-2">
        {icono}
        {rotulo}
      </div>
      <div className="min-w-0 flex-1 rounded-interno border border-border bg-card p-4 shadow-min">{children}</div>
      {pie}
    </div>
  )
}
function Pie({ href, icono, texto, accion, tono }: { href: string; icono: React.ReactNode; texto: string; accion: string; tono?: 'rojo' }) {
  return (
    <Link href={href} className={cn('flex min-h-11 items-center gap-1 px-[17px] py-2 text-xs font-medium transition-colors md:min-h-9', tono === 'rojo' ? 'text-danger' : 'text-muted-foreground hover:text-foreground')}>
      {icono}
      {texto}
      <span className="ml-auto inline-flex items-center gap-1">{accion}<ArrowUpRight size={14} aria-hidden /></span>
    </Link>
  )
}
const Ley = ({ color, children }: { color: string; children: React.ReactNode }) => (
  <span className="inline-flex items-center gap-1.5 whitespace-nowrap"><i className="size-2 rounded-[3px]" style={{ background: color }} />{children}</span>
)

function TileTitular({ a }: { a: AlertaInicio }) {
  if (a.tipoTitular === 'persona') return <AvatarPersona nombre={a.titular} slug={a.empresaSlug} />
  if (a.tipoTitular === 'empresa' && a.empresaSlug) return <IconoEmpresa slug={a.empresaSlug} nombre={a.empresaNombre ?? ''} tamano={36} />
  return (
    <Cuadro color={a.tipoTitular === 'vehiculo' ? 'var(--f-log)' : 'var(--f-ope)'}>
      {a.tipoTitular === 'vehiculo' ? <Truck size={18} /> : a.tipoTitular === 'empresa' ? <Certificate size={18} /> : <FireExtinguisher size={18} />}
    </Cuadro>
  )
}

const ICONO_PASO: Record<PasoRecurso['icono'], React.ComponentType<{ size?: number; className?: string }>> = {
  alerta: WarningCircle, reloj: HourglassHigh, llave: Wrench, calendario: CalendarBlank, whatsapp: WhatsappLogo, chispa: Sparkle,
}
const ICONO_RECURSO = { truck: Truck, bulldozer: Bulldozer, package: Package, container: ShippingContainer }
const COLOR_SEG = { verde: 'var(--verde-g)', amarillo: 'var(--ambar-g)', rojo: 'var(--rojo-g)' }

function TarjetaRecurso({ r }: { r: RecursoInicio }) {
  const Ico = ICONO_RECURSO[r.icono]
  return (
    <article className="group relative flex min-w-0 flex-col rounded-2xl border border-border bg-card transition-[transform,box-shadow,border-color] duration-200 hover:-translate-y-0.5 hover:border-border-strong hover:shadow-hover">
      <div className="px-5 pt-5 pb-4">
        <div className="flex min-h-6 items-center gap-1.5">
          {r.chip && <Chip tono={r.chip.tono}>{r.chip.texto}</Chip>}
          <span className="ml-auto flex gap-1">
            {r.tags.map((t) => <span key={t} className="inline-flex h-6 items-center rounded-lg border border-border px-2 text-xs font-medium whitespace-nowrap text-texto-2">{t}</span>)}
          </span>
        </div>
        <h3 className="mt-4 flex items-center gap-2 text-base leading-tight font-medium tracking-[-0.01em]">
          <Cuadro color={r.color} tamano={24} entidad><Ico size={13} weight="fill" /></Cuadro>
          <Link href={r.href} className="min-w-0 flex-1 truncate after:absolute after:inset-0 after:rounded-2xl max-md:-my-[13px] max-md:py-[13px]">{r.titulo}</Link>
          <ArrowUpRight size={16} className="text-muted-foreground transition-[transform,color] duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-foreground" aria-hidden />
        </h3>
        <div className="mt-4 flex items-center gap-3">
          <Bloques className="flex-1" colores={r.segs.map((s) => (s ? COLOR_SEG[s] : null))} />
          <b className="text-[13px] font-medium whitespace-nowrap">{r.resumen}</b>
        </div>
        <div className="mt-2 truncate text-xs text-muted-foreground">{r.meta}</div>
      </div>
      {r.serie && (
        <div className="border-y border-divisor bg-bandeja px-5 pt-3 pb-2">
          <Linea valores={r.serie.valores} color={r.color} punto={r.serie.valores.length - 1} />
          <div className="mt-1 flex justify-between text-xs text-muted-foreground"><span>{r.serie.rotulo}</span><span>{r.serie.ultimo}</span></div>
        </div>
      )}
      <div className={cn('relative z-[1] px-5 py-3', !r.serie && 'border-t border-divisor')}>
        <div className="mb-1 flex justify-between text-xs font-medium text-muted-foreground"><span>{r.pasosTitulo}</span><span>{r.pasosCuenta}</span></div>
        {r.pasos.length === 0 && <p className="flex h-9 items-center gap-2 text-[13px] text-texto-2"><CheckCircle size={15} className="text-muted-foreground" aria-hidden />Nada para resolver</p>}
        {r.pasos.map((p, i) => {
          const PI = ICONO_PASO[p.icono]
          return (
            <Link key={i} href={p.href} className="flex h-11 items-center gap-2 border-b border-divisor text-[13px] last:border-b-0 md:h-9">
              <PI size={15} className="shrink-0 text-muted-foreground" />
              <span className="min-w-0 flex-1 truncate">{p.texto}</span>
              <span className={cn('text-xs whitespace-nowrap text-muted-foreground', p.tono === 'v' && 'font-medium text-danger', p.tono === 'am' && 'font-medium text-warning', p.tono === 'ok' && 'font-medium text-success')}>{p.detalle}</span>
            </Link>
          )
        })}
      </div>
    </article>
  )
}

const ICONO_SISTEMA: Record<SistemaInicio['links'][number]['icono'], React.ComponentType<{ size?: number; className?: string }>> = {
  contenedor: ShippingContainer, escoba: Broom, bicho: Bug, checklist: ListChecks, cuadros: SquaresFour, mapa: MapTrifold, apreton: Handshake,
}

export default function InicioVista({ d }: { d: DatosInicio }) {
  const [tab, setTab] = useState(d.tab)
  const [cargar, setCargar] = useState(false)
  const anioHoy = new Date().getFullYear().toString()

  function cambiarTab(t: DatosInicio['tab']) {
    setTab(t)
    try {
      const url = new URL(window.location.href)
      if (t === 'todos') url.searchParams.delete('tab')
      else url.searchParams.set('tab', t)
      window.history.replaceState(null, '', url)
    } catch { /* la URL es cosmética */ }
  }

  const lista = tab === 'todos' ? d.alertas.todos : tab === 'vencidos' ? d.alertas.vencidos : d.alertas.proximos
  const visibles = lista.slice(0, VISIBLES)
  const hrefVerTodas = tab === 'todos' ? d.hrefs.vencimientos : tab === 'vencidos' ? d.hrefs.vencidos : d.hrefs.proximos
  const conFecha = Math.max(1, d.alDia.conFecha)
  const pctAlDia = Math.round((d.alDia.total / conFecha) * 1000) / 10
  const glob = d.proximos.curva.length > 1 ? posicionPunto(d.proximos.curva, 1, 84, 0) : null
  const topEmpresas = [...d.empleados.porEmpresa].sort((a, b) => b.n - a.n).slice(0, 3)
  const sinEmpresas = d.empresas.length === 0

  return (
    <div className="flex flex-col gap-9 px-4 pt-2 pb-20 text-sm md:gap-10 md:px-7 md:pt-6 md:pb-10">
      {/* ── Cabecera ── */}
      <div className="flex flex-col items-start gap-4 md:flex-row md:items-end">
        <div className="min-w-0">
          <span className="text-[13px] font-medium text-muted-foreground">{d.fecha}</span>
          <h1 className="mt-1 text-[32px] leading-[1.15] font-medium tracking-[-0.035em] md:text-[40px]">
            {d.saludo}, <b className="font-semibold">{d.nombre}</b>
          </h1>
          {!sinEmpresas && (
            <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-texto-2">
              {d.vencidos.total > 0 && (
                <>
                  <Link href={d.hrefs.vencidos} className="inline-flex items-center gap-1 rounded-md text-danger hover:underline hover:underline-offset-[3px] max-md:min-h-11"><b className="font-medium">{d.vencidos.total}</b> {d.vencidos.total === 1 ? 'vencido' : 'vencidos'}</Link>
                  <span className="text-muted-foreground">·</span>
                </>
              )}
              <Link href={d.hrefs.proximos} className="inline-flex items-center gap-1 rounded-md hover:underline hover:underline-offset-[3px] max-md:min-h-11"><b className="font-medium text-foreground">{d.proximos.total}</b> por vencer</Link>
              <span className="text-muted-foreground">·</span>
              <Link href={d.hrefs.empleados} className="inline-flex items-center gap-1 rounded-md hover:underline hover:underline-offset-[3px] max-md:min-h-11"><b className="font-medium text-foreground">{d.empleados.total}</b> empleados</Link>
            </p>
          )}
        </div>
        {d.puedeCargar && !sinEmpresas && (
          <div className="ml-auto hidden md:flex">
            <button type="button" data-principal onClick={() => setCargar(true)} className="inline-flex h-[38px] cursor-pointer items-center gap-2 rounded-xl bg-primary pr-4 pl-3 text-sm font-medium whitespace-nowrap text-primary-foreground shadow-principal transition-[background-color,transform] hover:bg-primary-hover active:scale-[0.97] dark:bg-foreground dark:text-card">
              <Plus size={17} aria-hidden />Cargar certificado
            </button>
          </div>
        )}
      </div>

      {sinEmpresas ? (
        <div className="rounded-2xl border border-border bg-card">
          <Vacio titulo="No tenés portales asignados">Contactá al administrador.</Vacio>
        </div>
      ) : (
        <>
          {/* ── KPIs: un protagonista y tres bandejas ── */}
          <section aria-labelledby="tResumen">
            <h2 id="tResumen" className="sr-only">Resumen de la documentación</h2>
            <div className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pt-0.5 pb-3 [scrollbar-width:none] md:mx-0 md:grid md:grid-cols-2 md:gap-[14px] md:overflow-visible md:p-0 xl:grid-cols-[1.25fr_repeat(3,minmax(0,1fr))] [&>*]:min-w-0 max-md:[&>*]:shrink-0 max-md:[&>*]:basis-[84%] max-md:[&>*]:snap-center">
              <Link
                href={d.hrefs.proximos}
                className="relative flex min-h-[228px] flex-col overflow-hidden rounded-2xl p-6 text-left text-white shadow-heroe"
                style={{ background: 'radial-gradient(120% 140% at 100% 0%, #6d63ff 0%, transparent 55%), linear-gradient(150deg, #3730a3, #4f46e5 60%, #4338ca)' }}
              >
                <span aria-hidden className="pointer-events-none absolute inset-0 [background-image:radial-gradient(rgb(255_255_255/.10)_1px,transparent_1.2px)] [background-size:14px_14px] [mask:linear-gradient(200deg,#000,transparent_60%)]" />
                <div className="relative z-[1] flex items-center justify-between">
                  <span className="grid size-10 place-items-center rounded-xl border border-white/25 bg-white/15 backdrop-blur-[6px]"><ClockCountdown size={20} aria-hidden /></span>
                  <span className="flex h-6 items-center gap-1 rounded-full border border-white/25 bg-white/15 px-2 text-xs font-medium backdrop-blur-[6px]"><CalendarBlank size={13} aria-hidden />{d.proximos.semana} esta semana</span>
                </div>
                <span className="relative mt-4 block text-[13px] font-medium text-white/90">Por vencer en 30 días</span>
                <div className="relative mt-1 text-[40px] leading-[1.05] font-semibold tracking-[-0.035em]"><Contar valor={d.proximos.total} /></div>
                <div className="relative mt-1 text-xs text-white/90">
                  {d.proximos.porTipo.length ? d.proximos.porTipo.map((t) => `${t.n} ${NOM_TIPO[t.tipo][t.n === 1 ? 0 : 1]}`).join(' · ') : 'Nada vence en los próximos 30 días'}
                </div>
                {d.proximos.curva.length > 1 && (
                  <div className="absolute inset-x-0 bottom-0">
                    <Linea valores={d.proximos.curva} color="#fff" rellenoBlanco alto={84} pad={0} punto={1} />
                    {glob && (
                      <span className="absolute z-[2] -translate-x-1/2 -translate-y-[calc(100%+12px)] rounded-lg bg-white px-2 py-0.5 text-xs font-medium whitespace-nowrap text-[#312e81] shadow-[0_6px_14px_-6px_rgb(23_22_31/.4)]" style={{ left: `clamp(90px, ${glob.left}%, calc(100% - 90px))`, top: glob.top }}>
                        Semana que viene · {d.proximos.curva[1]}
                      </span>
                    )}
                  </div>
                )}
              </Link>

              <Bandeja
                icono={<WarningCircle size={16} className="text-muted-foreground" aria-hidden />}
                rotulo="Vencidos"
                pie={d.vencidos.total
                  ? <Pie href={d.hrefs.vencidos} tono="rojo" icono={<WarningCircle size={14} aria-hidden />} texto="Requiere atención" accion="Revisar" />
                  : <Pie href={d.hrefs.vencimientos} icono={<CheckCircle size={14} aria-hidden />} texto="Nada vencido" accion="Ver" />}
              >
                <div className="text-[32px] leading-[1.05] font-semibold tracking-[-0.035em]"><Contar valor={d.vencidos.total} /></div>
                <div className="mt-1 text-xs text-muted-foreground">{d.vencidos.total ? `El más antiguo, hace ${plural(d.vencidos.masAntiguo, 'día', 'días')}` : 'Nada vencido'}</div>
                <Reparto partes={[{ n: d.vencidos.hasta7, color: 'var(--ambar-g)', t: 'Hasta 7 días' }, { n: d.vencidos.mas7, color: 'var(--rojo-g)', t: 'Más de 7 días' }]} />
                <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  <Ley color="var(--ambar-g)">Hasta 7 días <b className="font-medium text-foreground">{d.vencidos.hasta7}</b></Ley>
                  <Ley color="var(--rojo-g)">Más de 7 <b className="font-medium text-foreground">{d.vencidos.mas7}</b></Ley>
                </div>
              </Bandeja>

              <Bandeja
                icono={<CheckCircle size={16} className="text-muted-foreground" aria-hidden />}
                rotulo="Al día"
                pie={<Pie href={d.hrefs.vigentes} icono={<Certificate size={14} aria-hidden />} texto="Por estado" accion="Ver vigentes" />}
              >
                <div className="text-[32px] leading-[1.05] font-semibold tracking-[-0.035em]">
                  <Contar valor={d.alDia.total} /><small className="ml-1 text-xl font-normal tracking-[-0.01em] text-muted-foreground">de {d.alDia.conFecha.toLocaleString('es-AR')}</small>
                </div>
                <div className="mt-1 text-xs text-muted-foreground">{pctAlDia.toLocaleString('es-AR')} % de la documentación con fecha</div>
                <Reparto partes={[{ n: d.alDia.total, color: 'var(--verde-g)', t: 'Al día' }, { n: d.proximos.total, color: 'var(--ambar-g)', t: 'Por vencer' }, { n: d.vencidos.total, color: 'var(--rojo-g)', t: 'Vencidos' }]} />
                <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  <Ley color="var(--verde-g)">Al día</Ley>
                  <Ley color="var(--ambar-g)">Por vencer <b className="font-medium text-foreground">{d.proximos.total}</b></Ley>
                  <Ley color="var(--rojo-g)">Vencidos <b className="font-medium text-foreground">{d.vencidos.total}</b></Ley>
                </div>
              </Bandeja>

              <Bandeja
                icono={<IdentificationBadge size={16} className="text-muted-foreground" aria-hidden />}
                rotulo="Empleados activos"
                pie={<Pie href={d.hrefs.empleados} icono={<UsersFour size={14} aria-hidden />} texto="Por empresa" accion="Ver empleados" />}
              >
                <div className="text-[32px] leading-[1.05] font-semibold tracking-[-0.035em]"><Contar valor={d.empleados.total} /></div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {plural(d.empleados.porEmpresa.length, 'empresa', 'empresas')}{d.empleados.bajas ? ` · ${plural(d.empleados.bajas, 'dado de baja', 'dados de baja')}` : ''}
                </div>
                <Reparto partes={d.empleados.porEmpresa.map((e) => ({ n: e.n, color: colorEmpresa(e.slug), t: e.nombre }))} />
                <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  {topEmpresas.map((e) => <Ley key={e.slug} color={colorEmpresa(e.slug)}>{nombreCorto(e.nombre).replace(' S.R.L.', '')} <b className="font-medium text-foreground">{e.n}</b></Ley>)}
                  {d.empleados.porEmpresa.length > 3 && <span>+{d.empleados.porEmpresa.length - 3}</span>}
                </div>
              </Bandeja>
            </div>
          </section>

          {/* ── Cuerpo: vencimientos a la izquierda, empresas a la derecha ── */}
          <div className="grid items-start gap-[14px] xl:grid-cols-[minmax(0,1fr)_360px]">
            <section className="min-w-0 rounded-2xl border border-border bg-card" aria-labelledby="tVenc">
              <div className="flex flex-wrap items-center gap-3 px-4 pt-4 pb-3 md:flex-nowrap md:px-5 md:pt-5">
                <h3 id="tVenc" className="text-xl leading-tight font-medium tracking-[-0.025em]">Vencimientos</h3>
                <div className="w-full md:ml-auto md:w-auto">
                  <div role="group" aria-label="Qué vencimientos ver" className="flex max-w-full gap-0.5 overflow-x-auto rounded-xl bg-muted p-[3px] [scrollbar-width:none] md:inline-flex">
                    {([['todos', 'Todos', d.alertas.todos.length, null], ['vencidos', 'Vencidos', d.alertas.vencidos.length, 'var(--danger)'], ['proximos', 'Por vencer', d.alertas.proximos.length, 'var(--warning)']] as const).map(([k, t, n, c]) => (
                      <button key={k} type="button" aria-pressed={tab === k} onClick={() => cambiarTab(k)} className={cn('inline-flex h-11 flex-1 shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-[9px] px-3 text-[13px] font-medium whitespace-nowrap transition-colors md:h-7 md:flex-none', tab === k ? 'bg-card text-foreground shadow-[0_1px_2px_rgb(23_22_31/.1),0_0_0_1px_var(--border)] dark:bg-foreground dark:text-card dark:shadow-none' : 'text-texto-2 hover:text-foreground')}>
                        {c && <span aria-hidden className="size-1.5 rounded-full" style={{ background: c }} />}
                        {t} <span className={cn('font-medium', tab === k ? 'text-muted-foreground dark:text-card/70' : 'text-muted-foreground')}>{n}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              {visibles.length === 0 ? (
                <Vacio ilustracion="exito" titulo={tab === 'proximos' ? 'Nada vence en 30 días' : 'Todo al día'}>
                  {tab === 'vencidos' ? 'No hay certificados vencidos en las empresas que mirás.' : 'La documentación de las empresas que mirás está vigente.'}
                </Vacio>
              ) : (
                <ul>
                  {visibles.map((a, i) => (
                    <li key={a.id} style={{ '--i': i } as React.CSSProperties} className="entra relative grid min-h-16 grid-cols-[36px_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 border-t border-divisor px-4 py-3 transition-colors [grid-template-areas:'ic_q_acc''ic_est_acc'] hover:bg-hover md:grid-cols-[36px_minmax(0,1fr)_auto_76px_96px] md:px-5 md:py-2 md:[grid-template-areas:'ic_q_est_f_acc']">
                      <span className="self-start [grid-area:ic] md:self-center"><TileTitular a={a} /></span>
                      <div className="min-w-0 [grid-area:q]">
                        <Link href={a.href} className="block truncate font-medium after:absolute after:inset-0 max-md:-my-[13px] max-md:py-[13px]">{a.titular}</Link>
                        <small className="mt-0.5 block truncate text-xs text-muted-foreground">{[a.tipo, a.empresaNombre].filter(Boolean).join(' · ')}</small>
                      </div>
                      <span className="[grid-area:est]"><Chip tono={a.estado === 'vencido' ? 'ro' : 'am'}>{relVenc(a.dias)}</Chip></span>
                      <span className="hidden text-right text-xs whitespace-nowrap text-muted-foreground [grid-area:f] md:block">{fCorta(a.fecha, anioHoy)}</span>
                      <span className="relative z-[1] flex justify-end [grid-area:acc]">
                        {a.hrefRenovar && (
                          <Link href={a.hrefRenovar} aria-label={`Renovar ${a.tipo} de ${a.titular}`} className="inline-flex h-11 items-center gap-1 rounded-lg border border-border bg-card pr-3 pl-2 text-[13px] font-medium shadow-min transition-colors hover:bg-hover md:h-7">
                            <ArrowsClockwise size={14} className="text-texto-2" aria-hidden />Renovar
                          </Link>
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              {lista.length > 0 && (
                <div className="flex min-h-[52px] items-center gap-2 border-t border-divisor px-4 py-3 text-[13px] text-muted-foreground md:px-5">
                  <span><b className="font-medium text-foreground">{visibles.length}</b> de {plural(lista.length, 'alerta', 'alertas')}</span>
                  <Link href={hrefVerTodas} className="ml-auto inline-flex h-11 items-center gap-1 rounded-lg border border-border bg-card px-3 text-[13px] font-medium text-foreground shadow-min transition-colors hover:bg-hover md:h-7">
                    Ver {lista.length > visibles.length ? 'todas' : 'en Vencimientos'}<ArrowUpRight size={14} className="text-texto-2" aria-hidden />
                  </Link>
                </div>
              )}
            </section>

            <section className="min-w-0 rounded-2xl border border-border bg-card" aria-labelledby="tEmp">
              <div className="flex items-center gap-3 px-4 pt-4 pb-3 md:px-5 md:pt-5">
                <h3 id="tEmp" className="text-xl leading-tight font-medium tracking-[-0.025em]">Empresas <span className="font-normal text-muted-foreground">{d.empresas.length}</span></h3>
                <span className="ml-auto inline-flex h-6 items-center gap-1 rounded-lg border border-border px-2 text-xs font-medium whitespace-nowrap text-texto-2"><FolderSimple size={14} aria-hidden />Mensual de {d.mes}</span>
              </div>
              <div aria-hidden className="grid grid-cols-[28px_minmax(0,1fr)_60px_64px] gap-x-2 px-4 pb-2 text-xs font-medium whitespace-nowrap text-muted-foreground md:px-5">
                <span /><span>Empleados y mensual</span><span className="text-right">Vencidos</span><span className="text-right">Por vencer</span>
              </div>
              {d.empresas.map((e) => (
                <div key={e.id} className="relative grid min-h-[60px] grid-cols-[28px_minmax(0,1fr)_60px_64px] items-center gap-x-2 border-t border-divisor px-4 py-1.5 hover:bg-hover md:px-5">
                  <IconoEmpresa slug={e.slug} nombre={e.nombre} tamano={28} />
                  <div className="min-w-0">
                    <Link href={`/empresa/${e.slug}`} className="block truncate font-medium after:absolute after:inset-0 max-md:-my-[13px] max-md:py-[13px]">{e.nombre}</Link>
                    <small className="mt-0.5 flex items-center gap-2 text-xs whitespace-nowrap text-muted-foreground">
                      <span>{plural(e.empleados, 'empleado', 'empleados')}</span>
                      {e.mensual && e.mensual.de > 0 && (
                        <Bloques className="w-11 shrink-0" alto={4} colores={Array.from({ length: e.mensual.de }, (_, i) => (i < e.mensual!.con ? colorEmpresa(e.slug) : null))} etiqueta={`Documentación de ${d.mes}: ${e.mensual.con} de ${e.mensual.de} carpetas con archivos`} />
                      )}
                    </small>
                  </div>
                  {/* Cada número abre los vencimientos de ESA empresa en ese estado. */}
                  <Link href={`/vencimientos?empresa=${e.slug}&estado=vencido`} aria-label={`${plural(e.vencidos, 'vencido', 'vencidos')} de ${e.nombre}`} className={cn('relative z-[1] grid h-11 min-w-11 place-items-center justify-self-end rounded-lg text-sm font-medium hover:bg-muted md:h-8 md:min-w-8', e.vencidos ? 'text-danger' : 'text-muted-foreground')}>{e.vencidos}</Link>
                  <Link href={`/vencimientos?empresa=${e.slug}&estado=proximo`} aria-label={`${e.proximos} por vencer de ${e.nombre}`} className={cn('relative z-[1] grid h-11 min-w-11 place-items-center justify-self-end rounded-lg text-sm font-medium hover:bg-muted md:h-8 md:min-w-8', e.proximos ? 'text-warning' : 'text-muted-foreground')}>{e.proximos}</Link>
                </div>
              ))}
            </section>
          </div>

          {/* ── Recursos ── */}
          {(d.recursos.length > 0 || d.fallas.length > 0) && (
            <section aria-labelledby="tRec">
              <div className="mb-3 flex min-h-7 flex-wrap items-center gap-2">
                <h2 id="tRec" className="text-xl leading-tight font-medium tracking-[-0.025em]">Recursos</h2>
                <span className="text-xl text-muted-foreground">{d.recursos.length}</span>
                {d.fallas.length > 0 && <span className="ml-auto inline-flex items-center gap-1 text-[13px] text-danger"><WarningCircle size={14} aria-hidden />No se pudo leer: {d.fallas.join(', ')}</span>}
              </div>
              <div className="grid gap-3 md:grid-cols-2 md:gap-[14px] xl:[grid-template-columns:repeat(var(--n),minmax(0,1fr))]" style={{ '--n': Math.max(d.recursos.length, 2) } as React.CSSProperties}>
                {d.recursos.map((r) => <TarjetaRecurso key={r.key} r={r} />)}
              </div>
            </section>
          )}

          {/* ── Otros sistemas ── */}
          {d.sistemas.length > 0 && (
            <section aria-labelledby="tSis">
              <div className="mb-3 flex min-h-7 items-center gap-2">
                <h2 id="tSis" className="text-xl leading-tight font-medium tracking-[-0.025em]">Otros sistemas</h2>
                <span className="text-xl text-muted-foreground">{d.sistemas.length}</span>
              </div>
              <div className="grid gap-[14px] md:[grid-template-columns:repeat(var(--n),minmax(0,1fr))]" style={{ '--n': Math.max(d.sistemas.length, 2) } as React.CSSProperties}>
                {d.sistemas.map((m) => (
                  <div key={m.key} className="min-w-0 rounded-2xl border border-border bg-card pb-2">
                    <div className="flex items-center gap-3 px-4 pt-4 pb-2 md:px-5 md:pt-5">
                      <span className="grid size-10 place-items-center overflow-hidden rounded-xl border border-border bg-white">
                        {/* eslint-disable-next-line @next/next/no-img-element -- ícono chico */}
                        <img src={m.icono} alt="" width={32} height={32} className="size-[82%] object-contain" />
                      </span>
                      <h3 className="text-base font-medium tracking-[-0.025em]">{m.nombre}</h3>
                    </div>
                    {m.links.map((l) => {
                      const I = ICONO_SISTEMA[l.icono]
                      const cuerpo = (
                        <>
                          <I size={17} className="text-muted-foreground" />
                          <span className="min-w-0 flex-1 truncate">{l.label}</span>
                          {l.externo ? <ArrowSquareOut size={14} className="text-muted-foreground" aria-hidden /> : <ArrowUpRight size={14} className="text-muted-foreground" aria-hidden />}
                        </>
                      )
                      const cls = 'flex min-h-12 items-center gap-3 border-t border-divisor px-4 text-[13px] font-medium hover:bg-hover md:min-h-11 md:px-5'
                      return l.externo
                        ? <a key={l.label} href={l.href} target="_blank" rel="noopener noreferrer" className={cls}>{cuerpo}</a>
                        : <Link key={l.label} href={l.href} className={cls}>{cuerpo}</Link>
                    })}
                  </div>
                ))}
              </div>
            </section>
          )}
        </>
      )}

      {/* Celular: la acción principal en una píldora arriba de la barra inferior */}
      {d.puedeCargar && !sinEmpresas && (
        <button type="button" onClick={() => setCargar(true)} className="fixed inset-x-4 bottom-[calc(92px+env(safe-area-inset-bottom))] z-[29] flex h-[54px] cursor-pointer items-center justify-center gap-2 rounded-full bg-primary text-base font-medium text-primary-foreground shadow-[0_12px_24px_-12px_rgb(79_70_229/.6)] transition-[transform,opacity] duration-300 md:hidden dark:bg-foreground dark:text-card dark:shadow-none in-data-capa:pointer-events-none in-data-capa:translate-y-5 in-data-capa:opacity-0">
          <Plus size={18} aria-hidden />Cargar certificado
        </button>
      )}
      {d.puedeCargar && <CargarCertificado abierta={cargar} onCerrar={() => setCargar(false)} empresas={d.empresas} />}
    </div>
  )
}
