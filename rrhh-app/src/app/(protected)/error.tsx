'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { CircleAlert, RotateCcw } from 'lucide-react'

/**
 * Límite de error de RRHH: una lectura que falla (ver `leer()` en lib/errores)
 * se muestra como error, con la barra lateral a mano, y nunca como "Todo al día".
 * Antes caía en la pantalla de Next en inglés y sin navegación.
 */
export default function ProtectedError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const router = useRouter()
  useEffect(() => console.error(error), [error])

  return (
    <div className="mx-auto max-w-6xl p-4 sm:p-6 lg:p-8">
      <div className="rounded-2xl border border-danger/30 bg-danger-subtle p-5 text-sm text-danger">
        <p className="inline-flex items-center gap-2 font-medium">
          <CircleAlert className="size-4" strokeWidth={1.75} />
          No se pudo cargar esta pantalla.
        </p>
        <p className="mt-2 text-danger/80">
          Los datos no están disponibles en este momento: lo que falta no es que «no haya nada». Probá de nuevo en unos segundos y, si sigue, avisá al administrador.
        </p>
        {error.digest && <p className="mt-1 text-xs text-danger/60">Código: {error.digest}</p>}
        <button
          onClick={() => { router.refresh(); reset() }}
          className="mt-4 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
        >
          <RotateCcw className="size-4" strokeWidth={1.75} />
          Reintentar
        </button>
      </div>
    </div>
  )
}
