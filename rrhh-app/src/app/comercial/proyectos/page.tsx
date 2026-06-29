import { requireModulo } from '@/lib/auth/session'
import { listarProyectos } from '@/modules/comercial/queries'
import { tieneRol, COMERCIAL_GESTION } from '@/lib/auth/roles'
import Link from 'next/link'
import { EtapaBadge } from '@/components/comercial/EtapaBadge'
import { EstadoBadge } from '@/components/comercial/EstadoBadge'
import { PriorityBadge } from '@/components/comercial/PriorityBadge'
import { EmptyState } from '@/components/comercial/EmptyState'
import { Button } from '@/components/ui/button'
import { FolderKanban, Plus, AlertTriangle } from 'lucide-react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import type { EtapaProyecto, EstadoProyecto } from '@/modules/comercial/tipos'

export default async function ProyectosPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sesion = await requireModulo('comercial')
  const sp = await searchParams
  const esGestion = tieneRol(sesion.rol, COMERCIAL_GESTION)

  const proyectos = await listarProyectos(sesion, {
    estado: sp.estado ?? 'abierto',
    etapa: sp.etapa,
    prioridad: sp.prioridad,
  })

  const hoy = new Date().toISOString().substring(0, 10)
  const hace7 = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

  function alertas(p: typeof proyectos[0]) {
    const items: string[] = []
    if (!p.proxima_accion) items.push('Sin próxima acción')
    if (p.proxima_accion_fecha && p.proxima_accion_fecha < hoy) items.push('Acción vencida')
    if (!p.ultima_actividad_at || p.ultima_actividad_at < hace7) items.push('Sin movimiento +7d')
    return items
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Proyectos</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">{proyectos.length} proyectos · {sp.estado ?? 'abiertos'}</p>
        </div>
        <Link href="/comercial/proyectos/nuevo">
          <Button size="sm" className="gap-1.5"><Plus className="size-4" />Nuevo proyecto</Button>
        </Link>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-2">
        {['abierto', 'ganado', 'perdido', 'pausado'].map((estado) => (
          <Link key={estado} href={`/comercial/proyectos?estado=${estado}`}
            className={`rounded-md border px-3 py-1.5 text-xs font-medium transition-colors ${(sp.estado ?? 'abierto') === estado ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:bg-accent'}`}>
            {estado.charAt(0).toUpperCase() + estado.slice(1)}
          </Link>
        ))}
      </div>

      {proyectos.length === 0 ? (
        <EmptyState icon={FolderKanban} title="Sin proyectos" description="No hay proyectos en este estado."
          action={<Link href="/comercial/proyectos/nuevo"><Button size="sm">Crear proyecto</Button></Link>} />
      ) : (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Proyecto</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Etapa</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Prioridad</th>
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wide text-muted-foreground">Valor est.</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Próxima acción</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Alertas</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {proyectos.map((p) => {
                  const warns = alertas(p)
                  return (
                    <tr key={p.id} className="hover:bg-accent/50 transition-colors">
                      <td className="px-5 py-3.5">
                        <Link href={`/comercial/proyectos/${p.id}`} className="font-medium text-foreground hover:text-primary">{p.titulo}</Link>
                        {p.codigo && <p className="text-xs text-muted-foreground">{p.codigo}</p>}
                      </td>
                      <td className="px-4 py-3.5"><EtapaBadge etapa={p.etapa as EtapaProyecto} /></td>
                      <td className="px-4 py-3.5"><PriorityBadge prioridad={p.prioridad} /></td>
                      <td className="px-4 py-3.5 text-right font-mono text-sm">
                        {p.valor_estimado ? `${p.moneda ?? 'ARS'} ${p.valor_estimado.toLocaleString('es-AR')}` : '—'}
                      </td>
                      <td className="px-4 py-3.5">
                        {p.proxima_accion ? (
                          <div>
                            <p className="text-xs line-clamp-1 text-foreground">{p.proxima_accion}</p>
                            {p.proxima_accion_fecha && (
                              <p className={`text-xs ${p.proxima_accion_fecha < hoy ? 'text-red-500' : 'text-muted-foreground'}`}>
                                {format(new Date(p.proxima_accion_fecha + 'T12:00:00'), 'd MMM', { locale: es })}
                              </p>
                            )}
                          </div>
                        ) : <span className="text-xs text-amber-500">Sin definir</span>}
                      </td>
                      <td className="px-4 py-3.5">
                        {warns.length > 0 && (
                          <div className="flex items-center gap-1 text-amber-500">
                            <AlertTriangle className="size-3.5 shrink-0" />
                            <span className="text-xs">{warns[0]}</span>
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        <Link href={`/comercial/proyectos/${p.id}`} className="text-xs font-medium text-primary hover:underline">Ver →</Link>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
