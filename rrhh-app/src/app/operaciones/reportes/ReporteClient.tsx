'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import { SectionHeader } from '@/components/operaciones/SectionHeader'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2, Check, CalendarDays } from 'lucide-react'
import { DOTACION_MINIMA, contarPresentes, type EstadoAsistencia } from '@/modules/limpieza/reglas'

type Area = { id: string; nombre: string; tipo: string }
const hoyLocal = () => new Date().toLocaleDateString('en-CA')

export function ReporteClient({ areas }: { areas: Area[] }) {
  const supabase = createClient()
  const [fecha, setFecha] = useState(hoyLocal)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [reporteId, setReporteId] = useState<string | null>(null)
  const [firmadoAt, setFirmadoAt] = useState<string | null>(null)
  const [presentesReales, setPresentesReales] = useState(0)
  const [tareas, setTareas] = useState<Record<string, boolean>>({})
  const [form, setForm] = useState({
    turno_inicio: '06:00',
    turno_fin: '16:00',
    dotacion_presente: '',
    incidencias: '',
    estado_consumibles: '',
    observaciones: '',
  })

  const cargar = useCallback(async () => {
    setLoading(true)
    // dotación real desde Asistencia
    const { data: asis } = await supabase
      .from('limpieza_asistencia')
      .select('estado')
      .eq('fecha', fecha)
    const presentes = contarPresentes((asis ?? []).map((a) => a.estado as EstadoAsistencia))
    setPresentesReales(presentes)

    // reporte existente
    const { data: rep } = await supabase
      .from('limpieza_reportes')
      .select('*')
      .eq('fecha', fecha)
      .maybeSingle()

    if (rep) {
      setReporteId(rep.id)
      setFirmadoAt(rep.firmado_at)
      setTareas((rep.tareas_resumen as Record<string, boolean>) ?? {})
      setForm({
        turno_inicio: rep.turno_inicio?.slice(0, 5) ?? '06:00',
        turno_fin: rep.turno_fin?.slice(0, 5) ?? '16:00',
        dotacion_presente: rep.dotacion_presente?.toString() ?? presentes.toString(),
        incidencias: rep.incidencias ?? '',
        estado_consumibles: rep.estado_consumibles ?? '',
        observaciones: rep.observaciones ?? '',
      })
    } else {
      setReporteId(null)
      setFirmadoAt(null)
      setTareas({})
      setForm((f) => ({ ...f, dotacion_presente: presentes.toString(), incidencias: '', estado_consumibles: '', observaciones: '' }))
    }
    setLoading(false)
  }, [supabase, fecha])

  useEffect(() => {
    cargar()
  }, [cargar])

  async function guardar(firmar = false) {
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    const payload = {
      fecha,
      turno_inicio: form.turno_inicio || null,
      turno_fin: form.turno_fin || null,
      dotacion_presente: form.dotacion_presente ? Number(form.dotacion_presente) : null,
      dotacion_planificada: DOTACION_MINIMA,
      tareas_resumen: tareas,
      incidencias: form.incidencias || null,
      estado_consumibles: form.estado_consumibles || null,
      observaciones: form.observaciones || null,
      ...(firmar ? { firmado_por: user?.id ?? null, firmado_at: new Date().toISOString() } : {}),
    }
    const { data } = await supabase
      .from('limpieza_reportes')
      .upsert(payload, { onConflict: 'fecha' })
      .select('*')
      .single()
    if (data) {
      setReporteId(data.id)
      setFirmadoAt(data.firmado_at)
    }
    setSaving(false)
  }

  const dot = Number(form.dotacion_presente || 0)
  const insuf = dot < DOTACION_MINIMA
  const completadas = Object.values(tareas).filter(Boolean).length

  return (
    <div className="space-y-5">
      <SectionHeader n="03" title="Reporte diario al supervisor UNIPAR" subtitle="Informe al cierre de la jornada" />

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="grid gap-1.5">
          <Label htmlFor="fecha">Fecha</Label>
          <Input id="fecha" type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className="w-44" />
        </div>
        {firmadoAt && (
          <span className="inline-flex items-center gap-1.5 rounded-md border border-emerald-500/30 bg-emerald-100 px-3 py-1.5 text-sm font-medium text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400">
            <Check className="size-4" /> Firmado
          </span>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Cargando…
        </div>
      ) : (
        <>
          {/* Turno + dotación */}
          <Card>
            <CardContent className="grid gap-4 p-4 sm:grid-cols-3 sm:p-5">
              <div className="grid gap-2">
                <Label htmlFor="ti">Turno inicio</Label>
                <Input id="ti" type="time" value={form.turno_inicio} onChange={(e) => setForm({ ...form, turno_inicio: e.target.value })} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="tf">Turno fin</Label>
                <Input id="tf" type="time" value={form.turno_fin} onChange={(e) => setForm({ ...form, turno_fin: e.target.value })} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="dp">Dotación presente</Label>
                <Input
                  id="dp"
                  type="number"
                  value={form.dotacion_presente}
                  onChange={(e) => setForm({ ...form, dotacion_presente: e.target.value })}
                  className={cn(insuf && 'border-red-500/50')}
                />
                <p className="text-xs text-muted-foreground">
                  Asistencia hoy: {presentesReales}/{DOTACION_MINIMA}
                  {insuf && <span className="ml-1 font-medium text-red-600 dark:text-red-400">· bajo mínimo</span>}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Tareas por área */}
          <Card>
            <CardContent className="p-4 sm:p-5">
              <div className="mb-3 flex items-center justify-between">
                <p className="font-medium">Tareas completadas</p>
                <span className="text-sm text-muted-foreground">{completadas}/{areas.length}</span>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                {areas.map((a) => (
                  <label
                    key={a.id}
                    className="flex cursor-pointer items-center gap-3 rounded-md border p-3 text-sm transition-colors hover:bg-accent"
                  >
                    <input
                      type="checkbox"
                      checked={!!tareas[a.id]}
                      onChange={(e) => setTareas((t) => ({ ...t, [a.id]: e.target.checked }))}
                      className="size-4 accent-[var(--primary)]"
                    />
                    <span className={cn(tareas[a.id] && 'font-medium')}>{a.nombre}</span>
                  </label>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Textos */}
          <Card>
            <CardContent className="grid gap-4 p-4 sm:p-5">
              <div className="grid gap-2">
                <Label htmlFor="inc">Incidencias</Label>
                <textarea id="inc" rows={2} value={form.incidencias} onChange={(e) => setForm({ ...form, incidencias: e.target.value })}
                  placeholder="Daños, faltantes o situaciones detectadas" className="w-full rounded-md border border-input px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50" />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="cons">Estado de consumibles</Label>
                <Input id="cons" value={form.estado_consumibles} onChange={(e) => setForm({ ...form, estado_consumibles: e.target.value })} placeholder="Ej: lavandina en alerta" />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="obs">Observaciones</Label>
                <textarea id="obs" rows={2} value={form.observaciones} onChange={(e) => setForm({ ...form, observaciones: e.target.value })}
                  placeholder="Notas del supervisor" className="w-full rounded-md border border-input px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50" />
              </div>
            </CardContent>
          </Card>

          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => guardar(false)} disabled={saving}>
              {saving ? 'Guardando…' : 'Guardar borrador'}
            </Button>
            <Button onClick={() => guardar(true)} disabled={saving}>
              <CalendarDays className="size-4" strokeWidth={2} />
              {firmadoAt ? 'Actualizar y firmar' : 'Firmar y cerrar'}
            </Button>
          </div>
        </>
      )}
    </div>
  )
}
