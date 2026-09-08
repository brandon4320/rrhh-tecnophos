import Link from 'next/link'
import { ArrowRight, CircleCheck } from 'lucide-react'
import { EstadoPill } from '@/components/ui/estado-pill'
import { TileEstado } from '@/components/arcor/TileEstado'
import { BarraConsumo } from '@/components/arcor/BarraConsumo'
import { AlertaCard } from '@/components/arcor/AlertaCard'
import { ListaEventos } from '@/components/arcor/ListaEventos'
import { ProvinciasBarras } from '@/components/arcor/ProvinciasBarras'
import { getAlertasAbiertas, getEstados, getEventos, getResumenMes } from '@/modules/arcor/queries'
import { evaluarSilencio, mesActual, mesAnterior, nivelCredito, severidadAEstado } from '@/modules/arcor/reglas'
import type { EstadoClaude, EstadoHeartbeat, EstadoPublicaciones, EstadoWhatsapp, EventoRow } from '@/modules/arcor/tipos'
import { fmtFechaHoraAR, fmtFechaLargaAR, tiempoRelativo } from '@/lib/fechas-ar'

export const dynamic = 'force-dynamic'

export default async function ArcorResumenPage() {
  const ahora = new Date()
  const mes = mesActual(ahora)
  const [estados, abiertas, resumen, resumenPrevio, recientes] = await Promise.all([
    getEstados(),
    getAlertasAbiertas(),
    getResumenMes(mes),
    getResumenMes(mesAnterior(mes)),
    getEventos({ limit: 10 }),
  ])

  const wa = estados.whatsapp?.valor as EstadoWhatsapp | undefined
  const claude = estados.claude?.valor as EstadoClaude | undefined
  const hb = estados.heartbeat?.valor as EstadoHeartbeat | undefined
  const pub = estados.publicaciones?.valor as EstadoPublicaciones | undefined

  const silencio = evaluarSilencio(hb?.ts ?? null, ahora)
  const nivel = nivelCredito(claude?.porcentaje_usado)
  const alertaWa = abiertas.find((a) => a.clave_alerta === 'whatsapp')

  // Alerta sintética: el sistema dejó de reportar (no vive en la DB, se evalúa al leer).
  const alertaSilencio: EventoRow | null = silencio.silencio
    ? {
        id: 'silencio',
        ts: hb?.ts ?? estados.heartbeat?.updated_at ?? ahora.toISOString(),
        tipo: 'sistema_silencio',
        severidad: 'critical',
        titulo: hb ? 'El sistema ARCOR dejó de reportar' : 'El sistema ARCOR todavía no reportó nunca',
        detalle: { umbral_min: silencio.umbralMin, minutos: silencio.minutos },
        origen: 'gestion',
        clave_alerta: 'silencio',
        resuelto_en: null,
        created_at: ahora.toISOString(),
      }
    : null
  const todasAbiertas = alertaSilencio ? [alertaSilencio, ...abiertas] : abiertas

  const mesHref = `/arcor/contenedores?mes=${encodeURIComponent(mes)}`
  const diff = resumen.total - resumenPrevio.total

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6 lg:p-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Tecnophos - ARCOR</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Certificados de fumigación de contenedores · <span className="capitalize">{fmtFechaLargaAR(ahora.toISOString())}</span>
        </p>
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
            pill={!claude ? 'Sin datos' : nivel === 'critical' ? 'Agotándose' : nivel === 'warning' ? 'Bajo' : 'OK'}
            valor={claude ? `US$ ${Number(claude.restante_usd).toFixed(2)}` : '—'}
            sub={
              claude
                ? `${Number(claude.gastado_usd).toFixed(2)} de ${Number(claude.presupuesto_usd).toFixed(0)} usados${claude.certificados_restantes_estimados != null ? ` · ~${claude.certificados_restantes_estimados} certificados` : ''}`
                : 'Todavía no reportó'
            }
            extra={claude ? <BarraConsumo pct={claude.porcentaje_usado ?? 0} nivel={nivel} /> : undefined}
          />
          <TileEstado
            className="sm:px-6"
            label="Último reporte"
            estado={!hb ? 'sin_fecha' : silencio.silencio ? 'vencido' : 'vigente'}
            pill={!hb ? 'Sin datos' : silencio.silencio ? 'Sin señal' : 'Reportando'}
            valor={hb ? tiempoRelativo(hb.ts, ahora) : '—'}
            sub={hb ? `${fmtFechaHoraAR(hb.ts)} · vía ${hb.origen}` : 'Todavía no reportó'}
          />
          <TileEstado
            className="sm:pl-6"
            label="Publicaciones Colabora"
            estado={!pub ? 'sin_fecha' : pub.vencidas?.length ? 'proximo' : 'vigente'}
            pill={!pub ? 'Sin datos' : pub.vencidas?.length ? `${pub.vencidas.length} vencidas` : 'Al día'}
            valor={pub ? pub.pendientes : '—'}
            sub={pub ? `en cola · ${pub.revisar?.length ?? 0} para revisar` : 'Todavía no reportó'}
          />
        </div>
      </section>

      {/* ── Contenedores del mes + Alertas abiertas ── */}
      <section className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <div className="rounded-2xl border border-border bg-card p-5 sm:p-6">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <div>
              <h2 className="text-lg font-semibold tracking-tight">Contenedores · <span className="capitalize">{mes.toLowerCase()}</span></h2>
              <p className="text-sm text-muted-foreground">Certificados con fecha en el mes (misma regla que la pestaña del Sheets)</p>
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
                {resumenPrevio.total} el mes pasado{diff !== 0 && ` (${diff > 0 ? '+' : ''}${diff})`}
              </p>
            </div>
            <div className="sm:px-6">
              <p className="text-3xl font-semibold tabular-nums">{resumen.encontrados}</p>
              <p className="mt-0.5 text-sm text-muted-foreground">Cargados</p>
              <p className="text-xs text-muted-foreground">{resumen.publicados} publicados en Colabora</p>
            </div>
            <div className="sm:px-6">
              <p className={`text-3xl font-semibold tabular-nums ${resumen.pendientes > 0 ? 'text-warning' : ''}`}>{resumen.pendientes}</p>
              <p className="mt-0.5 text-sm text-muted-foreground">Pendiente ARCOR</p>
              <p className="text-xs text-muted-foreground">esperan carga en Colabora</p>
            </div>
            <div className="sm:pl-6">
              <p className={`text-3xl font-semibold tabular-nums ${resumen.revisar > 0 ? 'text-danger' : ''}`}>{resumen.revisar}</p>
              <p className="mt-0.5 text-sm text-muted-foreground">Revisar foto</p>
              <p className="text-xs text-muted-foreground">requieren una persona</p>
            </div>
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
