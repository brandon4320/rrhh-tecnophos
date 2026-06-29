import { listarTareas, listarVendedores } from '@/modules/comercial/queries'
import type { Sesion } from '@/lib/auth/session'
import { GrupoTareas, type TareaItem } from './GrupoTareas'
import { AsignarTareaRapida } from '@/components/comercial/AsignarTareaRapida'
import { UsersRound } from 'lucide-react'

interface TareaResp extends TareaItem {
  responsable_id: string
  fecha_completada: string | null
}

export async function VistaPorComercial({ sesion }: { sesion: Sesion }) {
  const [vendedores, tareas] = await Promise.all([
    listarVendedores(),
    listarTareas(sesion, {}) as unknown as Promise<TareaResp[]>,
  ])

  const cutoff7d = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString()

  const porResp = new Map<string, TareaResp[]>()
  for (const t of tareas) {
    if (t.estado === 'cancelada') continue
    const arr = porResp.get(t.responsable_id) ?? []
    arr.push(t)
    porResp.set(t.responsable_id, arr)
  }

  if (vendedores.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border px-6 py-12 text-center">
        <UsersRound className="mx-auto size-10 text-muted-foreground/40" strokeWidth={1.25} />
        <p className="mt-3 text-sm text-muted-foreground">No hay comerciales registrados.</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Tareas abiertas + completadas de los últimos 7 días, por comercial
      </p>

      {vendedores.map((v) => {
        const todas = porResp.get(v.id) ?? []
        const completas7d = todas.filter(
          (t) => t.estado === 'completada' && t.fecha_completada && t.fecha_completada >= cutoff7d
        ).length
        // Mostrar abiertas + completadas recientes (no histórico infinito)
        const aMostrar = todas.filter(
          (t) => t.estado !== 'completada' || (t.fecha_completada != null && t.fecha_completada >= cutoff7d)
        )

        return (
          <GrupoTareas
            key={v.id}
            titulo={v.nombre ?? 'Sin nombre'}
            tareas={aMostrar}
            footer={<AsignarTareaRapida miembroId={v.id} miembroNombre={v.nombre} />}
            badge={
              completas7d > 0 ? (
                <span className="shrink-0 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
                  ✓ {completas7d} completadas (7d)
                </span>
              ) : undefined
            }
          />
        )
      })}
    </div>
  )
}
