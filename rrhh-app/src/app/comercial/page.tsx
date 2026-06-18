import { requireModulo } from '@/lib/auth/session'
import { obtenerDashboardComercial } from '@/modules/comercial/queries'
import { tieneRol, COMERCIAL_GESTION } from '@/lib/auth/roles'
import { Card, CardContent } from '@/components/ui/card'
import Link from 'next/link'
import { EtapaBadge } from '@/components/comercial/EtapaBadge'
import { PriorityBadge } from '@/components/comercial/PriorityBadge'
import { EmptyState } from '@/components/comercial/EmptyState'
import { AlertTriangle, CheckSquare, CalendarDays, FolderKanban } from 'lucide-react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import type { EtapaProyecto } from '@/modules/comercial/tipos'

export default async function ComercialHome() {
  const sesion = await requireModulo('comercial')
  const dash = await obtenerDashboardComercial(sesion)
  const esGestion = tieneRol(sesion.rol, COMERCIAL_GESTION)

  const kpis = [
    { label: 'Proyectos abiertos', valor: dash.proyectosAbiertos, sub: 'en pipeline' },
    { label: 'Tareas para hoy', valor: dash.tareasHoy.length, sub: 'pendientes hoy', alerta: dash.tareasHoy.length > 0 },
    { label: 'Tareas vencidas', valor: dash.tareasVencidas.length, sub: 'requieren atención', alerta: dash.tareasVencidas.length > 0 },
    { label: 'Sin próxima acción', valor: dash.sinProximaAccion.length, sub: 'proyectos sin acción', alerta: dash.sinProximaAccion.length > 0 },
    { label: 'Sin movimiento', valor: dash.sinMovimiento.length, sub: '+7 días sin actividad', alerta: dash.sinMovimiento.length > 0 },
    { label: 'Pipeline estimado', valor: `$${dash.pipeline.toLocaleString('es-AR')}`, sub: 'valor total abierto' },
  ]

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Resumen</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {esGestion ? 'Vista global del equipo comercial' : `Vista personal · ${sesion.nombre ?? sesion.email}`}
        </p>
      </div>

      {/* KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {kpis.map((k) => (
          <Card key={k.label} className={k.alerta ? 'border-amber-500/30' : ''}>
            <CardContent className="p-5">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{k.label}</p>
              <p className={`mt-1 text-2xl font-semibold tabular-nums ${typeof k.alerta === 'boolean' && k.alerta && Number(k.valor) > 0 ? 'text-amber-500' : ''}`}>{k.valor}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">{k.sub}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Tareas para hoy */}
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-foreground flex items-center gap-2"><CheckSquare className="size-4 text-muted-foreground" strokeWidth={1.75} /> Tareas para hoy</h2>
            <Link href="/comercial/tareas?rango=hoy" className="text-xs text-primary hover:underline">Ver todas →</Link>
          </div>
          {dash.tareasHoy.length === 0 ? (
            <EmptyState title="Sin tareas para hoy" description="No hay tareas con vencimiento hoy." />
          ) : (
            <div className="divide-y divide-border rounded-xl border border-border bg-card overflow-hidden">
              {dash.tareasHoy.slice(0, 6).map((t) => (
                <div key={t.id} className="flex items-center gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">{t.titulo}</p>
                  </div>
                  <PriorityBadge prioridad={t.prioridad} />
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Próximas reuniones */}
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-foreground flex items-center gap-2"><CalendarDays className="size-4 text-muted-foreground" strokeWidth={1.75} /> Reuniones próximas</h2>
            <Link href="/comercial/agenda" className="text-xs text-primary hover:underline">Ver agenda →</Link>
          </div>
          {dash.proximasReuniones.length === 0 ? (
            <EmptyState title="Sin reuniones próximas" description="No hay eventos programados." />
          ) : (
            <div className="divide-y divide-border rounded-xl border border-border bg-card overflow-hidden">
              {dash.proximasReuniones.slice(0, 5).map((ev) => (
                <div key={ev.id} className="flex items-center gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">{ev.titulo}</p>
                    <p className="text-xs text-muted-foreground">{format(new Date(ev.fecha_inicio), "d MMM · HH:mm", { locale: es })}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* Alertas */}
      {(dash.sinProximaAccion.length > 0 || dash.sinMovimiento.length > 0 || dash.tareasVencidas.length > 0) && (
        <section>
          <h2 className="mb-3 text-sm font-semibold text-foreground flex items-center gap-2"><AlertTriangle className="size-4 text-amber-500" strokeWidth={1.75} /> Requieren atención</h2>
          <div className="space-y-2">
            {dash.tareasVencidas.length > 0 && (
              <div className="flex items-center justify-between rounded-lg border border-amber-500/20 bg-amber-500/5 px-4 py-3">
                <p className="text-sm text-amber-700 dark:text-amber-400">{dash.tareasVencidas.length} {dash.tareasVencidas.length === 1 ? 'tarea vencida' : 'tareas vencidas'}</p>
                <Link href="/comercial/tareas?rango=vencidas" className="text-xs font-medium text-amber-700 hover:underline dark:text-amber-400">Ver →</Link>
              </div>
            )}
            {dash.sinProximaAccion.length > 0 && (
              <div className="flex items-center justify-between rounded-lg border border-amber-500/20 bg-amber-500/5 px-4 py-3">
                <p className="text-sm text-amber-700 dark:text-amber-400">{dash.sinProximaAccion.length} {dash.sinProximaAccion.length === 1 ? 'proyecto sin próxima acción' : 'proyectos sin próxima acción'}</p>
                <Link href="/comercial/proyectos" className="text-xs font-medium text-amber-700 hover:underline dark:text-amber-400">Ver →</Link>
              </div>
            )}
            {dash.sinMovimiento.length > 0 && (
              <div className="flex items-center justify-between rounded-lg border border-amber-500/20 bg-amber-500/5 px-4 py-3">
                <p className="text-sm text-amber-700 dark:text-amber-400">{dash.sinMovimiento.length} {dash.sinMovimiento.length === 1 ? 'proyecto sin movimiento' : 'proyectos sin movimiento'} (más de 7 días)</p>
                <Link href="/comercial/proyectos" className="text-xs font-medium text-amber-700 hover:underline dark:text-amber-400">Ver →</Link>
              </div>
            )}
          </div>
        </section>
      )}

      {/* Pipeline por etapa */}
      {Object.keys(dash.porEtapa).length > 0 && (
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-foreground flex items-center gap-2"><FolderKanban className="size-4 text-muted-foreground" strokeWidth={1.75} /> Proyectos por etapa</h2>
            <Link href="/comercial/proyectos" className="text-xs text-primary hover:underline">Ver pipeline →</Link>
          </div>
          <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-4">
            {Object.entries(dash.porEtapa).map(([etapa, count]) => (
              <div key={etapa} className="flex items-center justify-between rounded-lg border border-border bg-card px-3 py-2.5">
                <EtapaBadge etapa={etapa as EtapaProyecto} />
                <span className="text-sm font-semibold tabular-nums">{count}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Actividad reciente */}
      {dash.actividadReciente.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-semibold text-foreground">Actividad reciente</h2>
          <div className="divide-y divide-border rounded-xl border border-border bg-card overflow-hidden">
            {dash.actividadReciente.slice(0, 8).map((a) => (
              <div key={a.id} className="flex items-start gap-3 px-4 py-3">
                <div className="mt-0.5 size-1.5 shrink-0 rounded-full bg-primary/60 mt-2" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-foreground">{a.titulo}</p>
                  <p className="text-xs text-muted-foreground">{format(new Date(a.created_at), "d MMM · HH:mm", { locale: es })}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
