import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getSesion } from '@/lib/auth/session'
import { tieneRol, LEGAJO_ESCRITURA } from '@/lib/auth/roles'
import { DOC_COLUMNAS, anioMesAR, empleadosConReciboPorPeriodo } from '@/modules/documentos/reglas'
import { traerTodo } from '@/lib/paginar'
import DocumentosClient from './DocumentosClient'

export const dynamic = 'force-dynamic'

/**
 * Documentación mensual por empresa (?empresa=slug&anio=2026), igual que /stock.
 * Se carga el año completo (paginado) y así el cambio de mes es instantáneo.
 * La RLS de documentos_mensuales limita a las empresas que el usuario ve.
 */
export default async function DocumentosPage({
  searchParams,
}: {
  searchParams: Promise<{ empresa?: string; anio?: string }>
}) {
  const { empresa, anio: anioParam } = await searchParams
  const supabase = await createClient()
  const [{ data: empresas }, sesion] = await Promise.all([
    supabase.from('empresas').select('id, nombre, slug').order('nombre'),
    getSesion(),
  ])
  const lista = empresas ?? []
  const empresaSel = (empresa ? lista.find((e) => e.slug === empresa) : undefined) ?? (lista.length === 1 ? lista[0] : undefined)

  if (!empresaSel) {
    return (
      <div className="mx-auto max-w-6xl p-4 sm:p-6 lg:p-8">
        <h1 className="text-2xl font-semibold tracking-tight">Documentación mensual</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">Elegí la empresa cuya documentación querés ver.</p>
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {lista.map((e) => (
            <Link
              key={e.id}
              href={`/documentos?empresa=${e.slug}`}
              className="rounded-2xl border border-border bg-card px-5 py-4 text-sm font-medium transition-colors hover:bg-muted"
            >
              {e.nombre}
            </Link>
          ))}
        </div>
      </div>
    )
  }

  // Año en hora Argentina (Vercel corre en UTC: el 31/12 a la noche ya sería el año siguiente).
  const anioActual = anioMesAR().anio
  const anioNum = Number(anioParam)
  const anio = Number.isInteger(anioNum) && anioNum >= 2000 && anioNum <= anioActual + 1 ? anioNum : anioActual
  const desde = `${anio}-01-01`
  const hasta = `${anio}-12-01`

  // Tres consultas en paralelo. La de recibos filtra por la empresa a través del
  // empleado (join interno) y solo cuenta empleados ACTIVOS, el mismo universo que
  // el denominador: así "X de Y empleados" nunca supera Y.
  // Los documentos del año se paginan: PostgREST corta en 1000 filas sin avisar y
  // tecnophos-bb ya tenía 661 en nueve meses (el mes de diciembre "desaparecía").
  // Solo las columnas que usa la pantalla (DOC_COLUMNAS) y orden estable con id.
  const [docsRes, empRes, recRes] = await Promise.all([
    traerTodo((d, h) =>
      supabase
        .from('documentos_mensuales')
        .select(DOC_COLUMNAS)
        .eq('empresa_id', empresaSel.id)
        .gte('periodo', desde)
        .lte('periodo', hasta)
        .order('carpeta')
        .order('created_at', { ascending: false })
        .order('id')
        .range(d, h)
    ),
    supabase.from('empleados').select('id', { count: 'exact', head: true }).eq('empresa_id', empresaSel.id).eq('activo', true),
    // Un recibo mensual por empleado activo y mes: con ~90 empleados el año pasa de
    // 1000 filas, así que también se pagina (si no, los últimos meses "no tenían" recibos).
    traerTodo((d, h) =>
      supabase
        .from('recibos_sueldo')
        .select('periodo, empleado_id, empleados!inner(empresa_id, activo)')
        .eq('empleados.empresa_id', empresaSel.id)
        .eq('empleados.activo', true)
        .eq('tipo', 'mensual')
        .gte('periodo', desde)
        .lte('periodo', hasta)
        .order('periodo')
        .order('id')
        .range(d, h)
    ),
  ])

  // Nunca tragarse un error de Supabase (AGENTS.md §10): si la tabla no existe
  // (migración 17 sin aplicar) o falla la consulta, se dice, no se muestra "Sin cargar".
  const errorCarga = docsRes.error ?? empRes.error ?? recRes.error
  if (errorCarga) {
    return (
      <div className="mx-auto max-w-6xl p-4 sm:p-6 lg:p-8">
        <h1 className="text-2xl font-semibold tracking-tight">Documentación mensual</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">{empresaSel.nombre}</p>
        <div className="mt-6 rounded-2xl border border-danger/30 bg-danger-subtle px-5 py-4 text-sm text-danger">
          No se pudo cargar la documentación. Detalle técnico: {errorCarga.message}
        </div>
      </div>
    )
  }

  return (
    <DocumentosClient
      key={`${empresaSel.id}-${anio}`}
      empresa={empresaSel}
      anio={anio}
      documentos={docsRes.data ?? []}
      recibosPorPeriodo={Object.fromEntries(empleadosConReciboPorPeriodo(recRes.data ?? []))}
      empleadosActivos={empRes.count ?? 0}
      canEdit={tieneRol(sesion?.rol ?? null, LEGAJO_ESCRITURA)}
    />
  )
}
