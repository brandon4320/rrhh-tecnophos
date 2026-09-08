import { Segmented } from '@/components/ui/segmented'
import { TablaContenedores } from '@/components/arcor/TablaContenedores'
import { getContenedores, getMeses } from '@/modules/arcor/queries'
import { ESTADOS_CONTENEDOR, LUGARES, esMesValido, mesActual, tituloLugar, type EstadoContenedor } from '@/modules/arcor/reglas'

export const dynamic = 'force-dynamic'

export default async function ArcorContenedoresPage({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string; lugar?: string; estado?: string }>
}) {
  const sp = await searchParams
  const meses = await getMeses()
  const actual = mesActual()
  const opcionesMes = meses.includes(actual) ? meses : [actual, ...meses]
  const mes = esMesValido(sp.mes) && opcionesMes.includes(sp.mes) ? sp.mes : opcionesMes[0]
  const lugar = (LUGARES as readonly string[]).includes(sp.lugar ?? '') ? sp.lugar : undefined
  const estado = (ESTADOS_CONTENEDOR as readonly string[]).includes(sp.estado ?? '') ? (sp.estado as EstadoContenedor) : undefined

  const items = await getContenedores({ mes, lugar, estado, limit: 1000 })

  const href = (p: { mes?: string; lugar?: string | null; estado?: string | null }) => {
    const q = new URLSearchParams()
    q.set('mes', p.mes ?? mes)
    const l = p.lugar === undefined ? lugar : p.lugar
    const e = p.estado === undefined ? estado : p.estado
    if (l) q.set('lugar', l)
    if (e) q.set('estado', e)
    return `/arcor/contenedores?${q.toString()}`
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6 lg:p-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Contenedores</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {items.length} en <span className="capitalize">{mes.toLowerCase()}</span>
            {lugar && ` · ${tituloLugar(lugar)}`}
          </p>
        </div>
        <Segmented
          active={mes}
          tabs={opcionesMes.slice(0, 6).map((m) => ({ key: m, label: m.charAt(0) + m.slice(1).toLowerCase(), href: href({ mes: m }) }))}
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Segmented
          active={lugar ?? 'todas'}
          tabs={[
            { key: 'todas', label: 'Todas', href: href({ lugar: null }) },
            ...LUGARES.map((l) => ({ key: l, label: tituloLugar(l), href: href({ lugar: l }) })),
          ]}
        />
        <Segmented
          active={estado ?? 'todos'}
          tabs={[
            { key: 'todos', label: 'Todos', href: href({ estado: null }) },
            { key: 'encontrado', label: 'Cargados', href: href({ estado: 'encontrado' }) },
            { key: 'pendiente_arcor', label: 'Pendiente ARCOR', href: href({ estado: 'pendiente_arcor' }) },
            { key: 'revisar_foto', label: 'Revisar foto', href: href({ estado: 'revisar_foto' }) },
          ]}
        />
      </div>

      <TablaContenedores items={items} />
    </div>
  )
}
