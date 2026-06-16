'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import { SectionHeader } from '@/components/operaciones/SectionHeader'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { X, Loader2 } from 'lucide-react'

type Area = { id: string; nombre: string; tipo: string; prioridad: string }
type Persona = { id: string; nombre: string; apellido: string | null; funcion: string | null }
type Asig = { id: string; area_id: string; personal_id: string }

const PRIORIDAD_BADGE: Record<string, string> = {
  critica: 'bg-red-100 text-red-700 border-red-200 dark:bg-red-500/15 dark:text-red-400 dark:border-red-500/30',
  alta: 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-500/15 dark:text-amber-400 dark:border-amber-500/30',
  media: 'bg-sky-100 text-sky-700 border-sky-200 dark:bg-sky-500/15 dark:text-sky-400 dark:border-sky-500/30',
  baja: 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-500/15 dark:text-slate-400 dark:border-slate-500/30',
}
const hoyLocal = () => new Date().toLocaleDateString('en-CA')

export function AsignacionesClient({ areas, personal }: { areas: Area[]; personal: Persona[] }) {
  const supabase = createClient()
  const [fecha, setFecha] = useState(hoyLocal)
  const [asigs, setAsigs] = useState<Asig[]>([])
  const [loading, setLoading] = useState(true)

  const nombre = (id: string) => {
    const p = personal.find((x) => x.id === id)
    return p ? [p.apellido, p.nombre].filter(Boolean).join(', ') || p.nombre : '—'
  }

  const cargar = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('limpieza_asignaciones')
      .select('id, area_id, personal_id')
      .eq('fecha', fecha)
    setAsigs(data ?? [])
    setLoading(false)
  }, [supabase, fecha])

  useEffect(() => {
    cargar()
  }, [cargar])

  async function agregar(areaId: string, personalId: string) {
    if (!personalId) return
    const { data } = await supabase
      .from('limpieza_asignaciones')
      .insert({ fecha, area_id: areaId, personal_id: personalId })
      .select('id, area_id, personal_id')
      .single()
    if (data) setAsigs((p) => [...p, data])
  }

  async function quitar(id: string) {
    await supabase.from('limpieza_asignaciones').delete().eq('id', id)
    setAsigs((p) => p.filter((a) => a.id !== id))
  }

  const sinAsignar = personal.length - new Set(asigs.map((a) => a.personal_id)).size

  return (
    <div className="space-y-5">
      <SectionHeader n="02" title="Asignación de tareas por área" subtitle="Distribución diaria de operarios por sitio" />

      <div className="flex flex-wrap items-end gap-3">
        <div className="grid gap-1.5">
          <label htmlFor="fecha" className="text-xs font-medium text-muted-foreground">Fecha</label>
          <Input id="fecha" type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className="w-44" />
        </div>
        <p className="pb-2 text-sm text-muted-foreground">{sinAsignar} sin asignar</p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Cargando…
        </div>
      ) : areas.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            No hay sitios cargados. Agregalos en Sitios y áreas.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {areas.map((area) => {
            const asignados = asigs.filter((a) => a.area_id === area.id)
            const disponibles = personal.filter((p) => !asignados.some((a) => a.personal_id === p.id))
            return (
              <Card key={area.id} className="py-0">
                <CardContent className="p-4">
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <p className="font-medium">{area.nombre}</p>
                    <Badge variant="outline" className={cn('capitalize', PRIORIDAD_BADGE[area.prioridad])}>
                      {area.prioridad}
                    </Badge>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {asignados.length === 0 && (
                      <span className="text-sm text-muted-foreground">Sin operarios asignados</span>
                    )}
                    {asignados.map((a) => (
                      <span
                        key={a.id}
                        className="inline-flex items-center gap-1.5 rounded-md bg-primary/10 py-1 pl-2.5 pr-1 text-sm font-medium text-primary"
                      >
                        {nombre(a.personal_id)}
                        <button
                          onClick={() => quitar(a.id)}
                          aria-label="Quitar"
                          className="inline-flex size-5 items-center justify-center rounded hover:bg-primary/20"
                        >
                          <X className="size-3.5" />
                        </button>
                      </span>
                    ))}
                  </div>

                  {disponibles.length > 0 && (
                    <select
                      value=""
                      onChange={(e) => agregar(area.id, e.target.value)}
                      className="mt-3 h-9 w-full rounded-md border border-input px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 sm:w-64"
                    >
                      <option value="">+ Asignar operario…</option>
                      {disponibles.map((p) => (
                        <option key={p.id} value={p.id}>
                          {[p.apellido, p.nombre].filter(Boolean).join(', ') || p.nombre}
                        </option>
                      ))}
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
