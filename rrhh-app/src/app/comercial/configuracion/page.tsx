import { requireModulo } from '@/lib/auth/session'
import { puedeGestionarConfiguracionComercial } from '@/modules/comercial/permisos'
import { redirect } from 'next/navigation'
import { listarMotivosDetalle, obtenerConfigComercial } from '@/modules/comercial/queries'
import { Card, CardContent } from '@/components/ui/card'
import Link from 'next/link'
import { UserPlus } from 'lucide-react'

export default async function ConfiguracionComercialPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>
}) {
  const sesion = await requireModulo('comercial')
  if (!puedeGestionarConfiguracionComercial(sesion)) redirect('/comercial')

  const [motivos, configMap, sp] = await Promise.all([
    listarMotivosDetalle(),
    obtenerConfigComercial(),
    searchParams,
  ])

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Configuración del módulo</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">Parámetros y datos de referencia del módulo comercial</p>
      </div>

      {sp.success === 'comercial_creado' && (
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300">
          Comercial creado exitosamente.
        </div>
      )}

      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold">Gestión de equipo</h2>
          <Link
            href="/comercial/configuracion/equipo/nuevo"
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition-colors">
            <UserPlus className="size-3.5" strokeWidth={2} />
            Agregar comercial
          </Link>
        </div>
        <p className="text-xs text-muted-foreground">Creá usuarios para que los comerciales puedan acceder al sistema. Los usuarios creados aquí tendrán acceso únicamente al módulo comercial.</p>
      </section>

      <section>
        <h2 className="mb-4 text-sm font-semibold">Parámetros generales</h2>
        <Card>
          <CardContent className="p-5 space-y-3">
            <div className="flex items-center justify-between py-2 border-b border-border">
              <div>
                <p className="text-sm font-medium">Días sin movimiento para alerta</p>
                <p className="text-xs text-muted-foreground">Proyectos abiertos sin actividad que superan este umbral se marcan como en riesgo.</p>
              </div>
              <span className="text-sm font-semibold tabular-nums">{String(configMap['dias_sin_movimiento_alerta'] ?? 7)} días</span>
            </div>
            <div className="flex items-center justify-between py-2">
              <div>
                <p className="text-sm font-medium">Moneda por defecto</p>
                <p className="text-xs text-muted-foreground">Se usa al crear nuevos proyectos y viajes.</p>
              </div>
              <span className="text-sm font-semibold">{String(configMap['moneda_default'] ?? 'ARS').replace(/"/g, '')}</span>
            </div>
          </CardContent>
        </Card>
        <p className="mt-2 text-xs text-muted-foreground">La edición de configuración estará disponible próximamente.</p>
      </section>

      <section>
        <h2 className="mb-4 text-sm font-semibold">Motivos de pérdida ({motivos.length})</h2>
        <Card>
          <CardContent className="p-0">
            <div className="divide-y divide-border">
              {motivos.map((m) => (
                <div key={m.id} className="flex items-center gap-3 px-5 py-3">
                  <div className={`size-2 rounded-full shrink-0 ${m.activo ? 'bg-emerald-500' : 'bg-neutral-400'}`} />
                  <div className="flex-1">
                    <p className="text-sm font-medium">{m.nombre}</p>
                    {m.descripcion && <p className="text-xs text-muted-foreground">{m.descripcion}</p>}
                  </div>
                  <span className="text-xs text-muted-foreground">#{m.orden}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
        <p className="mt-2 text-xs text-muted-foreground">Gestión de motivos de pérdida estará disponible próximamente.</p>
      </section>
    </div>
  )
}
