'use client'

import { KanbanBoard, type KanbanColumn } from './KanbanBoard'
import { EmpresaBadge } from '@/components/comercial/EmpresaBadge'
import { PriorityBadge } from '@/components/comercial/PriorityBadge'
import { fmtFechaHoraAR } from '@/modules/comercial/fechas'

interface Tarea {
  id: string; col: string; titulo: string; prioridad: string
  fecha_vencimiento: string | null; empresa?: string | null
}

// Columnas del tablero de tareas (sin "cancelada")
const columns: KanbanColumn[] = [
  { key: 'pendiente',           label: 'Pendiente' },
  { key: 'en_proceso',          label: 'En proceso' },
  { key: 'esperando_respuesta', label: 'Esperando' },
  { key: 'bloqueada',           label: 'Bloqueada' },
  { key: 'completada',          label: 'Hecho' },
]

export function TableroTareas({ tareas }: { tareas: Tarea[] }) {
  async function onMove(id: string, estado: string) {
    const res = await fetch('/api/comercial/tarea', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, estado }),
    })
    return res.ok
  }

  return (
    <KanbanBoard
      columns={columns}
      items={tareas}
      onMove={onMove}
      renderCard={(t) => (
        <div className="space-y-1.5">
          <p className={`text-sm font-medium leading-snug ${t.col === 'completada' ? 'text-muted-foreground line-through' : ''}`}>
            {t.titulo}
          </p>
          <div className="flex flex-wrap items-center gap-1.5">
            {t.empresa && <EmpresaBadge empresa={t.empresa} size="xs" />}
            {t.col !== 'completada' && <PriorityBadge prioridad={t.prioridad} />}
            {t.fecha_vencimiento && (
              <span className="text-[10px] text-muted-foreground tabular-nums">{fmtFechaHoraAR(t.fecha_vencimiento)}</span>
            )}
          </div>
        </div>
      )}
    />
  )
}
