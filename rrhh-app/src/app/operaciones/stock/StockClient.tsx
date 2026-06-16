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
import { Plus, AlertTriangle } from 'lucide-react'
import { stockEnAlerta } from '@/modules/limpieza/reglas'

type Consumible = Tables<'limpieza_consumibles'>
const EMPTY = { nombre: '', stock_pct: '100', minimo_pct: '30', provee: 'ADC' }

export function StockClient({ inicial }: { inicial: Consumible[] }) {
  const supabase = createClient()
  const [items, setItems] = useState<Consumible[]>(inicial)
  const [edit, setEdit] = useState<Record<string, string>>({})
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(EMPTY)
  const [saving, setSaving] = useState(false)

  async function actualizar(c: Consumible) {
    const nuevo = Number(edit[c.id])
    if (Number.isNaN(nuevo) || nuevo === c.stock_pct) return
    const clamped = Math.max(0, Math.min(100, nuevo))
    await supabase.from('limpieza_consumible_mov').insert({
      consumible_id: c.id,
      pct_anterior: c.stock_pct,
      pct_nuevo: clamped,
      tipo: clamped > c.stock_pct ? 'reposicion' : 'consumo',
    })
    const { data } = await supabase
      .from('limpieza_consumibles')
      .update({ stock_pct: clamped })
      .eq('id', c.id)
      .select('*')
      .single()
    if (data) {
      setItems((p) => p.map((x) => (x.id === c.id ? data : x)))
      setEdit((e) => ({ ...e, [c.id]: '' }))
    }
  }

  async function crear() {
    if (!form.nombre.trim()) return
    setSaving(true)
    const { data } = await supabase
      .from('limpieza_consumibles')
      .insert({
        nombre: form.nombre.trim(),
        stock_pct: Number(form.stock_pct) || 0,
        minimo_pct: Number(form.minimo_pct) || 0,
        provee: form.provee || null,
      })
      .select('*')
      .single()
    if (data) setItems((p) => [...p, data].sort((a, b) => a.nombre.localeCompare(b.nombre)))
    setSaving(false)
    setShowForm(false)
    setForm(EMPTY)
  }

  const enAlerta = items.filter((c) => stockEnAlerta(c.stock_pct, c.minimo_pct)).length

  return (
    <div className="space-y-5">
      <SectionHeader
        n="06"
        title="Control de stock de consumibles"
        subtitle="Monitoreo y alerta ante stock mínimo"
        action={
          <Button size="sm" variant="secondary" onClick={() => setShowForm((s) => !s)} className="bg-white/10 text-white hover:bg-white/20">
            <Plus className="size-4" /> Insumo
          </Button>
        }
      />

      {enAlerta > 0 && (
        <div className="flex items-center gap-2 rounded-md border border-red-500/30 bg-red-100 px-3 py-2 text-sm text-red-700 dark:bg-red-500/15 dark:text-red-400">
          <AlertTriangle className="size-4" />
          {enAlerta} insumo{enAlerta > 1 ? 's' : ''} bajo el mínimo
        </div>
      )}

      {showForm && (
        <Card>
          <CardContent className="grid gap-4 p-4 sm:grid-cols-4 sm:p-5">
            <div className="grid gap-2 sm:col-span-2">
              <Label htmlFor="nombre">Insumo</Label>
              <Input id="nombre" value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} placeholder="Lavandina" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="stock">Stock %</Label>
              <Input id="stock" type="number" value={form.stock_pct} onChange={(e) => setForm({ ...form, stock_pct: e.target.value })} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="min">Mínimo %</Label>
              <Input id="min" type="number" value={form.minimo_pct} onChange={(e) => setForm({ ...form, minimo_pct: e.target.value })} />
            </div>
            <div className="grid gap-2 sm:col-span-2">
              <Label htmlFor="provee">Provee</Label>
              <select id="provee" value={form.provee} onChange={(e) => setForm({ ...form, provee: e.target.value })}
                className="h-9 w-full rounded-md border border-input px-3 text-sm">
                <option value="ADC">ADC provee</option>
                <option value="UNIPAR">ADC solicita a UNIPAR</option>
              </select>
            </div>
            <div className="flex items-end gap-2 sm:col-span-2">
              <Button onClick={crear} disabled={saving}>{saving ? 'Guardando…' : 'Agregar'}</Button>
              <Button variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="space-y-3">
        {items.map((c) => {
          const alerta = stockEnAlerta(c.stock_pct, c.minimo_pct)
          return (
            <Card key={c.id} className="py-0">
              <CardContent className="p-4">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="font-medium">{c.nombre}</p>
                    <p className="text-xs text-muted-foreground">
                      Mín {c.minimo_pct}% · {c.provee === 'UNIPAR' ? 'ADC solicita a UNIPAR' : 'ADC provee'}
                    </p>
                  </div>
                  <Badge variant="outline" className={cn(alerta
                    ? 'bg-red-100 text-red-700 border-red-200 dark:bg-red-500/15 dark:text-red-400 dark:border-red-500/30'
                    : 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-400 dark:border-emerald-500/30')}>
                    {alerta ? 'ALERTA' : 'OK'} · {c.stock_pct}%
                  </Badge>
                </div>

                <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className={cn('h-full rounded-full', alerta ? 'bg-red-500' : 'bg-primary')}
                    style={{ width: `${Math.max(0, Math.min(100, c.stock_pct))}%` }}
                  />
                </div>

                <div className="mt-3 flex items-center gap-2">
                  <Input
                    type="number"
                    placeholder="Nuevo %"
                    value={edit[c.id] ?? ''}
                    onChange={(e) => setEdit((s) => ({ ...s, [c.id]: e.target.value }))}
                    className="h-8 w-28"
                  />
                  <Button size="sm" variant="outline" onClick={() => actualizar(c)} disabled={!edit[c.id]}>
                    Actualizar
                  </Button>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
