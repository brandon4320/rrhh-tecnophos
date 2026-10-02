'use client'

import { useCallback, useEffect, useRef, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { RefreshCw } from 'lucide-react'
import { fmtHoraAR } from '@/lib/fechas-ar'
import { cn } from '@/lib/utils'

/** Cada cuánto se vuelve a pedir la página mientras la pestaña está a la vista. */
const CADA_MS = 2 * 60 * 1000
/** Al volver a la pestaña, no refrescar si la última lectura tiene menos de esto. */
const FRESCO_MS = 30 * 1000

/**
 * Mantiene al día un tablero de observabilidad que queda abierto en una pestaña:
 * router.refresh() cada 2 minutos (solo con la pestaña visible) y al volver a ella.
 * Muestra la hora del render del server (`generado`), así "actualizado 14:32" dice
 * de cuándo son los datos, no cuándo se tocó el botón. Tocarlo refresca ya.
 */
export function AutoRefresh({ generado, className }: { generado: string; className?: string }) {
  const router = useRouter()
  const [refrescando, startTransition] = useTransition()
  const ultimo = useRef(0)

  // Cada render nuevo del server (prop distinta) cuenta como lectura fresca.
  useEffect(() => {
    ultimo.current = Date.now()
  }, [generado])

  const refrescar = useCallback(() => {
    ultimo.current = Date.now()
    startTransition(() => router.refresh())
  }, [router])

  useEffect(() => {
    const id = window.setInterval(() => {
      if (document.visibilityState === 'visible') refrescar()
    }, CADA_MS)
    const alVolver = () => {
      if (document.visibilityState === 'visible' && Date.now() - ultimo.current > FRESCO_MS) refrescar()
    }
    document.addEventListener('visibilitychange', alVolver)
    return () => {
      window.clearInterval(id)
      document.removeEventListener('visibilitychange', alVolver)
    }
  }, [refrescar])

  return (
    <button
      type="button"
      onClick={refrescar}
      disabled={refrescando}
      title="Se actualiza solo cada 2 minutos. Tocá para actualizar ahora."
      className={cn(
        'inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-70',
        className
      )}
    >
      <RefreshCw className={cn('size-3.5', refrescando && 'animate-spin')} strokeWidth={1.75} />
      {refrescando ? 'Actualizando…' : `Actualizado ${fmtHoraAR(generado)}`}
    </button>
  )
}
