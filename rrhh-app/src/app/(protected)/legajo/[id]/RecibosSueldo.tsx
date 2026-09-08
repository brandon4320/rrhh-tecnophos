'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { FileText, Plus, Trash2, ExternalLink, Upload } from 'lucide-react'
import type { Recibo } from '@/types'
import { subirRecibo } from '@/lib/upload-client'
import {
  TIPOS_RECIBO, TIPO_RECIBO_LABEL, agruparPorAnio, labelPeriodo, mesAnteriorInput,
  validarArchivoRecibo, type TipoRecibo,
} from '@/lib/recibos'
import { fmtFechaAR } from '@/lib/fechas-ar'

interface Props {
  empleadoId: string
  empresaSlug: string
  recibos: Recibo[]
  canEdit: boolean
}

const inputCls =
  'w-full px-3.5 py-2.5 rounded-lg border border-input bg-card text-sm focus:outline-none focus:ring-2 focus:ring-ring'

/**
 * Comprobantes de sueldo del empleado: lista por año y carga manual.
 * Los datos entran por /api/recibos (RLS) y el archivo va directo a R2.
 * Cuando exista la carga automática, va a escribir en la misma tabla con
 * origen='automatico' — la UI no cambia.
 */
export default function RecibosSueldo({ empleadoId, empresaSlug, recibos, canEdit }: Props) {
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)
  const [showForm, setShowForm] = useState(false)
  const [periodo, setPeriodo] = useState(mesAnteriorInput())
  const [tipo, setTipo] = useState<TipoRecibo>('mensual')
  const [notas, setNotas] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)
  const [borrando, setBorrando] = useState<string | null>(null)

  function reset() {
    setShowForm(false)
    setPeriodo(mesAnteriorInput())
    setTipo('mensual')
    setNotas('')
    setFile(null)
    if (fileRef.current) fileRef.current.value = ''
  }

  async function handleSubir() {
    if (!file) {
      toast.error('Elegí el archivo del comprobante.')
      return
    }
    const invalido = validarArchivoRecibo(file)
    if (invalido) {
      toast.error(invalido)
      return
    }
    setSaving(true)
    try {
      await subirRecibo(file, { empleadoId, empresaSlug, periodo, tipo, notas })
      toast.success(`Comprobante de ${labelPeriodo(periodo + '-01').toLowerCase()} cargado.`)
      reset()
      router.refresh()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo cargar el comprobante.')
    } finally {
      setSaving(false)
    }
  }

  async function handleVer(r: Recibo) {
    const res = await fetch(`/api/archivo?path=${encodeURIComponent(r.path)}`)
    if (!res.ok) {
      toast.error('No se pudo abrir el comprobante.')
      return
    }
    const { url } = await res.json()
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  async function handleEliminar(r: Recibo) {
    if (!confirm(`¿Eliminar el comprobante de ${labelPeriodo(r.periodo)} (${TIPO_RECIBO_LABEL[r.tipo as TipoRecibo] ?? r.tipo})?`)) return
    setBorrando(r.id)
    const res = await fetch(`/api/recibos?id=${r.id}`, { method: 'DELETE' })
    setBorrando(null)
    if (!res.ok) {
      const payload = await res.json().catch(() => null)
      toast.error(payload?.error ?? 'No se pudo eliminar el comprobante.')
      return
    }
    toast.success('Comprobante eliminado.')
    router.refresh()
  }

  const grupos = agruparPorAnio(recibos)

  return (
    <section className="mt-10">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-foreground">Comprobantes de sueldo</h2>
          <p className="text-xs text-muted-foreground">
            {recibos.length === 0 ? 'Todavía no hay comprobantes cargados.' : `${recibos.length} ${recibos.length === 1 ? 'comprobante' : 'comprobantes'}`}
          </p>
        </div>
        {canEdit && !showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary transition-colors hover:bg-primary/20"
          >
            <Plus className="size-3.5" strokeWidth={2.5} />
            Cargar comprobante
          </button>
        )}
      </div>

      {canEdit && showForm && (
        <div className="mb-3 rounded-xl border border-primary/30 bg-primary/5 p-4">
          <p className="mb-3 text-sm font-medium text-foreground">Nuevo comprobante</p>
          <div className="mb-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-foreground">Período *</label>
              <input type="month" value={periodo} onChange={(e) => setPeriodo(e.target.value)} className={inputCls} max={new Date().toISOString().slice(0, 7)} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-foreground">Tipo</label>
              <select value={tipo} onChange={(e) => setTipo(e.target.value as TipoRecibo)} className={inputCls}>
                {TIPOS_RECIBO.map((t) => (
                  <option key={t} value={t}>{TIPO_RECIBO_LABEL[t]}</option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-medium text-foreground">Archivo * <span className="font-normal text-muted-foreground">(PDF o imagen, hasta 15 MB)</span></label>
              <input
                ref={fileRef}
                type="file"
                accept="application/pdf,image/jpeg,image/png,image/webp,.pdf,.jpg,.jpeg,.png,.webp"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                className="block w-full text-sm text-muted-foreground file:mr-3 file:rounded-lg file:border-0 file:bg-muted file:px-3 file:py-2 file:text-sm file:font-medium file:text-foreground hover:file:bg-accent"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-medium text-foreground">Notas</label>
              <input type="text" value={notas} onChange={(e) => setNotas(e.target.value)} className={inputCls} placeholder="Opcional: ajuste, complemento, etc." />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleSubir}
              disabled={saving || !file}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
            >
              <Upload className="size-3.5" strokeWidth={2} />
              {saving ? 'Subiendo...' : 'Cargar comprobante'}
            </button>
            <button onClick={reset} className="px-2 py-2 text-xs text-muted-foreground hover:text-foreground">
              Cancelar
            </button>
          </div>
        </div>
      )}

      {recibos.length === 0 && !showForm && (
        <div className="rounded-xl border border-dashed border-border px-6 py-8 text-center text-sm text-muted-foreground">
          Sin comprobantes de sueldo.{' '}
          {canEdit && (
            <button onClick={() => setShowForm(true)} className="text-primary hover:underline">
              Cargar el primero
            </button>
          )}
        </div>
      )}

      {grupos.length > 0 && (
        <div className="space-y-4">
          {grupos.map((g) => (
            <div key={g.anio}>
              <div className="mb-1 flex items-center gap-3 px-1">
                <p className="text-xs font-medium text-muted-foreground">{g.anio}</p>
                <span className="h-px flex-1 bg-border" />
                <span className="text-[11px] tabular-nums text-muted-foreground">{g.items.length}</span>
              </div>
              <div className="overflow-hidden rounded-xl border border-border bg-card">
                <ul className="divide-y divide-border">
                  {g.items.map((r) => (
                    <li key={r.id} className="flex items-center gap-4 px-5 py-3">
                      <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                        <FileText className="size-4" strokeWidth={1.75} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-foreground">
                          {labelPeriodo(r.periodo)}
                          {r.tipo !== 'mensual' && (
                            <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                              {TIPO_RECIBO_LABEL[r.tipo as TipoRecibo] ?? r.tipo}
                            </span>
                          )}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {r.nombre_archivo}
                          {r.size_bytes ? ` · ${(r.size_bytes / 1024).toFixed(0)} KB` : ''}
                          {r.created_at ? ` · cargado el ${fmtFechaAR(r.created_at)}` : ''}
                          {r.origen === 'automatico' ? ' · automático' : ''}
                          {r.notas ? ` · ${r.notas}` : ''}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-3">
                        <button onClick={() => handleVer(r)} className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
                          Ver <ExternalLink className="size-3" strokeWidth={2} />
                        </button>
                        {canEdit && (
                          <button
                            onClick={() => handleEliminar(r)}
                            disabled={borrando === r.id}
                            className="inline-flex items-center gap-1 text-xs text-danger/80 hover:text-danger disabled:opacity-50"
                            title="Eliminar comprobante"
                          >
                            <Trash2 className="size-3.5" strokeWidth={1.75} />
                          </button>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
