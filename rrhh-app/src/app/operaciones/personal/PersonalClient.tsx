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
import { Plus, Pencil, Trash2, Phone } from 'lucide-react'

type Persona = Tables<'limpieza_personal'>

const FUNCIONES = [
  { value: 'tipo1', label: 'Tipo 1' },
  { value: 'tipo2', label: 'Tipo 2' },
  { value: 'tipo3', label: 'Tipo 3' },
  { value: 'supervisor', label: 'Supervisor' },
  { value: 'reemplazo', label: 'Reemplazo' },
]
const funcionLabel = (v: string | null) => FUNCIONES.find((f) => f.value === v)?.label ?? '—'

const EMPTY = { nombre: '', apellido: '', funcion: '', telefono: '' }

export function PersonalClient({ inicial }: { inicial: Persona[] }) {
  const supabase = createClient()
  const [items, setItems] = useState<Persona[]>(inicial)
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
  function openEdit(p: Persona) {
    setForm({
      nombre: p.nombre ?? '',
      apellido: p.apellido ?? '',
      funcion: p.funcion ?? '',
      telefono: p.telefono ?? '',
    })
    setEditId(p.id)
    setError('')
    setShowForm(true)
  }

  async function save() {
    if (!form.nombre.trim()) {
      setError('El nombre es obligatorio.')
      return
    }
    setSaving(true)
    setError('')
    const payload = {
      nombre: form.nombre.trim(),
      apellido: form.apellido.trim() || null,
      funcion: form.funcion || null,
      telefono: form.telefono.trim() || null,
    }

    if (editId) {
      const { data, error: err } = await supabase
        .from('limpieza_personal')
        .update(payload)
        .eq('id', editId)
        .select('*')
        .single()
      if (err || !data) {
        setError('No se pudo guardar.')
        setSaving(false)
        return
      }
      setItems((prev) => prev.map((p) => (p.id === editId ? data : p)))
    } else {
      const { data, error: err } = await supabase
        .from('limpieza_personal')
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

  async function toggleActivo(p: Persona) {
    const { data } = await supabase
      .from('limpieza_personal')
      .update({ activo: !p.activo })
      .eq('id', p.id)
      .select('*')
      .single()
    if (data) setItems((prev) => prev.map((x) => (x.id === p.id ? data : x)))
  }

  async function remove(p: Persona) {
    if (!confirm(`¿Eliminar a ${[p.nombre, p.apellido].filter(Boolean).join(' ')}?`)) return
    const { error: err } = await supabase.from('limpieza_personal').delete().eq('id', p.id)
    if (!err) setItems((prev) => prev.filter((x) => x.id !== p.id))
  }

  const activos = items.filter((i) => i.activo).length

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Personal</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {items.length} {items.length === 1 ? 'persona' : 'personas'} · {activos} activas
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
            <h2 className="mb-4 font-medium">{editId ? 'Editar persona' : 'Nueva persona'}</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="nombre">Nombre</Label>
                <Input
                  id="nombre"
                  value={form.nombre}
                  onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                  placeholder="Juan"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="apellido">Apellido</Label>
                <Input
                  id="apellido"
                  value={form.apellido}
                  onChange={(e) => setForm({ ...form, apellido: e.target.value })}
                  placeholder="García"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="funcion">Función</Label>
                <select
                  id="funcion"
                  value={form.funcion}
                  onChange={(e) => setForm({ ...form, funcion: e.target.value })}
                  className="h-9 w-full rounded-md border border-input px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
                >
                  <option value="">Sin asignar</option>
                  {FUNCIONES.map((f) => (
                    <option key={f.value} value={f.value}>
                      {f.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="telefono">Teléfono</Label>
                <Input
                  id="telefono"
                  value={form.telefono}
                  onChange={(e) => setForm({ ...form, telefono: e.target.value })}
                  placeholder="291 555 1234"
                  inputMode="tel"
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
            Todavía no hay personal cargado. Tocá <span className="font-medium text-foreground">Agregar</span> para sumar al equipo.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {items.map((p) => (
            <Card key={p.id} className={cn('py-0', !p.activo && 'opacity-60')}>
              <CardContent className="flex items-start justify-between gap-3 p-4">
                <div className="min-w-0">
                  <p className="truncate font-medium">
                    {[p.nombre, p.apellido].filter(Boolean).join(' ')}
                  </p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-2">
                    <Badge variant="secondary">{funcionLabel(p.funcion)}</Badge>
                    {!p.activo && <Badge variant="outline">Inactivo</Badge>}
                  </div>
                  {p.telefono && (
                    <p className="mt-2 flex items-center gap-1.5 text-sm text-muted-foreground">
                      <Phone className="size-3.5" strokeWidth={1.75} />
                      {p.telefono}
                    </p>
                  )}
                </div>
                <div className="flex shrink-0 flex-col gap-1">
                  <Button variant="ghost" size="icon-sm" onClick={() => openEdit(p)} aria-label="Editar">
                    <Pencil className="size-4" strokeWidth={1.75} />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => remove(p)}
                    aria-label="Eliminar"
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="size-4" strokeWidth={1.75} />
                  </Button>
                </div>
              </CardContent>
              <button
                onClick={() => toggleActivo(p)}
                className="border-t px-4 py-2 text-left text-xs font-medium text-muted-foreground transition-colors hover:bg-accent"
              >
                {p.activo ? 'Marcar como inactivo' : 'Reactivar'}
              </button>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
