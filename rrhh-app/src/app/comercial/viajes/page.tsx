import { requireModulo } from '@/lib/auth/session'
import { listarViajes } from '@/modules/comercial/queries'
import { cerrarViaje } from '@/modules/comercial/actions'
import Link from 'next/link'
import { EstadoBadge } from '@/components/comercial/EstadoBadge'
import { EmptyState } from '@/components/comercial/EmptyState'
import { Button } from '@/components/ui/button'
import { Plane, Plus } from 'lucide-react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { redirect } from 'next/navigation'

export default async function ViajesPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sesion = await requireModulo('comercial')
  const sp = await searchParams

  const viajes = await listarViajes(sesion, { estado: sp.estado })

  async function actionCerrar(form: FormData) {
    'use server'
    await cerrarViaje(form.get('viaje_id') as string, (form.get('notas') as string) || undefined)
    redirect('/comercial/viajes')
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Viajes comerciales</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">{viajes.length} viajes</p>
        </div>
        <Link href="/comercial/viajes/nuevo">
          <Button size="sm" className="gap-1.5"><Plus className="size-4" />Nuevo viaje</Button>
        </Link>
      </div>

      <div className="flex flex-wrap gap-2">
        {['planificado', 'en_curso', 'finalizado'].map((estado) => (
          <Link key={estado} href={`/comercial/viajes?estado=${estado}`}
            className={`rounded-md border px-3 py-1.5 text-xs font-medium transition-colors ${sp.estado === estado ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:bg-accent'}`}>
            {estado.charAt(0).toUpperCase() + estado.slice(1).replace('_', ' ')}
          </Link>
        ))}
      </div>

      {viajes.length === 0 ? (
        <EmptyState icon={Plane} title="Sin viajes" description="No hay viajes registrados."
          action={<Link href="/comercial/viajes/nuevo"><Button size="sm">Registrar viaje</Button></Link>} />
      ) : (
        <div className="space-y-4">
          {viajes.map((v) => (
            <div key={v.id} className="rounded-xl border border-border bg-card overflow-hidden">
              <div className="flex items-start gap-4 px-5 py-4">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <p className="font-medium text-foreground">{v.titulo}</p>
                    <EstadoBadge estado={v.estado} />
                  </div>
                  <p className="text-sm text-muted-foreground">{[v.ciudad, v.pais].filter(Boolean).join(', ')}</p>
                  {v.fecha_inicio && v.fecha_fin && (
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(v.fecha_inicio + 'T12:00:00'), "d MMM", { locale: es })} – {format(new Date(v.fecha_fin + 'T12:00:00'), "d MMM yyyy", { locale: es })}
                    </p>
                  )}
                  {v.motivo && <p className="mt-1 text-xs text-muted-foreground">{v.motivo}</p>}
                </div>
              </div>
              {(v.estado === 'planificado' || v.estado === 'en_curso') && (
                <div className="border-t border-border bg-muted/30 px-5 py-3">
                  <form action={actionCerrar} className="flex flex-wrap gap-2 items-end">
                    <input type="hidden" name="viaje_id" value={v.id} />
                    <input name="notas" placeholder="Notas de cierre del viaje (opcional)…" className="flex h-8 flex-1 min-w-40 rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" />
                    <button type="submit" className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90">Cerrar viaje</button>
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
