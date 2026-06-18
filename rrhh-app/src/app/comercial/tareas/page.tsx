import { requireModulo } from '@/lib/auth/session'
import { listarTareas, listarVendedores } from '@/modules/comercial/queries'
import { completarTarea, cancelarTarea } from '@/modules/comercial/actions'
import { tieneRol, COMERCIAL_GESTION } from '@/lib/auth/roles'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { EmpresaBadge } from '@/components/comercial/EmpresaBadge'
import { EstadoBadge } from '@/components/comercial/EstadoBadge'
import { PriorityBadge } from '@/components/comercial/PriorityBadge'
import { EmptyState } from '@/components/comercial/EmptyState'
import { Button } from '@/components/ui/button'
import { CheckSquare, Plus, Check } from 'lucide-react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { TIPO_TAREA_LABEL, EMPRESA_LABEL, EMPRESAS } from '@/modules/comercial/tipos'
import type { TipoTarea } from '@/modules/comercial/tipos'

function fmtFechaAR(dateStr: string) {
  try {
    const d = new Date(dateStr)
    return format(d, "dd/MM/yyyy · HH:mm", { locale: es })
  } catch { return dateStr }
}

export default async function TareasPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sesion = await requireModulo('comercial')
  const sp = await searchParams
  const esGestion = tieneRol(sesion.rol, COMERCIAL_GESTION)

  const [tareas, vendedores] = await Promise.all([
    listarTareas(sesion, {
      rango: sp.rango as 'hoy' | 'vencidas' | 'semana' | undefined,
      estado: sp.estado,
      empresa: sp.empresa,
      responsable: sp.responsable,
    }),
    esGestion ? listarVendedores() : Promise.resolve([]),
  ])

  async function actionCompletar(form: FormData) {
    'use server'
    await completarTarea(form.get('tarea_id') as string)
    redirect('/comercial/tareas')
  }

  async function actionCancelar(form: FormData) {
    'use server'
    await cancelarTarea(form.get('tarea_id') as string)
    redirect('/comercial/tareas')
  }

  const filtrosRango = [
    { key: '', label: 'Todas' },
    { key: 'hoy', label: 'Hoy' },
    { key: 'vencidas', label: 'Vencidas' },
    { key: 'semana', label: 'Esta semana' },
  ]

  const ahora = new Date().toISOString()

  function tareaUrl(filtros: Record<string, string>) {
    const p = new URLSearchParams()
    const merged = { rango: sp.rango ?? '', estado: sp.estado ?? '', empresa: sp.empresa ?? '', responsable: sp.responsable ?? '', ...filtros }
    Object.entries(merged).forEach(([k, v]) => { if (v) p.set(k, v) })
    const qs = p.toString()
    return `/comercial/tareas${qs ? `?${qs}` : ''}`
  }

  return (
    <div className="space-y-5">
      {/* Encabezado */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Tareas</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">{tareas.length} {tareas.length === 1 ? 'tarea' : 'tareas'}</p>
        </div>
        <Link href="/comercial/tareas/nueva">
          <Button size="sm" className="gap-1.5 rounded-full">
            <Plus className="size-4" strokeWidth={2.5} />Nueva
          </Button>
        </Link>
      </div>

      {/* Filtros — scrollable horizontal en mobile */}
      <div className="space-y-2">
        {/* Rango de tiempo */}
        <div className="flex gap-1.5 overflow-x-auto pb-1 no-scrollbar">
          {filtrosRango.map((f) => (
            <Link key={f.key} href={tareaUrl({ rango: f.key })}
              className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap
                ${(sp.rango ?? '') === f.key
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border text-muted-foreground hover:bg-accent'}`}>
              {f.label}
            </Link>
          ))}
        </div>
        {/* Empresa */}
        <div className="flex gap-1.5 overflow-x-auto pb-1 no-scrollbar">
          <Link href={tareaUrl({ empresa: '' })}
            className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors
              ${!sp.empresa ? 'border-primary bg-primary text-primary-foreground' : 'border-border text-muted-foreground hover:bg-accent'}`}>
            Todas las empresas
          </Link>
          {EMPRESAS.map((emp) => (
            <Link key={emp} href={tareaUrl({ empresa: emp })}
              className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors
                ${sp.empresa === emp ? 'border-primary bg-primary text-primary-foreground' : 'border-border text-muted-foreground hover:bg-accent'}`}>
              {EMPRESA_LABEL[emp]}
            </Link>
          ))}
        </div>
        {/* Responsable (solo gestión) */}
        {esGestion && vendedores.length > 0 && (
          <div className="flex gap-1.5 overflow-x-auto pb-1 no-scrollbar">
            <Link href={tareaUrl({ responsable: '' })}
              className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors
                ${!sp.responsable ? 'border-primary bg-primary text-primary-foreground' : 'border-border text-muted-foreground hover:bg-accent'}`}>
              Todo el equipo
            </Link>
            {vendedores.map((v) => (
              <Link key={v.id} href={tareaUrl({ responsable: v.id })}
                className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors
                  ${sp.responsable === v.id ? 'border-primary bg-primary text-primary-foreground' : 'border-border text-muted-foreground hover:bg-accent'}`}>
                {v.nombre ?? v.id.slice(0, 6)}
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Lista de tareas — cards */}
      {tareas.length === 0 ? (
        <EmptyState icon={CheckSquare} title="Sin tareas" description="No hay tareas en este filtro."
          action={<Link href="/comercial/tareas/nueva"><Button size="sm">Nueva tarea</Button></Link>} />
      ) : (
        <div className="space-y-2">
          {tareas.map((t) => {
            const tAny = t as { empresa?: string | null; nota_asignacion?: string | null }
            const vencida = t.fecha_vencimiento && t.fecha_vencimiento < ahora && t.estado !== 'completada'
            const pendiente = t.estado === 'pendiente' || t.estado === 'en_proceso'

            return (
              <div key={t.id} className={`rounded-xl border bg-card overflow-hidden transition-colors
                ${vencida ? 'border-red-400/40' : 'border-border'}`}>
                <div className="flex items-start gap-3 px-4 py-3.5">
                  {/* Check button */}
                  {pendiente ? (
                    <form action={actionCompletar} className="shrink-0 mt-0.5">
                      <input type="hidden" name="tarea_id" value={t.id} />
                      <button type="submit"
                        className="flex size-5 items-center justify-center rounded border-2 border-muted-foreground/40 text-transparent hover:border-emerald-500 hover:text-emerald-500 transition-colors"
                        title="Marcar como completada">
                        <Check className="size-3" strokeWidth={3} />
                      </button>
                    </form>
                  ) : (
                    <div className="shrink-0 mt-0.5 flex size-5 items-center justify-center rounded border-2 border-emerald-500/50 text-emerald-500">
                      <Check className="size-3" strokeWidth={3} />
                    </div>
                  )}

                  <div className="min-w-0 flex-1">
                    <p className={`text-sm font-medium leading-snug ${t.estado === 'completada' ? 'line-through text-muted-foreground' : ''}`}>
                      {t.titulo}
                    </p>
                    {tAny.nota_asignacion && (
                      <p className="mt-0.5 text-[11px] text-primary/80 italic">📌 {tAny.nota_asignacion}</p>
                    )}
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      {tAny.empresa && <EmpresaBadge empresa={tAny.empresa} size="xs" />}
                      <EstadoBadge estado={t.estado} />
                      <PriorityBadge prioridad={t.prioridad} />
                      <span className="text-[10px] text-muted-foreground">{TIPO_TAREA_LABEL[t.tipo as TipoTarea] ?? t.tipo}</span>
                    </div>
                    <div className="mt-1 flex items-center justify-between">
                      {t.fecha_vencimiento ? (
                        <span className={`text-[11px] font-medium ${vencida ? 'text-red-500' : 'text-muted-foreground'}`}>
                          {vencida ? '⚠ ' : ''}Vence: {fmtFechaAR(t.fecha_vencimiento)}
                        </span>
                      ) : <span />}
                      {t.proyecto_id && (
                        <Link href={`/comercial/proyectos/${t.proyecto_id}`} className="text-[10px] text-primary hover:underline">
                          Ver proyecto →
                        </Link>
                      )}
                    </div>
                  </div>
                </div>

                {/* Acciones rápidas (solo pendientes) */}
                {pendiente && (
                  <div className="flex items-center gap-3 border-t border-border bg-muted/30 px-4 py-2">
                    <form action={actionCompletar}>
                      <input type="hidden" name="tarea_id" value={t.id} />
                      <button type="submit" className="text-[11px] font-medium text-emerald-600 hover:text-emerald-700">
                        ✓ Completar
                      </button>
                    </form>
                    <form action={actionCancelar}>
                      <input type="hidden" name="tarea_id" value={t.id} />
                      <button type="submit" className="text-[11px] text-muted-foreground hover:text-red-500">
                        Cancelar
                      </button>
                    </form>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
