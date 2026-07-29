import { createClient } from '@/lib/supabase/server'
import { getEstadoVencimiento, diasHastaVencimiento } from '@/types'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import Link from 'next/link'
import { ChevronRight, ArrowRight } from 'lucide-react'
import { Monograma } from '@/components/ui/monograma'
import { EstadoBadgeSuave } from '@/components/ui/estado-pill'
import { Segmented } from '@/components/ui/segmented'

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>
}) {
  const sp = await searchParams
  const supabase = await createClient()

  const [{ data: certs }, { data: empresas }, { data: empleados }] = await Promise.all([
    supabase
      .from('certificados')
      .select(`
        id, fecha_vencimiento, alerta_dias, tipo_nombre_custom,
        tipo:tipos_certificado(nombre),
        empleado:empleados(id, nombre, apellido, empresa_id, empresa:empresas(id, nombre, slug)),
        vehiculo:vehiculos(patente, empresa_id, empresa:empresas(id, nombre, slug)),
        equipo:equipos(nombre, empresa_id, empresa:empresas(id, nombre, slug)),
        empresa:empresas(id, nombre, slug)
      `)
      .not('fecha_vencimiento', 'is', null)
      .order('fecha_vencimiento', { ascending: true }),
    supabase.from('empresas').select('id, nombre, slug').order('nombre'),
    supabase.from('empleados').select('id, empresa_id').eq('activo', true),
  ])

  const hoy = new Date()

  const conEstado = (certs ?? []).map((c) => ({
    ...c,
    estado: getEstadoVencimiento(c.fecha_vencimiento, c.alerta_dias),
  }))
  const vencidos = conEstado.filter((c) => c.estado === 'vencido')
  const proximos = conEstado.filter((c) => c.estado === 'proximo')
  const alDia = conEstado.length - vencidos.length - proximos.length
  const total = Math.max(1, conEstado.length)

  const masUrgente = vencidos[0]
  const diasUrgente = masUrgente ? Math.abs(diasHastaVencimiento(masUrgente.fecha_vencimiento!)) : 0

  const tab = sp.tab === 'vencidos' ? 'vencidos' : sp.tab === 'proximos' ? 'proximos' : 'todos'
  const alertas = tab === 'vencidos' ? vencidos : tab === 'proximos' ? proximos : [...vencidos, ...proximos]
  const visibles = alertas.slice(0, 6)

  const byEmpresa = (empresas ?? []).map((emp) => {
    const propios = conEstado.filter((c) => {
      const empId = c.empleado?.empresa_id ?? c.vehiculo?.empresa_id ?? c.equipo?.empresa_id ?? c.empresa?.id ?? null
      return empId === emp.id
    })
    return {
      ...emp,
      total: (empleados ?? []).filter((e) => e.empresa_id === emp.id).length,
      vencidos: propios.filter((c) => c.estado === 'vencido').length,
      proximos: propios.filter((c) => c.estado === 'proximo').length,
    }
  })

  function duenoDe(c: (typeof conEstado)[number]) {
    if (c.empleado) {
      return {
        nombre: [c.empleado.nombre, c.empleado.apellido].filter(Boolean).join(' '),
        href: `/legajo/${c.empleado.id}`,
      }
    }
    if (c.vehiculo) {
      return {
        nombre: `Vehículo ${c.vehiculo.patente}`,
        href: c.vehiculo.empresa?.slug ? `/empresa/${c.vehiculo.empresa.slug}?vista=documentacion` : '/vencimientos',
      }
    }
    if (c.equipo) {
      return {
        nombre: c.equipo.nombre,
        href: c.equipo.empresa?.slug ? `/empresa/${c.equipo.empresa.slug}?vista=documentacion` : '/vencimientos',
      }
    }
    return {
      nombre: c.empresa?.nombre ?? '—',
      href: c.empresa?.slug ? `/empresa/${c.empresa.slug}?vista=documentacion` : '/vencimientos',
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6 lg:p-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="mt-0.5 text-sm capitalize text-muted-foreground">
          {format(hoy, "EEEE d 'de' MMMM 'de' yyyy", { locale: es })}
        </p>
      </div>

      {/* ── Estado general + Atención ── */}
      <section className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="rounded-2xl border border-border bg-card p-5 sm:p-6">
          <h2 className="text-lg font-semibold tracking-tight">Estado general</h2>
          <p className="text-sm text-muted-foreground">Lectura rápida de todas las empresas</p>

          <div className="mt-5 grid grid-cols-2 gap-y-5 sm:grid-cols-4 sm:divide-x sm:divide-border">
            <div className="sm:pr-6">
              <p className="text-3xl font-semibold tabular-nums">{empleados?.length ?? 0}</p>
              <p className="mt-0.5 text-sm text-muted-foreground">Empleados</p>
            </div>
            <div className="sm:px-6">
              <p className={`text-3xl font-semibold tabular-nums ${vencidos.length > 0 ? 'text-danger' : ''}`}>
                {vencidos.length}
              </p>
              <p className="mt-0.5 text-sm text-muted-foreground">Vencidos</p>
              <p className="text-xs text-muted-foreground">requieren acción</p>
            </div>
            <div className="sm:px-6">
              <p className={`text-3xl font-semibold tabular-nums ${proximos.length > 0 ? 'text-warning' : ''}`}>
                {proximos.length}
              </p>
              <p className="mt-0.5 text-sm text-muted-foreground">Por vencer</p>
              <p className="text-xs text-muted-foreground">en su ventana de alerta</p>
            </div>
            <div className="sm:pl-6">
              <p className="text-3xl font-semibold tabular-nums text-success">{alDia}</p>
              <p className="mt-0.5 text-sm text-muted-foreground">Al día</p>
              <p className="text-xs text-muted-foreground">documentación vigente</p>
            </div>
          </div>

          {/* Barra apilada */}
          <div className="mt-6 flex h-2 w-full gap-1 overflow-hidden rounded-full">
            {alDia > 0 && <div className="rounded-full bg-success" style={{ width: `${(alDia / total) * 100}%` }} />}
            {proximos.length > 0 && (
              <div className="rounded-full bg-warning" style={{ width: `${(proximos.length / total) * 100}%` }} />
            )}
            {vencidos.length > 0 && (
              <div className="rounded-full bg-danger" style={{ width: `${(vencidos.length / total) * 100}%` }} />
            )}
          </div>
        </div>

        {/* Atención */}
        <div className="flex flex-col justify-between rounded-2xl bg-surface-dark p-6 text-surface-dark-foreground">
          {vencidos.length > 0 ? (
            <>
              <div>
                <EstadoBadgeSuave estado="vencido" label="ATENCIÓN" />
                <p className="mt-3 text-2xl font-semibold tracking-tight">
                  {vencidos.length} {vencidos.length === 1 ? 'certificado vencido' : 'certificados vencidos'}
                </p>
                <p className="mt-1 text-sm text-white/60">
                  El caso más urgente venció hace {diasUrgente} {diasUrgente === 1 ? 'día' : 'días'}.
                </p>
              </div>
              <Link
                href="/vencimientos?estado=vencido"
                className="mt-5 inline-flex items-center justify-between gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
              >
                Revisar vencimientos
                <ArrowRight className="size-4" strokeWidth={2} />
              </Link>
            </>
          ) : (
            <>
              <div>
                <EstadoBadgeSuave estado="vigente" label="EN ORDEN" />
                <p className="mt-3 text-2xl font-semibold tracking-tight">Sin certificados vencidos</p>
                <p className="mt-1 text-sm text-white/60">
                  {proximos.length > 0
                    ? `${proximos.length} por vencer dentro de su ventana de alerta.`
                    : 'Toda la documentación está vigente.'}
                </p>
              </div>
              <Link
                href="/vencimientos"
                className="mt-5 inline-flex items-center justify-between gap-2 rounded-xl bg-white/10 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-white/15"
              >
                Ver vencimientos
                <ArrowRight className="size-4" strokeWidth={2} />
              </Link>
            </>
          )}
        </div>
      </section>

      {/* ── Prioritarios + columna derecha ── */}
      <section className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="rounded-2xl border border-border bg-card p-5 sm:p-6">
          <h2 className="text-lg font-semibold tracking-tight">Vencimientos prioritarios</h2>
          <p className="text-sm text-muted-foreground">Ordenados por urgencia</p>

          <Segmented
            className="mt-4"
            active={tab}
            tabs={[
              { key: 'todos', label: 'Todos', href: '/dashboard' },
              { key: 'vencidos', label: 'Vencidos', href: '/dashboard?tab=vencidos' },
              { key: 'proximos', label: 'Próximos', href: '/dashboard?tab=proximos' },
            ]}
          />

          <div className="mt-4 space-y-2">
            {visibles.length === 0 && (
              <p className="rounded-xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
                Sin alertas en esta vista.
              </p>
            )}
            {visibles.map((c) => {
              const dias = diasHastaVencimiento(c.fecha_vencimiento!)
              const dueno = duenoDe(c)
              const label =
                dias < 0
                  ? `Venció hace ${Math.abs(dias)} ${Math.abs(dias) === 1 ? 'día' : 'días'}`
                  : dias === 0
                    ? 'Vence hoy'
                    : `Vence en ${dias} ${dias === 1 ? 'día' : 'días'}`
              return (
                <Link
                  key={c.id}
                  href={dueno.href}
                  className="flex items-center gap-4 rounded-xl border border-border px-4 py-3 transition-colors hover:bg-muted/50"
                >
                  <Monograma nombre={dueno.nombre} size="md" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{dueno.nombre}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {c.tipo?.nombre ?? c.tipo_nombre_custom ?? 'Certificado'}
                    </p>
                  </div>
                  <EstadoBadgeSuave estado={c.estado} label={label} className="shrink-0" />
                  <span className="hidden shrink-0 text-xs tabular-nums text-muted-foreground sm:block">
                    {format(new Date(c.fecha_vencimiento!.slice(0, 10) + 'T12:00:00'), 'dd/MM/yyyy')}
                  </span>
                  <ChevronRight className="size-4 shrink-0 text-muted-foreground/50" strokeWidth={1.75} />
                </Link>
              )
            })}
          </div>

          {alertas.length > 0 && (
            <div className="mt-4 flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                {visibles.length} {visibles.length === 1 ? 'caso visible' : 'casos visibles'} de {alertas.length} alertas
              </p>
              <Link
                href="/vencimientos"
                className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                Ver todos
              </Link>
            </div>
          )}
        </div>

        <div className="space-y-6">
          {/* Empresas */}
          <div className="rounded-2xl border border-border bg-card p-5 sm:p-6">
            <h2 className="text-lg font-semibold tracking-tight">Empresas</h2>
            <p className="text-sm text-muted-foreground">Comparación de estado</p>

            <div className="mt-4">
              <div className="grid grid-cols-[1fr_44px_44px] gap-2 border-b border-border pb-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                <span>Empresa</span>
                <span className="text-right">Venc.</span>
                <span className="text-right">Próx.</span>
              </div>
              <div className="divide-y divide-border">
                {byEmpresa.map((emp) => (
                  <Link
                    key={emp.id}
                    href={`/empresa/${emp.slug}`}
                    className="grid grid-cols-[1fr_44px_44px] items-center gap-2 py-2.5 transition-colors hover:bg-muted/40"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">{emp.nombre}</span>
                      <span className="block text-[11px] text-muted-foreground">
                        {emp.total} {emp.total === 1 ? 'empleado' : 'empleados'}
                      </span>
                    </span>
                    <span className={`text-right text-sm font-semibold tabular-nums ${emp.vencidos > 0 ? 'text-danger' : 'text-muted-foreground/50'}`}>
                      {emp.vencidos}
                    </span>
                    <span className={`text-right text-sm font-semibold tabular-nums ${emp.proximos > 0 ? 'text-warning' : 'text-muted-foreground/50'}`}>
                      {emp.proximos}
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          </div>

          {/* Distribución documental */}
          <div className="rounded-2xl border border-border bg-card p-5 sm:p-6">
            <h2 className="text-lg font-semibold tracking-tight">Distribución documental</h2>
            <p className="text-sm text-muted-foreground">Estado de los certificados</p>

            <div className="mt-4 space-y-4">
              {[
                { label: 'Al día', count: alDia, color: 'bg-success' },
                { label: 'Por vencer', count: proximos.length, color: 'bg-warning' },
                { label: 'Vencidos', count: vencidos.length, color: 'bg-danger' },
              ].map((f) => (
                <div key={f.label}>
                  <div className="mb-1.5 flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">{f.label}</span>
                    <span className="text-sm font-semibold tabular-nums">{f.count}</span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                    <div className={`h-full rounded-full ${f.color}`} style={{ width: `${(f.count / total) * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
