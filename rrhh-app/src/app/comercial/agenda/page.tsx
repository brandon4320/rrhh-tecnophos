import { requireModulo } from '@/lib/auth/session'
import { listarEventos } from '@/modules/comercial/queries'
import { marcarEventoRealizado, cancelarEvento } from '@/modules/comercial/actions'
import Link from 'next/link'
import { EstadoBadge } from '@/components/comercial/EstadoBadge'
import { EmptyState } from '@/components/comercial/EmptyState'
import { Button } from '@/components/ui/button'
import { CalendarDays, Plus } from 'lucide-react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { TIPO_EVENTO_LABEL } from '@/modules/comercial/tipos'
import type { TipoEvento } from '@/modules/comercial/tipos'
import { redirect } from 'next/navigation'

export default async function AgendaPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sesion = await requireModulo('comercial')
  const sp = await searchParams

  const eventos = await listarEventos(sesion, { estado: sp.estado })

  async function actionRealizado(form: FormData) {
    'use server'
    const id = form.get('evento_id') as string
    const resultado = form.get('resultado') as string
    await marcarEventoRealizado(id, resultado)
    redirect('/comercial/agenda')
  }

  async function actionCancelar(form: FormData) {
    'use server'
    await cancelarEvento(form.get('evento_id') as string)
    redirect('/comercial/agenda')
  }

  const filtros = [
    { key: '', label: 'Todos' },
    { key: 'programado', label: 'Programados' },
    { key: 'realizado', label: 'Realizados' },
    { key: 'cancelado', label: 'Cancelados' },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Agenda</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">{eventos.length} eventos</p>
        </div>
        <Link href="/comercial/agenda/nuevo">
          <Button size="sm" className="gap-1.5"><Plus className="size-4" />Nuevo evento</Button>
        </Link>
      </div>

      <div className="flex flex-wrap gap-2">
        {filtros.map((f) => (
          <Link key={f.key} href={f.key ? `/comercial/agenda?estado=${f.key}` : '/comercial/agenda'}
            className={`rounded-md border px-3 py-1.5 text-xs font-medium transition-colors ${(sp.estado ?? '') === f.key ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:bg-accent'}`}>
            {f.label}
          </Link>
        ))}
      </div>

      {eventos.length === 0 ? (
        <EmptyState icon={CalendarDays} title="Sin eventos" description="No hay eventos en este filtro."
          action={<Link href="/comercial/agenda/nuevo"><Button size="sm">Agendar evento</Button></Link>} />
      ) : (
        <div className="space-y-3">
          {eventos.map((ev) => (
            <div key={ev.id} className="rounded-xl border border-border bg-card overflow-hidden">
              <div className="flex items-start gap-4 px-5 py-4">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <p className="font-medium text-foreground">{ev.titulo}</p>
                    <EstadoBadge estado={ev.estado} />
                    <span className="text-xs text-muted-foreground">{TIPO_EVENTO_LABEL[ev.tipo as TipoEvento] ?? ev.tipo}</span>
                  </div>
                  <p className="text-sm text-muted-foreground">{format(new Date(ev.fecha_inicio), "EEEE d 'de' MMMM yyyy · HH:mm", { locale: es })}</p>
                  {ev.resultado && <p className="mt-1 text-xs text-muted-foreground border-l-2 border-border pl-2">{ev.resultado}</p>}
                </div>
                <div className="flex shrink-0 gap-2 flex-col items-end">
                  {ev.proyecto_id && (
                    <Link href={`/comercial/proyectos/${ev.proyecto_id}`} className="text-xs text-primary hover:underline">Ver proyecto →</Link>
                  )}
                </div>
              </div>

              {ev.estado === 'programado' && (
                <div className="border-t border-border bg-muted/30 px-5 py-3">
                  <form action={actionRealizado} className="flex flex-wrap gap-2 items-end">
                    <input type="hidden" name="evento_id" value={ev.id} />
                    <input name="resultado" placeholder="Resultado de la reunión…" className="flex h-8 flex-1 min-w-40 rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" />
                    <button type="submit" className="rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700">Marcar realizado</button>
                  </form>
                  <form action={actionCancelar} className="mt-2">
                    <input type="hidden" name="evento_id" value={ev.id} />
                    <button type="submit" className="text-xs text-muted-foreground hover:text-red-500">Cancelar evento</button>
                  </form>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
