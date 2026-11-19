'use client'

import { useEffect, useRef, useSyncExternalStore, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { X } from '@phosphor-icons/react'
import { cn } from '@/lib/utils'

const sinSuscripcion = () => () => {}

/**
 * Hoja lateral de la skill (demo aprobada): en escritorio entra desde la derecha (460 px,
 * a 8 px de los bordes) sobre un velo suave; en celular sube desde abajo (92 dvh).
 * Esc y el velo la cierran, el foco queda adentro mientras está abierta y vuelve a donde
 * estaba al cerrarse. Mientras hay una hoja abierta, el botón principal de la pantalla pasa
 * a borde (body[data-capa]): nunca dos rellenos a la vista.
 */
export function Hoja({
  abierta,
  onCerrar,
  etiqueta,
  ancho = 460,
  children,
  className,
}: {
  abierta: boolean
  onCerrar: () => void
  /** id del título (aria-labelledby) o texto (aria-label). */
  etiqueta: { id: string } | { texto: string }
  ancho?: number
  children: ReactNode
  className?: string
}) {
  const montado = useSyncExternalStore(sinSuscripcion, () => true, () => false)
  const ref = useRef<HTMLElement>(null)
  const foco = useRef<Element | null>(null)
  const cerrar = useRef(onCerrar)
  useEffect(() => { cerrar.current = onCerrar })

  useEffect(() => {
    if (!abierta) return
    foco.current = document.activeElement
    document.body.dataset.capa = '1'
    const movil = window.matchMedia('(max-width: 767px)').matches
    if (movil) document.body.style.overflow = 'hidden'
    const t = window.setTimeout(() => {
      const primero = ref.current?.querySelector<HTMLElement>('[autofocus],[data-autofocus]') ?? ref.current
      primero?.focus({ preventScroll: true })
    }, 60)
    function teclado(e: KeyboardEvent) {
      if (e.key === 'Escape' && !document.querySelector('[data-menu-abierto]')) {
        e.preventDefault()
        cerrar.current()
      }
      if (e.key === 'Tab' && ref.current) {
        const f = [...ref.current.querySelectorAll<HTMLElement>('button, a[href], input, select, textarea, [tabindex]:not([tabindex="-1"])')].filter((x) => x.offsetParent && !x.hasAttribute('disabled'))
        if (!f.length) return
        if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f.at(-1)!.focus() }
        else if (!e.shiftKey && document.activeElement === f.at(-1)) { e.preventDefault(); f[0].focus() }
      }
    }
    document.addEventListener('keydown', teclado)
    return () => {
      window.clearTimeout(t)
      document.removeEventListener('keydown', teclado)
      delete document.body.dataset.capa
      document.body.style.overflow = ''
      const f = foco.current as HTMLElement | null
      f?.focus?.({ preventScroll: true })
    }
  }, [abierta])

  if (!montado) return null
  return createPortal(
    <>
      <div
        aria-hidden
        onClick={onCerrar}
        className={cn('fixed inset-0 z-[45] bg-[rgb(10_9_15/0.18)] transition-opacity duration-200', abierta ? 'opacity-100' : 'pointer-events-none opacity-0')}
      />
      <aside
        ref={ref}
        role="dialog"
        aria-modal="true"
        tabIndex={-1}
        inert={!abierta}
        {...('id' in etiqueta ? { 'aria-labelledby': etiqueta.id } : { 'aria-label': etiqueta.texto })}
        style={{ '--ancho-hoja': `${ancho}px` } as React.CSSProperties}
        className={cn(
          'fixed z-50 flex flex-col overflow-hidden border border-border bg-card shadow-flotante outline-none',
          'inset-x-0 bottom-0 h-[92dvh] rounded-t-[24px] border-b-0',
          'md:inset-x-auto md:top-2 md:right-2 md:bottom-2 md:h-auto md:w-[var(--ancho-hoja)] md:max-w-[calc(100vw-16px)] md:rounded-2xl md:border-b',
          'transition-[transform,visibility] duration-300 ease-out',
          abierta ? 'visible translate-x-0 translate-y-0' : 'invisible translate-y-full md:translate-x-[calc(100%+24px)] md:translate-y-0',
          className
        )}
      >
        <span aria-hidden className="absolute top-1.5 left-1/2 h-1 w-10 -translate-x-1/2 rounded-full bg-border-strong md:hidden" />
        {abierta ? children : null}
      </aside>
    </>,
    document.body
  )
}

/** Cabecera de la hoja: tile o avatar, rótulo chico arriba, título y botones a la derecha. */
export function HojaCabecera({
  tile,
  rotulo,
  titulo,
  tituloId,
  onCerrar,
  children,
}: {
  tile?: ReactNode
  rotulo?: ReactNode
  titulo: ReactNode
  tituloId: string
  onCerrar: () => void
  /** Botones extra (anterior/siguiente, ⋯) antes de la X. */
  children?: ReactNode
}) {
  return (
    <div className="relative flex items-center gap-3 border-b border-divisor px-4 pt-5 pb-3 md:pt-4 md:pr-4 md:pl-5">
      {tile}
      <div className="min-w-0 flex-1">
        {rotulo && <small className="block truncate text-xs leading-[1.3] text-muted-foreground">{rotulo}</small>}
        <h3 id={tituloId} className="truncate text-xl leading-tight font-medium tracking-[-0.015em]">{titulo}</h3>
      </div>
      <div className="flex gap-1">
        {children}
        <BotonIcono etiqueta="Cerrar" onClick={onCerrar} borde>
          <X size={17} />
        </BotonIcono>
      </div>
    </div>
  )
}

/** Botón cuadrado de 36 px (44 en celular) con solo un ícono: siempre lleva nombre. */
export function BotonIcono({
  etiqueta,
  onClick,
  children,
  borde = false,
  className,
  ...resto
}: {
  etiqueta: string
  onClick?: () => void
  children: ReactNode
  /** Con borde y fondo (cerrar); sin borde, fantasma. */
  borde?: boolean
  className?: string
} & Omit<React.ComponentProps<'button'>, 'onClick' | 'children'>) {
  return (
    <button
      type="button"
      aria-label={etiqueta}
      title={etiqueta}
      onClick={onClick}
      className={cn(
        'relative grid size-11 shrink-0 cursor-pointer place-items-center rounded-xl transition-colors md:size-9',
        borde
          ? 'border border-border bg-card text-texto-2 shadow-min hover:bg-hover hover:text-foreground'
          : 'text-muted-foreground hover:bg-muted hover:text-foreground',
        className
      )}
      {...resto}
    >
      {children}
    </button>
  )
}
