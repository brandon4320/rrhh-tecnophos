import { createClient } from '@/lib/supabase/server'
import { getEstadoVencimiento, ESTADO_COLORS } from '@/types'
import { tieneRol, LEGAJO_ESCRITURA, type Rol } from '@/lib/auth/roles'
import Link from 'next/link'

const EMPRESA_DOT: Record<string, string> = {
  'tecnophos-bb': 'bg-indigo-500',
  'tecnophos-rosario': 'bg-sky-500',
  'tecnophos-necochea': 'bg-emerald-500',
  adc: 'bg-amber-500',
}

export default async function EmpleadosPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; empresa?: string }>
}) {
  const { q, empresa } = await searchParams
  const supabase = await createClient()

  let query = supabase
    .from('empleados')
    .select(`
      *,
      empresa:empresas(id, nombre, slug),
      certificados(fecha_vencimiento, alerta_dias)
    `)
    .eq('activo', true)
    .order('nombre')

  if (q) query = query.ilike('nombre', `%${q}%`)
  if (empresa) {
    const { data: emp } = await supabase.from('empresas').select('id').eq('slug', empresa).single()
    if (emp) query = query.eq('empresa_id', emp.id)
  }

  const { data: empleados } = await query
  const { data: empresas } = await supabase.from('empresas').select('*').order('nombre')

  const { data: { user } } = await supabase.auth.getUser()
  const { data: perfil } = user
    ? await supabase.from('perfiles').select('rol').eq('id', user.id).single()
    : { data: null }
  const puedeCrear = tieneRol(perfil?.rol as Rol | null, LEGAJO_ESCRITURA)

  function peorEstado(certs: { fecha_vencimiento?: string | null; alerta_dias?: number | null }[]) {
    const estados = certs.map((c) => getEstadoVencimiento(c.fecha_vencimiento, c.alerta_dias))
    if (estados.includes('vencido')) return 'vencido'
    if (estados.includes('proximo')) return 'proximo'
    if (estados.includes('vigente')) return 'vigente'
    return 'sin_fecha'
  }

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Empleados</h1>
          <p className="text-sm text-muted-foreground mt-1">{empleados?.length ?? 0} resultados</p>
        </div>
        {puedeCrear && (
          <Link
            href="/admin/empleados/nuevo"
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            + Nuevo empleado
          </Link>
        )}
      </div>

      <div className="flex gap-3 mb-6">
        <form className="flex-1 flex gap-3 flex-wrap">
          <div className="relative flex-1 max-w-sm min-w-[240px]">
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
              />
            </svg>
            <input
              type="search"
              name="q"
              defaultValue={q}
              placeholder="Buscar por nombre..."
              className="w-full pl-9 pr-4 py-2.5 rounded-lg border border-input text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          <select
            name="empresa"
            defaultValue={empresa ?? ''}
            className="px-3.5 py-2.5 rounded-lg border border-input text-sm focus:outline-none focus:ring-2 focus:ring-ring"
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
            className="bg-primary hover:brightness-110 text-white text-sm font-medium px-4 py-2.5 rounded-lg transition-colors"
          >
            Buscar
          </button>

          {(q || empresa) && (
            <Link
              href="/empleados"
              className="px-4 py-2.5 rounded-lg border border-input text-sm font-medium text-foreground hover:bg-accent"
            >
              Limpiar
            </Link>
          )}
        </form>
      </div>

      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted">
              <th className="text-left px-5 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">Nombre</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">Empresa</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">Sector</th>
              <th className="text-center px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">Certificados</th>
              <th className="text-center px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">Estado</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {(empleados ?? []).map((emp) => {
              const certs = emp.certificados ?? []
              const estado = peorEstado(certs)
              const slug = emp.empresa?.slug ?? ''
              const nombreCompleto = [emp.nombre, emp.apellido].filter(Boolean).join(' ')

              return (
                <tr key={emp.id} className="hover:bg-accent transition-colors">
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      <span className={`w-2 h-2 rounded-full shrink-0 ${EMPRESA_DOT[slug] ?? 'bg-slate-600'}`} />
                      <span className="font-medium text-foreground">{nombreCompleto}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3.5 text-muted-foreground">{emp.empresa?.nombre ?? '—'}</td>
                  <td className="px-4 py-3.5 text-muted-foreground">{emp.sector ?? '—'}</td>
                  <td className="px-4 py-3.5 text-center text-muted-foreground">{certs.length}</td>
                  <td className="px-4 py-3.5 text-center">
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${ESTADO_COLORS[estado]}`}>
                      {estado === 'vigente'
                        ? 'OK'
                        : estado === 'vencido'
                          ? 'Vencido'
                          : estado === 'proximo'
                            ? 'Por vencer'
                            : 'Sin datos'}
                    </span>
                  </td>
                  <td className="px-4 py-3.5 text-right">
                    <Link href={`/legajo/${emp.id}`} className="text-xs text-primary hover:underline font-medium">
                      Ver legajo →
                    </Link>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>

        {(empleados?.length ?? 0) === 0 && (
          <div className="text-center py-12 text-sm text-muted-foreground">No se encontraron empleados</div>
        )}
      </div>
    </div>
  )
}
