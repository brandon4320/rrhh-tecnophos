import Link from 'next/link'
import { ArrowRight, CircleCheck } from 'lucide-react'
import { EstadoPill } from '@/components/ui/estado-pill'
import { TileEstado } from '@/components/arcor/TileEstado'
import { BarraConsumo } from '@/components/arcor/BarraConsumo'
import { AlertaCard } from '@/components/arcor/AlertaCard'
import { ListaEventos } from '@/components/arcor/ListaEventos'
import { ProvinciasBarras } from '@/components/arcor/ProvinciasBarras'
import { AccionesArcor } from '@/components/arcor/AccionesArcor'
import { AutoRefresh } from '@/components/arcor/AutoRefresh'
import { ENLACES_ARCOR } from '@/modules/arcor/enlaces'
import { getAlertasAbiertas, getColasAbiertas, getEstados, getEventos, getResumenConAnterior } from '@/modules/arcor/queries'
import {
  alertaSilencio, diasDelMes, evaluarSilencio, labelOrigen, mesActual, nivelCredito, severidadAEstado,
  type ColaAbierta,
} from '@/modules/arcor/reglas'
import type { EstadoClaude, EstadoHeartbeat, EstadoPublicaciones, EstadoWhatsapp } from '@/modules/arcor/tipos'
import { diaClaveAR, fmtFechaAR, fmtFechaHoraAR, fmtFechaLargaAR, tiempoRelativo } from '@/lib/fechas-ar'

export const dynamic = 'force-dynamic'

/** "19 de meses anteriores · el más viejo del 05/09" (null si no hay arrastre). */
function arrastre(c: ColaAbierta): string | null {
  if (c.anteriores === 0) return null
  return `${c.anteriores} de meses anteriores${c.masViejo ? ` · el más viejo del ${fmtFechaAR(c.masViejo)}` : ''}`
}

