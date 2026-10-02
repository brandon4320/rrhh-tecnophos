import { createClient } from '@/lib/supabase/server'
import { requireRol } from '@/lib/auth/session'
import { LEGAJO_ESCRITURA } from '@/lib/auth/roles'
import NuevoEmpleadoForm from './NuevoEmpleadoForm'

export default async function NuevoEmpleadoPage({
  searchParams,
}: {
  searchParams: Promise<{ empresa?: string }>
}) {
  const [{ empresa: empresaParam }] = await Promise.all([searchParams, requireRol(LEGAJO_ESCRITURA)])
  const supabase = await createClient()

  const [{ data: empresas }, { data: sectoresRaw }] = await Promise.all([
    supabase.from('empresas').select('id, nombre, slug').order('nombre'),
    // Sectores ya usados, para sugerirlos (y no terminar con "Planta", "PLANTA" y "planta ").
    supabase.from('empleados').select('sector').not('sector', 'is', null),
  ])

  const lista = empresas ?? []
  // Empresa preseleccionada: la que viene en ?empresa= (slug o id, desde /empleados
  // o la sidebar) o, si el usuario ve una sola, esa.
  const preseleccionada =
    (empresaParam ? lista.find((e) => e.slug === empresaParam || e.id === empresaParam) : undefined) ??
    (lista.length === 1 ? lista[0] : undefined)

  const sectores = [
    ...new Map(
      (sectoresRaw ?? [])
        .map((s) => s.sector?.trim() ?? '')
        .filter(Boolean)
        .map((s) => [s.toLowerCase(), s] as const)
    ).values(),
  ].sort((a, b) => a.localeCompare(b, 'es'))

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Nuevo empleado</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Cargá los datos básicos. Después vas directo a su legajo para agregar los certificados.
        </p>
      </div>

      <NuevoEmpleadoForm
        empresas={lista}
        empresaInicial={preseleccionada?.id ?? ''}
        sectores={sectores}
        volverA={preseleccionada && empresaParam ? `/empleados?empresa=${preseleccionada.slug}` : '/empleados'}
      />
    </div>
  )
}
