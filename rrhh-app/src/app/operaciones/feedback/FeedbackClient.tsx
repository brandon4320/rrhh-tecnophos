'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Tables } from '@/types/database'
import { cn } from '@/lib/utils'
import { SectionHeader } from '@/components/operaciones/SectionHeader'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Plus } from 'lucide-react'

type Feedback = Tables<'limpieza_feedback'>
type Area = { id: string; nombre: string }

const TIPOS = [
  { v: 'reclamo', l: 'Reclamo' },
  { v: 'observacion', l: 'Observación' },
  { v: 'sugerencia', l: 'Sugerencia' },
  { v: 'felicitacion', l: 'Felicitación' },
]
const PRIORIDADES = ['critica', 'alta', 'media', 'baja']
const ESTADOS = [
  { v: 'pendiente', l: 'Pendiente' },
  { v: 'en_gestion', l: 'En gestión' },
  { v: 'resuelto', l: 'Resuelto' },
  { v: 'cerrado', l: 'Cerrado' },
]

const PRIORIDAD_BADGE: Record<string, string> = {
  critica: 'bg-red-100 text-red-700 border-red-200 dark:bg-red-500/15 dark:text-red-400 dark:border-red-500/30',
  alta: 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-500/15 dark:text-amber-400 dark:border-amber-500/30',
  media: 'bg-sky-100 text-sky-700 border-sky-200 dark:bg-sky-500/15 dark:text-sky-400 dark:border-sky-500/30',
  baja: 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-500/15 dark:text-slate-400 dark:border-slate-500/30',
}
const ESTADO_BADGE: Record<string, string> = {
  pendiente: 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-500/15 dark:text-amber-400 dark:border-amber-500/30',
  en_gestion: 'bg-sky-100 text-sky-700 border-sky-200 dark:bg-sky-500/15 dark:text-sky-400 dark:border-sky-500/30',
  resuelto: 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-400 dark:border-emerald-500/30',
  cerrado: 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-500/15 dark:text-slate-400 dark:border-slate-500/30',
}
const EMPTY = { tipo: 'observacion', prioridad: 'media', area_id: '', registrado_por: '', sector: '', descripcion: '' }

