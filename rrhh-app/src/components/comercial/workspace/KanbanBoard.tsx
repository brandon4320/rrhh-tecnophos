'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

export interface KanbanColumn { key: string; label: string }
export interface KanbanItem { id: string; col: string }

export function KanbanBoard<T extends KanbanItem>({
  columns,
  items: initial,
  renderCard,
  onMove,
  columnFooter,
}: {
  columns: KanbanColumn[]
  items: T[]
  renderCard: (item: T) => React.ReactNode
  onMove: (id: string, toCol: string) => Promise<boolean>
  columnFooter?: (items: T[]) => React.ReactNode
}) {
  const router = useRouter()
  const [items, setItems] = useState(initial)
  const [dragId, setDragId] = useState<string | null>(null)
  const [overCol, setOverCol] = useState<string | null>(null)

  // Re-sincronizar con los datos del servidor cuando llegan (tras router.refresh)
  useEffect(() => { setItems(initial) }, [initial])

  async function move(id: string, toCol: string) {
    const cur = items.find((i) => i.id === id)
    if (!cur || cur.col === toCol) return
    const prev = items
    setItems((p) => p.map((i) => (i.id === id ? { ...i, col: toCol } : i))) // optimista
    const ok = await onMove(id, toCol)
    if (!ok) {
      setItems(prev) // revertir al estado previo, no al snapshot inicial
      toast.error('No se pudo mover. Reintentá.')
      return
    }
    router.refresh()
  }

  return (
    <div className="flex gap-3 overflow-x-auto pb-3 no-scrollbar">
      {columns.map((col) => {
        const colItems = items.filter((i) => i.col === col.key)
        return (
          <div
            key={col.key}
            onDragOver={(e) => { e.preventDefault(); setOverCol(col.key) }}
            onDragLeave={() => setOverCol((c) => (c === col.key ? null : c))}
            onDrop={() => { if (dragId) move(dragId, col.key); setDragId(null); setOverCol(null) }}
            className={`flex w-64 shrink-0 flex-col rounded-xl border bg-muted/30 transition-colors ${
              overCol === col.key ? 'border-primary/60 bg-primary/5' : 'border-border'
            }`}
          >
            <div className="flex items-center justify-between border-b border-border px-3 py-2.5">
              <span className="truncate text-xs font-semibold uppercase tracking-wide text-muted-foreground">{col.label}</span>
              <span className="ml-2 shrink-0 rounded-full bg-background px-1.5 py-0.5 text-[10px] font-bold text-muted-foreground">{colItems.length}</span>
            </div>

            <div className="flex-1 space-y-2 p-2 min-h-[60px]">
              {colItems.map((item) => (
                <div
                  key={item.id}
                  draggable
                  onDragStart={() => setDragId(item.id)}
                  onDragEnd={() => { setDragId(null); setOverCol(null) }}
                  className="rounded-lg border border-border bg-card p-2.5 shadow-sm transition-shadow hover:shadow md:cursor-grab md:active:cursor-grabbing"
                >
                  {renderCard(item)}
                  <select
                    value={col.key}
                    onChange={(e) => move(item.id, e.target.value)}
                    className="mt-2 w-full rounded border border-input bg-background px-1.5 py-1 text-[11px] text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                    aria-label="Mover a…"
                  >
                    {columns.map((c) => (
                      <option key={c.key} value={c.key}>{c.key === col.key ? `• ${c.label}` : `→ ${c.label}`}</option>
                    ))}
                  </select>
                </div>
              ))}
            </div>

            {columnFooter && <div className="border-t border-border px-3 py-2">{columnFooter(colItems)}</div>}
          </div>
        )
      })}
    </div>
  )
}
