'use client'

import { Printer } from 'lucide-react'

export default function BotonImprimir() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="inline-flex items-center gap-2 rounded-[10px] bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-[background-color,transform] hover:bg-primary-hover active:scale-[0.97]"
    >
      <Printer className="size-4" strokeWidth={2} />
      Imprimir
    </button>
  )
}
