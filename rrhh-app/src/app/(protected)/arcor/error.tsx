'use client'

import { CircleAlert, RotateCcw } from 'lucide-react'

/**
 * Límite de error de la sección ARCOR. Las lecturas (modules/arcor/queries.ts)
 * lanzan si Supabase falla: en un tablero de observabilidad, "no pude leer" tiene
 * que verse como error, nunca como "0 contenedores, sin alertas".
 */
export default function ArcorError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="mx-auto max-w-6xl p-4 sm:p-6 lg:p-8">
      <h1 className="text-2xl font-semibold tracking-tight">Tecnophos - ARCOR</h1>
      <div className="mt-6 rounded-2xl border border-danger/30 bg-danger-subtle p-5 text-sm text-danger">
        <p className="inline-flex items-center gap-2 font-medium">
          <CircleAlert className="size-4" strokeWidth={2} />
          No se pudo leer el estado del sistema ARCOR.
        </p>
        <p className="mt-2 text-danger/80">
          Los datos no están disponibles en este momento; lo que ves no es que «no haya nada». Detalle técnico: {error.message}
        </p>
        <button
          onClick={reset}
          className="mt-4 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
        >
          <RotateCcw className="size-4" strokeWidth={2} />
          Reintentar
        </button>
      </div>
    </div>
  )
}
