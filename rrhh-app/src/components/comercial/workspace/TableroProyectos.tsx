'use client'

import Link from 'next/link'
import { KanbanBoard, type KanbanColumn } from './KanbanBoard'
import { EmpresaBadge } from '@/components/comercial/EmpresaBadge'
import { PriorityBadge } from '@/components/comercial/PriorityBadge'
import { ETAPAS_PROYECTO, ETAPA_LABEL } from '@/modules/comercial/tipos'

interface Proyecto {
  id: string; col: string; titulo: string; prioridad: string
  valor_estimado: number | null; moneda: string | null; probabilidad: number | null
  empresa?: string | null
}

const columns: KanbanColumn[] = ETAPAS_PROYECTO.map((e) => ({ key: e, label: ETAPA_LABEL[e] }))

function fmtMonto(v: number | null, moneda: string | null) {
  if (!v) return null
  try {
    return new Intl.NumberFormat('es-AR', { style: 'currency', currency: moneda || 'USD', maximumFractionDigits: 0 }).format(v)
  } catch {
    return `${moneda || 'USD'} ${v.toLocaleString('es-AR')}`
  }
}

export function TableroProyectos({ proyectos }: { proyectos: Proyecto[] }) {
  async function onMove(id: string, etapa: string) {
    const res = await fetch('/api/comercial/proyecto', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, etapa }),
    })
    return res.ok
  }

  return (
    <KanbanBoard
      columns={columns}
      items={proyectos}
      onMove={onMove}
      renderCard={(p) => (
        <div className="space-y-1.5">
          <Link href={`/comercial/proyectos/${p.id}`} className="block text-sm font-medium leading-snug hover:underline">
            {p.titulo}
          </Link>
          <div className="flex flex-wrap items-center gap-1.5">
            {p.empresa && <EmpresaBadge empresa={p.empresa} size="xs" />}
            <PriorityBadge prioridad={p.prioridad} />
            {p.probabilidad != null && (
              <span className="text-[10px] font-medium text-muted-foreground">{p.probabilidad}%</span>
            )}
          </div>
          {fmtMonto(p.valor_estimado, p.moneda) && (
            <p className="text-xs font-semibold tabular-nums text-foreground">{fmtMonto(p.valor_estimado, p.moneda)}</p>
          )}
        </div>
      )}
      columnFooter={(items) => {
        const total = items.reduce((s, p) => s + (p.valor_estimado ?? 0), 0)
        return (
          <p className="text-[10px] text-muted-foreground tabular-nums">
            {total > 0 ? `Σ ${total.toLocaleString('es-AR')}` : '—'}
          </p>
        )
      }}
    />
  )
}
