import { requireModulo } from '@/lib/auth/session'
import { listarTareas } from '@/modules/comercial/queries'
import Link from 'next/link'
import { EstadoBadge } from '@/components/comercial/EstadoBadge'
import { PriorityBadge } from '@/components/comercial/PriorityBadge'
import { EmptyState } from '@/components/comercial/EmptyState'
import { Button } from '@/components/ui/button'
import { CheckSquare, Plus } from 'lucide-react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { TIPO_TAREA_LABEL } from '@/modules/comercial/tipos'
import type { TipoTarea } from '@/modules/comercial/tipos'

export default async function TareasPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sesion = await requireModulo('comercial')
  const sp = await searchParams
  const rango = (sp.rango as 'hoy' | 'vencidas' | 'semana') || undefined

  const tareas = await listarTareas(sesion, {
    rango,
    estado: sp.estado,
    prioridad: sp.prioridad,
  })

  const filtros = [
    { key: '', label: 'Todas' },
    { key: 'hoy', label: 'Hoy' },
    { key: 'vencidas', label: 'Vencidas' },
    { key: 'semana', label: 'Esta semana' },
  ]

  const hoy = new Date()

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Tareas</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">{tareas.length} tareas</p>
        </div>
        <Link href="/comercial/tareas/nueva">
          <Button size="sm" className="gap-1.5"><Plus className="size-4" />Nueva tarea</Button>
        </Link>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-2">
        {filtros.map((f) => (
          <Link key={f.key} href={f.key ? `/comercial/tareas?rango=${f.key}` : '/comercial/tareas'}
            className={`rounded-md border px-3 py-1.5 text-xs font-medium transition-colors ${(sp.rango ?? '') === f.key ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:bg-accent'}`}>
            {f.label}
          </Link>
        ))}
      </div>

      {tareas.length === 0 ? (
        <EmptyState icon={CheckSquare} title="Sin tareas" description="No hay tareas en este filtro."
          action={<Link href="/comercial/tareas/nueva"><Button size="sm">Nueva tarea</Button></Link>} />
      ) : (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Tarea</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Tipo</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Estado</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Prioridad</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Vencimiento</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {tareas.map((t) => {
                  const vencida = t.fecha_vencimiento && new Date(t.fecha_vencimiento) < hoy && t.estado !== 'completada'
                  return (
                    <tr key={t.id} className="hover:bg-accent/50 transition-colors">
                      <td className="px-5 py-3.5">
                        <p className="font-medium text-foreground">{t.titulo}</p>
                      </td>
                      <td className="px-4 py-3.5 text-muted-foreground text-xs">{TIPO_TAREA_LABEL[t.tipo as TipoTarea] ?? t.tipo}</td>
                      <td className="px-4 py-3.5"><EstadoBadge estado={t.estado} /></td>
                      <td className="px-4 py-3.5"><PriorityBadge prioridad={t.prioridad} /></td>
                      <td className={`px-4 py-3.5 text-xs ${vencida ? 'text-red-500 font-medium' : 'text-muted-foreground'}`}>
                        {t.fecha_vencimiento ? format(new Date(t.fecha_vencimiento), "d MMM · HH:mm", { locale: es }) : '—'}
                        {vencida ? ' · VENCIDA' : ''}
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        {t.proyecto_id && <Link href={`/comercial/proyectos/${t.proyecto_id}`} className="text-xs text-primary hover:underline">Ver proyecto →</Link>}
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
