import Link from 'next/link'
import { ChevronRight, MessageCircle, Printer } from 'lucide-react'
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

  const [{ data: encargados }, { data: avisos }] = await Promise.all([
    todas
      ? supabase.from('flota_encargados').select('id, empresa_id, nombre, telefono, activo').eq('activo', true)
      : supabase.from('flota_encargados').select('id, empresa_id, nombre, telefono, activo').eq('empresa_id', empresaSel.id).order('nombre'),
    todas
      ? Promise.resolve({ data: [] as { id: string; tipo: string; estado: string; mensaje: string; destinatarios: number; error: string | null; created_at: string }[] })
      : supabase.from('flota_avisos').select('id, tipo, estado, mensaje, destinatarios, error, created_at').eq('empresa_id', empresaSel.id).order('created_at', { ascending: false }).limit(15),
  ])

  const filas = flota
    .map((v) => ({ v, r: resumirVehiculo(v), empresa: nombreEmpresa.get(v.empresa_id) }))
    .sort((a, b) =>
      SEMAFORO[a.r.semaforo].orden - SEMAFORO[b.r.semaforo].orden ||
      (a.empresa?.nombre ?? '').localeCompare(b.empresa?.nombre ?? '') ||
      a.v.patente.localeCompare(b.v.patente)
    )

  const cuenta = (s: Semaforo) => filas.filter((f) => f.r.semaforo === s).length
  const canEdit = tieneRol(sesion?.rol ?? null, LEGAJO_ESCRITURA)

  // Con todas: cuántos vehículos y cuántos encargados tiene cada empresa, para ver
  // de un vistazo cuál todavía no tiene a quién avisarle.
  const porEmpresa = todas
    ? lista
        .map((e) => ({
          ...e,
          vehiculos: flota.filter((v) => v.empresa_id === e.id).length,
          encargados: (encargados ?? []).filter((x) => x.empresa_id === e.id).length,
        }))
        .filter((e) => e.vehiculos > 0)
    : []

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6 lg:p-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Flota</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {filas.length} {filas.length === 1 ? 'vehículo' : 'vehículos'} · {todas ? 'todas las empresas' : empresaSel.nombre}
          </p>
        </div>
        {!todas && filas.length > 0 && (
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
          <table className="w-full min-w-[860px] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                <th className="px-5 py-3">Vehículo</th>
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
                    <td className="px-5 py-3">
                      <Link href={`/flota/${v.id}`} className="font-mono font-semibold tracking-wide hover:text-primary">{v.patente}</Link>
                      <p className="text-xs text-muted-foreground">{[v.marca, v.modelo].filter(Boolean).join(' ') || v.descripcion || '—'}</p>
                    </td>
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
                        <p className={service.estado === 'vencido' ? 'font-medium text-danger' : service.estado === 'proximo' ? 'font-medium text-warning' : ''}>
                          {service.estado === 'sin_dato' ? <span className="text-muted-foreground">Sin último service</span> : service.motivo}
                        </p>
                      ) : <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="max-w-[240px] px-3 py-3">
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

      {todas ? (
        porEmpresa.length > 0 && (
          <section className="rounded-2xl border border-border bg-card">
            <div className="border-b border-border px-5 py-4 sm:px-6">
              <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight">
                <MessageCircle className="size-5 text-muted-foreground" strokeWidth={1.75} />
                Avisos por WhatsApp
              </h2>
              <p className="text-sm text-muted-foreground">
                Se configuran en cada empresa: cada una avisa a sus propios encargados.
                {!hayCanalWhatsApp() && ' El envío todavía no está conectado.'}
              </p>
            </div>
            <ul className="divide-y divide-border">
              {porEmpresa.map((e) => (
                <li key={e.id}>
                  <Link href={`/flota?empresa=${e.slug}`} className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-muted/40 sm:px-6">
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium">{e.nombre}</span>
                      <span className="block text-xs text-muted-foreground">{e.vehiculos} {e.vehiculos === 1 ? 'vehículo' : 'vehículos'}</span>
                    </span>
                    <span className={`text-xs ${e.encargados === 0 ? 'font-medium text-warning' : 'text-muted-foreground'}`}>
                      {e.encargados === 0 ? 'Sin encargados' : `${e.encargados} ${e.encargados === 1 ? 'encargado' : 'encargados'}`}
                    </span>
                    <ChevronRight className="size-4 text-muted-foreground" />
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )
      ) : (
        <EncargadosClient
          empresa={{ id: empresaSel.id, nombre: empresaSel.nombre }}
          encargados={encargados ?? []}
          avisos={avisos ?? []}
          canalActivo={hayCanalWhatsApp()}
          canEdit={canEdit}
        />
      )}
    </div>
  )
}
