import Link from 'next/link'
import { ChevronRight, MessageCircle, PencilLine, Printer } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { getSesion } from '@/lib/auth/session'
import { tieneRol, LEGAJO_ESCRITURA } from '@/lib/auth/roles'
import { EstadoPill } from '@/components/ui/estado-pill'
import { cargarFlota } from '@/modules/flota/queries'
import { resumirVehiculo, type ResumenVehiculo, type Semaforo } from '@/modules/flota/resumen'
import { ESTADO_CHECKLIST_LABEL, fmtDia } from '@/modules/flota/reglas'
import type { EstadoVencimiento } from '@/types'

export const dynamic = 'force-dynamic'

const SEMAFORO: Record<Semaforo, { estado: EstadoVencimiento; label: string; orden: number }> = {
  rojo: { estado: 'vencido', label: 'Atención', orden: 0 },
  amarillo: { estado: 'proximo', label: 'Revisar', orden: 1 },
  verde: { estado: 'vigente', label: 'En orden', orden: 2 },
}

const CHECKLIST_PILL = { al_dia: 'vigente', vence_pronto: 'proximo', vencido: 'vencido', nunca: 'sin_fecha' } as const

/** Debajo del estado del checklist: cuándo se hizo o hasta cuándo hay tiempo. */
function detalleChecklist(c: ResumenVehiculo['checklist']): string {
  if (c.estado === 'nunca') return 'nunca se hizo'
  if (c.estado === 'vence_pronto') return c.venceEn === 0 ? 'hoy es el último día' : `hay tiempo hasta el ${fmtDia(c.limite!)}`
  if (c.estado === 'vencido') return `venció el ${fmtDia(c.limite!)}`
  return c.diasDesde === 0 ? 'hecho hoy' : `hecho hace ${c.diasDesde} ${c.diasDesde === 1 ? 'día' : 'días'}`
}

/**
 * Flota de una empresa (?empresa=slug) o de TODAS (sin el parámetro): la misma
 * tabla, ordenada por urgencia; con todas se suma la columna de empresa.
 */
