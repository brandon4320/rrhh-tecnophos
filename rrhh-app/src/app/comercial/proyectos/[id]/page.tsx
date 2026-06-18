import { requireModulo } from '@/lib/auth/session'
import { obtenerProyecto, listarMotivosPerdida } from '@/modules/comercial/queries'
import { puedeEditarProyecto, puedeCerrarProyecto } from '@/modules/comercial/permisos'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { EtapaBadge } from '@/components/comercial/EtapaBadge'
import { EstadoBadge } from '@/components/comercial/EstadoBadge'
import { PriorityBadge } from '@/components/comercial/PriorityBadge'
import { EmptyState } from '@/components/comercial/EmptyState'
import { Card, CardContent } from '@/components/ui/card'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import type { EtapaProyecto } from '@/modules/comercial/tipos'
import { ETAPA_LABEL, ETAPAS_PROYECTO } from '@/modules/comercial/tipos'
import { cambiarEtapaProyecto, actualizarProximaAccion, cerrarProyectoGanado, cerrarProyectoPerdido, crearNota } from '@/modules/comercial/actions'
import { redirect } from 'next/navigation'

export default async function ProyectoDetallePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const sesion = await requireModulo('comercial')

  let data
  try { data = await obtenerProyecto(id, sesion) } catch { notFound() }
  const { proyecto, tareas, eventos, notas, actividad, archivos } = data

  const canEdit = puedeEditarProyecto(sesion, proyecto)
  const canClose = puedeCerrarProyecto(sesion, proyecto)
  const motivosPerdida = canClose ? await listarMotivosPerdida() : []

  const hoy = new Date().toISOString().substring(0, 10)

  async function actionCambiarEtapa(form: FormData) {
    'use server'
    const etapa = form.get('etapa') as EtapaProyecto
    await cambiarEtapaProyecto(id, etapa)
    redirect(`/comercial/proyectos/${id}`)
  }

  async function actionProximaAccion(form: FormData) {
    'use server'
    await actualizarProximaAccion(id, form.get('proxima_accion') as string, form.get('proxima_accion_fecha') as string)
    redirect(`/comercial/proyectos/${id}`)
  }

  async function actionCerrarGanado(form: FormData) {
    'use server'
    const res = await cerrarProyectoGanado(id, (form.get('resultado_cierre') as string) || undefined)
    if (!res.error) redirect('/comercial/proyectos?estado=ganado')
  }

  async function actionCerrarPerdido(form: FormData) {
    'use server'
    const motivo = form.get('motivo_perdida_id') as string
    const res = await cerrarProyectoPerdido(id, motivo, (form.get('resultado_cierre') as string) || undefined)
    if (!res.error) redirect('/comercial/proyectos?estado=perdido')
  }

  async function actionNota(form: FormData) {
    'use server'
    form.set('proyecto_id', id)
    await crearNota(form)
    redirect(`/comercial/proyectos/${id}`)
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <Link href="/comercial/proyectos" className="text-xs text-muted-foreground hover:text-foreground">← Proyectos</Link>
          <h1 className="mt-2 text-2xl font-semibold leading-tight">{proyecto.titulo}</h1>
          {proyecto.codigo && <p className="text-xs text-muted-foreground mt-0.5">{proyecto.codigo}</p>}
          <div className="mt-2 flex flex-wrap gap-2">
            <EtapaBadge etapa={proyecto.etapa as EtapaProyecto} />
            <EstadoBadge estado={proyecto.estado} />
            <PriorityBadge prioridad={proyecto.prioridad} />
          </div>
        </div>

        {/* Acciones rápidas */}
        {canEdit && proyecto.estado === 'abierto' && (
          <div className="flex flex-wrap gap-2">
            <Link href={`/comercial/tareas/nueva?proyecto_id=${id}`} className="rounded-md border border-border px-3 py-1.5 text-xs font-medium hover:bg-accent">+ Tarea</Link>
            <Link href={`/comercial/agenda/nuevo?proyecto_id=${id}`} className="rounded-md border border-border px-3 py-1.5 text-xs font-medium hover:bg-accent">+ Reunión</Link>
          </div>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">

          {/* Info central */}
          <Card>
            <CardContent className="p-5 grid gap-4 sm:grid-cols-2">
              <div>
                <p className="text-xs text-muted-foreground">Cliente</p>
                <p className="text-sm font-medium">{proyecto.cliente_id ? <Link href={`/comercial/clientes/${proyecto.cliente_id}`} className="hover:text-primary">Ver cliente →</Link> : '—'}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Valor estimado</p>
                <p className="text-sm font-medium font-mono">{proyecto.valor_estimado ? `${proyecto.moneda ?? 'USD'} ${Number(proyecto.valor_estimado).toLocaleString('es-AR')}` : '—'}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Probabilidad</p>
                <p className="text-sm font-medium">{proyecto.probabilidad ?? 0}%</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Cierre estimado</p>
                <p className="text-sm font-medium">{proyecto.fecha_estimada_cierre ? format(new Date(proyecto.fecha_estimada_cierre + 'T12:00:00'), 'd MMM yyyy', { locale: es }) : '—'}</p>
              </div>
              {proyecto.descripcion && (
                <div className="sm:col-span-2">
                  <p className="text-xs text-muted-foreground">Descripción</p>
                  <p className="text-sm mt-0.5">{proyecto.descripcion}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Próxima acción */}
          <Card>
            <CardContent className="p-5">
              <h3 className="text-sm font-semibold mb-3">Próxima acción</h3>
              {proyecto.proxima_accion ? (
                <div className="mb-3">
                  <p className="text-sm font-medium">{proyecto.proxima_accion}</p>
                  {proyecto.proxima_accion_fecha && (
                    <p className={`text-xs mt-0.5 ${proyecto.proxima_accion_fecha < hoy ? 'text-red-500' : 'text-muted-foreground'}`}>
                      {format(new Date(proyecto.proxima_accion_fecha + 'T12:00:00'), "EEEE d 'de' MMMM yyyy", { locale: es })}
                      {proyecto.proxima_accion_fecha < hoy ? ' · VENCIDA' : ''}
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-sm text-amber-500 mb-3">Sin próxima acción definida.</p>
              )}
              {canEdit && proyecto.estado === 'abierto' && (
                <form action={actionProximaAccion} className="flex flex-wrap items-end gap-2">
                  <div className="flex-1 min-w-40">
                    <input name="proxima_accion" defaultValue={proyecto.proxima_accion ?? ''} placeholder="Qué hay que hacer…" className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" />
                  </div>
                  <input type="date" name="proxima_accion_fecha" defaultValue={proyecto.proxima_accion_fecha ?? ''} className="flex h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" />
                  <button type="submit" className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90">Guardar</button>
                </form>
              )}
            </CardContent>
          </Card>

          {/* Cambiar etapa */}
          {canEdit && proyecto.estado === 'abierto' && (
            <Card>
              <CardContent className="p-5">
                <h3 className="text-sm font-semibold mb-3">Etapa del proyecto</h3>
                <form action={actionCambiarEtapa} className="flex flex-wrap gap-2">
                  {ETAPAS_PROYECTO.filter((e) => !['ganado', 'perdido'].includes(e)).map((etapa) => (
                    <button key={etapa} type="submit" name="etapa" value={etapa}
                      className={`rounded-md border px-3 py-1.5 text-xs font-medium transition-colors ${proyecto.etapa === etapa ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:bg-accent'}`}>
                      {ETAPA_LABEL[etapa]}
                    </button>
                  ))}
                </form>
              </CardContent>
            </Card>
          )}

          {/* Tareas */}
          <section>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold">Tareas abiertas ({tareas.length})</h2>
              {canEdit && <Link href={`/comercial/tareas/nueva?proyecto_id=${id}`} className="text-xs text-primary hover:underline">+ Nueva tarea</Link>}
            </div>
            {tareas.length === 0 ? <EmptyState title="Sin tareas abiertas" /> : (
              <div className="divide-y divide-border rounded-xl border border-border bg-card overflow-hidden">
                {tareas.map((t) => (
                  <div key={t.id} className="flex items-center gap-3 px-4 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">{t.titulo}</p>
                      {t.fecha_vencimiento && (
                        <p className={`text-xs ${new Date(t.fecha_vencimiento) < new Date() ? 'text-red-500' : 'text-muted-foreground'}`}>
                          {format(new Date(t.fecha_vencimiento), 'd MMM · HH:mm', { locale: es })}
                        </p>
                      )}
                    </div>
                    <PriorityBadge prioridad={t.prioridad} />
                    <EstadoBadge estado={t.estado} />
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Reuniones */}
          <section>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold">Reuniones ({eventos.length})</h2>
              {canEdit && <Link href={`/comercial/agenda/nuevo?proyecto_id=${id}`} className="text-xs text-primary hover:underline">+ Agendar</Link>}
            </div>
            {eventos.length === 0 ? <EmptyState title="Sin reuniones registradas" /> : (
              <div className="divide-y divide-border rounded-xl border border-border bg-card overflow-hidden">
                {eventos.slice(0, 5).map((e) => (
                  <div key={e.id} className="flex items-center gap-3 px-4 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">{e.titulo}</p>
                      <p className="text-xs text-muted-foreground">{format(new Date(e.fecha_inicio), "d MMM yyyy · HH:mm", { locale: es })}</p>
                      {e.resultado && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">Resultado: {e.resultado}</p>}
                    </div>
                    <EstadoBadge estado={e.estado} />
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Notas */}
          <section>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold">Notas ({notas.length})</h2>
            </div>
            {canEdit && (
              <form action={actionNota} className="mb-3 flex gap-2">
                <textarea name="contenido" rows={2} placeholder="Agregar una nota…" required className="flex-1 rounded-md border border-input bg-transparent px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none" />
                <button type="submit" className="self-end rounded-md bg-primary px-3 py-2 text-xs font-medium text-primary-foreground hover:bg-primary/90">Guardar</button>
              </form>
            )}
            {notas.length === 0 ? <EmptyState title="Sin notas" /> : (
              <div className="space-y-2">
                {notas.map((n) => (
                  <div key={n.id} className="rounded-lg border border-border bg-card px-4 py-3">
                    <p className="text-sm">{n.contenido}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{format(new Date(n.created_at), "d MMM yyyy · HH:mm", { locale: es })}</p>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Cierre */}
          {canClose && proyecto.estado === 'abierto' && (
            <section>
              <h2 className="mb-3 text-sm font-semibold">Cierre de proyecto</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                <Card className="border-emerald-500/30">
                  <CardContent className="p-4">
                    <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400 mb-2">Cerrar como ganado</p>
                    <form action={actionCerrarGanado} className="space-y-2">
                      <textarea name="resultado_cierre" rows={2} placeholder="Resultado o notas del cierre (opcional)…" className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none" />
                      <button type="submit" className="w-full rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700">Marcar como GANADO</button>
                    </form>
                  </CardContent>
                </Card>
                <Card className="border-red-500/30">
                  <CardContent className="p-4">
                    <p className="text-sm font-medium text-red-700 dark:text-red-400 mb-2">Cerrar como perdido</p>
                    <form action={actionCerrarPerdido} className="space-y-2">
                      <select name="motivo_perdida_id" required className="w-full rounded-md border border-input bg-transparent px-3 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
                        <option value="">Motivo de pérdida *</option>
                        {motivosPerdida.map((m) => <option key={m.id} value={m.id}>{m.nombre}</option>)}
                      </select>
                      <textarea name="resultado_cierre" rows={2} placeholder="Notas adicionales (opcional)…" className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none" />
                      <button type="submit" className="w-full rounded-md bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700">Marcar como PERDIDO</button>
                    </form>
                  </CardContent>
                </Card>
              </div>
            </section>
          )}
        </div>

        {/* Sidebar — Timeline actividad */}
        <div>
          <Card>
            <CardContent className="p-4">
              <h3 className="mb-3 text-sm font-semibold">Actividad</h3>
              {actividad.length === 0 ? (
                <p className="text-xs text-muted-foreground">Sin actividad registrada.</p>
              ) : (
                <div className="space-y-3">
                  {actividad.slice(0, 15).map((a) => (
                    <div key={a.id} className="flex gap-2.5">
                      <div className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary/50" />
                      <div>
                        <p className="text-xs font-medium text-foreground leading-snug">{a.titulo}</p>
                        {a.descripcion && <p className="text-xs text-muted-foreground">{a.descripcion}</p>}
                        <p className="text-xs text-muted-foreground">{format(new Date(a.created_at), "d MMM · HH:mm", { locale: es })}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
