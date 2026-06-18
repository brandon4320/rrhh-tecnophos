'use client'

import { useState } from 'react'
import { Plus, X } from 'lucide-react'

interface Props {
  miembroId: string
  miembroNombre: string | null
}

export function AsignarTareaRapida({ miembroId, miembroNombre }: Props) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    const form = new FormData(e.currentTarget)
    await fetch('/api/comercial/tarea-rapida', { method: 'POST', body: form })
    setLoading(false)
    setOpen(false)
    window.location.reload()
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition-colors">
        <Plus className="size-3.5" strokeWidth={2.5} />
        Asignar tarea
      </button>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="w-full space-y-2 border-t border-border bg-muted/30 px-4 py-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-foreground">Asignar tarea a {miembroNombre ?? 'comercial'}</p>
        <button type="button" onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground">
          <X className="size-4" />
        </button>
      </div>
      <input type="hidden" name="responsable_id" value={miembroId} />
      <input
        name="titulo"
        required
        placeholder="¿Qué tiene que hacer?"
        autoFocus
        className="w-full rounded-md border border-input bg-card px-3 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
      />
      <div className="flex gap-2">
        <input
          type="datetime-local"
          name="fecha_vencimiento"
          className="flex-1 rounded-md border border-input bg-card px-2 py-1.5 text-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        />
        <select name="prioridad" defaultValue="media" className="rounded-md border border-input bg-card px-2 py-1.5 text-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
          <option value="baja">Baja</option>
          <option value="media">Media</option>
          <option value="alta">Alta</option>
          <option value="urgente">Urgente</option>
        </select>
      </div>
      <input
        name="nota_asignacion"
        placeholder="Nota para el comercial (opcional)…"
        className="w-full rounded-md border border-input bg-card px-3 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
      />
      <div className="flex justify-end gap-2">
        <button type="button" onClick={() => setOpen(false)} className="text-xs text-muted-foreground hover:text-foreground px-2 py-1">Cancelar</button>
        <button type="submit" disabled={loading}
          className="rounded-md bg-primary px-4 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
          {loading ? 'Asignando…' : 'Asignar'}
        </button>
      </div>
    </form>
  )
}
