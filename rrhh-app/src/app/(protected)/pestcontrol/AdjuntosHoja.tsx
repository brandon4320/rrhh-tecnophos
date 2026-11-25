'use client'

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { toast } from 'sonner'
import { FilePdf, Image as ImageIcon, Paperclip, Trash } from '@phosphor-icons/react'
import { mensajeError } from '@/lib/errores'
import { createClient } from '@/lib/supabase/client'
import { abrirArchivo } from '@/lib/archivos-client'
import { subirAdjuntoPestcontrol } from '@/lib/upload-client'
import { Button } from '@/components/ui/button'
import { Hoja, HojaCabecera } from '@/components/ui/hoja'
import { pdb } from '@/modules/pestcontrol/db'
import { fmtFecha, validarAdjunto, type PestRenglon } from '@/modules/pestcontrol/reglas'

const ACEPTA = 'image/*,application/pdf,.heic,.heif'

/** Botón que abre el selector de archivos (fotos o PDF, varios a la vez). */
export function ElegirArchivos({ onElegir, disabled, children }: { onElegir: (fs: File[]) => void; disabled?: boolean; children: ReactNode }) {
  const ref = useRef<HTMLInputElement>(null)
  return (
    <>
      <input
        ref={ref}
        type="file"
        multiple
        accept={ACEPTA}
        className="hidden"
        onChange={(e) => {
          const fs = [...(e.target.files ?? [])]
          e.target.value = ''
          if (fs.length) onElegir(fs)
        }}
      />
      <Button type="button" variant="outline" disabled={disabled} onClick={() => ref.current?.click()}>
        <Paperclip /> {children}
      </Button>
    </>
  )
}

interface Adjunto {
  id: string
  path: string
  nombre_archivo: string
  mime_type: string | null
  created_at: string
}

/** Comprobantes de un movimiento: ver (URL firmada de R2), agregar y quitar. */
export default function AdjuntosHoja({
  movimiento,
  onCerrar,
  onCambio,
}: {
  movimiento: PestRenglon | null
  onCerrar: () => void
  onCambio: () => void
}) {
  return (
    <Hoja abierta={!!movimiento} onCerrar={onCerrar} etiqueta={{ id: 'hoja-pest-adj' }}>
      {movimiento && <Contenido key={movimiento.id} movimiento={movimiento} onCerrar={onCerrar} onCambio={onCambio} />}
    </Hoja>
  )
}

function Contenido({ movimiento, onCerrar, onCambio }: { movimiento: PestRenglon; onCerrar: () => void; onCambio: () => void }) {
  const [supabase] = useState(() => createClient())
  const [lista, setLista] = useState<Adjunto[] | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const [confirmar, setConfirmar] = useState<string | null>(null)

  const cargar = useCallback(async () => {
    const { data, error } = await pdb(supabase)
      .from('pest_adjuntos')
      .select('id, path, nombre_archivo, mime_type, created_at')
      .eq('movimiento_id', movimiento.id)
      .order('created_at')
    if (error) {
      toast.error(mensajeError(error, 'cargar los comprobantes'))
      setLista([])
      return
    }
    setLista((data ?? []) as Adjunto[])
  }, [supabase, movimiento.id])

  useEffect(() => {
    // Lectura al abrir la hoja: el setState llega después del await, no en el render.
    void cargar()
  }, [cargar])

  async function agregar(fs: File[]) {
    const validos = fs.filter((f) => {
      const m = validarAdjunto(f)
      if (m) toast.error(m)
      return !m
    })
    if (!validos.length) return
    setOcupado(true)
    let ok = 0
    for (const f of validos) {
      try {
        await subirAdjuntoPestcontrol(f, movimiento.id)
        ok += 1
      } catch (e) {
        toast.error(mensajeError(e, `subir "${f.name}"`))
      }
    }
    setOcupado(false)
    if (ok) {
      toast.success(ok === 1 ? 'Comprobante adjuntado' : `${ok} comprobantes adjuntados`)
      await cargar()
      onCambio()
    }
  }

  async function quitar(id: string) {
    setOcupado(true)
    try {
      const res = await fetch(`/api/pestcontrol/adjuntos?id=${encodeURIComponent(id)}`, { method: 'DELETE' })
      if (!res.ok) throw new Error((await res.json().catch(() => null))?.error ?? 'No se pudo quitar el comprobante.')
      toast.success('Comprobante quitado')
      await cargar()
      onCambio()
    } catch (e) {
      toast.error(mensajeError(e, 'quitar el comprobante'))
    } finally {
      setOcupado(false)
      setConfirmar(null)
    }
  }

  const titulo = movimiento.barco || movimiento.detalle || 'Movimiento'
  return (
    <>
      <HojaCabecera tituloId="hoja-pest-adj" rotulo={`Comprobantes · ${fmtFecha(movimiento.fecha)}`} titulo={titulo} onCerrar={onCerrar} />
      <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4 md:px-5">
        {lista === null ? (
          <p className="text-sm text-muted-foreground">Cargando…</p>
        ) : lista.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border-strong px-4 py-6 text-center text-sm text-muted-foreground">
            Sin comprobantes todavía.
          </p>
        ) : (
          <ul className="divide-y divide-divisor rounded-xl border border-border">
            {lista.map((a) => {
              const pdf = a.mime_type === 'application/pdf' || /\.pdf$/i.test(a.nombre_archivo)
              return (
                <li key={a.id} className="flex items-center gap-2 px-3 py-2">
                  {pdf ? <FilePdf size={18} className="shrink-0 text-muted-foreground" aria-hidden /> : <ImageIcon size={18} className="shrink-0 text-muted-foreground" aria-hidden />}
                  <button type="button" onClick={() => abrirArchivo(a.path)} className="min-w-0 flex-1 truncate text-left text-sm font-medium text-foreground hover:underline" title="Abrir">
                    {a.nombre_archivo}
                  </button>
                  {confirmar === a.id ? (
                    <>
                      <Button size="sm" variant="destructive" disabled={ocupado} onClick={() => quitar(a.id)}>Quitar</Button>
                      <Button size="sm" variant="ghost" disabled={ocupado} onClick={() => setConfirmar(null)}>No</Button>
                    </>
                  ) : (
                    <Button size="icon-sm" variant="ghost" aria-label={`Quitar ${a.nombre_archivo}`} disabled={ocupado} onClick={() => setConfirmar(a.id)}>
                      <Trash />
                    </Button>
                  )}
                </li>
              )
            })}
          </ul>
        )}
        <ElegirArchivos onElegir={agregar} disabled={ocupado}>
          {ocupado ? 'Subiendo…' : 'Adjuntar remito o foto'}
        </ElegirArchivos>
      </div>
    </>
  )
}
