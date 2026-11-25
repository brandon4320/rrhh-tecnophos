'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { mensajeError } from '@/lib/errores'
import { createClient } from '@/lib/supabase/client'
import { subirAdjuntoPestcontrol } from '@/lib/upload-client'
import { Button } from '@/components/ui/button'
import { Hoja, HojaCabecera } from '@/components/ui/hoja'
import { hoyClave } from '@/modules/stock/reglas'
import { pdb } from '@/modules/pestcontrol/db'
import { fmtCantidad, parseCantidad, redondear, validarAdjunto, type PestInsumo, type PestRenglon } from '@/modules/pestcontrol/reglas'
import { inputCls, labelCls } from '../stock/estilos'
import { ElegirArchivos } from './AdjuntosHoja'

type Cant = { entrada: string; salida: string }

const aTexto = (n: number) => (n ? String(n).replace('.', ',') : '')

interface Props {
  empresaId: string
  insumos: PestInsumo[]
  movimiento: PestRenglon | null
  onCerrar: () => void
  onGuardado: () => void
}

/**
 * Alta o edición de un movimiento: encabezado (fecha, barco, detalle, comprobante, lugar)
 * + entrada/salida por insumo, guardado en UNA transacción (rpc pest_guardar_movimiento).
 * Los comprobantes elegidos se suben después, porque cuelgan del movimiento ya guardado.
 */
