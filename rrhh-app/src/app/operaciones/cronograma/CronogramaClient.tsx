'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import { SectionHeader } from '@/components/operaciones/SectionHeader'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { X, Loader2 } from 'lucide-react'

type Area = { id: string; nombre: string }
type Persona = { id: string; nombre: string; apellido: string | null }
type Entry = { id: string; area_id: string; personal_id: string; dia: number }

const DIAS = [
  { n: 1, l: 'Lun' }, { n: 2, l: 'Mar' }, { n: 3, l: 'Mié' },
  { n: 4, l: 'Jue' }, { n: 5, l: 'Vie' }, { n: 6, l: 'Sáb' },
]

function mondayOf(dateStr?: string) {
  const d = dateStr ? new Date(dateStr + 'T12:00:00') : new Date()
  const day = (d.getDay() + 6) % 7
  d.setDate(d.getDate() - day)
  return d.toLocaleDateString('en-CA')
}

export function CronogramaClient({ areas, personal }: { areas: Area[]; personal: Persona[] }) {
  const supabase = createClient()
  const [semana, setSemana] = useState(() => mondayOf())
  const [dia, setDia] = useState(1)
  const [entries, setEntries] = useState<Entry[]>([])
  const [loading, setLoading] = useState(true)

  const nombre = (id: string) => { const p = personal.find((x) => x.id === id); return p ? [p.apellido, p.nombre].filter(Boolean).join(', ') || p.nombre : '—' }

  const cargar = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('limpieza_cronograma')
      .select('id, area_id, personal_id, dia')
      .eq('semana', semana)
    setEntries(data ?? [])
    setLoading(false)
  }, [supabase, semana])

  useEffect(() => { cargar() }, [cargar])

  async function agregar(areaId: string, personalId: string) {
    if (!personalId) return
    const { data } = await supabase
      .from('limpieza_cronograma')
      .insert({ semana, area_id: areaId, personal_id: personalId, dia })
      .select('id, area_id, personal_id, dia')
      .single()
    if (data) setEntries((p) => [...p, data])
  }
  async function quitar(id: string) {
    await supabase.from('limpieza_cronograma').delete().eq('id', id)
    setEntries((p) => p.filter((e) => e.id !== id))
  }

  const countDia = (n: number) => entries.filter((e) => e.dia === n).length

  return (
    <div className="space-y-5">
      <SectionHeader n="04" title="Cronograma de personal por turno" subtitle="Planificación semanal por área y día" />

      <div className="flex flex-wrap items-end gap-3">
        <div className="grid gap-1.5">
          <label className="text-xs font-medium text-muted-foreground">Semana del</label>
          <Input type="date" value={semana} onChange={(e) => setSemana(mondayOf(e.target.value))} className="w-44" />
        </div>
      </div>

      {/* Días */}
      <div className="flex gap-1.5 overflow-x-auto">
        {DIAS.map((d) => (
          <button
            key={d.n}
            onClick={() => setDia(d.n)}
            className={cn(
              'flex shrink-0 flex-col items-center rounded-md border px-3 py-1.5 text-sm transition-colors',
              dia === d.n ? 'border-primary bg-primary/10 text-primary' : 'border-input text-muted-foreground hover:bg-accent'
            )}
          >
            <span className="font-medium">{d.l}</span>
            <span className="text-xs tabular-nums">{countDia(d.n)}</span>
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" /> Cargando…</div>
      ) : areas.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-sm text-muted-foreground">No hay sitios cargados.</CardContent></Card>
      ) : (
        <div className="space-y-3">
          {areas.map((area) => {
            const asignados = entries.filter((e) => e.area_id === area.id && e.dia === dia)
            const disponibles = personal.filter((p) => !asignados.some((a) => a.personal_id === p.id))
            return (
              <Card key={area.id} className="py-0">
                <CardContent className="p-4">
                  <p className="mb-3 font-medium">{area.nombre}</p>
                  <div className="flex flex-wrap gap-2">
                    {asignados.length === 0 && <span className="text-sm text-muted-foreground">Sin asignar</span>}
                    {asignados.map((a) => (
                      <span key={a.id} className="inline-flex items-center gap-1.5 rounded-md bg-primary/10 py-1 pl-2.5 pr-1 text-sm font-medium text-primary">
                        {nombre(a.personal_id)}
                        <button onClick={() => quitar(a.id)} aria-label="Quitar" className="inline-flex size-5 items-center justify-center rounded hover:bg-primary/20">
                          <X className="size-3.5" />
                        </button>
                      </span>
                    ))}
                  </div>
                  {disponibles.length > 0 && (
                    <select value="" onChange={(e) => agregar(area.id, e.target.value)}
                      className="mt-3 h-9 w-full rounded-md border border-input px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 sm:w-64">
                      <option value="">+ Asignar al {DIAS.find((d) => d.n === dia)?.l}…</option>
                      {disponibles.map((p) => <option key={p.id} value={p.id}>{[p.apellido, p.nombre].filter(Boolean).join(', ') || p.nombre}</option>)}
                    </select>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
