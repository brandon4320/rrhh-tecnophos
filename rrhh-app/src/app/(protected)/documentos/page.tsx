import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getSesion } from '@/lib/auth/session'
import { tieneRol, LEGAJO_ESCRITURA } from '@/lib/auth/roles'
import { empleadosConReciboPorPeriodo } from '@/modules/documentos/reglas'
import DocumentosClient from './DocumentosClient'

export const dynamic = 'force-dynamic'

/**
 * Documentación mensual por empresa (?empresa=slug&anio=2026), igual que /stock.
 * Se carga el año completo: 12 meses × 6 carpetas es poco volumen y así el
 * cambio de mes es instantáneo. La RLS de documentos_mensuales limita a las
 * empresas que el usuario ve.
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

  const anioActual = new Date().getFullYear()
  const anioNum = Number(anioParam)
  const anio = Number.isInteger(anioNum) && anioNum >= 2000 && anioNum <= anioActual + 1 ? anioNum : anioActual
  const desde = `${anio}-01-01`
  const hasta = `${anio}-12-01`

  const [{ data: documentos }, { data: empleados }] = await Promise.all([
    supabase
      .from('documentos_mensuales')
      .select('*')
      .eq('empresa_id', empresaSel.id)
      .gte('periodo', desde)
      .lte('periodo', hasta)
      .order('carpeta')
      .order('created_at', { ascending: false }),
    supabase.from('empleados').select('id, activo').eq('empresa_id', empresaSel.id),
  ])

  // Carpeta "Recibos de sueldos": cuántos empleados ya tienen su recibo del mes en el legajo.
  const idsEmpleados = (empleados ?? []).map((e) => e.id)
  const empleadosActivos = (empleados ?? []).filter((e) => e.activo !== false).length
  const { data: recibos } = idsEmpleados.length
    ? await supabase
        .from('recibos_sueldo')
        .select('periodo, empleado_id, tipo')
        .in('empleado_id', idsEmpleados)
        .gte('periodo', desde)
        .lte('periodo', hasta)
    : { data: [] }

  return (
    <DocumentosClient
      key={`${empresaSel.id}-${anio}`}
      empresa={empresaSel}
      anio={anio}
      documentos={documentos ?? []}
      recibosPorPeriodo={Object.fromEntries(empleadosConReciboPorPeriodo(recibos ?? []))}
      empleadosActivos={empleadosActivos}
      canEdit={tieneRol(sesion?.rol ?? null, LEGAJO_ESCRITURA)}
    />
  )
}
