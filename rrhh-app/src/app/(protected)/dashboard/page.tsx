import { createClient } from '@/lib/supabase/server'
import { getEstadoVencimiento, ESTADO_COLORS } from '@/types'
import { format, differenceInDays } from 'date-fns'
import { es } from 'date-fns/locale'
import Link from 'next/link'
import { CheckCircle2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

const EMPRESA_COLORS: Record<string, string> = {
  'tecnophos-bb': 'bg-indigo-500',
  'tecnophos-rosario': 'bg-sky-500',
  'tecnophos-necochea': 'bg-emerald-500',
  adc: 'bg-amber-500',
}

export default async function DashboardPage() {
  const supabase = await createClient()

  const [{ data: certs }, { data: empresas }, { data: empleados }] = await Promise.all([
    supabase
      .from('certificados')
      .select(`
        *,
        tipo:tipos_certificado(nombre),
        empleado:empleados(nombre, apellido, empresa_id, empresa:empresas(id, nombre, slug)),
        vehiculo:vehiculos(patente, empresa_id, empresa:empresas(id, nombre, slug)),
        empresa:empresas(id, nombre, slug)
      `)
      .not('fecha_vencimiento', 'is', null)
      .order('fecha_vencimiento', { ascending: true }),
    supabase.from('empresas').select('*').order('nombre'),
    supabase.from('empleados').select('id, empresa_id').eq('activo', true),
  ])

  const hoy = new Date()

  const vencidos = (certs ?? []).filter((c) => getEstadoVencimiento(c.fecha_vencimiento) === 'vencido')
  const proximos = (certs ?? []).filter((c) => getEstadoVencimiento(c.fecha_vencimiento) === 'proximo')
  const alertas = [...vencidos, ...proximos].slice(0, 20)

  const byEmpresa = (empresas ?? []).map((emp) => ({
    ...emp,
    total: (empleados ?? []).filter((e) => e.empresa_id === emp.id).length,
    vencidos: (certs ?? []).filter((c) => {
      const empId = c.empleado?.empresa_id ?? c.vehiculo?.empresa_id ?? c.empresa?.id ?? null
      return empId === emp.id && getEstadoVencimiento(c.fecha_vencimiento) === 'vencido'
    }).length,
    proximos: (certs ?? []).filter((c) => {
      const empId = c.empleado?.empresa_id ?? c.vehiculo?.empresa_id ?? c.empresa?.id ?? null
      return empId === emp.id && getEstadoVencimiento(c.fecha_vencimiento) === 'proximo'
    }).length,
  }))

  return (
    <div className="mx-auto max-w-7xl p-6 sm:p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="mt-1 text-sm capitalize text-muted-foreground">
          {format(hoy, "EEEE d 'de' MMMM 'de' yyyy", { locale: es })}
        </p>
      </div>

      {/* KPIs */}
      <div className="mb-8 grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">Empleados activos</p>
            <p className="mt-1 text-3xl font-semibold tabular-nums">{empleados?.length ?? 0}</p>
            <p className="mt-1 text-xs text-muted-foreground">en {empresas?.length ?? 0} empresas</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">Certificados vencidos</p>
            <p className="mt-1 text-3xl font-semibold tabular-nums text-red-600 dark:text-red-400">
              {vencidos.length}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">requieren atención inmediata</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">Por vencer (30 días)</p>
            <p className="mt-1 text-3xl font-semibold tabular-nums text-amber-600 dark:text-amber-400">
              {proximos.length}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">en los próximos 30 días</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        {/* Alertas */}
        <div className="lg:col-span-3">
          <Card className="overflow-hidden py-0">
            <div className="flex items-center justify-between border-b px-5 py-4">
              <h2 className="font-medium">Alertas de vencimiento</h2>
              <Link href="/vencimientos" className="text-xs font-medium text-primary hover:underline">
                Ver todos
              </Link>
            </div>

            {alertas.length === 0 ? (
              <div className="px-5 py-12 text-center">
                <div className="mx-auto mb-3 flex size-10 items-center justify-center rounded-md bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400">
                  <CheckCircle2 className="size-5" strokeWidth={1.75} />
                </div>
                <p className="text-sm text-muted-foreground">Sin alertas activas</p>
              </div>
            ) : (
              <div className="divide-y">
                {alertas.map((cert) => {
                  const estado = getEstadoVencimiento(cert.fecha_vencimiento)
                  const dias = differenceInDays(new Date(cert.fecha_vencimiento!), hoy)
                  const nombreEmpleado = [cert.empleado?.nombre, cert.empleado?.apellido].filter(Boolean).join(' ')
                  const nombre = cert.empleado
                    ? nombreEmpleado
                    : cert.vehiculo
                      ? cert.vehiculo.patente ?? 'Vehículo'
                      : cert.empresa?.nombre ?? '—'
                  const empresa = cert.empleado?.empresa ?? cert.vehiculo?.empresa ?? cert.empresa
                  const slug = empresa?.slug ?? ''

                  return (
                    <Link
                      key={cert.id}
                      href={slug ? `/empresa/${slug}` : '/vencimientos'}
                      className="flex items-center gap-4 px-5 py-3.5 transition-colors hover:bg-accent"
                    >
                      <span className={cn('size-2 shrink-0 rounded-full', EMPRESA_COLORS[slug] ?? 'bg-slate-400')} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{nombre}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {cert.tipo?.nombre ?? cert.tipo_nombre_custom}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <Badge variant="outline" className={cn('tabular-nums', ESTADO_COLORS[estado])}>
                          {estado === 'vencido' ? `hace ${Math.abs(dias)}d` : `${dias}d`}
                        </Badge>
                        <p className="mt-1 text-xs tabular-nums text-muted-foreground">
                          {format(new Date(cert.fecha_vencimiento!), 'dd/MM/yyyy')}
                        </p>
                      </div>
                    </Link>
                  )
                })}
              </div>
            )}
          </Card>
        </div>

        {/* Por empresa */}
        <div className="space-y-3 lg:col-span-2">
          <h2 className="font-medium">Por empresa</h2>
          {byEmpresa.map((emp) => (
            <Link key={emp.id} href={`/empresa/${emp.slug}`} className="block">
              <Card className="py-0 transition-colors hover:border-primary/50">
                <CardContent className="p-4">
                  <div className="mb-3 flex items-center gap-3">
                    <span className={cn('size-2.5 shrink-0 rounded-full', EMPRESA_COLORS[emp.slug] ?? 'bg-slate-400')} />
                    <p className="truncate text-sm font-medium">{emp.nombre}</p>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div>
                      <p className="text-lg font-semibold tabular-nums">{emp.total}</p>
                      <p className="text-xs text-muted-foreground">empleados</p>
                    </div>
                    <div>
                      <p className={cn('text-lg font-semibold tabular-nums', emp.vencidos > 0 ? 'text-red-600 dark:text-red-400' : 'text-muted-foreground')}>
                        {emp.vencidos}
                      </p>
                      <p className="text-xs text-muted-foreground">vencidos</p>
                    </div>
                    <div>
                      <p className={cn('text-lg font-semibold tabular-nums', emp.proximos > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-muted-foreground')}>
                        {emp.proximos}
                      </p>
                      <p className="text-xs text-muted-foreground">próximos</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
