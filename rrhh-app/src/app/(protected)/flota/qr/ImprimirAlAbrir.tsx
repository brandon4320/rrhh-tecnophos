'use client'

import { useEffect } from 'react'

/** Abre el diálogo de impresión apenas carga la hoja (botón "QR" de cada fila en Flota). */
export default function ImprimirAlAbrir() {
  useEffect(() => {
    const t = setTimeout(() => window.print(), 300)
    return () => clearTimeout(t)
  }, [])
  return null
}
