'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'

export function ToggleTareaButton({ tareaId, completada }: { tareaId: string; completada: boolean }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)

  async function toggle() {
    if (busy) return
    setBusy(true)
    const res = await fetch('/api/comercial/tarea', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: tareaId, estado: completada ? 'pendiente' : 'completada' }),
    })
    setBusy(false)
    if (res.ok) router.refresh()
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={busy}
      title={completada ? 'Reabrir tarea' : 'Marcar completada'}
      className={cn(
        'flex size-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors disabled:opacity-50',
        completada
          ? 'border-emerald-500 bg-emerald-500 text-white'
          : 'border-muted-foreground/40 text-transparent hover:border-emerald-500 hover:text-emerald-500'
      )}
    >
      <Check className="size-3" strokeWidth={3} />
    </button>
  )
}
