import { createClient } from '@/lib/supabase/server'
import { cn } from '@/lib/utils'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

const PRIORIDAD_BADGE: Record<string, string> = {
  critica: 'bg-red-100 text-red-700 border-red-200 dark:bg-red-500/15 dark:text-red-400 dark:border-red-500/30',
  alta: 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-500/15 dark:text-amber-400 dark:border-amber-500/30',
  media: 'bg-sky-100 text-sky-700 border-sky-200 dark:bg-sky-500/15 dark:text-sky-400 dark:border-sky-500/30',
  baja: 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-500/15 dark:text-slate-400 dark:border-slate-500/30',
}

const PRIORIDAD_ORDEN: Record<string, number> = { critica: 0, alta: 1, media: 2, baja: 3 }

const PROXIMOS = [
  { titulo: 'Asistencia diaria', desc: 'Dotación, reemplazos y cierre del supervisor.' },
  { titulo: 'Asignación de tareas', desc: 'Distribución de operarios por área.' },
  { titulo: 'Reporte diario', desc: 'Reporte al supervisor UNIPAR + PDF.' },
]

export default async function OperacionesHome() {
  const supabase = await createClient()

  const [{ data: areas }, { count: dotacion }] = await Promise.all([
    supabase.from('limpieza_areas').select('*').eq('activo', true),
    supabase
      .from('limpieza_personal')
      .select('*', { count: 'exact', head: true })
      .eq('activo', true),
  ])

  const areasOrdenadas = (areas ?? []).sort(
    (a, b) => (PRIORIDAD_ORDEN[a.prioridad] ?? 9) - (PRIORIDAD_ORDEN[b.prioridad] ?? 9)
  )

  const resumen = [
    { label: 'Dotación', valor: dotacion ?? 0, sub: 'personas activas' },
    { label: 'Áreas', valor: areasOrdenadas.length, sub: 'del pliego' },
    { label: 'Mínimo contractual', valor: 13, sub: 'operarios + 1 supervisor' },
  ]

  return (
    <div className="space-y-8">
      {/* Resumen */}
      <div className="grid gap-4 sm:grid-cols-3">
        {resumen.map((r) => (
          <Card key={r.label}>
            <CardContent className="p-5">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{r.label}</p>
              <p className="mt-1 text-2xl font-semibold">{r.valor}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">{r.sub}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Áreas del servicio */}
      <section>
        <h2 className="mb-3 text-sm font-semibold">Áreas del servicio</h2>
        <Card className="overflow-hidden py-0">
          <div className="divide-y">
            {areasOrdenadas.map((a) => (
              <div key={a.id} className="flex items-center justify-between px-5 py-3.5">
                <div className="min-w-0">
                  <p className="truncate font-medium">{a.nombre}</p>
                  {a.frecuencia && <p className="mt-0.5 text-xs text-muted-foreground">{a.frecuencia}</p>}
                </div>
                <Badge
                  variant="outline"
                  className={cn('ml-3 shrink-0 capitalize', PRIORIDAD_BADGE[a.prioridad] ?? PRIORIDAD_BADGE.baja)}
                >
                  {a.prioridad}
                </Badge>
              </div>
            ))}
            {areasOrdenadas.length === 0 && (
              <div className="px-5 py-10 text-center text-sm text-muted-foreground">Sin áreas cargadas.</div>
            )}
          </div>
        </Card>
      </section>

      {/* Próximos features */}
      <section>
        <h2 className="mb-3 text-sm font-semibold">Gestión diaria</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          {PROXIMOS.map((p) => (
            <Card key={p.titulo} className="border-dashed bg-transparent shadow-none">
              <CardContent className="p-5">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-medium">{p.titulo}</p>
                  <Badge variant="secondary" className="shrink-0 text-[10px]">PRÓXIMO</Badge>
                </div>
                <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{p.desc}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
    </div>
  )
}
