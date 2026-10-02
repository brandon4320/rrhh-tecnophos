import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { Segmented } from '@/components/ui/segmented'
import { ListaEventos } from '@/components/arcor/ListaEventos'
import { AutoRefresh } from '@/components/arcor/AutoRefresh'
import { contarActividad, getActividad, type FiltroActividad } from '@/modules/arcor/queries'
import { TIPOS_MOVIMIENTO, cursorDe, parseCursor } from '@/modules/arcor/reglas'
import { diaClaveAR, fmtFechaHoraAR } from '@/lib/fechas-ar'

export const dynamic = 'force-dynamic'

/** Eventos por página. Antes era un `limit 400` mudo: "30 días" mostraba ~7 y nadie se enteraba. */
const POR_PAGINA = 300

const RANGOS = {
  hoy: { label: 'Hoy' },
  '7d': { label: '7 días' },
  '30d': { label: '30 días' },
} as const
type Rango = keyof typeof RANGOS

/** importante = sin ruido (TIPOS_RUIDO) · todo = el log entero · alertas = incidentes y alertas. */
const FILTROS = {
  importante: { label: 'Importante' },
  todo: { label: 'Todo' },
  alertas: { label: 'Solo alertas' },
} as const
type Filtro = keyof typeof FILTROS

function desdeDe(rango: Rango, ahora: Date): string {
  if (rango === 'hoy') return `${diaClaveAR(ahora)}T00:00:00-03:00`
  const dias = rango === '7d' ? 7 : 30
  return new Date(ahora.getTime() - dias * 86400000).toISOString()
}

export default async function ArcorActividadPage({
  searchParams,
}: {
  searchParams: Promise<{ rango?: string; solo?: string; antes?: string }>
}) {
  const sp = await searchParams
  const rango: Rango = sp.rango === '7d' || sp.rango === '30d' ? sp.rango : 'hoy'
  const filtro: Filtro = sp.solo === 'alertas' || sp.solo === 'todo' ? sp.solo : 'importante'
  const antes = parseCursor(sp.antes)
  const ahora = new Date()
  const desde = desdeDe(rango, ahora)

  const f: FiltroActividad = { desde, soloAlertas: filtro === 'alertas', sinRuido: filtro === 'importante' }
  // Los números del encabezado son conteos de la DB (head), no de la página que se muestra.
  const [pagina, total, movimientos, ocultos] = await Promise.all([
    getActividad({ ...f, antes, limit: POR_PAGINA }),
    contarActividad(f),
    contarActividad({ ...f, tipos: TIPOS_MOVIMIENTO }),
    filtro === 'importante' ? contarActividad({ desde, soloRuido: true }) : Promise.resolve(0),
  ])

  const href = (p: { rango?: Rango; filtro?: Filtro; antes?: string }) => {
    const q = new URLSearchParams()
    q.set('rango', p.rango ?? rango)
    const fl = p.filtro ?? filtro
    if (fl !== 'importante') q.set('solo', fl)
    if (p.antes) q.set('antes', p.antes)
    return `/arcor/actividad?${q.toString()}`
  }
  const ultimo = pagina.eventos[pagina.eventos.length - 1]

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6 lg:p-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Actividad</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {total} {total === 1 ? 'evento' : 'eventos'} · {movimientos} movimientos de contenedores
            {ocultos > 0 && (
              <>
                {' · '}
                <Link
                  href={href({ filtro: 'todo' })}
                  className="hover:text-foreground hover:underline"
                  title="Fotos que no eran certificados y lecturas con Claude (repiten el evento del contenedor)"
                >
                  {ocultos} técnicos ocultos
                </Link>
              </>
            )}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <AutoRefresh generado={ahora.toISOString()} />
          <Segmented
            active={rango}
            tabs={(Object.keys(RANGOS) as Rango[]).map((r) => ({ key: r, label: RANGOS[r].label, href: href({ rango: r }) }))}
          />
          <Segmented
            active={filtro}
            tabs={(Object.keys(FILTROS) as Filtro[]).map((k) => ({ key: k, label: FILTROS[k].label, href: href({ filtro: k }) }))}
          />
        </div>
      </div>

      <section className="rounded-2xl border border-border bg-card p-5 sm:p-6">
        {antes && (
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2 border-b border-border pb-4 text-sm text-muted-foreground">
            <span>Anteriores al {fmtFechaHoraAR(antes.ts)}</span>
            <Link href={href({})} className="font-medium text-primary hover:underline">
              Volver a lo más reciente
            </Link>
          </div>
        )}
        <ListaEventos
          eventos={pagina.eventos}
          vacio={
            antes ? 'No hay eventos más viejos en este período.'
            : rango === 'hoy' ? 'Sin actividad hoy todavía. Probá con 7 días.'
            : 'Sin actividad en este período.'
          }
        />
        {pagina.hayMas && ultimo && (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-4 text-sm text-muted-foreground">
            <span>
              {antes
                ? `${pagina.eventos.length} más · ${total} en total`
                : `Mostrando ${pagina.eventos.length} de ${total}`}
            </span>
            <Link
              href={href({ antes: cursorDe(ultimo) })}
              className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
            >
              Ver más <ArrowRight className="size-3.5" strokeWidth={1.75} />
            </Link>
          </div>
        )}
      </section>
    </div>
  )
}
