import Link from 'next/link'
import { Search } from 'lucide-react'
import { Segmented } from '@/components/ui/segmented'
import { TablaContenedores } from '@/components/arcor/TablaContenedores'
import { AccionesArcor } from '@/components/arcor/AccionesArcor'
import { AutoRefresh } from '@/components/arcor/AutoRefresh'
import { SelectorMes } from '@/components/arcor/SelectorMes'
import { getContenedores, getMeses, getRevisarPendientes } from '@/modules/arcor/queries'
import {
  ESTADOS_CONTENEDOR, LUGARES, claveMes, esMesValido, mesActual, patronBusqueda, tituloLugar, tituloMes,
  type EstadoContenedor,
} from '@/modules/arcor/reglas'
import { diaClaveAR } from '@/lib/fechas-ar'

export const dynamic = 'force-dynamic'

/** `?mes=todos`: sin filtro de mes (lo usan los tiles de pendientes del Resumen). */
const TODOS = 'todos'
/** Hasta cuántos meses se muestran como tabs; con más, un select. */
const MAX_TABS_MES = 4

export default async function ArcorContenedoresPage({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string; lugar?: string; estado?: string; q?: string }>
}) {
  const sp = await searchParams
  const ahora = new Date()
  const hoy = diaClaveAR(ahora)
  const actual = mesActual(ahora)

  const q = typeof sp.q === 'string' ? sp.q.trim().slice(0, 60) : ''
  const patron = patronBusqueda(q)
  const mes = esMesValido(sp.mes) ? sp.mes : actual
  /** El mes elegido en el selector, aparte de la búsqueda (a dónde vuelve "Limpiar"). */
  const mesParam = sp.mes === TODOS ? TODOS : mes
  // La búsqueda mira TODOS los meses: quien busca un contenedor no sabe en qué pestaña cayó.
  const todosLosMeses = mesParam === TODOS || !!patron
  const lugar = (LUGARES as readonly string[]).includes(sp.lugar ?? '') ? sp.lugar : undefined
  const estado = (ESTADOS_CONTENEDOR as readonly string[]).includes(sp.estado ?? '') ? (sp.estado as EstadoContenedor) : undefined
  // Las colas, del más viejo al más nuevo: lo que más espera, arriba.
  const esCola = estado === 'pendiente_arcor' || estado === 'revisar_foto'

  const [meses, { items, total }, dudosas] = await Promise.all([
    getMeses(ahora),
    getContenedores({
      mes: todosLosMeses ? undefined : mes,
      lugar,
      estado,
      patron,
      // Buscando, también aparecen los descartados (la fila dice "Descartado"): si no,
      // un número que existe parecería no estar.
      incluirDescartados: !!patron,
      ascendente: esCola,
      limit: 1000,
    }),
    getRevisarPendientes(),
  ])
  const opcionesMes = meses.includes(mes) ? meses : [mes, ...meses].sort((a, b) => claveMes(b) - claveMes(a))

  const href = (p: { mes?: string; lugar?: string | null; estado?: string | null; conBusqueda?: boolean }) => {
    const u = new URLSearchParams()
    u.set('mes', p.mes ?? mesParam)
    const l = p.lugar === undefined ? lugar : p.lugar
    const e = p.estado === undefined ? estado : p.estado
    if (l) u.set('lugar', l)
    if (e) u.set('estado', e)
    // Cambiar de mes sale de la búsqueda; los demás filtros la conservan.
    if (q && p.conBusqueda !== false && p.mes === undefined) u.set('q', q)
    return `/arcor/contenedores?${u.toString()}`
  }

  const tabsMes = [
    { key: TODOS, label: 'Todos los meses', href: href({ mes: TODOS }) },
    ...opcionesMes.map((m) => ({ key: m, label: tituloMes(m), href: href({ mes: m }) })),
  ]
  const mesActivo = todosLosMeses ? TODOS : mes

  const alcance = patron
    ? <>para «{q}» en todos los meses</>
    : todosLosMeses
      ? <>en todos los meses</>
      : <>en <span className="capitalize">{mes.toLowerCase()}</span></>

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6 lg:p-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Contenedores</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {total} {alcance}
            {lugar && ` · ${tituloLugar(lugar)}`}
            {items.length < total && ` · mostrando los primeros ${items.length}`}
            {esCola && items.length > 1 && ' · del más viejo al más nuevo'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <AutoRefresh generado={ahora.toISOString()} />
          {opcionesMes.length <= MAX_TABS_MES ? (
            <Segmented active={mesActivo} tabs={tabsMes} />
          ) : (
            <SelectorMes opciones={tabsMes} activo={mesActivo} />
          )}
          <AccionesArcor revisar={dudosas} />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <form action="/arcor/contenedores" className="flex min-w-[240px] flex-1 items-center gap-2 sm:max-w-md">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" strokeWidth={1.75} />
            <input
              type="search"
              name="q"
              defaultValue={q}
              placeholder="Contenedor, booking u OE…"
              aria-label="Buscar contenedor, booking u OE en todos los meses"
              className="w-full rounded-xl border border-border bg-card py-2 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <input type="hidden" name="mes" value={mesParam} />
          {lugar && <input type="hidden" name="lugar" value={lugar} />}
          {estado && <input type="hidden" name="estado" value={estado} />}
          <button
            type="submit"
            className="rounded-xl border border-border bg-card px-3.5 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            Buscar
          </button>
          {q && (
            <Link
              href={href({ conBusqueda: false })}
              className="px-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              Limpiar
            </Link>
          )}
        </form>
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
            { key: 'descartado', label: 'Descartados', href: href({ estado: 'descartado' }) },
          ]}
        />
      </div>

      <TablaContenedores items={items} hoy={hoy} />
    </div>
  )
}
