'use client'

import { Printer } from 'lucide-react'

export default function BotonImprimir() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
    >
      <Printer className="size-4" strokeWidth={2} />
      Imprimir
    </button>
  )
}
