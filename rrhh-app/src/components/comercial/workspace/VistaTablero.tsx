import { listarProyectos, listarTareas } from '@/modules/comercial/queries'
import type { Sesion } from '@/lib/auth/session'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { TableroProyectos } from './TableroProyectos'
import { TableroTareas } from './TableroTareas'

interface ProyectoRow {
  id: string; titulo: string; etapa: string; estado: string; prioridad: string
  valor_estimado: number | null; moneda: string | null; probabilidad: number | null; empresa?: string | null
}
interface TareaRow {
  id: string; titulo: string; estado: string; prioridad: string; fecha_vencimiento: string | null; empresa?: string | null
}

export async function VistaTablero({ sesion, tablero }: { sesion: Sesion; tablero: string }) {
  const activo = tablero === 'tareas' ? 'tareas' : 'proyectos'

  return (
    <div className="space-y-4">
      <div className="inline-flex rounded-lg border border-border bg-muted/40 p-0.5 text-sm">
        <Link href="/comercial?vista=tablero&tablero=proyectos"
          className={cn('rounded-md px-3 py-1.5 font-medium transition-colors',
            activo === 'proyectos' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground')}>
          Pipeline de proyectos
        </Link>
        <Link href="/comercial?vista=tablero&tablero=tareas"
          className={cn('rounded-md px-3 py-1.5 font-medium transition-colors',
            activo === 'tareas' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground')}>
          Tablero de tareas
        </Link>
      </div>

      {activo === 'proyectos' ? <BoardProyectos sesion={sesion} /> : <BoardTareas sesion={sesion} />}

      <p className="text-[11px] text-muted-foreground">
        Arrastrá las tarjetas entre columnas (o usá el selector de cada tarjeta en el celular).
      </p>
    </div>
  )
}

async function BoardProyectos({ sesion }: { sesion: Sesion }) {
  const proyectos = (await listarProyectos(sesion, {})) as ProyectoRow[]
  const items = proyectos
    .filter((p) => p.estado !== 'cancelado')
    .map((p) => ({
      id: p.id, col: p.etapa, titulo: p.titulo, prioridad: p.prioridad,
      valor_estimado: p.valor_estimado, moneda: p.moneda, probabilidad: p.probabilidad, empresa: p.empresa ?? null,
    }))
  if (items.length === 0) {
    return <p className="rounded-xl border border-dashed border-border px-6 py-10 text-center text-sm text-muted-foreground">No hay proyectos para mostrar.</p>
  }
  return <TableroProyectos proyectos={items} />
}

async function BoardTareas({ sesion }: { sesion: Sesion }) {
  const tareas = (await listarTareas(sesion, {})) as TareaRow[]
  const items = tareas
    .filter((t) => t.estado !== 'cancelada')
    .map((t) => ({
      id: t.id, col: t.estado, titulo: t.titulo, prioridad: t.prioridad,
      fecha_vencimiento: t.fecha_vencimiento, empresa: t.empresa ?? null,
    }))
  if (items.length === 0) {
    return <p className="rounded-xl border border-dashed border-border px-6 py-10 text-center text-sm text-muted-foreground">No hay tareas para mostrar.</p>
  }
  return <TableroTareas tareas={items} />
}
