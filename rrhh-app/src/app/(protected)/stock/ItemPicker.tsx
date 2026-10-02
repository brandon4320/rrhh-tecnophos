'use client'

import { useId, useMemo, useState, type KeyboardEvent } from 'react'
import clsx from 'clsx'
import type { EstadoVencimiento } from '@/types'
import { coincide } from '@/lib/texto'
import { fmtCantidad } from '@/modules/stock/reglas'
import { colorStock, inputCls } from './estilos'

export interface OpcionItem {
  id: string
  nombre: string
  categoria: string | null
  unidad: string
  stock: number
  estado: EstadoVencimiento
}

const MAX_OPCIONES = 60

/**
 * Selector de ítem con búsqueda por palabras ("camisa 44" encuentra "Camisa ADC T 44").
 * Teclado: ↑/↓ para moverse, Enter o Tab para elegir, Esc para cerrar la lista
 * (sin cerrar el panel). Siempre devuelve el id de un ítem REAL.
 */
export function ItemPicker({
  opciones,
  value,
  onChange,
  inputRef,
  autoFocus,
  placeholder = 'Buscá un ítem…',
  ariaLabel = 'Ítem',
}: {
  opciones: OpcionItem[]
  value: string
  onChange: (id: string) => void
  inputRef?: (el: HTMLInputElement | null) => void
  autoFocus?: boolean
  placeholder?: string
  ariaLabel?: string
}) {
  const listId = useId()
  const [abierto, setAbierto] = useState(false)
  const [q, setQ] = useState('')
  const [resaltado, setResaltado] = useState(0)

  const elegido = useMemo(() => opciones.find((o) => o.id === value), [opciones, value])
  const filtradas = useMemo(
    () => (abierto ? opciones.filter((o) => coincide(q, o.nombre, o.categoria)).slice(0, MAX_OPCIONES) : []),
    [abierto, opciones, q]
  )
  const idx = Math.min(resaltado, filtradas.length - 1)

  function elegir(o: OpcionItem) {
    setAbierto(false)
    setQ('')
    onChange(o.id)
  }

  function mover(delta: number) {
    const n = Math.max(0, Math.min(idx + delta, filtradas.length - 1))
    setResaltado(n)
    requestAnimationFrame(() => document.getElementById(`${listId}-${n}`)?.scrollIntoView({ block: 'nearest' }))
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (!abierto) setAbierto(true)
      else mover(1)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      mover(-1)
    } else if (e.key === 'Enter' && !e.metaKey && !e.ctrlKey) {
      // Enter nunca envía el formulario desde acá: elige (o no hace nada).
      e.preventDefault()
      if (abierto && filtradas[idx]) elegir(filtradas[idx])
      else setAbierto(true)
    } else if (e.key === 'Escape') {
      if (abierto) {
        e.stopPropagation()
        setAbierto(false)
        setQ('')
      }
    } else if (e.key === 'Tab') {
      if (abierto && q.trim() && filtradas[idx]) elegir(filtradas[idx])
      else setAbierto(false)
    }
  }

  return (
    <div className="relative">
      <input
        ref={inputRef}
        type="text"
        role="combobox"
        aria-label={ariaLabel}
        aria-expanded={abierto}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={abierto && filtradas[idx] ? `${listId}-${idx}` : undefined}
        autoComplete="off"
        autoFocus={autoFocus}
        value={abierto ? q : (elegido?.nombre ?? '')}
        placeholder={elegido?.nombre ?? placeholder}
        onChange={(e) => {
          setQ(e.target.value)
          setResaltado(0)
          setAbierto(true)
        }}
        onFocus={() => { if (!value) setAbierto(true) }}
        onClick={() => setAbierto(true)}
        onBlur={() => { setAbierto(false); setQ('') }}
        onKeyDown={onKeyDown}
        className={clsx(inputCls, elegido && !abierto && 'font-medium')}
      />
      {abierto && (
        <ul
          id={listId}
          role="listbox"
          // mousedown sin preventDefault le sacaría el foco al input antes del click.
          onMouseDown={(e) => e.preventDefault()}
          className="absolute left-0 right-0 top-full z-30 mt-1 max-h-72 overflow-auto rounded-lg border border-border bg-card py-1 shadow-lg"
        >
          {filtradas.length === 0 ? (
            <li className="px-3 py-2 text-sm text-muted-foreground">Ningún ítem coincide.</li>
          ) : (
            filtradas.map((o, i) => (
              <li
                key={o.id}
                id={`${listId}-${i}`}
                role="option"
                aria-selected={i === idx}
                onClick={() => elegir(o)}
                onMouseEnter={() => setResaltado(i)}
                className={clsx('flex cursor-pointer items-center gap-3 px-3 py-2 text-sm', i === idx && 'bg-accent')}
              >
                <span className="min-w-0 flex-1 truncate">
                  {o.nombre}
                  {o.categoria && <span className="ml-2 text-xs text-muted-foreground">{o.categoria}</span>}
                </span>
                <span className={clsx('shrink-0 text-xs tabular-nums', colorStock(o.estado) || 'text-muted-foreground')}>
                  hay {fmtCantidad(o.stock, o.unidad)}
                </span>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  )
}
