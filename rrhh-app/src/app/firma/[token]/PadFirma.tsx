'use client'

import { useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { Eraser } from 'lucide-react'

/**
 * Donde la persona firma con el dedo.
 *
 * Dos decisiones que no son de estilo:
 *
 *  · **La tinta es un color fijo, no un token del tema.** Lo que se dibuja acá
 *    termina estampado sobre un recibo en papel blanco: si siguiera al modo
 *    oscuro de la app, la firma saldría clara y en el PDF no se vería. El
 *    recuadro también es blanco siempre, por lo mismo: es papel, no interfaz.
 *  · **Se recorta a lo dibujado.** El PNG sale del rectángulo que ocupa el
 *    trazo y no del lienzo entero. Si saliera entero, una firma chica en el
 *    medio de un lienzo grande se achicaría todavía más al entrar en el
 *    recuadro del recibo y quedaría ilegible.
 */

/** Azul tinta. No es un token a propósito (ver arriba). */
const TINTA = '#1b2a5e'
const GROSOR = 2.6
/** Aire alrededor del trazo, en píxeles de pantalla. */
const AIRE = 8
/** Menos que esto no es una firma, es un toque sin querer. */
const MINIMO_TRAZO = 24

export interface PadFirmaHandle {
  /** El PNG recortado al trazo, o null si no hay firma válida. */
  exportar: () => string | null
  borrar: () => void
}

interface Limites {
  x0: number
  y0: number
  x1: number
  y1: number
}

export default function PadFirma({
  ref,
  onCambio,
}: {
  ref?: React.Ref<PadFirmaHandle>
  /** Avisa si hay algo dibujado, para habilitar el botón de firmar. */
  onCambio?: (hayTrazo: boolean) => void
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const dibujando = useRef(false)
  const limites = useRef<Limites | null>(null)
  const dpr = useRef(1)
  const [hayTrazo, setHayTrazo] = useState(false)

  /**
   * El lienzo se dimensiona en píxeles de verdad y no en píxeles CSS: en un
   * celular con pantalla densa, un canvas sin esto sale borroso.
   *
   * Redimensionar BORRA el contenido del canvas, así que solo se toca cuando
   * el tamaño cambió de verdad: si no, girar el teléfono mientras alguien
   * firma le borraría la firma.
   */
  const medir = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const caja = canvas.getBoundingClientRect()
    const escala = Math.min(window.devicePixelRatio || 1, 3)
    const ancho = Math.round(caja.width * escala)
    const alto = Math.round(caja.height * escala)
    if (canvas.width === ancho && canvas.height === alto) return
    canvas.width = ancho
    canvas.height = alto
    dpr.current = escala
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.setTransform(escala, 0, 0, escala, 0, 0)
    ctx.lineWidth = GROSOR
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.strokeStyle = TINTA
  }, [])

  useEffect(() => {
    medir()
    window.addEventListener('resize', medir)
    return () => window.removeEventListener('resize', medir)
  }, [medir])

  function limpiar() {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    ctx.save()
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.restore()
    limites.current = null
    setHayTrazo(false)
    onCambio?.(false)
  }

  useImperativeHandle(ref, () => ({
    borrar: limpiar,
    exportar() {
      const canvas = canvasRef.current
      const l = limites.current
      if (!canvas || !l) return null
      // Un punto suelto no es una firma.
      if (l.x1 - l.x0 < MINIMO_TRAZO && l.y1 - l.y0 < MINIMO_TRAZO) return null

      const e = dpr.current
      const x = Math.max(0, Math.floor((l.x0 - AIRE) * e))
      const y = Math.max(0, Math.floor((l.y0 - AIRE) * e))
      const ancho = Math.min(canvas.width - x, Math.ceil((l.x1 - l.x0 + AIRE * 2) * e))
      const alto = Math.min(canvas.height - y, Math.ceil((l.y1 - l.y0 + AIRE * 2) * e))
      if (ancho <= 0 || alto <= 0) return null

      const recorte = document.createElement('canvas')
      recorte.width = ancho
      recorte.height = alto
      const ctx = recorte.getContext('2d')
      if (!ctx) return null
      ctx.drawImage(canvas, x, y, ancho, alto, 0, 0, ancho, alto)
      // PNG y no JPEG: hace falta el fondo transparente para que la firma se
      // apoye sobre el recibo en vez de taparlo con un rectángulo blanco.
      return recorte.toDataURL('image/png')
    },
  }))

  function punto(e: React.PointerEvent<HTMLCanvasElement>) {
    const caja = e.currentTarget.getBoundingClientRect()
    return { x: e.clientX - caja.left, y: e.clientY - caja.top }
  }

  function anotar(x: number, y: number) {
    const l = limites.current
    limites.current = l
      ? { x0: Math.min(l.x0, x), y0: Math.min(l.y0, y), x1: Math.max(l.x1, x), y1: Math.max(l.y1, y) }
      : { x0: x, y0: y, x1: x, y1: y }
  }

  function empezar(e: React.PointerEvent<HTMLCanvasElement>) {
    const ctx = canvasRef.current?.getContext('2d')
    if (!ctx) return
    e.preventDefault()
    e.currentTarget.setPointerCapture(e.pointerId)
    dibujando.current = true
    const p = punto(e)
    anotar(p.x, p.y)
    ctx.beginPath()
    ctx.moveTo(p.x, p.y)
    // Un toque sin arrastrar también deja marca: hay firmas con puntos.
    ctx.lineTo(p.x + 0.01, p.y)
    ctx.stroke()
    if (!hayTrazo) {
      setHayTrazo(true)
      onCambio?.(true)
    }
  }

  function seguir(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!dibujando.current) return
    const ctx = canvasRef.current?.getContext('2d')
    if (!ctx) return
    const p = punto(e)
    anotar(p.x, p.y)
    ctx.lineTo(p.x, p.y)
    ctx.stroke()
  }

  function terminar() {
    dibujando.current = false
  }

  return (
    <div className="space-y-2">
      <div className="relative overflow-hidden rounded-[10px] border border-input bg-white">
        <canvas
          ref={canvasRef}
          onPointerDown={empezar}
          onPointerMove={seguir}
          onPointerUp={terminar}
          onPointerLeave={terminar}
          onPointerCancel={terminar}
          aria-label="Firmá con el dedo"
          className="block h-44 w-full touch-none"
        />
        <span className="pointer-events-none absolute inset-x-6 bottom-8 border-b border-dashed border-neutral-300" />
        {!hayTrazo && (
          <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-neutral-400">
            Firmá acá con el dedo
          </span>
        )}
      </div>
      <button
        type="button"
        onClick={limpiar}
        disabled={!hayTrazo}
        className="inline-flex min-h-9 items-center gap-1.5 rounded-[10px] border border-border-strong bg-card px-3 text-xs font-medium hover:bg-muted disabled:opacity-40"
      >
        <Eraser className="size-3.5" strokeWidth={1.75} />
        Borrar y hacerla de nuevo
      </button>
    </div>
  )
}