export default async function ArcorResumenPage() {
  const ahora = new Date()
  const mes = mesActual(ahora)
  const dia = Number(diaClaveAR(ahora).slice(8, 10))
  const [estados, abiertas, comparacion, recientes, colas] = await Promise.all([
    getEstados(),
    getAlertasAbiertas(),
    getResumenConAnterior(mes, dia),
    getEventos({ limit: 10, sinRuido: true }),
    getColasAbiertas(mes),
  ])
  const resumen = comparacion.actual
  const previo = comparacion.previo
  // Pendiente ARCOR y Revisar foto cuentan TODOS los meses: son colas de trabajo, no
  // estadística del mes (un pendiente del 30/09 sigue esperando el 1/10). El tile de
  // Revisar foto y el botón "Revisar dudosas" muestran el mismo número.
  const pendientes = colas.pendiente_arcor
  const dudosas = colas.revisar_foto

  const wa = estados.whatsapp?.valor as EstadoWhatsapp | undefined
  const claude = estados.claude?.valor as EstadoClaude | undefined
  const hb = estados.heartbeat?.valor as EstadoHeartbeat | undefined
  const pub = estados.publicaciones?.valor as EstadoPublicaciones | undefined

  const silencio = evaluarSilencio(hb?.ts ?? null, ahora)
  const nivel = nivelCredito(claude?.porcentaje_usado, claude?.sin_credito)
  const alertaWa = abiertas.find((a) => a.clave_alerta === 'whatsapp')

  // Alerta sintética: el sistema dejó de reportar (no vive en la DB, se evalúa al leer).
  const sintetica = alertaSilencio(silencio, { ts: hb?.ts, updated_at: estados.heartbeat?.updated_at }, ahora)
  const todasAbiertas = sintetica ? [sintetica, ...abiertas] : abiertas

  const mesHref = `/arcor/contenedores?mes=${encodeURIComponent(mes)}`
  const pendientesHref = '/arcor/contenedores?mes=todos&estado=pendiente_arcor'
  // Comparación justa: el mes en curso contra el anterior HASTA EL MISMO DÍA (el 2/10,
  // 3 contra los 158 de septiembre entero era "-155" sin sentido).
  const nombrePrevio = previo.mes.split(' ')[0].toLowerCase()
  const mesPrevioCompleto = dia >= diasDelMes(previo.mes)
  const diff = resumen.total - previo.hastaDia
  const vencidasPub = pub?.vencidas?.length ?? 0
  const revisarPub = pub?.revisar?.length ?? 0

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6 lg:p-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Tecnophos - ARCOR</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Certificados de fumigación de contenedores · <span className="capitalize">{fmtFechaLargaAR(ahora.toISOString())}</span>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <AutoRefresh generado={ahora.toISOString()} />
          {/* Las dudosas de TODOS los meses: la galería no distingue mes */}
          <AccionesArcor revisar={dudosas.total} />
        </div>
      </div>

      {/* ── Estado del sistema ── */}
      <section className="rounded-2xl border border-border bg-card p-5 sm:p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">Estado del sistema</h2>
            <p className="text-sm text-muted-foreground">Lo que reporta el servidor de ARCOR (WhatsApp, lector, publicaciones)</p>
          </div>
          <Link href="/arcor/alertas" className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
            Ver alertas <ArrowRight className="size-3.5" strokeWidth={1.75} />
          </Link>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-y-6 sm:grid-cols-4 sm:gap-y-0 sm:divide-x sm:divide-border">
          <TileEstado
            className="sm:pr-6"
            label="WhatsApp"
            estado={!wa ? 'sin_fecha' : wa.ok ? 'vigente' : 'vencido'}
            pill={!wa ? 'Sin datos' : wa.ok ? 'Conectado' : 'Desvinculado'}
            valor={!wa ? '—' : wa.ok ? 'OK' : 'Caído'}
            sub={
              !wa ? 'Todavía no reportó'
              : wa.ok ? `Verificado ${tiempoRelativo(estados.whatsapp.updated_at, ahora)}`
              : alertaWa ? `Desde ${fmtFechaHoraAR(alertaWa.ts)}` : `Estado: ${wa.estado}`
            }
          />
          <TileEstado
            className="sm:px-6"
            label="Crédito Claude"
            estado={!claude ? 'sin_fecha' : severidadAEstado(nivel)}
            pill={!claude ? 'Sin datos' : claude.sin_credito ? 'Sin crédito' : nivel === 'critical' ? 'Agotándose' : nivel === 'warning' ? 'Bajo' : 'OK'}
            valor={claude ? `US$ ${Number(claude.restante_usd).toFixed(2)}` : '—'}
            sub={
              !claude
                ? 'Todavía no reportó'
                : claude.sin_credito
                  ? `La API rechazó la última llamada por falta de crédito${claude.sin_credito_desde ? ` · desde ${fmtFechaHoraAR(claude.sin_credito_desde)}` : ''}`
                  : `${Number(claude.gastado_usd).toFixed(2)} de ${Number(claude.presupuesto_usd).toFixed(0)} usados${claude.certificados_restantes_estimados != null ? ` · ~${claude.certificados_restantes_estimados} certificados` : ''}`
            }
            extra={claude ? <BarraConsumo pct={claude.porcentaje_usado ?? 0} nivel={nivel} /> : undefined}
          />
          <TileEstado
            className="sm:px-6"
            label="Último reporte"
            estado={!hb ? 'sin_fecha' : silencio.silencio ? 'vencido' : 'vigente'}
            pill={!hb ? 'Sin datos' : silencio.silencio ? 'Sin señal' : 'Reportando'}
            valor={hb ? tiempoRelativo(hb.ts, ahora) : '—'}
            sub={hb ? `${fmtFechaHoraAR(hb.ts)} · vía ${labelOrigen(hb.origen)}${hb.errores ? ` · ${hb.errores} con error` : ''}` : 'Todavía no reportó'}
          />
          <TileEstado
            className="sm:pl-6"
            label="Publicaciones Colabora"
            estado={!pub ? 'sin_fecha' : vencidasPub ? 'proximo' : 'vigente'}
            pill={!pub ? 'Sin datos' : vencidasPub ? `${vencidasPub} vencidas` : 'Al día'}
            valor={pub ? pub.pendientes : '—'}
            sub={pub ? `en cola · ${revisarPub} para revisar` : 'Todavía no reportó'}
            extra={
              vencidasPub || revisarPub ? (
                <Link href="/arcor/alertas#publicaciones" className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
                  {vencidasPub ? `Ver ${vencidasPub === 1 ? 'la vencida' : `las ${vencidasPub} vencidas`}` : 'Ver cuáles'}
                  <ArrowRight className="size-3" strokeWidth={1.75} />
                </Link>
              ) : undefined
            }
          />
        </div>
      </section>

      {/* ── Contenedores del mes + Alertas abiertas ── */}
      <section className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <div className="rounded-2xl border border-border bg-card p-5 sm:p-6">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <div>
              <h2 className="text-lg font-semibold tracking-tight">Contenedores · <span className="capitalize">{mes.toLowerCase()}</span></h2>
              <p className="text-sm text-muted-foreground">
                Certificados con fecha en el mes (misma regla que la pestaña del Sheets). Pendientes y dudosas: de todos los meses.
              </p>
            </div>
            <Link href={mesHref} className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
              Ver tabla <ArrowRight className="size-3.5" strokeWidth={1.75} />
            </Link>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-y-5 sm:grid-cols-4 sm:divide-x sm:divide-border">
            <div className="sm:pr-6">
              <p className="text-3xl font-semibold tabular-nums">{resumen.total}</p>
              <p className="mt-0.5 text-sm text-muted-foreground">Total del mes</p>
              <p className="text-xs text-muted-foreground">
                {mesPrevioCompleto
                  ? `${previo.hastaDia} en todo ${nombrePrevio}`
                  : `${previo.hastaDia} al ${dia} de ${nombrePrevio}`}
                {diff !== 0 && ` (${diff > 0 ? '+' : ''}${diff})`}
              </p>
              {!mesPrevioCompleto && (
                <p className="text-xs text-muted-foreground">{nombrePrevio.charAt(0).toUpperCase() + nombrePrevio.slice(1)} cerró con {previo.total}</p>
              )}
            </div>
            <div className="sm:px-6">
              <p className="text-3xl font-semibold tabular-nums">{resumen.encontrados}</p>
              <p className="mt-0.5 text-sm text-muted-foreground">Cargados</p>
              <p className="text-xs text-muted-foreground">{resumen.publicados} publicados en Colabora</p>
            </div>
            <Link href={pendientesHref} className="group sm:px-6">
              <p className={`text-3xl font-semibold tabular-nums ${pendientes.total > 0 ? 'text-warning' : ''}`}>{pendientes.total}</p>
              <p className="mt-0.5 text-sm text-muted-foreground group-hover:text-foreground">Pendiente ARCOR</p>
              <p className="text-xs text-muted-foreground">{arrastre(pendientes) ?? 'esperan carga en Colabora'}</p>
            </Link>
            {/* Las dudosas se resuelven en la galería del sistema ARCOR: el tile abre ese formulario. */}
            <a href={ENLACES_ARCOR.revisar} target="_blank" rel="noopener noreferrer" className="group sm:pl-6">
              <p className={`text-3xl font-semibold tabular-nums ${dudosas.total > 0 ? 'text-danger' : ''}`}>{dudosas.total}</p>
              <p className="mt-0.5 text-sm text-muted-foreground group-hover:text-foreground">Revisar foto</p>
              {arrastre(dudosas) && <p className="text-xs text-muted-foreground">{arrastre(dudosas)}</p>}
              <p className="text-xs text-muted-foreground">
                {dudosas.total > 0 ? 'resolver en la galería ↗' : 'requieren una persona'}
              </p>
            </a>
          </div>

          <div className="mt-6 border-t border-border pt-5">
            <p className="mb-3 text-sm font-medium">Por provincia</p>
            <ProvinciasBarras resumen={resumen} mesHref={mesHref} />
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-5 sm:p-6">
          <div className="flex items-baseline justify-between gap-2">
            <h2 className="text-lg font-semibold tracking-tight">Alertas abiertas</h2>
            {todasAbiertas.length > 0 && (
              <EstadoPill estado={todasAbiertas.some((a) => a.severidad === 'critical') ? 'vencido' : 'proximo'} label={`${todasAbiertas.length}`} />
            )}
          </div>
          {todasAbiertas.length === 0 ? (
            <div className="mt-4 flex items-center gap-3 rounded-xl bg-success-subtle px-4 py-3 text-sm text-success">
              <CircleCheck className="size-4 shrink-0" strokeWidth={1.75} />
              Sin alertas abiertas. Todo reportando normal.
            </div>
          ) : (
            <div className="mt-4 space-y-3">
              {todasAbiertas.slice(0, 4).map((a) => <AlertaCard key={a.id} e={a} compacta />)}
              {todasAbiertas.length > 4 && (
                <Link href="/arcor/alertas" className="block text-center text-sm font-medium text-primary hover:underline">
                  Ver las {todasAbiertas.length} alertas
                </Link>
              )}
            </div>
          )}
        </div>
      </section>

      {/* ── Actividad reciente ── */}
      <section className="rounded-2xl border border-border bg-card p-5 sm:p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">Actividad reciente</h2>
            <p className="text-sm text-muted-foreground">Últimos movimientos registrados por el sistema</p>
          </div>
          <Link href="/arcor/actividad" className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
            Ver toda la actividad <ArrowRight className="size-3.5" strokeWidth={1.75} />
          </Link>
        </div>
        <div className="mt-4">
          <ListaEventos eventos={recientes} vacio="Todavía no llegó ningún evento del sistema ARCOR." />
        </div>
      </section>
    </div>
  )
}
