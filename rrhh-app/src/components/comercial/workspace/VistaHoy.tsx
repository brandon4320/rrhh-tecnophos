import { obtenerDashboardComercial } from '@/modules/comercial/queries'
import { completarTarea } from '@/modules/comercial/actions'
import { tieneRol, COMERCIAL_GESTION } from '@/lib/auth/roles'
import type { Sesion } from '@/lib/auth/session'
import { EmpresaBadge } from '@/components/comercial/EmpresaBadge'
import { EtapaBadge } from '@/components/comercial/EtapaBadge'
import { PriorityBadge } from '@/components/comercial/PriorityBadge'
import Link from 'next/link'
import { fmtFechaAR, fmtHoraAR, fmtFechaHoraAR } from '@/modules/comercial/fechas'
import { AlertTriangle, CheckSquare, CalendarDays, FolderKanban, Clock, TrendingUp, Users } from 'lucide-react'
import type { EtapaProyecto } from '@/modules/comercial/tipos'
import { redirect } from 'next/navigation'

function formatPeso(valor: number) {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(valor)
}

export async function VistaHoy({ sesion }: { sesion: Sesion }) {
  const dash = await obtenerDashboardComercial(sesion)
  const esGestion = tieneRol(sesion.rol, COMERCIAL_GESTION)

  const hayAlertas = dash.tareasVencidas.length > 0 || dash.sinProximaAccion.length > 0

  return (
    <div className="space-y-5">
      {!esGestion && (
        <p className="text-sm text-muted-foreground">
          {dash.tareasHoy.length > 0
            ? `${dash.tareasHoy.length} ${dash.tareasHoy.length === 1 ? 'tarea' : 'tareas'} para hoy`
            : 'No hay tareas para hoy'}
        </p>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-1.5 text-muted-foreground mb-1.5">
            <FolderKanban className="size-3.5" strokeWidth={1.75} />
            <span className="text-xs font-medium">Proyectos</span>
          </div>
          <p className="text-2xl font-bold tabular-nums">{dash.proyectosAbiertos}</p>
          <p className="text-xs text-muted-foreground">abiertos</p>
        </div>
        <div className={`rounded-xl border p-4 ${dash.tareasVencidas.length > 0 ? 'border-red-500/40 bg-red-500/5' : 'border-border bg-card'}`}>
          <div className={`flex items-center gap-1.5 mb-1.5 ${dash.tareasVencidas.length > 0 ? 'text-red-500' : 'text-muted-foreground'}`}>
            <AlertTriangle className="size-3.5" strokeWidth={1.75} />
            <span className="text-xs font-medium">Vencidas</span>
          </div>
          <p className={`text-2xl font-bold tabular-nums ${dash.tareasVencidas.length > 0 ? 'text-red-500' : ''}`}>{dash.tareasVencidas.length}</p>
          <p className="text-xs text-muted-foreground">tareas</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-1.5 text-muted-foreground mb-1.5">
            <TrendingUp className="size-3.5" strokeWidth={1.75} />
            <span className="text-xs font-medium">Pipeline</span>
          </div>
          <p className="text-lg font-bold tabular-nums leading-tight">{formatPeso(dash.pipeline)}</p>
          <p className="text-xs text-muted-foreground">estimado</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-1.5 text-muted-foreground mb-1.5">
            <Clock className="size-3.5" strokeWidth={1.75} />
            <span className="text-xs font-medium">Sin acción</span>
          </div>
          <p className={`text-2xl font-bold tabular-nums ${dash.sinProximaAccion.length > 0 ? 'text-amber-500' : ''}`}>{dash.sinProximaAccion.length}</p>
          <p className="text-xs text-muted-foreground">proyectos</p>
        </div>
      </div>

      {/* Alertas */}
      {hayAlertas && (
        <div className="rounded-xl border border-amber-400/30 bg-amber-50 dark:bg-amber-900/10 p-4 space-y-2">
          <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-400">
            <AlertTriangle className="size-3.5" /> Requieren atención
          </p>
          {dash.tareasVencidas.length > 0 && (
            <Link href="/comercial/tareas?rango=vencidas"
              className="flex items-center justify-between rounded-lg bg-white dark:bg-black/20 px-3 py-2.5 hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-colors">
              <span className="text-sm text-amber-900 dark:text-amber-200">{dash.tareasVencidas.length} {dash.tareasVencidas.length === 1 ? 'tarea vencida' : 'tareas vencidas'}</span>
              <span className="text-xs text-amber-600 dark:text-amber-400">Ver →</span>
            </Link>
          )}
          {dash.sinProximaAccion.length > 0 && (
            <Link href="/comercial?vista=proyectos"
              className="flex items-center justify-between rounded-lg bg-white dark:bg-black/20 px-3 py-2.5 hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-colors">
              <span className="text-sm text-amber-900 dark:text-amber-200">{dash.sinProximaAccion.length} {dash.sinProximaAccion.length === 1 ? 'proyecto' : 'proyectos'} sin próxima acción</span>
              <span className="text-xs text-amber-600 dark:text-amber-400">Ver →</span>
            </Link>
          )}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Tareas para hoy */}
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-sm font-semibold">
              <CheckSquare className="size-4 text-primary" strokeWidth={1.75} />
              Tareas para hoy
              {dash.tareasHoy.length > 0 && (
                <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold text-primary-foreground">{dash.tareasHoy.length}</span>
              )}
            </h2>
            <Link href="/comercial/tareas" className="text-xs text-muted-foreground hover:text-foreground">Ver todas →</Link>
          </div>
          {dash.tareasHoy.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border px-5 py-8 text-center">
              <CheckSquare className="mx-auto size-9 text-muted-foreground/30" strokeWidth={1.25} />
              <p className="mt-2 text-sm text-muted-foreground">Sin tareas para hoy</p>
              <Link href="/comercial/tareas/nueva" className="mt-1.5 inline-flex text-xs text-primary hover:underline">Agregar tarea →</Link>
            </div>
          ) : (
            <div className="space-y-2">
              {dash.tareasHoy.slice(0, 8).map((t) => {
                const tAny = t as { empresa?: string | null }
                async function completar() {
                  'use server'
                  await completarTarea(t.id)
                  redirect('/comercial')
                }
                return (
                  <div key={t.id} className="flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-3 hover:bg-accent/50 transition-colors">
                    <form action={completar} className="shrink-0">
                      <button type="submit" title="Marcar completada"
                        className="flex size-6 items-center justify-center rounded-full border-2 border-muted-foreground/30 hover:border-primary hover:bg-primary/10 transition-colors">
                        <CheckSquare className="size-3 text-muted-foreground/40" strokeWidth={2} />
                      </button>
                    </form>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{t.titulo}</p>
                      <div className="mt-0.5 flex items-center gap-1.5 flex-wrap">
                        {tAny.empresa && <EmpresaBadge empresa={tAny.empresa} size="xs" />}
                        {t.fecha_vencimiento && (
                          <span className="text-[10px] text-muted-foreground">{fmtHoraAR(t.fecha_vencimiento)}</span>
                        )}
                      </div>
                    </div>
                    <PriorityBadge prioridad={t.prioridad} />
                  </div>
                )
              })}
            </div>
          )}
        </section>

        {/* Próximas reuniones */}
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-sm font-semibold">
              <CalendarDays className="size-4 text-primary" strokeWidth={1.75} />
              Próximas reuniones
            </h2>
            <Link href="/comercial/agenda" className="text-xs text-muted-foreground hover:text-foreground">Ver agenda →</Link>
          </div>
          {dash.proximasReuniones.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border px-5 py-8 text-center">
              <CalendarDays className="mx-auto size-9 text-muted-foreground/30" strokeWidth={1.25} />
              <p className="mt-2 text-sm text-muted-foreground">Sin reuniones próximas</p>
              <Link href="/comercial/agenda/nuevo" className="mt-1.5 inline-flex text-xs text-primary hover:underline">Agendar →</Link>
            </div>
          ) : (
            <div className="space-y-2">
              {dash.proximasReuniones.slice(0, 5).map((ev) => {
                const evAny = ev as { empresa?: string | null }
                return (
                  <div key={ev.id} className="flex items-start gap-3 rounded-xl border border-border bg-card px-4 py-3">
                    <div className="shrink-0 text-center min-w-[2.5rem]">
                      <p className="text-sm font-bold text-primary leading-none">{fmtHoraAR(ev.fecha_inicio)}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">{fmtFechaAR(ev.fecha_inicio)}</p>
                    </div>
                    <div className="min-w-0 flex-1 border-l border-border pl-3">
                      <p className="truncate text-sm font-medium">{ev.titulo}</p>
                      <div className="mt-0.5 flex items-center gap-1.5">
                        {evAny.empresa && <EmpresaBadge empresa={evAny.empresa} size="xs" />}
                        <span className="capitalize text-[10px] text-muted-foreground">{ev.tipo}</span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </section>
      </div>

      {/* Pipeline por etapa */}
      {Object.keys(dash.porEtapa).length > 0 && (
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-sm font-semibold">
              <FolderKanban className="size-4 text-muted-foreground" strokeWidth={1.75} />
              Pipeline por etapa
            </h2>
            <Link href="/comercial?vista=tablero" className="text-xs text-muted-foreground hover:text-foreground">Ver tablero →</Link>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
            {Object.entries(dash.porEtapa).map(([etapa, count]) => (
              <Link key={etapa} href={`/comercial/proyectos?etapa=${etapa}`}
                className="flex items-center justify-between rounded-xl border border-border bg-card px-3 py-2.5 hover:bg-accent transition-colors">
                <EtapaBadge etapa={etapa as EtapaProyecto} />
                <span className="text-sm font-bold tabular-nums">{count}</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Panel gerente */}
      {esGestion && (
        <Link href="/comercial/equipo"
          className="flex items-center justify-between rounded-xl border border-border bg-card px-5 py-4 hover:bg-accent transition-colors">
          <div className="flex items-center gap-3">
            <Users className="size-5 text-muted-foreground" strokeWidth={1.75} />
            <div>
              <p className="text-sm font-semibold">Equipo comercial</p>
              <p className="text-xs text-muted-foreground">Ver estado del equipo y asignar tareas</p>
            </div>
          </div>
          <span className="text-sm text-muted-foreground">→</span>
        </Link>
      )}

      {/* Actividad reciente */}
      {dash.actividadReciente.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-semibold">Actividad reciente</h2>
          <div className="divide-y divide-border rounded-xl border border-border bg-card overflow-hidden">
            {dash.actividadReciente.slice(0, 6).map((a) => (
              <div key={a.id} className="flex items-start gap-3 px-4 py-3">
                <div className="mt-[9px] size-1.5 shrink-0 rounded-full bg-primary/50" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm">{a.titulo}</p>
                  <p className="text-[10px] text-muted-foreground">{fmtFechaHoraAR(a.created_at)}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
