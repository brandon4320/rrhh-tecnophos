'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus } from 'lucide-react'

export function QuickAddTarea({ proyectoId, placeholder }: { proyectoId: string | null; placeholder?: string }) {
  const router = useRouter()
  const [titulo, setTitulo] = useState('')
  const [saving, setSaving] = useState(false)

  async function add() {
    const t = titulo.trim()
    if (!t || saving) return
    setSaving(true)
    const res = await fetch('/api/comercial/tarea', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ titulo: t, proyecto_id: proyectoId }),
    })
    setSaving(false)
    if (res.ok) {
      setTitulo('')
      router.refresh()
    }
  }

  return (
    <div className="flex items-center gap-2 px-3 py-2">
      <Plus className="size-4 shrink-0 text-muted-foreground/60" strokeWidth={2} />
      <input
        value={titulo}
        onChange={(e) => setTitulo(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') add() }}
        onBlur={add}
        disabled={saving}
        placeholder={placeholder ?? 'Nueva tarea…'}
        className="flex-1 bg-transparent text-sm placeholder:text-muted-foreground/60 focus:outline-none disabled:opacity-50"
      />
    </div>
  )
}