export function FeedbackClient({ inicial, areas }: { inicial: Feedback[]; areas: Area[] }) {
  const supabase = createClient()
  const [items, setItems] = useState<Feedback[]>(inicial)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(EMPTY)
  const [saving, setSaving] = useState(false)

  const areaNombre = (id: string | null) => areas.find((a) => a.id === id)?.nombre

  async function crear() {
    if (!form.descripcion.trim()) return
    setSaving(true)
    const { data } = await supabase
      .from('limpieza_feedback')
      .insert({
        tipo: form.tipo,
        prioridad: form.prioridad,
        area_id: form.area_id || null,
        registrado_por: form.registrado_por.trim() || null,
        sector: form.sector.trim() || null,
        descripcion: form.descripcion.trim(),
      })
      .select('*')
      .single()
    if (data) setItems((p) => [data, ...p])
    setSaving(false)
    setShowForm(false)
    setForm(EMPTY)
  }

  async function cambiarEstado(f: Feedback, estado: string) {
    const { data } = await supabase
      .from('limpieza_feedback')
      .update({ estado, cerrado_at: estado === 'cerrado' ? new Date().toISOString() : null })
      .eq('id', f.id)
      .select('*')
      .single()
    if (data) setItems((p) => p.map((x) => (x.id === f.id ? data : x)))
  }

  async function responder(f: Feedback, respuesta: string) {
    const { data } = await supabase
      .from('limpieza_feedback')
      .update({ respuesta_adc: respuesta || null })
      .eq('id', f.id)
      .select('*')
      .single()
    if (data) setItems((p) => p.map((x) => (x.id === f.id ? data : x)))
  }

  const pendientes = items.filter((f) => f.estado === 'pendiente').length

  return (
    <div className="space-y-5">
      <SectionHeader
        n="07"
        title="Canal de feedback y reclamos"
        subtitle="Registro de UNIPAR y gestión de ADC"
        action={
          <Button size="sm" variant="secondary" onClick={() => setShowForm((s) => !s)} className="bg-white/10 text-white hover:bg-white/20">
            <Plus className="size-4" /> Registrar
          </Button>
        }
      />

      {pendientes > 0 && (
        <p className="text-sm text-muted-foreground">{pendientes} pendiente{pendientes > 1 ? 's' : ''} de gestión</p>
      )}

      {showForm && (
        <Card>
          <CardContent className="grid gap-4 p-4 sm:grid-cols-2 sm:p-5">
            <div className="grid gap-2">
              <Label>Tipo</Label>
              <select value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value })} className="h-9 w-full rounded-md border border-input px-3 text-sm">
                {TIPOS.map((t) => <option key={t.v} value={t.v}>{t.l}</option>)}
              </select>
            </div>
            <div className="grid gap-2">
              <Label>Prioridad</Label>
              <select value={form.prioridad} onChange={(e) => setForm({ ...form, prioridad: e.target.value })} className="h-9 w-full rounded-md border border-input px-3 text-sm capitalize">
                {PRIORIDADES.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div className="grid gap-2">
              <Label>Área afectada</Label>
              <select value={form.area_id} onChange={(e) => setForm({ ...form, area_id: e.target.value })} className="h-9 w-full rounded-md border border-input px-3 text-sm">
                <option value="">General</option>
                {areas.map((a) => <option key={a.id} value={a.id}>{a.nombre}</option>)}
              </select>
            </div>
            <div className="grid gap-2">
              <Label>Registrado por (UNIPAR)</Label>
              <Input value={form.registrado_por} onChange={(e) => setForm({ ...form, registrado_por: e.target.value })} placeholder="Nombre y sector" />
            </div>
            <div className="grid gap-2 sm:col-span-2">
              <Label>Descripción</Label>
              <textarea rows={2} value={form.descripcion} onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
                className="w-full rounded-md border border-input px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50" placeholder="Detalle del evento" />
            </div>
            <div className="flex gap-2 sm:col-span-2">
              <Button onClick={crear} disabled={saving}>{saving ? 'Guardando…' : 'Registrar'}</Button>
              <Button variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {items.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-sm text-muted-foreground">Sin registros todavía.</CardContent></Card>
      ) : (
        <div className="space-y-3">
          {items.map((f) => (
            <Card key={f.id} className="py-0">
              <CardContent className="p-4">
                <div className="flex flex-wrap items-center gap-1.5">
                  <Badge variant="secondary" className="capitalize">{TIPOS.find((t) => t.v === f.tipo)?.l ?? f.tipo}</Badge>
                  <Badge variant="outline" className={cn('capitalize', PRIORIDAD_BADGE[f.prioridad])}>{f.prioridad}</Badge>
                  <Badge variant="outline" className={cn(ESTADO_BADGE[f.estado])}>{ESTADOS.find((e) => e.v === f.estado)?.l}</Badge>
                  <span className="ml-auto text-xs text-muted-foreground">
                    {f.created_at ? new Date(f.created_at).toLocaleDateString('es-AR') : ''}
                  </span>
                </div>
                <p className="mt-2 text-sm">{f.descripcion}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {[f.registrado_por, areaNombre(f.area_id)].filter(Boolean).join(' · ') || 'Sin datos de origen'}
                </p>

                <div className="mt-3 flex flex-wrap items-center gap-2 border-t pt-3">
                  <select
                    value={f.estado}
                    onChange={(e) => cambiarEstado(f, e.target.value)}
                    className="h-8 rounded-md border border-input px-2 text-xs"
                  >
                    {ESTADOS.map((e) => <option key={e.v} value={e.v}>{e.l}</option>)}
                  </select>
                  <Input
                    defaultValue={f.respuesta_adc ?? ''}
                    onBlur={(e) => { if ((e.target.value || '') !== (f.respuesta_adc ?? '')) responder(f, e.target.value) }}
                    placeholder="Respuesta ADC…"
                    className="h-8 flex-1 text-sm"
                  />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
