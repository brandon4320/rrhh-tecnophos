'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { MagnifyingGlass, Paperclip, PencilSimple, Plus, Trash, WarningCircle } from '@phosphor-icons/react'
import { cn } from '@/lib/utils'
import { coincide } from '@/lib/texto'
import { mensajeError } from '@/lib/errores'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { pdb } from '@/modules/pestcontrol/db'
import {
  enCajas, fmtCantidad, fmtFecha, saldosActuales, textoBuscable, ultimoMovimiento,
  type PestInsumo, type PestRenglon,
} from '@/modules/pestcontrol/reglas'
import { inputCls, segBtn } from '../stock/estilos'
import MovimientoHoja from './MovimientoHoja'
import AdjuntosHoja from './AdjuntosHoja'

const PAGINA = 60

interface Props {
  empresa: { id: string; nombre: string; slug: string }
  insumos: PestInsumo[]
  libro: PestRenglon[]
}

export default function PestcontrolClient({ empresa, insumos, libro }: Props) {
  const router = useRouter()
  const [supabase] = useState(() => createClient())
  const [q, setQ] = useState('')
  const [anio, setAnio] = useState('todos')
  const [soloConComprobante, setSoloConComprobante] = useState(false)
  const [cuantos, setCuantos] = useState(PAGINA)
  const [editando, setEditando] = useState<PestRenglon | 'nuevo' | null>(null)
  const [viendoAdjuntos, setViendoAdjuntos] = useState<PestRenglon | null>(null)
  const [borrando, setBorrando] = useState<string | null>(null)
  const [confirmarBorrar, setConfirmarBorrar] = useState<string | null>(null)

  const saldos = useMemo(() => saldosActuales(insumos, libro), [insumos, libro])
  const ultimo = useMemo(() => ultimoMovimiento(libro), [libro])
  const anios = useMemo(() => [...new Set(libro.map((r) => r.fecha.slice(0, 4)))].sort().reverse(), [libro])

  // Lo más nuevo arriba. El saldo de cada renglón es el que quedó después de ese movimiento.
  // Un movimiento que solo tocó insumos archivados quedaría como renglón vacío: no se muestra.
  const visibles = useMemo(() => new Set(insumos.map((i) => i.id)), [insumos])
  const filas = useMemo(
    () =>
      [...libro]
        .reverse()
        .filter((r) => r.lineas.length === 0 || r.lineas.some((l) => visibles.has(l.insumo_id)))
        .filter((r) => anio === 'todos' || r.fecha.startsWith(anio))
        .filter((r) => !soloConComprobante || r.adjuntos > 0)
        .filter((r) => !q.trim() || coincide(q, ...textoBuscable(r))),
    [libro, visibles, q, anio, soloConComprobante]
  )

  function filtro<T>(set: (v: T) => void) {
    return (v: T) => {
      set(v)
      setCuantos(PAGINA)
    }
  }

  async function eliminar(r: PestRenglon) {
    setBorrando(r.id)
    try {
      // Los comprobantes primero, por la API: así también se borra el archivo en R2
      // (el cascade de la base solo borraría las filas y dejaría los objetos huérfanos).
      if (r.adjuntos > 0) {
        const { data: adjs, error } = await pdb(supabase).from('pest_adjuntos').select('id').eq('movimiento_id', r.id)
        if (error) throw error
        for (const a of (adjs ?? []) as { id: string }[]) {
          const res = await fetch(`/api/pestcontrol/adjuntos?id=${encodeURIComponent(a.id)}`, { method: 'DELETE' })
          if (!res.ok) throw new Error('No se pudo borrar un comprobante del movimiento.')
        }
      }
      const { error } = await pdb(supabase).from('pest_movimientos').delete().eq('id', r.id)
      if (error) throw error
      toast.success('Movimiento eliminado')
      router.refresh()
    } catch (e) {
      toast.error(mensajeError(e, 'eliminar el movimiento'))
    } finally {
      setBorrando(null)
      setConfirmarBorrar(null)
    }
  }

  return (
    <div className="mx-auto max-w-[1400px] px-4 pt-2 pb-8 md:px-7 md:pt-6 md:pb-10">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-[28px] leading-tight font-semibold tracking-[-0.02em]">Pestcontrol</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">{empresa.nombre}</p>
        </div>
        <Button onClick={() => setEditando('nuevo')}>
          <Plus weight="bold" /> Nuevo movimiento
        </Button>
      </div>

      {/* Saldo actual de cada insumo */}
      <section aria-label="Saldo actual" className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {insumos.map((it) => {
          const s = saldos[it.id] ?? 0
          const cajas = enCajas(it, s)
          const falta = s < 0
          return (
            <div key={it.id} className="flex min-w-0 flex-col gap-1.5 rounded-2xl border border-border bg-card p-4 shadow-tarjeta">
              <p className="line-clamp-2 min-h-[2.6em] text-[13px] leading-snug font-semibold text-balance text-foreground" title={it.nombre}>
                {it.nombre}
              </p>
              <p className={cn('text-[26px] leading-none font-semibold tracking-[-0.02em] tabular-nums', falta ? 'text-danger' : 'text-foreground')}>
                {fmtCantidad(s)}
                {it.unidad && <span className="ml-1.5 text-sm font-normal tracking-normal text-muted-foreground">{it.unidad}</span>}
              </p>
              <p className={cn('flex items-center gap-1 text-xs', falta ? 'font-medium text-danger-text' : 'text-muted-foreground')}>
                {falta && <WarningCircle size={14} weight="fill" aria-hidden className="shrink-0" />}
                <span className="min-w-0">
                  {falta && <b className="font-semibold">Faltante · </b>}
                  {cajas ? `${cajas} · ` : null}
                  {ultimo[it.id] ? `últ. mov. ${fmtFecha(ultimo[it.id])}` : 'sin movimientos'}
                </span>
              </p>
            </div>
          )
        })}
      </section>

      {/* Filtros */}
      <div className="mt-6 flex flex-wrap items-center gap-2">
        <div className="relative min-w-0 flex-1 sm:max-w-xs">
          <MagnifyingGlass size={16} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <input
            value={q}
            onChange={(e) => filtro(setQ)(e.target.value)}
            placeholder="Buscar barco, detalle o comprobante"
            aria-label="Buscar movimientos"
            className={cn(inputCls, 'pl-9')}
          />
        </div>
        <div className="flex max-w-full flex-wrap gap-0.5 rounded-xl bg-muted p-1" role="group" aria-label="Año">
          {['todos', ...anios].map((a) => (
            <button key={a} type="button" aria-pressed={anio === a} onClick={() => filtro(setAnio)(a)} className={segBtn(anio === a)}>
              {a === 'todos' ? 'Todos' : a}
            </button>
          ))}
        </div>
        <Button variant={soloConComprobante ? 'secondary' : 'outline'} aria-pressed={soloConComprobante} onClick={() => filtro(setSoloConComprobante)(!soloConComprobante)}>
          <Paperclip /> Con comprobante
        </Button>
      </div>

      {/* Libro: un renglón por movimiento; en cada insumo, lo que entró/salió y el saldo que quedó */}
      <div className="mt-4 overflow-x-auto rounded-2xl border border-border bg-card shadow-tarjeta">
        <table className="w-full min-w-[1100px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-border bg-muted text-left text-xs font-semibold text-foreground">
              <th className="sticky left-0 z-10 bg-muted px-3 py-2.5 font-semibold">Fecha</th>
              <th className="px-3 py-2.5 font-semibold">Barco / detalle</th>
              <th className="px-3 py-2.5 font-semibold">Comprobante</th>
              {insumos.map((it) => (
                <th key={it.id} className="px-3 py-2.5 text-right font-semibold" title={it.unidad ? `En ${it.unidad}` : undefined}>
                  {it.nombre}
                </th>
              ))}
              <th className="px-2 py-2.5"><span className="sr-only">Acciones</span></th>
            </tr>
          </thead>
          <tbody>
            {filas.slice(0, cuantos).map((r) => {
              const porInsumo = new Map(r.lineas.map((l) => [l.insumo_id, l]))
              return (
                <tr key={r.id} className="group border-b border-divisor last:border-0 hover:bg-hover">
                  <td className="sticky left-0 bg-card px-3 py-2 align-top whitespace-nowrap tabular-nums group-hover:bg-hover">{fmtFecha(r.fecha)}</td>
                  <td className="max-w-[280px] px-3 py-2 align-top">
                    {r.barco && <p className="font-medium text-foreground">{r.barco}</p>}
                    {r.detalle && <p className={r.barco ? 'text-xs text-muted-foreground' : 'text-foreground'}>{r.detalle}</p>}
                    {r.notas && <p className="text-xs text-muted-foreground italic">{r.notas}</p>}
                  </td>
                  <td className="px-3 py-2 align-top text-xs whitespace-nowrap text-muted-foreground">
                    {[r.comprobante, r.lugar].filter(Boolean).join(' · ') || '—'}
                  </td>
                  {insumos.map((it) => {
                    const l = porInsumo.get(it.id)
                    const neto = l ? l.entrada - l.salida : 0
                    const saldo = r.saldos[it.id] ?? 0
                    return (
                      <td key={it.id} className="px-3 py-2 text-right align-top whitespace-nowrap tabular-nums">
                        {l ? (
                          <p className="font-medium text-foreground">
                            {neto > 0 ? '+' : neto < 0 ? '−' : ''}
                            {fmtCantidad(Math.abs(neto))}
                          </p>
                        ) : null}
                        <p className={cn('text-xs', saldo < 0 ? 'font-medium text-danger' : 'text-muted-foreground', !l && 'opacity-60')}>
                          {fmtCantidad(saldo)}
                        </p>
                      </td>
                    )
                  })}
                  <td className="px-2 py-1.5 align-top whitespace-nowrap">
                    {confirmarBorrar === r.id ? (
                      <div className="flex items-center gap-1">
                        <Button size="sm" variant="destructive" disabled={borrando === r.id} onClick={() => eliminar(r)}>
                          {borrando === r.id ? 'Eliminando…' : 'Eliminar'}
                        </Button>
                        <Button size="sm" variant="ghost" disabled={borrando === r.id} onClick={() => setConfirmarBorrar(null)}>
                          No
                        </Button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-0.5">
                        <Button
                          size="sm"
                          variant="ghost"
                          className={cn('px-1.5 tabular-nums', r.adjuntos === 0 && 'opacity-50 group-hover:opacity-100')}
                          aria-label={r.adjuntos ? `Ver ${r.adjuntos} comprobante(s)` : 'Adjuntar comprobante'}
                          title={r.adjuntos ? 'Ver comprobantes' : 'Adjuntar remito o foto'}
                          onClick={() => setViendoAdjuntos(r)}
                        >
                          <Paperclip />
                          {r.adjuntos > 0 && r.adjuntos}
                        </Button>
                        <Button size="icon-sm" variant="ghost" aria-label="Editar" onClick={() => setEditando(r)}>
                          <PencilSimple />
                        </Button>
                        <Button size="icon-sm" variant="ghost" aria-label="Eliminar" onClick={() => setConfirmarBorrar(r.id)}>
                          <Trash />
                        </Button>
                      </div>
                    )}
                  </td>
                </tr>
              )
            })}
            {filas.length === 0 && (
              <tr>
                <td colSpan={insumos.length + 4} className="px-3 py-10 text-center text-muted-foreground">
                  {libro.length === 0 ? 'Todavía no hay movimientos cargados.' : 'Ningún movimiento coincide con la búsqueda.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="mt-3 flex items-center justify-between gap-3 text-xs text-muted-foreground">
        <span>
          {Math.min(cuantos, filas.length)} de {filas.length} movimientos · en cada insumo, lo que entró (+) o salió (−) y abajo el saldo que quedó
        </span>
        {filas.length > cuantos && (
          <Button size="sm" variant="outline" onClick={() => setCuantos((c) => c + PAGINA * 2)}>
            Ver más
          </Button>
        )}
      </div>

      <AdjuntosHoja movimiento={viendoAdjuntos} onCerrar={() => setViendoAdjuntos(null)} onCambio={() => router.refresh()} />

      {editando && (
        <MovimientoHoja
          empresaId={empresa.id}
          insumos={insumos}
          movimiento={editando === 'nuevo' ? null : editando}
          onCerrar={() => setEditando(null)}
          onGuardado={() => {
            setEditando(null)
            router.refresh()
          }}
        />
      )}
    </div>
  )
}
