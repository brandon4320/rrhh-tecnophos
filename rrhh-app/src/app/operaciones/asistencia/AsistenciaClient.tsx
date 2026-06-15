'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import { SectionHeader } from '@/components/operaciones/SectionHeader'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react'
import { DOTACION_MINIMA, contarPresentes, type EstadoAsistencia } from '@/modules/limpieza/reglas'

type Persona = { id: string; nombre: string; apellido: string | null; funcion: string | null }
type Fila = { estado: EstadoAsistencia; observaciones: string | null; confirmado_at: string | null }

const ESTADOS: { value: EstadoAsistencia; letra: string; nombre: string; activo: string }[] = [
  { value: 'presente', letra: '✓', nombre: 'Presente', activo: 'bg-emerald-600 text-white border-emerald-600' },
  { value: 'tarde', letra: 'L', nombre: 'Llegada tarde', activo: 'bg-amber-500 text-white border-amber-500' },
  { value: 'reemplazo', letra: 'E', nombre: 'En reemplazo', activo: 'bg-blue-600 text-white border-blue-600' },
  { value: 'ausente', letra: 'A', nombre: 'Ausente', activo: 'bg-red-600 text-white border-red-600' },
  { value: 'no_trabaja', letra: '—', nombre: 'No trabaja', activo: 'bg-slate-500 text-white border-slate-500' },
]

const FUNCIONES: Record<string, string> = {
  tipo1: 'Tipo 1', tipo2: 'Tipo 2', tipo3: 'Tipo 3', supervisor: 'Supervisor', reemplazo: 'Reemplazo',
}

const hoyLocal = () => new Date().toLocaleDateString('en-CA') // YYYY-MM-DD

