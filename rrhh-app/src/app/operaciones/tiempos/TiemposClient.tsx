'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import { SectionHeader } from '@/components/operaciones/SectionHeader'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Plus, Trash2, Loader2 } from 'lucide-react'

type Persona = { id: string; nombre: string; apellido: string | null }
type Area = { id: string; nombre: string }
type Tiempo = {
  id: string; personal_id: string; area_id: string | null
  inicio: string | null; fin: string | null; duracion_min: number | null
  estado: string; notas: string | null
}

const hoyLocal = () => new Date().toLocaleDateString('en-CA')
function dur(inicio: string, fin: string) {
  if (!inicio || !fin) return null
  const [hi, mi] = inicio.split(':').map(Number)
  const [hf, mf] = fin.split(':').map(Number)
  const d = hf * 60 + mf - (hi * 60 + mi)
  return d > 0 ? d : null
}
const EMPTY = { personal_id: '', area_id: '', inicio: '', fin: '', estado: 'ok', notas: '' }

export function TiemposClient({ personal, areas }: { personal: Persona[]; areas: Area[] }) {
  const supabase = createClient()
  const [fecha, setFecha] = useState(hoyLocal)
  const [items, setItems] = useState<Tiempo[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(EMPTY)
  const [saving, setSaving] = useState(false)

  const pNombre = (id: string) => { const p = personal.find((x) => x.id === id); return p ? [p.apellido, p.nombre].filter(Boolean).join(', ') || p.nombre : '—' }
  const aNombre = (id: string | null) => areas.find((a) => a.id === id)?.nombre ?? '—'

  const cargar = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('limpieza_tiempos')
      .select('id, personal_id, area_id, inicio, fin, duracion_min, estado, notas')
      .eq('fecha', fecha)
      .order('inicio')
    setItems(data ?? [])
    setLoading(false)
  }, [supabase, fecha])

  useEffect(() => { cargar() }, [cargar])

  async function crear() {
    if (!form.personal_id) return
    setSaving(true)
    const { data } = await supabase
      .from('limpieza_tiempos')
      .insert({
        fecha,
        personal_id: form.personal_id,
        area_id: form.area_id || null,
        inicio: form.inicio || null,
        fin: form.fin || null,
        duracion_min: dur(form.inicio, form.fin),
        estado: form.estado,
        notas: form.notas.trim() || null,
      })
      .select('id, personal_id, area_id, inicio, fin, duracion_min, estado, notas')
      .single()
    if (data) setItems((p) => [...p, data])
    setSaving(false)
    setShowForm(false)
    setForm(EMPTY)
  }

  async function eliminar(id: string) {
    await supabase.from('limpieza_tiempos').delete().eq('id', id)
    setItems((p) => p.filter((t) => t.id !== id))
  }

  return (
    <div className="space-y-5">
      <SectionHeader n="05" title="Registro de tiempos por tarea y sector" subtitle="Inicio, fin y duración por operario" />

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="grid gap-1.5">
          <Label htmlFor="fecha">Fecha</Label>
          <Input id="fecha" type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className="w-44" />
        </div>
        <Button onClick={() => setShowForm((s) => !s)}><Plus className="size-4" /> Registrar</Button>
      </div>

      {showForm && (
        <Card>
          <CardContent className="grid gap-4 p-4 sm:grid-cols-2 sm:p-5">
            <div className="grid gap-2">
              <Label>Operario</Label>
              <select value={form.personal_id} onChange={(e) => setForm({ ...form, personal_id: e.target.value })} className="h-9 w-full rounded-md border border-input px-3 text-sm">
                <option value="">Elegir…</option>
                {personal.map((p) => <option key={p.id} value={p.id}>{[p.apellido, p.nombre].filter(Boolean).join(', ') || p.nombre}</option>)}
              </select>
            </div>
            <div className="grid gap-2">
              <Label>Sector / Área</Label>
              <select value={form.area_id} onChange={(e) => setForm({ ...form, area_id: e.target.value })} className="h-9 w-full rounded-md border border-input px-3 text-sm">
                <option value="">Sin especificar</option>
                {areas.map((a) => <option key={a.id} value={a.id}>{a.nombre}</option>)}
              </select>
            </div>
            <div className="grid gap-2">
              <Label>Inicio</Label>
              <Input type="time" value={form.inicio} onChange={(e) => setForm({ ...form, inicio: e.target.value })} />
            </div>
            <div className="grid gap-2">
              <Label>Fin</Label>
              <Input type="time" value={form.fin} onChange={(e) => setForm({ ...form, fin: e.target.value })} />
            </div>
            <div className="grid gap-2">
              <Label>Estado</Label>
              <select value={form.estado} onChange={(e) => setForm({ ...form, estado: e.target.value })} className="h-9 w-full rounded-md border border-input px-3 text-sm">
                <option value="ok">OK</option>
                <option value="observacion">Con observación</option>
              </select>
            </div>
            <div className="grid gap-2">
              <Label>Notas</Label>
              <Input value={form.notas} onChange={(e) => setForm({ ...form, notas: e.target.value })} placeholder="Opcional" />
            </div>
            <div className="flex gap-2 sm:col-span-2">
              <Button onClick={crear} disabled={saving}>{saving ? 'Guardando…' : 'Guardar'}</Button>
              <Button variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" /> Cargando…</div>
      ) : items.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-sm text-muted-foreground">Sin registros para esta fecha.</CardContent></Card>
      ) : (
        <Card className="overflow-hidden py-0">
          <div className="divide-y">
            {items.map((t) => (
              <div key={t.id} className="flex items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{pNombre(t.personal_id)}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {aNombre(t.area_id)} · {t.inicio?.slice(0, 5) ?? '--'}–{t.fin?.slice(0, 5) ?? '--'}
                    {t.duracion_min != null && ` · ${t.duracion_min} min`}
                  </p>
                </div>
                <Badge variant="outline" className={cn(t.estado === 'ok'
                  ? 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-400 dark:border-emerald-500/30'
                  : 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-500/15 dark:text-amber-400 dark:border-amber-500/30')}>
                  {t.estado === 'ok' ? 'OK' : 'Obs.'}
                </Badge>
                <Button variant="ghost" size="icon-sm" onClick={() => eliminar(t.id)} className="text-muted-foreground hover:text-destructive" aria-label="Eliminar">
                  <Trash2 className="size-4" strokeWidth={1.75} />
                </Button>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  )
}
