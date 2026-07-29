import { createClient } from '@/lib/supabase/server'
import { getSesion } from '@/lib/auth/session'
import { notFound } from 'next/navigation'
import { getEstadoVencimiento, diasHastaVencimiento, type EstadoVencimiento } from '@/types'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import Link from 'next/link'
import { Users, FileCheck2, Clock, AlertTriangle, Plus } from 'lucide-react'
import { Monograma } from '@/components/ui/monograma'
import { EstadoPill, EstadoBadgeSuave } from '@/components/ui/estado-pill'
import { BarraVencimiento } from '@/components/ui/barra-vencimiento'
import { Donut } from '@/components/ui/donut'
import { Segmented } from '@/components/ui/segmented'
import VehiculosClient from './VehiculosClient'
import EquiposClient from './EquiposClient'
import EmpresaCertsClient from './EmpresaCertsClient'

interface CertFecha {
  fecha_vencimiento?: string | null
  alerta_dias?: number | null
  created_at?: string | null
}

function peorEstado(certs: CertFecha[]): EstadoVencimiento {
  const estados = certs.map((c) => getEstadoVencimiento(c.fecha_vencimiento, c.alerta_dias))
  if (estados.includes('vencido')) return 'vencido'
  if (estados.includes('proximo')) return 'proximo'
  if (estados.includes('vigente')) return 'vigente'
  return 'sin_fecha'
}

function fmtFechaLarga(fecha: string) {
  return format(new Date(fecha.slice(0, 10) + 'T12:00:00'), 'd MMM yyyy', { locale: es })
    .replace('.', '')
    .toUpperCase()
}

function fmtFechaCorta(fecha: string) {
  return format(new Date(fecha.slice(0, 10) + 'T12:00:00'), 'd MMM yyyy', { locale: es }).replace('.', '')
}