export default async function FlotaPage({ searchParams }: { searchParams: Promise<{ empresa?: string }> }) {
  const { empresa } = await searchParams
  const supabase = await createClient()
  const [{ data: empresas }, sesion] = await Promise.all([
    supabase.from('empresas').select('id, nombre, slug').order('nombre'),
    getSesion(),
  ])
  const canEdit = tieneRol(sesion?.rol ?? null, LEGAJO_ESCRITURA)
  const lista = empresas ?? []
  // Quien ve una sola empresa (acceso limitado a una sede) cae directo en la suya.
  const empresaSel = (empresa ? lista.find((e) => e.slug === empresa) : undefined) ?? (lista.length === 1 ? lista[0] : undefined)
  const todas = !empresaSel
  const nombreEmpresa = new Map(lista.map((e) => [e.id, e]))

  let flota
  try {
    flota = await cargarFlota(supabase, todas ? {} : { empresaId: empresaSel.id })
  } catch (e) {
    return (
      <div className="mx-auto max-w-6xl p-4 sm:p-6 lg:p-8">
        <h1 className="text-2xl font-semibold tracking-tight">Flota</h1>
        <div className="mt-6 rounded-2xl border border-danger/30 bg-danger-subtle px-5 py-4 text-sm text-danger">
          No se pudo cargar la flota. Detalle técnico: {e instanceof Error ? e.message : String(e)}
        </div>
      </div>
    )
  }

  const filas = flota
    .map((v) => ({ v, r: resumirVehiculo(v), empresa: nombreEmpresa.get(v.empresa_id) }))
    .sort((a, b) =>
      SEMAFORO[a.r.semaforo].orden - SEMAFORO[b.r.semaforo].orden ||
      (a.empresa?.nombre ?? '').localeCompare(b.empresa?.nombre ?? '') ||
      a.v.patente.localeCompare(b.v.patente)
    )

  const cuenta = (s: Semaforo) => filas.filter((f) => f.r.semaforo === s).length
  const sinDatos = filas.filter(({ v }) => !v.marca || !v.modelo || !v.anio).length
  const boton = 'inline-flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground'
  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6 lg:p-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Flota</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {filas.length} {filas.length === 1 ? 'vehículo' : 'vehículos'} · {todas ? 'todas las empresas' : empresaSel.nombre}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canEdit && filas.length > 0 && (
            <Link href={todas ? '/flota/datos' : `/flota/datos?empresa=${empresaSel.slug}`} className={boton}>
              <PencilLine className="size-4" strokeWidth={1.75} />
              Cargar marca, modelo y año
            </Link>
          )}
          {!todas && filas.length > 0 && (
            <Link href={`/flota/qr?empresa=${empresaSel.slug}`} className={boton}>
              <Printer className="size-4" strokeWidth={1.75} />
              Imprimir QR de las camionetas
            </Link>
          )}
        </div>
      </div>

      {canEdit && sinDatos > 0 && (
        <p className="rounded-xl border border-warning/30 bg-warning-subtle px-4 py-3 text-sm text-warning">
          {sinDatos === filas.length ? 'Ninguna camioneta tiene' : `${sinDatos} ${sinDatos === 1 ? 'camioneta no tiene' : 'camionetas no tienen'}`} marca, modelo y año completos.{' '}
          <Link href={todas ? '/flota/datos' : `/flota/datos?empresa=${empresaSel.slug}`} className="font-medium underline underline-offset-2">Cargarlos todos juntos</Link>
        </p>
      )}

      <section className="rounded-2xl border border-border bg-card p-5 sm:p-6">
        <div className="grid grid-cols-2 gap-y-5 sm:grid-cols-4 sm:divide-x sm:divide-border">
          <div className="sm:pr-6">
            <p className="text-3xl font-semibold tabular-nums">{filas.length}</p>
            <p className="mt-0.5 text-sm text-muted-foreground">Vehículos</p>
          </div>
          <div className="sm:px-6">
            <p className={`text-3xl font-semibold tabular-nums ${cuenta('rojo') > 0 ? 'text-danger' : ''}`}>{cuenta('rojo')}</p>
            <p className="mt-0.5 text-sm text-muted-foreground">Requieren atención</p>
          </div>
          <div className="sm:px-6">
            <p className={`text-3xl font-semibold tabular-nums ${cuenta('amarillo') > 0 ? 'text-warning' : ''}`}>{cuenta('amarillo')}</p>
            <p className="mt-0.5 text-sm text-muted-foreground">A revisar</p>
          </div>
          <div className="sm:pl-6">
            <p className="text-3xl font-semibold tabular-nums text-success">{cuenta('verde')}</p>
            <p className="mt-0.5 text-sm text-muted-foreground">En orden</p>
          </div>
        </div>
      </section>

      {filas.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border px-6 py-12 text-center text-sm text-muted-foreground">
          {todas ? (
            'No hay vehículos cargados en ninguna empresa.'
          ) : (
            <>
              {empresaSel.nombre} no tiene vehículos cargados. Se agregan en{' '}
              <Link href={`/empresa/${empresaSel.slug}?vista=documentacion`} className="text-primary hover:underline">Habilitaciones</Link>.
            </>
          )}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border bg-card">
          <table className="w-full min-w-[1040px] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                <th className="px-5 py-3">Patente</th>
                <th className="px-3 py-3">Marca</th>
                <th className="px-3 py-3">Modelo</th>
                <th className="px-3 py-3 text-right">Año</th>
                {todas && <th className="px-3 py-3">Empresa</th>}
                <th className="px-3 py-3">Estado</th>
                <th className="px-3 py-3">Checklist</th>
                <th className="px-3 py-3 text-right">Kilómetros</th>
                <th className="px-3 py-3">Próximo service</th>
                <th className="px-3 py-3">Para resolver</th>
                <th className="px-3 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filas.map(({ v, r, empresa: emp }) => {
                const service = r.mantenimientos.find((m) => m.tipo === 'service') ?? r.mantenimientos[0]
                return (
                  <tr key={v.id} className="transition-colors hover:bg-muted/40">
                    <td className="whitespace-nowrap px-5 py-3">
                      <Link href={`/flota/${v.id}`} className="font-mono font-semibold tracking-wide hover:text-primary">{v.patente}</Link>
                    </td>
                    <td className="px-3 py-3">{v.marca ?? <span className="text-muted-foreground">—</span>}</td>
                    <td className="px-3 py-3">{v.modelo ?? <span className="text-muted-foreground">{v.descripcion ?? '—'}</span>}</td>
                    <td className="px-3 py-3 text-right tabular-nums">{v.anio ?? <span className="text-muted-foreground">—</span>}</td>
                    {todas && (
                      <td className="px-3 py-3">
                        {emp ? (
                          <Link href={`/flota?empresa=${emp.slug}`} className="text-muted-foreground hover:text-foreground">{emp.nombre}</Link>
                        ) : '—'}
                      </td>
                    )}
                    <td className="px-3 py-3"><EstadoPill estado={SEMAFORO[r.semaforo].estado} label={SEMAFORO[r.semaforo].label} /></td>
                    <td className="px-3 py-3">
                      {v.checklist_activo ? (
                        <>
                          <EstadoPill estado={CHECKLIST_PILL[r.checklist.estado]} label={ESTADO_CHECKLIST_LABEL[r.checklist.estado]} />
                          <p className="mt-0.5 text-xs text-muted-foreground">{detalleChecklist(r.checklist)}</p>
                        </>
                      ) : (
                        <span className="text-xs text-muted-foreground">Desactivado</span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums">
                      {v.km_actual != null ? <span className="font-medium">{v.km_actual.toLocaleString('es-AR')}</span> : <span className="text-muted-foreground">—</span>}
                      {r.kmDia != null && <p className="text-xs text-muted-foreground">{Math.round(r.kmDia)} km/día</p>}
                    </td>
                    <td className="px-3 py-3">
                      {service ? (
                        <p className={service.estado === 'vencido' ? 'font-medium text-danger' : service.estado === 'proximo' ? 'font-medium text-warning' : ''}>
                          {service.estado === 'sin_dato'
                            ? <span className="text-muted-foreground">{v.services.some((s) => s.tipo === service.tipo) ? service.motivo : 'Sin último service'}</span>
                            : service.motivo}
                        </p>
                      ) : <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="max-w-[200px] px-3 py-3">
                      {r.motivos.length === 0 ? (
                        <span className="text-xs text-muted-foreground">Nada pendiente</span>
                      ) : (
                        <p className="truncate text-xs text-muted-foreground" title={r.motivos.join(' · ')}>
                          {r.motivos.slice(0, 2).join(' · ')}{r.motivos.length > 2 && ` · +${r.motivos.length - 2}`}
                        </p>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 text-right">
                      {emp && (
                        <Link href={`/flota/qr?empresa=${emp.slug}&vehiculo=${v.id}&imprimir=1`} prefetch={false} title={`Imprimir el QR de ${v.patente}`} className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground">
                          <Printer className="size-3.5" strokeWidth={1.75} />
                          QR
                        </Link>
                      )}
                      <Link href={`/flota/${v.id}`} aria-label={`Ver ${v.patente}`} className="inline-flex size-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground">
                        <ChevronRight className="size-4" />
                      </Link>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Avisos por WhatsApp: el backend está armado e inactivo (lib/whatsapp.ts,
          /api/cron/flota, EncargadosClient). Se habilita cuando se decida el número. */}
      <section className="flex flex-wrap items-start gap-3 rounded-2xl border border-dashed border-border bg-card px-5 py-4 sm:px-6">
        <MessageCircle className="mt-0.5 size-5 shrink-0 text-muted-foreground" strokeWidth={1.75} />
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-2 font-medium">
            Avisos por WhatsApp
            <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">En desarrollo</span>
          </p>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Más adelante, un resumen cada mañana de lo vencido y un aviso al instante cuando una camioneta quede no apta. Por ahora, todo se ve en esta pantalla.
          </p>
        </div>
      </section>
    </div>
  )
}
