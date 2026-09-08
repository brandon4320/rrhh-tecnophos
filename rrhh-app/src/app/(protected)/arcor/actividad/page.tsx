import { Segmented } from '@/components/ui/segmented'
import { ListaEventos } from '@/components/arcor/ListaEventos'
import { getEventos } from '@/modules/arcor/queries'
import { diaClaveAR } from '@/lib/fechas-ar'

export const dynamic = 'force-dynamic'

const RANGOS = {
  hoy: { label: 'Hoy' },
  '7d': { label: '7 días' },
  '30d': { label: '30 días' },
} as const
type Rango = keyof typeof RANGOS

function desdeDe(rango: Rango, ahora: Date): string {
  if (rango === 'hoy') return `${diaClaveAR(ahora)}T00:00:00-03:00`
  const dias = rango === '7d' ? 7 : 30
  return new Date(ahora.getTime() - dias * 86400000).toISOString()
}

export default async function ArcorActividadPage({
  searchParams,
}: {
  searchParams: Promise<{ rango?: string; solo?: string }>
}) {
  const sp = await searchParams
  const rango: Rango = sp.rango === '7d' || sp.rango === '30d' ? sp.rango : 'hoy'
  const soloAlertas = sp.solo === 'alertas'
  const ahora = new Date()

  const eventos = await getEventos({ desde: desdeDe(rango, ahora), limit: 400, soloAlertas })

  const q = (r: Rango, solo: boolean) => `/arcor/actividad?rango=${r}${solo ? '&solo=alertas' : ''}`
  const cargas = eventos.filter((e) => e.tipo.startsWith('contenedor') || e.tipo === 'lectura_dudosa').length

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6 lg:p-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Actividad</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {eventos.length} eventos · {cargas} movimientos de contenedores
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Segmented
            active={rango}
            tabs={(Object.keys(RANGOS) as Rango[]).map((r) => ({ key: r, label: RANGOS[r].label, href: q(r, soloAlertas) }))}
          />
          <Segmented
            active={soloAlertas ? 'alertas' : 'todo'}
            tabs={[
              { key: 'todo', label: 'Todo', href: q(rango, false) },
              { key: 'alertas', label: 'Solo alertas', href: q(rango, true) },
            ]}
          />
        </div>
      </div>

      <section className="rounded-2xl border border-border bg-card p-5 sm:p-6">
        <ListaEventos
          eventos={eventos}
          vacio={rango === 'hoy' ? 'Sin actividad hoy todavía. Probá con 7 días.' : 'Sin actividad en este período.'}
        />
      </section>
    </div>
  )
}
