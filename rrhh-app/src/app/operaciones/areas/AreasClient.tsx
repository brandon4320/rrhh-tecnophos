'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Tables } from '@/types/database'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Plus, Pencil, Trash2 } from 'lucide-react'

type Area = Tables<'limpieza_areas'>

const TIPOS = [
  { value: 'tipo1', label: 'Tipo 1 — Administrativos' },
  { value: 'tipo2', label: 'Tipo 2 — Industrial' },
  { value: 'tipo3', label: 'Tipo 3 — Veredas y playas' },
  { value: 'taller_anodos', label: 'Taller de Ánodos' },
  { value: 'u15', label: 'U-15 Puerto Galván' },
  { value: 'supervision', label: 'Supervisión' },
]
const tipoLabel = (v: string | null) => TIPOS.find((t) => t.value === v)?.label ?? v ?? '—'

const PRIORIDADES = ['critica', 'alta', 'media', 'baja']
const PRIORIDAD_BADGE: Record<string, string> = {
  critica: 'bg-red-100 text-red-700 border-red-200 dark:bg-red-500/15 dark:text-red-400 dark:border-red-500/30',
  alta: 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-500/15 dark:text-amber-400 dark:border-amber-500/30',
  media: 'bg-sky-100 text-sky-700 border-sky-200 dark:bg-sky-500/15 dark:text-sky-400 dark:border-sky-500/30',
  baja: 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-500/15 dark:text-slate-400 dark:border-slate-500/30',
}

const EMPTY = { nombre: '', tipo: '', frecuencia: '', prioridad: 'media' }

export function AreasClient({ inicial }: { inicial: Area[] }) {
  const supabase = createClient()
  const [items, setItems] = useState<Area[]>(inicial)
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState(EMPTY)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  function openNew() {
    setForm(EMPTY)
    setEditId(null)
    setError('')
    setShowForm(true)
  }
  function openEdit(a: Area) {
    setForm({
      nombre: a.nombre ?? '',
      tipo: a.tipo ?? '',
      frecuencia: a.frecuencia ?? '',
      prioridad: a.prioridad ?? 'media',
    })
    setEditId(a.id)
    setError('')
    setShowForm(true)
  }

  async function save() {
    if (!form.nombre.trim()) {
      setError('El nombre del sitio es obligatorio.')
      return
    }
    if (!form.tipo) {
      setError('Elegí un tipo.')
      return
    }
    setSaving(true)
    setError('')
    const payload = {
      nombre: form.nombre.trim(),
      tipo: form.tipo,
      frecuencia: form.frecuencia.trim() || null,
      prioridad: form.prioridad,
    }

    if (editId) {
      const { data, error: err } = await supabase
        .from('limpieza_areas')
        .update(payload)
        .eq('id', editId)
        .select('*')
        .single()
      if (err || !data) {
        setError('No se pudo guardar.')
        setSaving(false)
        return
      }
      setItems((prev) => prev.map((a) => (a.id === editId ? data : a)))
    } else {
      const { data, error: err } = await supabase
        .from('limpieza_areas')
        .insert(payload)
        .select('*')
        .single()
      if (err || !data) {
        setError('No se pudo crear.')
        setSaving(false)
        return
      }
      setItems((prev) => [...prev, data])
    }
    setSaving(false)
    setShowForm(false)
  }

  async function remove(a: Area) {
    if (!confirm(`¿Eliminar el sitio "${a.nombre}"?`)) return
    const { error: err } = await supabase.from('limpieza_areas').delete().eq('id', a.id)
    if (!err) setItems((prev) => prev.filter((x) => x.id !== a.id))
  }

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Sitios y áreas</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {items.length} {items.length === 1 ? 'sitio' : 'sitios'} del servicio
          </p>
        </div>
        <Button onClick={openNew} className="shrink-0">
          <Plus className="size-4" strokeWidth={2} />
          <span className="hidden sm:inline">Agregar</span>
        </Button>
      </div>

      {showForm && (
        <Card>
          <CardContent className="p-4 sm:p-5">
            <h2 className="mb-4 font-medium">{editId ? 'Editar sitio' : 'Nuevo sitio'}</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2 sm:col-span-2">
                <Label htmlFor="nombre">Nombre del sitio</Label>
                <Input
                  id="nombre"
                  value={form.nombre}
                  onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                  placeholder="Taller de Ánodos UE"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="tipo">Tipo</Label>
                <select
                  id="tipo"
                  value={form.tipo}
                  onChange={(e) => setForm({ ...form, tipo: e.target.value })}
                  className="h-9 w-full rounded-md border border-input px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
                >
                  <option value="">Elegir…</option>
                  {TIPOS.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="prioridad">Prioridad</Label>
                <select
                  id="prioridad"
                  value={form.prioridad}
                  onChange={(e) => setForm({ ...form, prioridad: e.target.value })}
                  className="h-9 w-full rounded-md border border-input px-3 text-sm capitalize outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
                >
                  {PRIORIDADES.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid gap-2 sm:col-span-2">
                <Label htmlFor="frecuencia">Frecuencia</Label>
                <Input
                  id="frecuencia"
                  value={form.frecuencia}
                  onChange={(e) => setForm({ ...form, frecuencia: e.target.value })}
                  placeholder="Diaria · 2 repasos/día · Según Anexo 1"
                />
              </div>
            </div>

            {error && <p className="mt-3 text-sm text-destructive">{error}</p>}

            <div className="mt-5 flex gap-2">
              <Button onClick={save} disabled={saving}>
                {saving ? 'Guardando…' : 'Guardar'}
              </Button>
              <Button variant="outline" onClick={() => setShowForm(false)} disabled={saving}>
                Cancelar
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {items.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            No hay sitios cargados. Tocá <span className="font-medium text-foreground">Agregar</span> para sumar las áreas del servicio.
          </CardContent>
        </Card>
      ) : (
        <Card className="overflow-hidden py-0">
          <div className="divide-y">
            {items.map((a) => (
              <div key={a.id} className="flex items-center justify-between gap-3 px-4 py-3.5">
                <div className="min-w-0">
                  <p className="truncate font-medium">{a.nombre}</p>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">
                    {tipoLabel(a.tipo)}
                    {a.frecuencia ? ` · ${a.frecuencia}` : ''}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  <Badge
                    variant="outline"
                    className={cn('capitalize', PRIORIDAD_BADGE[a.prioridad] ?? PRIORIDAD_BADGE.baja)}
                  >
                    {a.prioridad}
                  </Badge>
                  <Button variant="ghost" size="icon-sm" onClick={() => openEdit(a)} aria-label="Editar">
                    <Pencil className="size-4" strokeWidth={1.75} />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => remove(a)}
                    aria-label="Eliminar"
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="size-4" strokeWidth={1.75} />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  )
}
