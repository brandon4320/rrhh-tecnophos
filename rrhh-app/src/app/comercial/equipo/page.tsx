import { requireModulo } from '@/lib/auth/session'
import { listarEquipoComercial } from '@/modules/comercial/queries'
import { puedeVerEquipoComercial } from '@/modules/comercial/permisos'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { UsersRound, AlertTriangle, CheckSquare, FolderKanban, TrendingUp, Clock, AlertCircle, LogIn } from 'lucide-react'
import { AsignarTareaRapida } from '@/components/comercial/AsignarTareaRapida'

const ROL_LABEL: Record<string, string> = {
  vendedor:            'Vendedor/a',
  gerente_comercial:   'Gerente Comercial',
  asistente_comercial: 'Asistente Comercial',
  direccion:           'Dirección',
  admin:               'Administrador',
}

function formatPeso(valor: number) {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(valor)
}

function fmtRelativo(dateStr: string | null) {
  if (!dateStr) return null
  try {
    const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24))
    if (diff === 0) return 'Hoy'
    if (diff === 1) return 'Ayer'
    return `Hace ${diff} días`
  } catch { return null }
}

function getInitials(nombre: string | null) {
  if (!nombre) return '?'
  return nombre.split(' ').slice(0, 2).map((n) => n[0]).join('').toUpperCase()
}

const AVATAR_COLORS = [
  'bg-blue-500', 'bg-emerald-500', 'bg-violet-500',
  'bg-amber-500', 'bg-rose-500', 'bg-cyan-500',
]