export default async function EmpresaPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ vista?: string; tab?: string }>
}) {
  const [{ slug }, sp, sesion] = await Promise.all([params, searchParams, getSesion()])
  const supabase = await createClient()

  const { data: empresa } = await supabase
    .from('empresas')
    .select('id, nombre, slug')
    .eq('slug', slug)
    .single()

  if (!empresa) notFound()

  const canEdit = sesion?.rol === 'admin' || sesion?.rol === 'usuario'

  const [
    { data: empleados },
    { data: vehiculos },
    { data: equipos },
    { data: secciones },
    { data: certsEmpresa },
    { data: tiposVehiculo },
    { data: tiposEquipo },
  ] = await Promise.all([
    supabase
      .from('empleados')
      .select('id, nombre, apellido, sector, certificados(id, fecha_vencimiento, alerta_dias, created_at, tipo:tipos_certificado(nombre), tipo_nombre_custom)')
      .eq('empresa_id', empresa.id)
      .eq('activo', true)
      .order('nombre'),
    supabase
      .from('vehiculos')
      .select(
        '*, certificados(id, tipo_id, tipo_nombre_custom, fecha_vencimiento, notas, alerta_dias, created_at, tipo:tipos_certificado(nombre), archivos(id, nombre, path))'
      )
      .eq('empresa_id', empresa.id)
      .eq('activo', true)
      .order('patente'),
    supabase
      .from('equipos')
      .select(
        '*, certificados(id, tipo_id, tipo_nombre_custom, fecha_vencimiento, notas, alerta_dias, created_at, tipo:tipos_certificado(nombre), archivos(id, nombre, path))'
      )
      .eq('empresa_id', empresa.id)
      .eq('activo', true)
      .order('nombre'),
    supabase
      .from('activo_secciones')
      .select('id, nombre')
      .eq('empresa_id', empresa.id)
      .order('nombre'),
    supabase
      .from('certificados')
      .select('*, tipo:tipos_certificado(nombre), archivos(id, nombre, path)')
      .eq('empresa_id', empresa.id)
      .order('fecha_vencimiento'),
    supabase.from('tipos_certificado').select('*').eq('aplica_vehiculo', true).order('orden'),
    supabase.from('tipos_certificado').select('*').eq('aplica_equipo', true).order('orden'),
  ])

  const vista = sp.vista === 'documentacion' ? 'documentacion' : 'resumen'

  /* ── Vista Documentación: habilitaciones + vehículos + secciones de activos ── */
  if (vista === 'documentacion') {
    return (
      <div className="mx-auto max-w-6xl p-4 sm:p-6 lg:p-8" id="documentacion">
        <div className="mb-8 flex items-center gap-4">
          <Monograma nombre={empresa.nombre} size="lg" variant="accent" />
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Documentación</h1>
            <p className="text-sm text-muted-foreground">{empresa.nombre} · habilitaciones, vehículos y activos</p>
          </div>
        </div>

        <EmpresaCertsClient
          certs={certsEmpresa ?? []}
          canEdit={canEdit}
          empresaSlug={slug}
          empresaId={empresa.id}
        />

        <VehiculosClient
          vehiculos={vehiculos ?? []}
          tiposCertificado={tiposVehiculo ?? []}
          canEdit={canEdit}
          empresaSlug={slug}
        />

        <EquiposClient
          equipos={equipos ?? []}
          secciones={secciones ?? []}
          tiposCertificado={tiposEquipo ?? []}
          canEdit={canEdit}
          empresaSlug={slug}
          empresaId={empresa.id}
        />
      </div>
    )
  }

  /* ── Vista Resumen (dashboard del mockup) ── */

  // Todos los certificados del ámbito de la empresa, con su dueño
  interface CertConDueno extends CertFecha {
    id: string
    nombre: string // dueño legible
    detalle: string // tipo de certificado
    href: string
    sector?: string | null
  }

  const todosLosCerts: CertConDueno[] = []
  for (const emp of empleados ?? []) {
    const nombreCompleto = [emp.nombre, emp.apellido].filter(Boolean).join(' ')
    for (const c of emp.certificados ?? []) {
      todosLosCerts.push({
        ...c,
        id: c.id,
        nombre: nombreCompleto,
        detalle: c.tipo?.nombre ?? c.tipo_nombre_custom ?? 'Certificado',
        href: `/legajo/${emp.id}`,
        sector: emp.sector,
      })
    }
  }
  for (const v of vehiculos ?? []) {
    for (const c of v.certificados ?? []) {
      todosLosCerts.push({
        ...c,
        id: c.id,
        nombre: `Vehículo ${v.patente}`,
        detalle: c.tipo?.nombre ?? c.tipo_nombre_custom ?? 'Certificado',
        href: `/empresa/${slug}?vista=documentacion`,
      })
    }
  }
  for (const eq of equipos ?? []) {
    for (const c of eq.certificados ?? []) {
      todosLosCerts.push({
        ...c,
        id: c.id,
        nombre: eq.nombre,
        detalle: c.tipo?.nombre ?? c.tipo_nombre_custom ?? 'Certificado',
        href: `/empresa/${slug}?vista=documentacion`,
      })
    }
  }
  for (const c of certsEmpresa ?? []) {
    todosLosCerts.push({
      ...c,
      id: c.id,
      nombre: empresa.nombre,
      detalle: c.tipo?.nombre ?? c.tipo_nombre_custom ?? 'Habilitación',
      href: `/empresa/${slug}?vista=documentacion`,
    })
  }

  const conFecha = todosLosCerts.filter((c) => c.fecha_vencimiento)
  const vencidos = conFecha.filter((c) => getEstadoVencimiento(c.fecha_vencimiento, c.alerta_dias) === 'vencido')
  const proximos = conFecha.filter((c) => getEstadoVencimiento(c.fecha_vencimiento, c.alerta_dias) === 'proximo')
  const alDia = conFecha.length - vencidos.length - proximos.length
  const pctCumplimiento = conFecha.length > 0 ? (alDia / conFecha.length) * 100 : 100

  // Próximo vencimiento (fecha >= hoy más cercana)
  const proximoVenc = conFecha
    .filter((c) => diasHastaVencimiento(c.fecha_vencimiento!) >= 0)
    .sort((a, b) => a.fecha_vencimiento!.localeCompare(b.fecha_vencimiento!))[0]

  // Certificados cargados este mes
  const inicioMes = new Date()
  inicioMes.setDate(1)
  const inicioMesISO = inicioMes.toISOString().slice(0, 10)
  const nuevosMes = todosLosCerts.filter((c) => (c.created_at ?? '') >= inicioMesISO).length

  // Atención requerida: vencidos + próximos, ordenados por urgencia
  const atencion = [...vencidos, ...proximos]
    .sort((a, b) => a.fecha_vencimiento!.localeCompare(b.fecha_vencimiento!))
    .slice(0, 8)

  // Sectores con conteo y estado
  const sectores = [...new Set((empleados ?? []).map((e) => e.sector?.trim() || 'General'))].map((s) => {
    const emps = (empleados ?? []).filter((e) => (e.sector?.trim() || 'General') === s)
    const certs = emps.flatMap((e) => e.certificados ?? [])
    const prox = certs.filter((c) => {
      const est = getEstadoVencimiento(c.fecha_vencimiento, c.alerta_dias)
      return est === 'proximo' || est === 'vencido'
    }).length
    return { nombre: s, personas: emps.length, pendientes: prox }
  }).sort((a, b) => b.personas - a.personas)

  const tab = sp.tab === 'empleados' ? 'empleados' : 'vencimientos'

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6 lg:p-8">
      {/* ── Hero ── */}
      <section className="rounded-2xl bg-surface-dark p-6 text-surface-dark-foreground sm:p-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">{empresa.nombre}</h1>
            <p className="mt-1 text-sm text-white/50">Estado general de la empresa</p>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              {vencidos.length === 0 ? (
                <EstadoBadgeSuave estado="vigente" label="Operación estable" />
              ) : (
                <EstadoBadgeSuave
                  estado="vencido"
                  label={`${vencidos.length} ${vencidos.length === 1 ? 'vencimiento requiere' : 'vencimientos requieren'} acción`}
                />
              )}
              {proximos.length > 0 && (
                <span className="text-sm text-white/60">
                  {proximos.length} por vencer próximamente
                </span>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-8">
            <div className="lg:border-l lg:border-white/10 lg:pl-8">
              <p className="text-sm text-white/50">Próximo vencimiento</p>
              {proximoVenc ? (
                <>
                  <p className="mt-1 text-2xl font-semibold tracking-tight">
                    {fmtFechaLarga(proximoVenc.fecha_vencimiento!)}
                  </p>
                  <p className="mt-1 text-sm font-medium text-white/90">{proximoVenc.nombre}</p>
                  <p className="text-xs text-white/50">{proximoVenc.detalle}</p>
                </>
              ) : (
                <p className="mt-1 text-2xl font-semibold text-white/40">—</p>
              )}
            </div>
            {canEdit && (
              <Link
                href={`/empresa/${slug}?vista=documentacion`}
                className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
              >
                <Plus className="size-4" strokeWidth={2.5} />
                Nueva habilitación
              </Link>
            )}
          </div>
        </div>
      </section>

      {/* ── KPIs ── */}
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="rounded-2xl border border-border bg-card p-5">
          <div className="flex items-center gap-2.5">
            <span className="flex size-9 items-center justify-center rounded-xl bg-accent text-primary">
              <Users className="size-4" strokeWidth={1.75} />
            </span>
            <span className="text-sm text-muted-foreground">Empleados</span>
          </div>
          <p className="mt-3 text-3xl font-semibold tabular-nums">{empleados?.length ?? 0}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">activos</p>
        </div>

        <div className="rounded-2xl border border-border bg-card p-5">
          <div className="flex items-center gap-2.5">
            <span className="flex size-9 items-center justify-center rounded-xl bg-success-subtle text-success">
              <FileCheck2 className="size-4" strokeWidth={1.75} />
            </span>
            <span className="text-sm text-muted-foreground">Certificados</span>
          </div>
          <p className="mt-3 text-3xl font-semibold tabular-nums">{todosLosCerts.length}</p>
          <p className="mt-0.5 text-xs text-success">{nuevosMes > 0 ? `+${nuevosMes} este mes` : 'sin cargas este mes'}</p>
        </div>

        <div className="rounded-2xl border border-border bg-card p-5">
          <div className="flex items-center gap-2.5">
            <span className="flex size-9 items-center justify-center rounded-xl bg-warning-subtle text-warning">
              <Clock className="size-4" strokeWidth={1.75} />
            </span>
            <span className="text-sm text-muted-foreground">Por vencer</span>
          </div>
          <p className="mt-3 text-3xl font-semibold tabular-nums">{proximos.length}</p>
          <p className="mt-0.5 text-xs text-warning">dentro de su ventana de alerta</p>
        </div>

        <div
          className={`rounded-2xl border bg-card p-5 ${vencidos.length > 0 ? 'border-danger/30' : 'border-border'}`}
        >
          <div className="flex items-center gap-2.5">
            <span className="flex size-9 items-center justify-center rounded-xl bg-danger-subtle text-danger">
              <AlertTriangle className="size-4" strokeWidth={1.75} />
            </span>
            <span className="text-sm text-muted-foreground">Vencidos</span>
          </div>
          <p className="mt-3 text-3xl font-semibold tabular-nums">{vencidos.length}</p>
          <p className={`mt-0.5 text-xs ${vencidos.length > 0 ? 'text-danger' : 'text-muted-foreground'}`}>
            {vencidos.length > 0 ? 'atención inmediata' : 'todo en orden'}
          </p>
        </div>
      </section>

      {/* ── Atención requerida + columna derecha ── */}
      <section className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="rounded-2xl border border-border bg-card p-5 sm:p-6">
          <h2 className="text-lg font-semibold tracking-tight">Atención requerida</h2>
          <p className="text-sm text-muted-foreground">Ordenado por urgencia</p>

          <Segmented
            className="mt-4"
            active={tab}
            tabs={[
              { key: 'vencimientos', label: 'Vencimientos', href: `/empresa/${slug}` },
              { key: 'empleados', label: 'Todos los empleados', href: `/empresa/${slug}?tab=empleados` },
            ]}
          />

          {tab === 'vencimientos' ? (
            <div className="mt-4 space-y-2">
              {atencion.length === 0 && (
                <p className="rounded-xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
                  Nada requiere atención. Todo al día.
                </p>
              )}
              {atencion.map((c) => {
                const dias = diasHastaVencimiento(c.fecha_vencimiento!)
                const label =
                  dias < 0
                    ? `Vencido hace ${Math.abs(dias)} ${Math.abs(dias) === 1 ? 'día' : 'días'}`
                    : dias === 0
                      ? 'Vence hoy'
                      : `Vence en ${dias} ${dias === 1 ? 'día' : 'días'}`
                return (
                  <div
                    key={c.id}
                    className="flex items-center gap-4 rounded-xl border border-border px-4 py-3"
                  >
                    <Monograma nombre={c.nombre} size="md" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{c.nombre}</p>
                      <p className="truncate text-xs text-muted-foreground">{c.detalle}</p>
                      <BarraVencimiento
                        className="mt-2"
                        fecha={c.fecha_vencimiento!}
                        alertaDias={c.alerta_dias}
                      />
                    </div>
                    <div className="shrink-0 text-right">
                      <EstadoPill estado={dias < 0 ? 'vencido' : 'proximo'} label={label} />
                      <p className="mt-0.5 text-xs text-muted-foreground">{fmtFechaCorta(c.fecha_vencimiento!)}</p>
                    </div>
                    <Link
                      href={c.href}
                      className="shrink-0 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    >
                      Abrir
                    </Link>
                  </div>
                )
              })}
              {atencion.length > 0 && (
                <p className="pt-1 text-xs text-muted-foreground">
                  Se muestran los casos que requieren una acción concreta.
                </p>
              )}
            </div>
          ) : (
            <div className="mt-4 space-y-2">
              {(empleados ?? []).map((emp) => {
                const nombreCompleto = [emp.nombre, emp.apellido].filter(Boolean).join(' ')
                const certs = emp.certificados ?? []
                const estado = certs.length > 0 ? peorEstado(certs) : 'sin_fecha'
                return (
                  <div key={emp.id} className="flex items-center gap-4 rounded-xl border border-border px-4 py-3">
                    <Monograma nombre={nombreCompleto} size="md" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{nombreCompleto}</p>
                      <p className="text-xs text-muted-foreground">
                        {emp.sector?.trim() || 'General'} · {certs.length} {certs.length === 1 ? 'certificado' : 'certificados'}
                      </p>
                    </div>
                    <EstadoPill estado={estado} />
                    <Link
                      href={`/legajo/${emp.id}`}
                      className="shrink-0 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    >
                      Abrir
                    </Link>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <div className="space-y-6">
          {/* Cumplimiento */}
          <div className="rounded-2xl border border-border bg-card p-5 sm:p-6">
            <h2 className="text-lg font-semibold tracking-tight">Cumplimiento</h2>
            <p className="text-sm text-muted-foreground">Estado documental</p>
            <div className="mt-4 flex items-center gap-5">
              <Donut pct={pctCumplimiento} />
              <div className="space-y-2">
                <p className="text-3xl font-semibold tabular-nums leading-none">{alDia}</p>
                <p className="text-xs text-muted-foreground">certificados al día</p>
                <div className="space-y-1 pt-1">
                  <EstadoPill estado="proximo" label={`${proximos.length} próximos`} />
                  <br />
                  <EstadoPill estado="vencido" label={`${vencidos.length} ${vencidos.length === 1 ? 'vencido' : 'vencidos'}`} />
                </div>
              </div>
            </div>
          </div>

          {/* Equipos por área */}
          {sectores.length > 0 && (
            <div className="rounded-2xl border border-border bg-card p-5 sm:p-6">
              <h2 className="text-lg font-semibold tracking-tight">Equipos por área</h2>
              <p className="text-sm text-muted-foreground">Distribución actual</p>
              <div className="mt-4 space-y-2">
                {sectores.map((s) => (
                  <div key={s.nombre} className="flex items-center gap-3 rounded-xl bg-muted/60 px-4 py-3">
                    <span className={`size-2 shrink-0 rounded-full ${s.pendientes > 0 ? 'bg-warning' : 'bg-success'}`} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{s.nombre}</p>
                      <p className={`text-xs ${s.pendientes > 0 ? 'text-warning' : 'text-success'}`}>
                        {s.pendientes > 0 ? `${s.pendientes} ${s.pendientes === 1 ? 'pendiente' : 'pendientes'}` : 'Todo al día'}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-lg font-semibold tabular-nums leading-none">{s.personas}</p>
                      <p className="text-[11px] text-muted-foreground">{s.personas === 1 ? 'persona' : 'personas'}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  )
}
