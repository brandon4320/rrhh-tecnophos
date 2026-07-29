import { createClient } from '@/lib/supabase/server'
import { getSesion } from '@/lib/auth/session'
import { getEstadoVencimiento, type EstadoVencimiento } from '@/types'
import { tieneRol, LEGAJO_ESCRITURA } from '@/lib/auth/roles'
import { Monograma } from '@/components/ui/monograma'
import { EstadoPill } from '@/components/ui/estado-pill'
import { Search, Plus } from 'lucide-react'
import Link from 'next/link'

export default async function EmpleadosPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; empresa?: string }>
}) {
  const { q, empresa } = await searchParams
  const supabase = await createClient()

  const [{ data: empresas }, sesion] = await Promise.all([
    supabase.from('empresas').select('id, nombre, slug').order('nombre'),
    getSesion(),
  ])

  const empresaSel = empresa ? (empresas ?? []).find((e) => e.slug === empresa) : undefined

  let query = supabase
    .from('empleados')
    .select(`
      id, nombre, apellido, sector,
      empresa:empresas(id, nombre, slug),
      certificados(fecha_vencimiento, alerta_dias)
    `)
    .eq('activo', true)
    .order('nombre')

  if (q) {
    // buscar por nombre O apellido (sanitizar caracteres que rompen el .or de PostgREST)
    const term = q.replace(/[%,()]/g, ' ').trim()
    if (term) query = query.or(`nombre.ilike.%${term}%,apellido.ilike.%${term}%`)
  }
  if (empresaSel) query = query.eq('empresa_id', empresaSel.id)

  const { data: empleados } = await query
  const puedeCrear = tieneRol(sesion?.rol ?? null, LEGAJO_ESCRITURA)

  function peorEstado(certs: { fecha_vencimiento?: string | null; alerta_dias?: number | null }[]): EstadoVencimiento {
    const estados = certs.map((c) => getEstadoVencimiento(c.fecha_vencimiento, c.alerta_dias))
    if (estados.includes('vencido')) return 'vencido'
    if (estados.includes('proximo')) return 'proximo'
    if (estados.includes('vigente')) return 'vigente'
    return 'sin_fecha'
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6 lg:p-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Empleados</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {empleados?.length ?? 0} {(empleados?.length ?? 0) === 1 ? 'resultado' : 'resultados'}
            {empresaSel ? ` · ${empresaSel.nombre}` : ' · todas las empresas'}
          </p>
        </div>
        {puedeCrear && (
          <Link
            href="/admin/empleados/nuevo"
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
          >
            <Plus className="size-4" strokeWidth={2.5} />
            Nuevo empleado
          </Link>
        )}
      </div>

      {/* Filtros */}
      <form className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[240px] flex-1 sm:max-w-sm">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" strokeWidth={1.75} />
          <input
            type="search"
            name="q"
            defaultValue={q}
            placeholder="Buscar por nombre o apellido…"
            className="w-full rounded-xl border border-border bg-card py-2.5 pl-9 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <select
          name="empresa"
          defaultValue={empresa ?? ''}
          className="rounded-xl border border-border bg-card px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="">Todas las empresas</option>
          {(empresas ?? []).map((e) => (
            <option key={e.id} value={e.slug}>
              {e.nombre}
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          Buscar
        </button>
        {(q || empresa) && (
          <Link
            href="/empleados"
            className="px-2 py-2.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            Limpiar
          </Link>
        )}
      </form>

      {/* Lista */}
      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Nombre</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Empresa</th>
              <th className="hidden px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground sm:table-cell">Sector</th>
              <th className="hidden px-4 py-3 text-center text-xs font-medium uppercase tracking-wide text-muted-foreground sm:table-cell">Certificados</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Estado</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {(empleados ?? []).map((emp) => {
              const certs = emp.certificados ?? []
              const estado = peorEstado(certs)
              const nombreCompleto = [emp.nombre, emp.apellido].filter(Boolean).join(' ')

              return (
                <tr key={emp.id} className="transition-colors hover:bg-muted/40">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <Monograma nombre={nombreCompleto} size="sm" />
                      <span className="font-medium">{nombreCompleto}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{emp.empresa?.nombre ?? '—'}</td>
                  <td className="hidden px-4 py-3 text-muted-foreground sm:table-cell">{emp.sector ?? '—'}</td>
                  <td className="hidden px-4 py-3 text-center tabular-nums text-muted-foreground sm:table-cell">{certs.length}</td>
                  <td className="px-4 py-3">
                    <EstadoPill estado={estado} />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/legajo/${emp.id}`}
                      className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    >
                      Abrir
                    </Link>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>

        {(empleados?.length ?? 0) === 0 && (
          <div className="py-12 text-center text-sm text-muted-foreground">No se encontraron empleados</div>
        )}
      </div>
    </div>
  )
}