export default async function EquipoComercialPage() {
  const sesion = await requireModulo('comercial')
  if (!puedeVerEquipoComercial(sesion)) redirect('/comercial')

  const equipo = await listarEquipoComercial()

  // Traer last_sign_in_at real desde auth.users (admin API)
  let loginMap = new Map<string, string | null>()
  try {
    const admin = createAdminClient()
    const { data } = await admin.auth.admin.listUsers({ perPage: 200 })
    for (const u of data?.users ?? []) {
      loginMap.set(u.id, u.last_sign_in_at ?? null)
    }
  } catch { /* service role no disponible, se muestra sin login */ }

  if (equipo.length === 0) {
    return (
      <div className="space-y-4">
        <h1 className="text-xl font-bold tracking-tight">Equipo comercial</h1>
        <div className="rounded-xl border border-dashed border-border px-6 py-12 text-center">
          <UsersRound className="mx-auto size-10 text-muted-foreground/40" strokeWidth={1.25} />
          <p className="mt-3 text-sm text-muted-foreground">No hay comerciales registrados aún.</p>
        </div>
      </div>
    )
  }

  const totalVencidas      = equipo.reduce((s, m) => s + m.tareasVencidas, 0)
  const totalAbiertas      = equipo.reduce((s, m) => s + m.tareasAbiertas, 0)
  const totalProyectos     = equipo.reduce((s, m) => s + m.proyectosAbiertos, 0)
  const totalSinAccion     = equipo.reduce((s, m) => s + m.proyectosSinAccion, 0)
  const totalPipeline      = equipo.reduce((s, m) => s + m.pipeline, 0)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold tracking-tight">Equipo comercial</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">{equipo.length} {equipo.length === 1 ? 'integrante' : 'integrantes'}</p>
      </div>

      {/* Resumen consolidado */}
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-5">
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-1.5 text-muted-foreground mb-1.5">
            <FolderKanban className="size-3.5" strokeWidth={1.75} />
            <span className="text-xs font-medium">Proyectos</span>
          </div>
          <p className="text-2xl font-bold">{totalProyectos}</p>
          <p className="text-xs text-muted-foreground">abiertos en equipo</p>
        </div>
        <div className={`rounded-xl border p-4 ${totalVencidas > 0 ? 'border-red-500/40 bg-red-500/5' : 'border-border bg-card'}`}>
          <div className={`flex items-center gap-1.5 mb-1.5 ${totalVencidas > 0 ? 'text-red-500' : 'text-muted-foreground'}`}>
            <AlertTriangle className="size-3.5" strokeWidth={1.75} />
            <span className="text-xs font-medium">Vencidas</span>
          </div>
          <p className={`text-2xl font-bold ${totalVencidas > 0 ? 'text-red-500' : ''}`}>{totalVencidas}</p>
          <p className="text-xs text-muted-foreground">tareas atrasadas</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-1.5 text-muted-foreground mb-1.5">
            <CheckSquare className="size-3.5" strokeWidth={1.75} />
            <span className="text-xs font-medium">En cola</span>
          </div>
          <p className="text-2xl font-bold">{totalAbiertas}</p>
          <p className="text-xs text-muted-foreground">tareas abiertas</p>
        </div>
        <div className={`rounded-xl border p-4 ${totalSinAccion > 0 ? 'border-amber-400/40 bg-amber-50/30 dark:bg-amber-900/10' : 'border-border bg-card'}`}>
          <div className={`flex items-center gap-1.5 mb-1.5 ${totalSinAccion > 0 ? 'text-amber-500' : 'text-muted-foreground'}`}>
            <AlertCircle className="size-3.5" strokeWidth={1.75} />
            <span className="text-xs font-medium">Sin acción</span>
          </div>
          <p className={`text-2xl font-bold ${totalSinAccion > 0 ? 'text-amber-500' : ''}`}>{totalSinAccion}</p>
          <p className="text-xs text-muted-foreground">proyectos parados</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-1.5 text-muted-foreground mb-1.5">
            <TrendingUp className="size-3.5" strokeWidth={1.75} />
            <span className="text-xs font-medium">Pipeline</span>
          </div>
          <p className="text-lg font-bold">{formatPeso(totalPipeline)}</p>
          <p className="text-xs text-muted-foreground">total estimado</p>
        </div>
      </div>

      {/* Cards por comercial */}
      <div className="space-y-3">
        {equipo.map((miembro, idx) => {
          const color = AVATAR_COLORS[idx % AVATAR_COLORS.length]
          const tieneProblemas = miembro.tareasVencidas > 0
          const ultimoLogin = loginMap.get(miembro.id) ?? null

          return (
            <div key={miembro.id}
              className={`rounded-xl border bg-card overflow-hidden ${tieneProblemas ? 'border-red-400/30' : 'border-border'}`}>
              <div className="flex items-start gap-4 p-4">
                {/* Avatar */}
                <div className={`flex size-10 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white ${color}`}>
                  {getInitials(miembro.nombre)}
                </div>

                {/* Info */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold leading-tight">{miembro.nombre ?? 'Sin nombre'}</p>
                      <p className="text-xs text-muted-foreground">{ROL_LABEL[miembro.rol] ?? miembro.rol}</p>
                    </div>
                    <div className="shrink-0 space-y-0.5 text-right">
                      <p className={`text-[10px] flex items-center justify-end gap-1 ${ultimoLogin ? 'text-muted-foreground' : 'text-red-400'}`}>
                        <LogIn className="size-3" />
                        {ultimoLogin ? fmtRelativo(ultimoLogin) : 'Sin login'}
                      </p>
                      {miembro.ultimaActividad && (
                        <p className="text-[10px] text-muted-foreground/60 flex items-center justify-end gap-1">
                          <Clock className="size-3" />
                          act. {fmtRelativo(miembro.ultimaActividad)}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Métricas */}
                  <div className="mt-2.5 flex flex-wrap gap-2">
                    <span className={`rounded-md px-2 py-0.5 text-xs font-medium
                      ${miembro.tareasVencidas > 0
                        ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
                        : 'bg-muted text-muted-foreground'}`}>
                      {miembro.tareasVencidas > 0 ? `⚠ ${miembro.tareasVencidas} vencida${miembro.tareasVencidas > 1 ? 's' : ''}` : 'Al día'}
                    </span>
                    <span className="rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                      {miembro.tareasHoy} para hoy
                    </span>
                    <span className={`rounded-md px-2 py-0.5 text-xs font-medium
                      ${miembro.tareasCompletadas7d > 0
                        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
                        : 'bg-muted text-muted-foreground'}`}>
                      ✓ {miembro.tareasCompletadas7d} en 7d
                    </span>
                    <span className="rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                      {miembro.proyectosAbiertos} {miembro.proyectosAbiertos === 1 ? 'proyecto' : 'proyectos'}
                    </span>
                    {miembro.pipeline > 0 && (
                      <span className="rounded-md bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                        {formatPeso(miembro.pipeline)}
                      </span>
                    )}
                    {miembro.proyectosSinAccion > 0 && (
                      <span className="rounded-md bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                        {miembro.proyectosSinAccion} sin acción
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Acciones */}
              <div className="flex items-center gap-3 border-t border-border bg-muted/30 px-4 py-2.5">
                <AsignarTareaRapida miembroId={miembro.id} miembroNombre={miembro.nombre} />
                <Link
                  href={`/comercial/tareas?responsable=${miembro.id}&rango=vencidas`}
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors">
                  Ver tareas
                </Link>
                <Link
                  href={`/comercial/proyectos?responsable=${miembro.id}`}
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors">
                  Ver proyectos
                </Link>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
