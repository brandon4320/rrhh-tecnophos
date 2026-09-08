import { CircleCheck } from 'lucide-react'
import { AlertaCard } from '@/components/arcor/AlertaCard'
import { ListaEventos } from '@/components/arcor/ListaEventos'
import { getAlertasAbiertas, getEstados, getEventos } from '@/modules/arcor/queries'
import { evaluarSilencio } from '@/modules/arcor/reglas'
import type { EstadoHeartbeat, EventoRow } from '@/modules/arcor/tipos'

export const dynamic = 'force-dynamic'

export default async function ArcorAlertasPage() {
  const ahora = new Date()
  const hace7d = new Date(ahora.getTime() - 7 * 86400000).toISOString()
  const [estados, abiertas, incidentes, resueltas] = await Promise.all([
    getEstados(),
    getAlertasAbiertas(),
    getEventos({ desde: hace7d, soloIncidentes: true, limit: 200 }),
    getEventos({ soloResueltas: true, limit: 50 }),
  ])

  const hb = estados.heartbeat?.valor as EstadoHeartbeat | undefined
  const silencio = evaluarSilencio(hb?.ts ?? null, ahora)
  const alertaSilencio: EventoRow | null = silencio.silencio
    ? {
        id: 'silencio',
        ts: hb?.ts ?? estados.heartbeat?.updated_at ?? ahora.toISOString(),
        tipo: 'sistema_silencio',
        severidad: 'critical',
        titulo: hb ? 'El sistema ARCOR dejó de reportar' : 'El sistema ARCOR todavía no reportó nunca',
        detalle: { umbral_min: silencio.umbralMin, minutos: silencio.minutos },
        origen: 'gestion',
        clave_alerta: 'silencio',
        resuelto_en: null,
        created_at: ahora.toISOString(),
      }
    : null
  const todasAbiertas = alertaSilencio ? [alertaSilencio, ...abiertas] : abiertas

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6 lg:p-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Alertas</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          WhatsApp, crédito del lector, fallos de workflows, publicaciones y silencio del sistema
        </p>
      </div>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold tracking-tight">Abiertas ahora</h2>
        {todasAbiertas.length === 0 ? (
          <div className="flex items-center gap-3 rounded-2xl border border-border bg-card px-5 py-4 text-sm">
            <CircleCheck className="size-4 shrink-0 text-success" strokeWidth={1.75} />
            <span>Sin alertas abiertas. Las guardias de n8n reportan cada 2 horas; si algo se cae, aparece acá.</span>
          </div>
        ) : (
          todasAbiertas.map((a) => <AlertaCard key={a.id} e={a} />)
        )}
      </section>

      <section className="rounded-2xl border border-border bg-card p-5 sm:p-6">
        <h2 className="text-lg font-semibold tracking-tight">Incidentes de los últimos 7 días</h2>
        <p className="mb-4 text-sm text-muted-foreground">
          Fallos puntuales sin estado (un workflow que falló, una conciliación que recuperó fotos, una lectura dudosa)
        </p>
        <ListaEventos eventos={incidentes} vacio="Sin incidentes en la última semana." />
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold tracking-tight">Historial de alertas resueltas</h2>
        {resueltas.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border px-6 py-8 text-center text-sm text-muted-foreground">
            Todavía no hay alertas resueltas registradas.
          </div>
        ) : (
          resueltas.map((a) => <AlertaCard key={a.id} e={a} />)
        )}
      </section>
    </div>
  )
}
