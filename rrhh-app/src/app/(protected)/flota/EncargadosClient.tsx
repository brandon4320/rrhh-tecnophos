'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { MessageCircle, Plus, Trash2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import { fmtFechaHoraAR } from '@/lib/fechas-ar'
import { normalizarTelefono } from '@/modules/flota/reglas'

interface Encargado { id: string; nombre: string; telefono: string; activo: boolean }
interface Aviso { id: string; tipo: string; estado: string; mensaje: string; destinatarios: number; error: string | null; created_at: string }

const ESTADO_AVISO: Record<string, { label: string; cls: string }> = {
  enviado: { label: 'Enviado', cls: 'text-success' },
  sin_canal: { label: 'Sin enviar', cls: 'text-muted-foreground' },
  error: { label: 'Falló', cls: 'text-danger' },
  pendiente: { label: 'Pendiente', cls: 'text-warning' },
}
const TIPO_AVISO: Record<string, string> = {
  resumen_diario: 'Resumen del día',
  checklist_no_apto: 'Camioneta no apta',
  novedad: 'Novedad reportada',
}

function fmtTelefono(t: string) {
  // 5492914123456 → +54 9 291 412-3456 (aproximado: la característica varía de 2 a 4 dígitos)
  const m = /^549(\d{3})(\d{3})(\d{4})$/.exec(t)
  return m ? `+54 9 ${m[1]} ${m[2]}-${m[3]}` : `+${t}`
}

export default function EncargadosClient({ empresa, encargados: inicial, avisos, canalActivo, canEdit }: {
  empresa: { id: string; nombre: string }
  encargados: Encargado[]
  avisos: Aviso[]
  canalActivo: boolean
  canEdit: boolean
}) {
  const supabase = createClient()
  const router = useRouter()
  const [encargados, setEncargados] = useState(inicial)
  const [form, setForm] = useState({ nombre: '', telefono: '' })
  const [saving, setSaving] = useState(false)
  const [abierto, setAbierto] = useState<string | null>(null)

  async function agregar(e: React.FormEvent) {
    e.preventDefault()
    const nombre = form.nombre.trim()
    const telefono = normalizarTelefono(form.telefono)
    if (!nombre) return toast.error('Escribí el nombre del encargado.')
    if (!telefono) return toast.error('El celular no parece válido. Escribilo con la característica, por ejemplo 291 412-3456.')
    setSaving(true)
    const { data, error } = await supabase
      .from('flota_encargados')
      .insert({ empresa_id: empresa.id, nombre, telefono })
      .select('id, nombre, telefono, activo')
      .single()
    setSaving(false)
    if (error || !data) return toast.error(`No se pudo agregar. ${error?.message ?? ''}`)
    setEncargados((prev) => [...prev, data].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')))
    setForm({ nombre: '', telefono: '' })
    toast.success(`${nombre} va a recibir los avisos de ${empresa.nombre}.`)
    router.refresh()
  }

  async function alternar(enc: Encargado) {
    const { error } = await supabase.from('flota_encargados').update({ activo: !enc.activo }).eq('id', enc.id)
    if (error) return toast.error(`No se pudo cambiar. ${error.message}`)
    setEncargados((prev) => prev.map((x) => (x.id === enc.id ? { ...x, activo: !x.activo } : x)))
  }

  async function quitar(enc: Encargado) {
    if (!confirm(`¿Dejar de avisarle a ${enc.nombre}?`)) return
    const { error } = await supabase.from('flota_encargados').delete().eq('id', enc.id)
    if (error) return toast.error(`No se pudo quitar. ${error.message}`)
    setEncargados((prev) => prev.filter((x) => x.id !== enc.id))
  }

  return (
    <section className="rounded-2xl border border-border bg-card">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border px-5 py-4 sm:px-6">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight">
            <MessageCircle className="size-5 text-muted-foreground" strokeWidth={1.75} />
            Avisos por WhatsApp
          </h2>
          <p className="text-sm text-muted-foreground">
            Cada mañana de lunes a viernes, un resumen de lo vencido. Al instante, si una camioneta queda no apta o alguien reporta una novedad.
          </p>
        </div>
      </div>

      {!canalActivo && (
        <div className="border-b border-border bg-warning-subtle px-5 py-3 text-sm text-warning sm:px-6">
          El envío por WhatsApp todavía no está conectado. Los avisos se arman igual y quedan registrados acá abajo.
        </div>
      )}

      <div className="grid gap-6 p-5 sm:p-6 lg:grid-cols-2">
        <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">Quién los recibe</p>
          {encargados.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
              Nadie todavía. Agregá al encargado de la flota de {empresa.nombre}.
            </p>
          ) : (
            <ul className="divide-y divide-border rounded-xl border border-border">
              {encargados.map((enc) => (
                <li key={enc.id} className={cn('flex items-center gap-3 px-4 py-2.5', !enc.activo && 'opacity-60')}>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{enc.nombre}</p>
                    <p className="text-xs tabular-nums text-muted-foreground">{fmtTelefono(enc.telefono)}</p>
                  </div>
                  {canEdit && (
                    <>
                      <button type="button" onClick={() => alternar(enc)} className="rounded-lg border border-border px-2.5 py-1 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground">
                        {enc.activo ? 'Pausar' : 'Reactivar'}
                      </button>
                      <button type="button" onClick={() => quitar(enc)} aria-label={`Quitar a ${enc.nombre}`} className="rounded-lg p-1.5 text-danger/70 hover:bg-danger-subtle hover:text-danger">
                        <Trash2 className="size-4" strokeWidth={1.75} />
                      </button>
                    </>
                  )}
                </li>
              ))}
            </ul>
          )}
          {canEdit && (
            <form onSubmit={agregar} className="mt-3 flex flex-wrap gap-2">
              <input id="enc-nombre" value={form.nombre} onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))}
                placeholder="Nombre" className="min-w-[140px] flex-1 rounded-lg border border-input bg-card px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
              <input id="enc-telefono" value={form.telefono} onChange={(e) => setForm((f) => ({ ...f, telefono: e.target.value }))}
                placeholder="Celular (291 412-3456)" inputMode="tel" className="min-w-[160px] flex-1 rounded-lg border border-input bg-card px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
              <button type="submit" disabled={saving} className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
                <Plus className="size-4" /> Agregar
              </button>
            </form>
          )}
        </div>

        <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">Últimos avisos</p>
          {avisos.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">Todavía no se generó ningún aviso.</p>
          ) : (
            <ul className="divide-y divide-border rounded-xl border border-border">
              {avisos.map((a) => {
                const est = ESTADO_AVISO[a.estado] ?? ESTADO_AVISO.pendiente
                return (
                  <li key={a.id}>
                    <button type="button" onClick={() => setAbierto(abierto === a.id ? null : a.id)} className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-muted/40">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{TIPO_AVISO[a.tipo] ?? a.tipo}</p>
                        <p className="text-xs text-muted-foreground">{fmtFechaHoraAR(a.created_at)}</p>
                      </div>
                      <span className={cn('text-xs font-medium', est.cls)}>
                        {est.label}{a.estado === 'enviado' && a.destinatarios > 0 ? ` · ${a.destinatarios}` : ''}
                      </span>
                    </button>
                    {abierto === a.id && (
                      <div className="border-t border-border bg-muted/40 px-4 py-3">
                        <pre className="whitespace-pre-wrap font-sans text-xs text-foreground">{a.mensaje}</pre>
                        {a.error && <p className="mt-2 text-xs text-danger">{a.error}</p>}
                      </div>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </div>
    </section>
  )
}
