import { requireModulo } from '@/lib/auth/session'
import { obtenerCliente } from '@/modules/comercial/queries'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { EstadoBadge } from '@/components/comercial/EstadoBadge'
import { PriorityBadge } from '@/components/comercial/PriorityBadge'
import { EtapaBadge } from '@/components/comercial/EtapaBadge'
import { EmptyState } from '@/components/comercial/EmptyState'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { Plus } from 'lucide-react'
import type { EtapaProyecto } from '@/modules/comercial/tipos'

export default async function ClienteDetallePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const sesion = await requireModulo('comercial')

  let data
  try { data = await obtenerCliente(id, sesion) } catch { notFound() }
  const { cliente, contactos, proyectos, tareas, eventos, notas } = data

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link href="/comercial/clientes" className="text-xs text-muted-foreground hover:text-foreground">← Clientes</Link>
          <h1 className="mt-2 text-2xl font-semibold">{cliente.nombre}</h1>
          {cliente.razon_social && <p className="text-sm text-muted-foreground">{cliente.razon_social}</p>}
          <div className="mt-2 flex flex-wrap gap-2">
            <EstadoBadge estado={cliente.estado} />
            <PriorityBadge prioridad={cliente.prioridad} />
            {cliente.pais && <span className="rounded border border-border px-2 py-0.5 text-xs text-muted-foreground">{[cliente.pais, cliente.ciudad].filter(Boolean).join(' · ')}</span>}
            {cliente.rubro && <span className="rounded border border-border px-2 py-0.5 text-xs text-muted-foreground">{cliente.rubro}</span>}
          </div>
        </div>
        <div className="flex gap-2 shrink-0">
          <Link href={`/comercial/proyectos/nuevo?cliente_id=${id}`}>
            <Button size="sm" variant="outline" className="gap-1.5"><Plus className="size-4" />Proyecto</Button>
          </Link>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          {/* Proyectos */}
          <section>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold">Proyectos ({proyectos.length})</h2>
              <Link href={`/comercial/proyectos/nuevo?cliente_id=${id}`} className="text-xs text-primary hover:underline">+ Nuevo</Link>
            </div>
            {proyectos.length === 0 ? (
              <EmptyState title="Sin proyectos" description="Este cliente aún no tiene proyectos." />
            ) : (
              <div className="divide-y divide-border rounded-xl border border-border bg-card overflow-hidden">
                {proyectos.map((p) => (
                  <div key={p.id} className="flex items-center gap-3 px-4 py-3">
                    <div className="min-w-0 flex-1">
                      <Link href={`/comercial/proyectos/${p.id}`} className="text-sm font-medium hover:text-primary">{p.titulo}</Link>
                      {p.proxima_accion_fecha && (
                        <p className="text-xs text-muted-foreground">Próx. acción: {format(new Date(p.proxima_accion_fecha + 'T12:00:00'), 'd MMM', { locale: es })}</p>
                      )}
                    </div>
                    <EtapaBadge etapa={p.etapa as EtapaProyecto} />
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Tareas abiertas */}
          <section>
            <h2 className="mb-3 text-sm font-semibold">Tareas abiertas ({tareas.length})</h2>
            {tareas.length === 0 ? (
              <EmptyState title="Sin tareas pendientes" />
            ) : (
              <div className="divide-y divide-border rounded-xl border border-border bg-card overflow-hidden">
                {tareas.slice(0, 8).map((t) => (
                  <div key={t.id} className="flex items-center gap-3 px-4 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">{t.titulo}</p>
                      {t.fecha_vencimiento && (
                        <p className="text-xs text-muted-foreground">Vence {format(new Date(t.fecha_vencimiento), 'd MMM · HH:mm', { locale: es })}</p>
                      )}
                    </div>
                    <PriorityBadge prioridad={t.prioridad} />
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Notas */}
          <section>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold">Notas ({notas.length})</h2>
              <Link href={`/comercial/notas/nueva?cliente_id=${id}`} className="text-xs text-primary hover:underline">+ Agregar</Link>
            </div>
            {notas.length === 0 ? (
              <EmptyState title="Sin notas" />
            ) : (
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
        </div>

        {/* Sidebar — contactos + próximas reuniones */}
        <div className="space-y-6">
          <Card>
            <CardContent className="p-4">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-semibold">Contactos</h3>
                <Link href={`/comercial/contactos/nuevo?cliente_id=${id}`} className="text-xs text-primary hover:underline">+ Agregar</Link>
              </div>
              {contactos.length === 0 ? (
                <p className="text-xs text-muted-foreground">Sin contactos cargados.</p>
              ) : (
                <div className="space-y-3">
                  {contactos.map((c) => (
                    <div key={c.id}>
                      <p className="text-sm font-medium">{c.nombre} {c.apellido}</p>
                      {c.cargo && <p className="text-xs text-muted-foreground">{c.cargo}</p>}
                      {c.email && <p className="text-xs text-muted-foreground">{c.email}</p>}
                      {c.whatsapp && <p className="text-xs text-muted-foreground">📱 {c.whatsapp}</p>}
                      {c.es_contacto_principal && <span className="text-xs text-primary">Principal</span>}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <h3 className="mb-3 text-sm font-semibold">Próximas reuniones</h3>
              {eventos.length === 0 ? (
                <p className="text-xs text-muted-foreground">Sin eventos próximos.</p>
              ) : (
                <div className="space-y-2">
                  {eventos.map((e) => (
                    <div key={e.id}>
                      <p className="text-sm font-medium">{e.titulo}</p>
                      <p className="text-xs text-muted-foreground">{format(new Date(e.fecha_inicio), "d MMM · HH:mm", { locale: es })}</p>
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
