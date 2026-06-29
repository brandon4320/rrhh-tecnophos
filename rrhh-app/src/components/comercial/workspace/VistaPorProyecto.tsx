import { listarProyectos, listarTareas } from '@/modules/comercial/queries'
import type { Sesion } from '@/lib/auth/session'
import Link from 'next/link'
import { EtapaBadge } from '@/components/comercial/EtapaBadge'
import { EmpresaBadge } from '@/components/comercial/EmpresaBadge'
import { PriorityBadge } from '@/components/comercial/PriorityBadge'
import { QuickAddTarea } from './QuickAddTarea'
import { ToggleTareaButton } from './ToggleTareaButton'
import { ChevronDown, FolderKanban, Inbox } from 'lucide-react'
import { format } from 'date-fns'
import type { EtapaProyecto } from '@/modules/comercial/tipos'

interface Tarea {
  id: string; titulo: string; estado: string; prioridad: string
  proyecto_id: string | null; fecha_vencimiento: string | null; empresa?: string | null
}
interface Proyecto {
  id: string; titulo: string; etapa: string; empresa?: string | null; valor_estimado: number | null; moneda: string | null
}

function fmtFecha(s: string) {
  try { return format(new Date(s.slice(0, 10) + 'T12:00:00'), 'dd/MM') } catch { return '' }
}

function TareaRow({ t }: { t: Tarea }) {
  const completada = t.estado === 'completada'
  return (
    <div className="flex items-center gap-3 px-3 py-2 hover:bg-accent/40 transition-colors">
      <ToggleTareaButton tareaId={t.id} completada={completada} />
      <span className={`min-w-0 flex-1 truncate text-sm ${completada ? 'text-muted-foreground line-through' : ''}`}>
        {t.titulo}
      </span>
      <div className="flex shrink-0 items-center gap-2">
        {t.empresa && <EmpresaBadge empresa={t.empresa} size="xs" />}
        {!completada && <PriorityBadge prioridad={t.prioridad} />}
        {t.fecha_vencimiento && (
          <span className="text-[11px] text-muted-foreground tabular-nums">{fmtFecha(t.fecha_vencimiento)}</span>
        )}
      </div>
    </div>
  )
}

function Grupo({
  titulo, href, badge, tareas, proyectoId,
}: {
  titulo: string; href?: string; badge?: React.ReactNode; tareas: Tarea[]; proyectoId: string | null
}) {
  const ordenadas = [...tareas].sort((a, b) => Number(a.estado === 'completada') - Number(b.estado === 'completada'))
  const completas = tareas.filter((t) => t.estado === 'completada').length

  return (
    <details open className="group rounded-xl border border-border bg-card overflow-hidden">
      <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 hover:bg-accent/40">
        <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-0 -rotate-90" strokeWidth={2} />
        <div className="flex min-w-0 flex-1 items-center gap-2">
          {href ? (
            <Link href={href} className="truncate font-semibold hover:underline">{titulo}</Link>
          ) : (
            <span className="truncate font-semibold">{titulo}</span>
          )}
          {badge}
        </div>
        <span className="shrink-0 text-xs text-muted-foreground">
          {completas}/{tareas.length}
        </span>
      </summary>

      <div className="divide-y divide-border border-t border-border">
        {ordenadas.map((t) => <TareaRow key={t.id} t={t} />)}
        <QuickAddTarea proyectoId={proyectoId} />
      </div>
    </details>
  )
}

export async function VistaPorProyecto({ sesion }: { sesion: Sesion }) {
  const [proyectos, tareas] = await Promise.all([
    listarProyectos(sesion, { estado: 'abierto' }) as Promise<Proyecto[]>,
    listarTareas(sesion, {}) as Promise<Tarea[]>,
  ])

  const activas = tareas.filter((t) => t.estado !== 'cancelada')
  const porProyecto = new Map<string, Tarea[]>()
  const sinProyecto: Tarea[] = []
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
        <Grupo
          key={p.id}
          titulo={p.titulo}
          href={`/comercial/proyectos/${p.id}`}
          proyectoId={p.id}
          tareas={porProyecto.get(p.id) ?? []}
          badge={
            <span className="flex shrink-0 items-center gap-1.5">
              <EtapaBadge etapa={p.etapa as EtapaProyecto} />
              {p.empresa && <EmpresaBadge empresa={p.empresa} size="xs" />}
            </span>
          }
        />
      ))}

      {sinProyecto.length > 0 && (
        <Grupo
          titulo="Sin proyecto"
          proyectoId={null}
          tareas={sinProyecto}
          badge={<Inbox className="size-3.5 shrink-0 text-muted-foreground" strokeWidth={1.75} />}
        />
      )}
    </div>
  )
}
