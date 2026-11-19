'use client'

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import { MagnifyingGlass, Truck } from '@phosphor-icons/react'
import { createClient } from '@/lib/supabase/client'
import { traerTodo } from '@/lib/paginar'
import { coincide } from '@/lib/texto'
import { cn } from '@/lib/utils'
import { AvatarPersona, Cuadro } from '@/components/ui/empresa'

export interface PantallaPaleta {
  key: string
  label: string
  href: string
  icon: React.ComponentType<{ size?: number; className?: string }>
  external?: boolean
}

interface Persona { id: string; nombre: string; apellido: string | null; sector: string | null; empresa_id: string | null }
interface Vehiculo { id: string; patente: string | null; marca: string | null; modelo: string | null; empresa_id: string | null }

const sinSuscripcion = () => () => {}

/**
 * ⌘K: pantallas del menú (con sus mismas condiciones de permiso: salen del menú armado),
 * personas y vehículos de las empresas que se miran. Solo lee, con el cliente del navegador
 * (la RLS decide qué ve cada uno). Se pide una vez al abrir por primera vez.
 */
export function Paleta({
  abierta,
  onCerrar,
  pantallas,
  empresas,
  hrefPersona,
}: {
  abierta: boolean
  onCerrar: () => void
  pantallas: PantallaPaleta[]
  /** Empresas a la vista: id → { slug, corto }. */
  empresas: Map<string, { slug: string; corto: string }>
  hrefPersona: (id: string) => string
}) {
  const montado = useSyncExternalStore(sinSuscripcion, () => true, () => false)
  const router = useRouter()
  const [q, setQ] = useState('')
  const [activo, setActivo] = useState(0)
  const [datos, setDatos] = useState<{ personas: Persona[]; vehiculos: Vehiculo[] } | null>(null)
  const pedido = useRef(false)
  const input = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!abierta || pedido.current) return
    pedido.current = true
    const supabase = createClient()
    Promise.all([
      traerTodo<Persona>((d, h) => supabase.from('empleados').select('id, nombre, apellido, sector, empresa_id').eq('activo', true).order('id').range(d, h)),
      traerTodo<Vehiculo>((d, h) => supabase.from('vehiculos').select('id, patente, marca, modelo, empresa_id').eq('activo', true).order('id').range(d, h)),
    ]).then(([p, v]) => setDatos({ personas: p.data ?? [], vehiculos: v.data ?? [] }))
  }, [abierta])

  useEffect(() => {
    if (!abierta) return
    const t = window.setTimeout(() => input.current?.focus(), 20)
    return () => window.clearTimeout(t)
  }, [abierta])

  const resultados = useMemo(() => {
    const texto = q.trim()
    const pan = pantallas.filter((p) => !texto || coincide(texto, p.label))
    const pers = (datos?.personas ?? [])
      .filter((p) => p.empresa_id && empresas.has(p.empresa_id) && coincide(texto, p.nombre, p.apellido, p.sector, empresas.get(p.empresa_id)?.corto))
      .slice(0, texto ? 6 : 4)
    const veh = texto
      ? (datos?.vehiculos ?? []).filter((v) => v.empresa_id && empresas.has(v.empresa_id) && coincide(texto, v.patente, v.marca, v.modelo)).slice(0, 4)
      : []
    return { pan, pers, veh }
  }, [q, pantallas, datos, empresas])

  const lista = [
    ...resultados.pan.map((p) => ({ key: `p-${p.key}`, href: p.href, external: p.external })),
    ...resultados.pers.map((p) => ({ key: `e-${p.id}`, href: hrefPersona(p.id), external: false })),
    ...resultados.veh.map((v) => ({ key: `v-${v.id}`, href: `/flota/${v.id}`, external: false })),
  ]
  const sel = Math.min(activo, Math.max(0, lista.length - 1))

  function ir(i: number) {
    const item = lista[i]
    if (!item) return
    onCerrar()
    setQ('')
    if (item.external) window.open(item.href, '_blank', 'noopener,noreferrer')
    else router.push(item.href)
  }

  if (!montado) return null
  const filaCls = (i: number) => cn('flex min-h-11 w-full cursor-pointer items-center gap-3 rounded-[10px] px-2 text-left text-sm', i === sel && 'bg-muted')
  let i = -1
  return createPortal(
    <>
      <div aria-hidden onClick={onCerrar} className={cn('fixed inset-0 z-[79] bg-[rgb(10_9_15/0.18)] transition-opacity', abierta ? 'opacity-100' : 'pointer-events-none opacity-0')} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Buscar"
        inert={!abierta}
        className={cn(
          'fixed top-3 left-1/2 z-80 w-[min(600px,calc(100vw-32px))] -translate-x-1/2 overflow-hidden rounded-2xl border border-border bg-card shadow-flotante transition-[opacity,transform] duration-150 md:top-[12vh]',
          abierta ? 'visible opacity-100' : 'invisible -translate-y-1.5 scale-[0.98] opacity-0'
        )}
      >
        <div className="flex h-14 items-center gap-3 border-b border-divisor px-5">
          <MagnifyingGlass size={20} className="text-muted-foreground" aria-hidden />
          <input
            ref={input}
            value={q}
            onChange={(e) => { setQ(e.target.value); setActivo(0) }}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                e.preventDefault()
                if (lista.length) setActivo((sel + (e.key === 'ArrowDown' ? 1 : -1) + lista.length) % lista.length)
              }
              if (e.key === 'Enter') { e.preventDefault(); ir(sel) }
              if (e.key === 'Escape') { e.preventDefault(); onCerrar() }
            }}
            placeholder="Buscar personas, vehículos o pantallas"
            aria-label="Buscar"
            autoComplete="off"
            className="h-full min-w-0 flex-1 border-0 bg-transparent text-base outline-none"
          />
          <kbd className="rounded-md border border-border px-1 font-mono text-[11px] text-muted-foreground">Esc</kbd>
        </div>
        <div className="max-h-[380px] overflow-auto p-1.5">
          {resultados.pan.length > 0 && <h6 className="px-2 pt-2 pb-1 text-xs font-medium text-muted-foreground">Pantallas</h6>}
          {resultados.pan.map((p) => { i++; const k = i; return (
            <button key={p.key} type="button" className={filaCls(k)} onMouseEnter={() => setActivo(k)} onClick={() => ir(k)}>
              <p.icon size={17} className="text-muted-foreground" />{p.label}
            </button>
          ) })}
          {resultados.pers.length > 0 && <h6 className="px-2 pt-2 pb-1 text-xs font-medium text-muted-foreground">Personas</h6>}
          {resultados.pers.map((p) => { i++; const k = i; const e = p.empresa_id ? empresas.get(p.empresa_id) : undefined; const nombre = [p.nombre, p.apellido].filter(Boolean).join(' '); return (
            <button key={p.id} type="button" className={filaCls(k)} onMouseEnter={() => setActivo(k)} onClick={() => ir(k)}>
              <AvatarPersona nombre={nombre} slug={e?.slug} tamano={28} />
              <span className="min-w-0 flex-1 truncate">{nombre}</span>
              <small className="shrink-0 text-xs text-muted-foreground">{[e?.corto, p.sector].filter(Boolean).join(' · ')}</small>
            </button>
          ) })}
          {resultados.veh.length > 0 && <h6 className="px-2 pt-2 pb-1 text-xs font-medium text-muted-foreground">Vehículos</h6>}
          {resultados.veh.map((v) => { i++; const k = i; return (
            <button key={v.id} type="button" className={filaCls(k)} onMouseEnter={() => setActivo(k)} onClick={() => ir(k)}>
              <Cuadro color="var(--f-log)" tamano={28}><Truck size={15} /></Cuadro>
              <span className="min-w-0 flex-1 truncate">{[v.marca, v.modelo].filter(Boolean).join(' ') || 'Vehículo'}</span>
              <small className="shrink-0 font-mono text-xs text-muted-foreground">{v.patente}</small>
            </button>
          ) })}
          {lista.length === 0 && <p className="p-6 text-center text-[13px] text-texto-2">No hay nada con «{q}»</p>}
        </div>
      </div>
    </>,
    document.body
  )
}
