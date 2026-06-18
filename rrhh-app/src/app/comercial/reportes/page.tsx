import { requireModulo } from '@/lib/auth/session'
import { obtenerReportesComerciales, listarVendedores } from '@/modules/comercial/queries'
import { puedeVerReportesComerciales } from '@/modules/comercial/permisos'
import { redirect } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { EtapaBadge } from '@/components/comercial/EtapaBadge'
import { ETAPA_LABEL } from '@/modules/comercial/tipos'
import type { EtapaProyecto } from '@/modules/comercial/tipos'

export default async function ReportesPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sesion = await requireModulo('comercial')
  if (!puedeVerReportesComerciales(sesion)) redirect('/comercial')

  const sp = await searchParams
  const [reporte, vendedores] = await Promise.all([
    obtenerReportesComerciales(sesion, { vendedor: sp.vendedor, estado: sp.estado, desde: sp.desde, hasta: sp.hasta }),
    listarVendedores(),
  ])

  const kpis = [
    { label: 'Proyectos abiertos', valor: reporte.proyectosAbiertos },
    { label: 'Pipeline estimado', valor: `$${reporte.pipeline.toLocaleString('es-AR')}` },
    { label: 'Ganados', valor: reporte.ganados },
    { label: 'Perdidos', valor: reporte.perdidos },
    { label: 'Tareas vencidas', valor: reporte.tareasVencidas, alerta: reporte.tareasVencidas > 0 },
    { label: 'Reuniones realizadas', valor: reporte.reunionesRealizadas },
    { label: 'Reuniones sin resultado', valor: reporte.reunionesSinResultado, alerta: reporte.reunionesSinResultado > 0 },
    { label: 'Sin movimiento', valor: reporte.sinMovimiento, alerta: reporte.sinMovimiento > 0 },
    { label: 'Sin próxima acción', valor: reporte.sinProximaAccion, alerta: reporte.sinProximaAccion > 0 },
  ]

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Reportes comerciales</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">Indicadores del equipo comercial</p>
        </div>
        <form className="flex flex-wrap gap-2 items-end">
          <select name="vendedor" defaultValue={sp.vendedor ?? ''} className="h-9 rounded-md border border-input bg-transparent px-3 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
            <option value="">Todo el equipo</option>
            {vendedores.map((v) => <option key={v.id} value={v.id}>{v.nombre}</option>)}
          </select>
          <div className="flex items-center gap-1.5">
            <label className="text-xs text-muted-foreground">Desde</label>
            <input type="date" name="desde" defaultValue={sp.desde ?? ''} className="h-9 rounded-md border border-input bg-transparent px-3 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" />
          </div>
          <div className="flex items-center gap-1.5">
            <label className="text-xs text-muted-foreground">Hasta</label>
            <input type="date" name="hasta" defaultValue={sp.hasta ?? ''} className="h-9 rounded-md border border-input bg-transparent px-3 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" />
          </div>
          <button type="submit" className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90">Filtrar</button>
          {(sp.vendedor || sp.desde || sp.hasta) && (
            <a href="/comercial/reportes" className="rounded-md border border-input px-3 py-1.5 text-xs text-muted-foreground hover:bg-accent">Limpiar</a>
          )}
        </form>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {kpis.map((k) => (
          <Card key={k.label} className={k.alerta && Number(k.valor) > 0 ? 'border-amber-500/30' : ''}>
            <CardContent className="p-5">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{k.label}</p>
              <p className={`mt-1 text-3xl font-semibold tabular-nums ${k.alerta && Number(k.valor) > 0 ? 'text-amber-500' : ''}`}>{k.valor}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {Object.keys(reporte.porEtapa).length > 0 && (
        <section>
          <h2 className="mb-4 text-sm font-semibold">Pipeline por etapa</h2>
          <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-4">
            {Object.entries(reporte.porEtapa).sort((a, b) => b[1] - a[1]).map(([etapa, count]) => (
              <div key={etapa} className="flex items-center justify-between rounded-lg border border-border bg-card px-4 py-3">
                <EtapaBadge etapa={etapa as EtapaProyecto} />
                <span className="text-lg font-semibold tabular-nums">{count}</span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