export default function MovimientoHoja({ empresaId, insumos, movimiento, onCerrar, onGuardado }: Props) {
  const [supabase] = useState(() => createClient())
  const [guardando, setGuardando] = useState(false)
  const [cab, setCab] = useState({
    fecha: movimiento?.fecha ?? hoyClave(),
    barco: movimiento?.barco ?? '',
    detalle: movimiento?.detalle ?? '',
    comprobante: movimiento?.comprobante ?? '',
    lugar: movimiento?.lugar ?? '',
    notas: movimiento?.notas ?? '',
  })
  // Insumos que se cuentan en cajas (fosfuro): se carga EN CAJAS por defecto (es como piensa la
  // gente de Pestcontrol) y se guarda en tarros. Al editar, en cajas solo si las cantidades
  // son cajas enteras; si no (55 tarros), en tarros para no mostrar 3,93 cajas.
  const [enCajas, setEnCajas] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(
      insumos.filter((it) => it.por_caja).map((it) => {
        const l = movimiento?.lineas.find((x) => x.insumo_id === it.id)
        const enteras = !l || (l.entrada % it.por_caja! === 0 && l.salida % it.por_caja! === 0)
        return [it.id, enteras]
      })
    )
  )
  const [cant, setCant] = useState<Record<string, Cant>>(() =>
    Object.fromEntries(
      insumos.map((it) => {
        const l = movimiento?.lineas.find((x) => x.insumo_id === it.id)
        const div = enCajas[it.id] && it.por_caja ? it.por_caja : 1
        return [it.id, { entrada: aTexto((l?.entrada ?? 0) / div), salida: aTexto((l?.salida ?? 0) / div) }]
      })
    )
  )
  const [archivos, setArchivos] = useState<File[]>([])

  const factor = (it: PestInsumo) => (enCajas[it.id] && it.por_caja ? it.por_caja : 1)
  const campo = (k: keyof typeof cab) => ({
    value: cab[k],
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setCab((c) => ({ ...c, [k]: e.target.value })),
  })

  async function guardar() {
    const lineas = insumos.map((it) => ({
      insumo_id: it.id,
      entrada: redondear(parseCantidad(cant[it.id].entrada) * factor(it)),
      salida: redondear(parseCantidad(cant[it.id].salida) * factor(it)),
    }))
    if (!cab.fecha) return toast.error('Poné la fecha.')
    if (!lineas.some((l) => l.entrada > 0 || l.salida > 0)) return toast.error('Cargá la cantidad de al menos un insumo.')
    // Líneas de insumos archivados (motores, caños): no se muestran, pero el rpc reemplaza
    // TODAS las líneas del movimiento, así que se reenvían tal cual para no perderlas.
    const visibles = new Set(insumos.map((i) => i.id))
    const archivadas = (movimiento?.lineas ?? []).filter((l) => !visibles.has(l.insumo_id))

    setGuardando(true)
    try {
      const { data: id, error } = await pdb(supabase).rpc('pest_guardar_movimiento', {
        p_id: movimiento?.id ?? null,
        p_empresa_id: empresaId,
        p_fecha: cab.fecha,
        p_barco: cab.barco,
        p_detalle: cab.detalle,
        p_comprobante: cab.comprobante,
        p_lugar: cab.lugar,
        p_notas: cab.notas,
        p_lineas: [...lineas, ...archivadas],
      })
      if (error || !id) throw error ?? new Error('sin id')

      let fallas = 0
      for (const f of archivos) {
        try {
          await subirAdjuntoPestcontrol(f, id as string)
        } catch (e) {
          fallas += 1
          toast.error(mensajeError(e, `subir "${f.name}"`))
        }
      }
      toast.success(movimiento ? 'Movimiento actualizado' : 'Movimiento cargado', {
        description: archivos.length
          ? fallas
            ? `${archivos.length - fallas} de ${archivos.length} comprobantes adjuntados`
            : archivos.length === 1 ? 'Con el comprobante adjunto' : `Con ${archivos.length} comprobantes adjuntos`
          : undefined,
      })
      onGuardado()
    } catch (e) {
      toast.error(mensajeError(e, 'guardar el movimiento'))
      setGuardando(false)
    }
  }

  return (
    <Hoja abierta onCerrar={onCerrar} etiqueta={{ id: 'hoja-pest-mov' }} ancho={560}>
      <HojaCabecera tituloId="hoja-pest-mov" rotulo="Pestcontrol" titulo={movimiento ? 'Editar movimiento' : 'Nuevo movimiento'} onCerrar={onCerrar} />
      <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4 md:px-5">
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="pc-fecha" className={labelCls}>Fecha</label>
            <input id="pc-fecha" type="date" className={inputCls} {...campo('fecha')} />
          </div>
          <div>
            <label htmlFor="pc-barco" className={labelCls}>Barco</label>
            <input id="pc-barco" placeholder="PORT ALBERNI" className={inputCls} {...campo('barco')} />
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="pc-detalle" className={labelCls}>Detalle</label>
            <input id="pc-detalle" placeholder="Compra 50 cajas · Retiro Rosario" className={inputCls} {...campo('detalle')} />
          </div>
          <div>
            <label htmlFor="pc-comp" className={labelCls}>Factura / remito</label>
            <input id="pc-comp" placeholder="Rto 7036" className={inputCls} {...campo('comprobante')} />
          </div>
          <div>
            <label htmlFor="pc-lugar" className={labelCls}>Lugar</label>
            <input id="pc-lugar" placeholder="Bahía Blanca" className={inputCls} {...campo('lugar')} />
          </div>
        </div>

        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full min-w-[420px] text-sm">
            <thead>
              <tr className="border-b border-border bg-muted text-left text-xs font-semibold text-foreground">
                <th className="px-3 py-2 font-semibold">Insumo</th>
                <th className="w-28 px-2 py-2 font-semibold">Entrada</th>
                <th className="w-28 px-2 py-2 font-semibold">Salida</th>
              </tr>
            </thead>
            <tbody>
              {insumos.map((it) => {
                const c = cant[it.id]
                const total = (parseCantidad(c.entrada) - parseCantidad(c.salida)) * factor(it)
                return (
                  <tr key={it.id} className="border-b border-divisor last:border-0">
                    <td className="px-3 py-1.5">
                      <p className="text-foreground">{it.nombre}</p>
                      {it.por_caja ? (
                        <div className="mt-1 flex flex-wrap items-center gap-1 text-xs" role="group" aria-label={`Unidad de ${it.nombre}`}>
                          {[true, false].map((cajas) => (
                            <button
                              key={String(cajas)}
                              type="button"
                              aria-pressed={!!enCajas[it.id] === cajas}
                              onClick={() => setEnCajas((e) => ({ ...e, [it.id]: cajas }))}
                              className={cn(
                                'rounded-md border px-1.5 py-0.5',
                                !!enCajas[it.id] === cajas ? 'border-border-strong bg-muted text-foreground' : 'border-border text-muted-foreground'
                              )}
                            >
                              {cajas ? `cajas (×${it.por_caja})` : it.unidad}
                            </button>
                          ))}
                          {enCajas[it.id] && total !== 0 && (
                            <span className="text-muted-foreground">= {fmtCantidad(Math.abs(total))} {it.unidad}</span>
                          )}
                        </div>
                      ) : it.unidad ? (
                        <p className="text-xs text-muted-foreground">{it.unidad}</p>
                      ) : null}
                    </td>
                    {(['entrada', 'salida'] as const).map((k) => (
                      <td key={k} className="px-2 py-1.5">
                        <input
                          inputMode="decimal"
                          aria-label={`${k === 'entrada' ? 'Entrada' : 'Salida'} de ${it.nombre}`}
                          value={c[k]}
                          onChange={(e) => setCant((s) => ({ ...s, [it.id]: { ...s[it.id], [k]: e.target.value.replace(/[^\d.,]/g, '') } }))}
                          className={cn(inputCls, 'text-right tabular-nums')}
                        />
                      </td>
                    ))}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        <div className="space-y-2">
          <p className={labelCls}>Comprobantes</p>
          {movimiento && movimiento.adjuntos > 0 && (
            <p className="text-xs text-muted-foreground">Ya tiene {movimiento.adjuntos}; se ven con el clip del renglón.</p>
          )}
          {archivos.length > 0 && (
            <ul className="flex flex-col gap-1 text-sm">
              {archivos.map((f, i) => (
                <li key={i} className="flex items-center gap-2">
                  <span className="min-w-0 flex-1 truncate">{f.name}</span>
                  <button type="button" className="text-xs text-muted-foreground underline-offset-2 hover:underline" onClick={() => setArchivos((a) => a.filter((_, j) => j !== i))}>
                    quitar
                  </button>
                </li>
              ))}
            </ul>
          )}
          <ElegirArchivos
            disabled={guardando}
            onElegir={(fs) => {
              const malos = fs.map(validarAdjunto).filter((x): x is string => !!x)
              malos.forEach((m) => toast.error(m))
              setArchivos((a) => [...a, ...fs.filter((f) => !validarAdjunto(f))])
            }}
          >
            Adjuntar remito o foto
          </ElegirArchivos>
        </div>

        <div>
          <label htmlFor="pc-notas" className={labelCls}>Notas</label>
          <textarea id="pc-notas" rows={2} className={inputCls} {...campo('notas')} />
        </div>
      </div>
      <div className="flex justify-end gap-2 border-t border-divisor px-4 py-3 md:px-5">
        <Button variant="outline" onClick={onCerrar} disabled={guardando}>Cancelar</Button>
        <Button onClick={guardar} disabled={guardando}>
          {guardando ? 'Guardando…' : movimiento ? 'Guardar cambios' : 'Cargar movimiento'}
        </Button>
      </div>
    </Hoja>
  )
}