export function AsistenciaClient({ personal }: { personal: Persona[] }) {
  const supabase = createClient()
  const [fecha, setFecha] = useState(hoyLocal)
  const [filas, setFilas] = useState<Record<string, Fila>>({})
  const [loading, setLoading] = useState(true)
  const [confirmando, setConfirmando] = useState(false)

  const cargar = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('limpieza_asistencia')
      .select('personal_id, estado, observaciones, confirmado_at')
      .eq('fecha', fecha)
    const map: Record<string, Fila> = {}
    for (const r of data ?? []) {
      map[r.personal_id] = {
        estado: r.estado as EstadoAsistencia,
        observaciones: r.observaciones,
        confirmado_at: r.confirmado_at,
      }
    }
    setFilas(map)
    setLoading(false)
  }, [supabase, fecha])

  useEffect(() => {
    cargar()
  }, [cargar])

  async function setEstado(personaId: string, estado: EstadoAsistencia) {
    // optimista
    setFilas((p) => ({ ...p, [personaId]: { ...(p[personaId] ?? { observaciones: null, confirmado_at: null }), estado } }))
    await supabase
      .from('limpieza_asistencia')
      .upsert(
        { personal_id: personaId, fecha, estado, observaciones: filas[personaId]?.observaciones ?? null },
        { onConflict: 'personal_id,fecha' }
      )
  }

  async function setObs(personaId: string, observaciones: string) {
    const estado = filas[personaId]?.estado
    if (!estado) return // sin estado no guardamos obs sueltas
    setFilas((p) => ({ ...p, [personaId]: { ...p[personaId], observaciones } }))
    await supabase
      .from('limpieza_asistencia')
      .upsert({ personal_id: personaId, fecha, estado, observaciones: observaciones || null }, { onConflict: 'personal_id,fecha' })
  }

  async function confirmarJornada() {
    setConfirmando(true)
    const { data: { user } } = await supabase.auth.getUser()
    await supabase
      .from('limpieza_asistencia')
      .update({ confirmado_por: user?.id ?? null, confirmado_at: new Date().toISOString() })
      .eq('fecha', fecha)
    await cargar()
    setConfirmando(false)
  }

  const estados = personal.map((p) => filas[p.id]?.estado).filter(Boolean) as EstadoAsistencia[]
  const presentes = contarPresentes(estados)
  const marcados = estados.length
  const insuficiente = presentes < DOTACION_MINIMA
  const confirmada = Object.values(filas).some((f) => f.confirmado_at)

  return (
    <div className="space-y-5">
      <SectionHeader n="01" title="Control de asistencia diaria" subtitle="Presentismo, reemplazos y cierre de jornada" />

      {/* Barra fecha + dotación */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="grid gap-1.5">
          <label htmlFor="fecha" className="text-xs font-medium text-muted-foreground">Fecha</label>
          <Input
            id="fecha"
            type="date"
            value={fecha}
            max={hoyLocal()}
            onChange={(e) => setFecha(e.target.value)}
            className="w-44"
          />
        </div>
        <div
          className={cn(
            'flex items-center gap-2 self-end rounded-md border px-3 py-2 text-sm',
            insuficiente
              ? 'border-red-500/30 bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400'
              : 'border-emerald-500/30 bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400'
          )}
        >
          {insuficiente ? <AlertTriangle className="size-4" /> : <CheckCircle2 className="size-4" />}
          <span className="font-medium tabular-nums">
            {presentes}/{DOTACION_MINIMA}
          </span>
          <span className="text-xs">{insuficiente ? 'dotación insuficiente' : 'dotación OK'}</span>
        </div>
      </div>

      {/* Leyenda */}
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        {ESTADOS.map((e) => (
          <span key={e.value} className="inline-flex items-center gap-1.5">
            <span className={cn('inline-flex size-4 items-center justify-center rounded text-[10px] font-bold', e.activo)}>
              {e.letra}
            </span>
            {e.nombre}
          </span>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Cargando…
        </div>
      ) : personal.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            No hay personal activo. Cargalo en la sección Personal.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2.5">
          {personal.map((p) => {
            const fila = filas[p.id]
            return (
              <Card key={p.id} className="py-0">
                <CardContent className="p-3 sm:p-4">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="truncate font-medium">
                      {[p.apellido, p.nombre].filter(Boolean).join(', ') || p.nombre}
                    </p>
                    <span className="shrink-0 text-xs text-muted-foreground">{FUNCIONES[p.funcion ?? ''] ?? ''}</span>
                  </div>
                  <div className="mt-2.5 flex gap-1.5">
                    {ESTADOS.map((e) => {
                      const active = fila?.estado === e.value
                      return (
                        <button
                          key={e.value}
                          type="button"
                          onClick={() => setEstado(p.id, e.value)}
                          title={e.nombre}
                          aria-label={e.nombre}
                          className={cn(
                            'flex h-10 flex-1 items-center justify-center rounded-md border text-sm font-semibold transition-colors',
                            active
                              ? e.activo
                              : 'border-input bg-muted/40 text-muted-foreground hover:bg-accent'
                          )}
                        >
                          {e.letra}
                        </button>
                      )
                    })}
                  </div>
                  {fila?.estado && (
                    <Input
                      defaultValue={fila.observaciones ?? ''}
                      onBlur={(e) => {
                        if ((e.target.value || '') !== (fila.observaciones ?? '')) setObs(p.id, e.target.value)
                      }}
                      placeholder="Observación (opcional)"
                      className="mt-2.5 h-8 text-sm"
                    />
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* Cierre */}
      {!loading && personal.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
          <p className="text-sm text-muted-foreground">
            {marcados}/{personal.length} marcados
            {confirmada && <span className="ml-2 font-medium text-emerald-600 dark:text-emerald-400">· Jornada confirmada</span>}
          </p>
          <Button onClick={confirmarJornada} disabled={confirmando || marcados === 0}>
            {confirmando ? 'Confirmando…' : confirmada ? 'Volver a confirmar' : 'Confirmar jornada'}
          </Button>
        </div>
      )}
    </div>
  )
}
