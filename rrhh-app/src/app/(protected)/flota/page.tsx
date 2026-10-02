import Link from 'next/link'
import { ChevronRight, Printer } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { getSesion } from '@/lib/auth/session'
import { tieneRol, LEGAJO_ESCRITURA } from '@/lib/auth/roles'
import { hayCanalWhatsApp } from '@/lib/whatsapp'
import { EstadoPill } from '@/components/ui/estado-pill'
import { cargarFlota } from '@/modules/flota/queries'
import { resumirVehiculo, type Semaforo } from '@/modules/flota/resumen'
import { ESTADO_CHECKLIST_LABEL } from '@/modules/flota/reglas'
import type { EstadoVencimiento } from '@/types'
import EncargadosClient from './EncargadosClient'

export const dynamic = 'force-dynamic'

const SEMAFORO: Record<Semaforo, { estado: EstadoVencimiento; label: string; orden: number }> = {
  rojo: { estado: 'vencido', label: 'Atención', orden: 0 },
  amarillo: { estado: 'proximo', label: 'Revisar', orden: 1 },
  verde: { estado: 'vigente', label: 'En orden', orden: 2 },
}

const CHECKLIST_PILL = { al_dia: 'vigente', vence_pronto: 'proximo', vencido: 'vencido', nunca: 'sin_fecha' } as const

export default async function FlotaPage({ searchParams }: { searchParams: Promise<{ empresa?: string }> }) {
  const { empresa } = await searchParams
  const supabase = await createClient()
  const [{ data: empresas }, sesion] = await Promise.all([
    supabase.from('empresas').select('id, nombre, slug').order('nombre'),
    getSesion(),
  ])
  const lista = empresas ?? []
  const empresaSel = (empresa ? lista.find((e) => e.slug === empresa) : undefined) ?? (lista.length === 1 ? lista[0] : undefined)

  if (!empresaSel) {
    return (
      <div className="mx-auto max-w-6xl p-4 sm:p-6 lg:p-8">
        <h1 className="text-2xl font-semibold tracking-tight">Flota</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">Elegí la empresa.</p>
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {lista.map((e) => (
            <Link key={e.id} href={`/flota?empresa=${e.slug}`} className="rounded-2xl border border-border bg-card px-5 py-4 text-sm font-medium transition-colors hover:bg-muted">
              {e.nombre}
            </Link>
          ))}
        </div>
      </div>
    )
  }

  let flota
  try {
    flota = await cargarFlota(supabase, { empresaId: empresaSel.id })
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

  const [{ data: encargados }, { data: avisos }] = await Promise.all([
    supabase.from('flota_encargados').select('id, nombre, telefono, activo').eq('empresa_id', empresaSel.id).order('nombre'),
    supabase.from('flota_avisos').select('id, tipo, estado, mensaje, destinatarios, error, created_at').eq('empresa_id', empresaSel.id).order('created_at', { ascending: false }).limit(15),
  ])

  const filas = flota
    .map((v) => ({ v, r: resumirVehiculo(v) }))
    .sort((a, b) => SEMAFORO[a.r.semaforo].orden - SEMAFORO[b.r.semaforo].orden || a.v.patente.localeCompare(b.v.patente))

  const cuenta = (s: Semaforo) => filas.filter((f) => f.r.semaforo === s).length
  const canEdit = tieneRol(sesion?.rol ?? null, LEGAJO_ESCRITURA)

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6 lg:p-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Flota</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {filas.length} {filas.length === 1 ? 'vehículo' : 'vehículos'} · {empresaSel.nombre}
          </p>
        </div>
        {filas.length > 0 && (
          <Link href={`/flota/qr?empresa=${empresaSel.slug}`} className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
            <Printer className="size-4" strokeWidth={1.75} />
            Imprimir QR de las camionetas
          </Link>
        )}
      </div>

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
          {empresaSel.nombre} no tiene vehículos cargados. Se agregan en{' '}
          <Link href={`/empresa/${empresaSel.slug}?vista=documentacion`} className="text-primary hover:underline">Documentación</Link>.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border bg-card">
          <table className="w-full min-w-[860px] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                <th className="px-5 py-3">Vehículo</th>
                <th className="px-3 py-3">Estado</th>
                <th className="px-3 py-3">Checklist</th>
                <th className="px-3 py-3 text-right">Kilómetros</th>
                <th className="px-3 py-3">Próximo service</th>
                <th className="px-3 py-3">Para resolver</th>
                <th className="px-3 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filas.map(({ v, r }) => {
                const service = r.mantenimientos.find((m) => m.tipo === 'service') ?? r.mantenimientos[0]
                return (
                  <tr key={v.id} className="transition-colors hover:bg-muted/40">
                    <td className="px-5 py-3">
                      <Link href={`/flota/${v.id}`} className="font-mono font-semibold tracking-wide hover:text-primary">{v.patente}</Link>
                      <p className="text-xs text-muted-foreground">{[v.marca, v.modelo].filter(Boolean).join(' ') || v.descripcion || '—'}</p>
                    </td>
                    <td className="px-3 py-3"><EstadoPill estado={SEMAFORO[r.semaforo].estado} label={SEMAFORO[r.semaforo].label} /></td>
                    <td className="px-3 py-3">
                      {v.checklist_activo ? (
                        <>
                          <EstadoPill estado={CHECKLIST_PILL[r.checklist.estado]} label={ESTADO_CHECKLIST_LABEL[r.checklist.estado]} />
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            {r.checklist.diasDesde == null ? 'nunca se hizo' : r.checklist.diasDesde === 0 ? 'hecho hoy' : `hace ${r.checklist.diasDesde} ${r.checklist.diasDesde === 1 ? 'día' : 'días'}`}
                          </p>
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
                        <>
                          <p className={service.estado === 'vencido' ? 'font-medium text-danger' : service.estado === 'proximo' ? 'font-medium text-warning' : ''}>
                            {service.estado === 'sin_dato' ? <span className="text-muted-foreground">Sin último service</span> : service.motivo}
                          </p>
                        </>
                      ) : <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="max-w-[260px] px-3 py-3">
                      {r.motivos.length === 0 ? (
                        <span className="text-xs text-muted-foreground">Nada pendiente</span>
                      ) : (
                        <p className="truncate text-xs text-muted-foreground" title={r.motivos.join(' · ')}>
                          {r.motivos.slice(0, 2).join(' · ')}{r.motivos.length > 2 && ` · +${r.motivos.length - 2}`}
                        </p>
                      )}
                    </td>
                    <td className="px-3 py-3 text-right">
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

      <EncargadosClient
        empresa={{ id: empresaSel.id, nombre: empresaSel.nombre }}
        encargados={encargados ?? []}
        avisos={avisos ?? []}
        canalActivo={hayCanalWhatsApp()}
        canEdit={canEdit}
      />
    </div>
  )
}
