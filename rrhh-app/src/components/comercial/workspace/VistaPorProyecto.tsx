import { listarProyectos, listarTareas } from '@/modules/comercial/queries'
import type { Sesion } from '@/lib/auth/session'
import Link from 'next/link'
import { EtapaBadge } from '@/components/comercial/EtapaBadge'
import { EmpresaBadge } from '@/components/comercial/EmpresaBadge'
import { GrupoTareas, type TareaItem } from './GrupoTareas'
import { QuickAddTarea } from './QuickAddTarea'
import { FolderKanban, Inbox } from 'lucide-react'
import type { EtapaProyecto } from '@/modules/comercial/tipos'

interface Proyecto {
  id: string; titulo: string; etapa: string; empresa?: string | null; valor_estimado: number | null; moneda: string | null
}

export async function VistaPorProyecto({ sesion }: { sesion: Sesion }) {
  const [proyectos, tareas] = await Promise.all([
    listarProyectos(sesion, { estado: 'abierto' }) as Promise<Proyecto[]>,
    listarTareas(sesion, {}) as Promise<TareaItem[]>,
  ])

  const activas = tareas.filter((t) => t.estado !== 'cancelada')
  const porProyecto = new Map<string, TareaItem[]>()
  const sinProyecto: TareaItem[] = []
  for (const t of activas) {
    if (t.proyecto_id) {
      const arr = porProyecto.get(t.proyecto_id) ?? []
      arr.push(t)
      porProyecto.set(t.proyecto_id, arr)
    } else {
      sinProyecto.push(t)
    }
  }

  if (proyectos.length === 0 && sinProyecto.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border px-6 py-12 text-center">
        <FolderKanban className="mx-auto size-10 text-muted-foreground/40" strokeWidth={1.25} />
        <p className="mt-3 text-sm text-muted-foreground">No hay proyectos abiertos todavía.</p>
        <Link href="/comercial/proyectos/nuevo" className="mt-2 inline-flex text-sm text-primary hover:underline">Crear proyecto →</Link>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{proyectos.length} {proyectos.length === 1 ? 'proyecto abierto' : 'proyectos abiertos'}</p>
        <Link href="/comercial/proyectos/nuevo" className="text-xs font-medium text-primary hover:underline">+ Nuevo proyecto</Link>
      </div>

      {proyectos.map((p) => (
        <GrupoTareas
          key={p.id}
          titulo={p.titulo}
          href={`/comercial/proyectos/${p.id}`}
          tareas={porProyecto.get(p.id) ?? []}
          footer={<QuickAddTarea proyectoId={p.id} />}
          badge={
            <span className="flex shrink-0 items-center gap-1.5">
              <EtapaBadge etapa={p.etapa as EtapaProyecto} />
              {p.empresa && <EmpresaBadge empresa={p.empresa} size="xs" />}
            </span>
          }
        />
      ))}

      {sinProyecto.length > 0 && (
        <GrupoTareas
          titulo="Sin proyecto"
          tareas={sinProyecto}
          footer={<QuickAddTarea proyectoId={null} />}
          badge={<Inbox className="size-3.5 shrink-0 text-muted-foreground" strokeWidth={1.75} />}
        />
      )}
    </div>
  )
}
