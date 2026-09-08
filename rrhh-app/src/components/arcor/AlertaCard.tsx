import { IconoEvento } from './IconoEvento'
import { EstadoPill } from '@/components/ui/estado-pill'
import type { EventoRow } from '@/modules/arcor/tipos'
import { severidadAEstado } from '@/modules/arcor/reglas'
import { duracion, fmtFechaHoraAR, tiempoRelativo } from '@/lib/fechas-ar'
import { cn } from '@/lib/utils'

const QUE_HACER: Record<string, string> = {
  whatsapp: 'Abrir tecnophos-wa.duckdns.org/manager, generar el QR de arcor-bot y escanearlo desde el WhatsApp del bot. La guardia de las 20:00 recupera lo que haya llegado en las últimas 72 h.',
  claude: 'Recargar crédito en console.anthropic.com → Billing. Sin Claude el sistema sigue solo con Groq (límite diario) y las fotos que no pueda leer van a la galería de revisión.',
  ocr: 'Groq y Claude fallaron o no tienen cupo: las fotos quedan para la guardia del día siguiente. Revisar claves y crédito.',
  arcor: 'El login en ARCOR Colabora está fallando: revisar ARCOR_PASSWORD en el servidor o si Colabora está caído.',
  silencio: 'Ningún reporte del sistema ARCOR en el período esperado: verificar que el droplet y los contenedores docker estén arriba (docker compose ps) y que n8n tenga los workflows activos.',
}

/** Alerta con estado: abierta (qué pasa, desde cuándo, qué hacer) o resuelta (cuánto duró). */
export function AlertaCard({ e, compacta = false }: { e: EventoRow; compacta?: boolean }) {
  const abierta = !e.resuelto_en
  const estado = abierta ? severidadAEstado(e.severidad) : 'vigente'
  const d = e.detalle ?? {}
  const desde = typeof d.abierta_desde === 'string' ? d.abierta_desde : e.ts
  const verificaciones = typeof d.verificaciones === 'number' ? d.verificaciones : null
  const accion = e.clave_alerta ? QUE_HACER[e.clave_alerta] : undefined

  return (
    <div
      className={cn(
        'rounded-xl border border-border bg-card p-4',
        abierta && e.severidad === 'critical' && 'border-danger/30',
        abierta && e.severidad === 'warning' && 'border-warning/30'
      )}
    >
      <div className="flex items-start gap-3">
        <span
          className={cn(
            'inline-flex size-9 shrink-0 items-center justify-center rounded-lg',
            !abierta ? 'bg-muted text-muted-foreground'
            : e.severidad === 'critical' ? 'bg-danger-subtle text-danger'
            : 'bg-warning-subtle text-warning'
          )}
        >
          <IconoEvento tipo={e.tipo} className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
            <p className="text-sm font-medium text-foreground">{e.titulo}</p>
            <EstadoPill
              estado={estado}
              label={abierta ? (e.severidad === 'critical' ? 'Crítica' : 'Atención') : `Resuelta · duró ${duracion(desde, e.resuelto_en!)}`}
            />
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {abierta
              ? <>Abierta desde {fmtFechaHoraAR(e.ts)} · {tiempoRelativo(e.ts)}{verificaciones ? ` · verificada ${verificaciones} veces` : ''}</>
              : <>{fmtFechaHoraAR(desde)} → {fmtFechaHoraAR(e.resuelto_en)}</>}
          </p>
          {abierta && accion && !compacta && (
            <p className="mt-2 rounded-lg bg-muted px-3 py-2 text-xs leading-relaxed text-foreground">{accion}</p>
          )}
        </div>
      </div>
    </div>
  )
}
