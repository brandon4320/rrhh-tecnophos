'use client'

import { Fragment, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  ArrowLeft, Check, ChevronDown, ClipboardCheck, Copy, ImageOff, Plus, Printer, QrCode, RefreshCw, Wrench,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import { EstadoPill } from '@/components/ui/estado-pill'
import { fmtFechaAR, fmtFechaHoraAR, diaClaveAR } from '@/lib/fechas-ar'
import type { EstadoVencimiento } from '@/types'
import type { ResumenVehiculo, Semaforo } from '@/modules/flota/resumen'
import {
  FOTOS_CHECKLIST, RESULTADO_LABEL, SECCIONES_CHECKLIST, TIPOS_MANTENIMIENTO, itemPorId, nombreMantenimiento,
  type EstadoMantenimiento, type Resultado,
} from '@/modules/flota/reglas'

interface Checklist {
  id: string; created_at: string; realizado_por_nombre: string; km: number | null; km_inconsistente: boolean
  resultado: string; respuestas: unknown; notas_items: unknown; fotos: unknown; observaciones: string | null; origen: string
}
interface Novedad {
  id: string; created_at: string; origen: string; item: string | null; titulo: string; descripcion: string | null
  gravedad: string; fotos: unknown; reportado_por_nombre: string | null; km: number | null; estado: string
  resolucion: string | null; costo: number | null; resuelta_at: string | null; checklist_id: string | null
}
interface Plan { id: string; tipo: string; cada_km: number | null; cada_meses: number | null }
interface Service { id: string; tipo: string; fecha: string; km: number | null; taller: string | null; costo: number | null; notas: string | null }

interface Props {
  vehiculo: {
    id: string; patente: string; descripcion: string | null; marca: string | null; modelo: string | null; anio: number | null
    empresaId: string; empresa: { nombre: string; slug: string }; kmActual: number | null; kmActualizadoAt: string | null
    conductorId: string | null; checklistActivo: boolean; checklistCadaDias: number
  }
  resumen: ResumenVehiculo
  checklists: Checklist[]
  novedades: Novedad[]
  plan: Plan[]
  services: Service[]
  empleados: { id: string; nombre: string }[]
  qr: { url: string; svg: string }
  canEdit: boolean
}

const SEMAFORO: Record<Semaforo, { estado: EstadoVencimiento; label: string }> = {
  rojo: { estado: 'vencido', label: 'Requiere atención' },
  amarillo: { estado: 'proximo', label: 'A revisar' },
  verde: { estado: 'vigente', label: 'En orden' },
}
const RESULTADO_PILL: Record<Resultado, EstadoVencimiento> = { ok: 'vigente', observaciones: 'proximo', no_apto: 'vencido' }
const MANT_PILL: Record<EstadoMantenimiento, EstadoVencimiento> = { ok: 'vigente', proximo: 'proximo', vencido: 'vencido', sin_dato: 'sin_fecha' }
const MANT_LABEL: Record<EstadoMantenimiento, string> = { ok: 'Al día', proximo: 'Próximo', vencido: 'Vencido', sin_dato: 'Sin datos' }
const GRAVEDAD: Record<string, { label: string; cls: string }> = {
  alta: { label: 'Grave', cls: 'bg-danger-subtle text-danger' },
  media: { label: 'Media', cls: 'bg-warning-subtle text-warning' },
  baja: { label: 'Leve', cls: 'bg-muted text-muted-foreground' },
}
const SLOT_LABEL = new Map(FOTOS_CHECKLIST.map((f) => [f.slot, f.label]))

const card = 'rounded-2xl border border-border bg-card'
const input = 'w-full rounded-lg border border-input bg-card px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring'
const btnPrimario = 'inline-flex items-center justify-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50'
const btnSecundario = 'inline-flex items-center justify-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50'

const pesos = (n: number) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n)
const num = (v: string) => (v.trim() === '' ? null : Number(v.replace(/\./g, '').replace(',', '.')))
const comoMapa = (v: unknown) => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, string>) : {})
const comoLista = (v: unknown) => (Array.isArray(v) ? (v as string[]) : [])

/** Foto guardada en R2: pide una URL firmada (la valida /api/archivo contra la RLS). */
function FotoR2({ path, label }: { path: string; label?: string }) {
  const [url, setUrl] = useState<string | null>(null)
  const [error, setError] = useState(false)
  useEffect(() => {
    let vivo = true
    fetch(`/api/archivo?path=${encodeURIComponent(path)}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((j) => vivo && setUrl(j.url))
      .catch(() => vivo && setError(true))
    return () => { vivo = false }
  }, [path])
  return (
    <figure className="space-y-1">
      <a href={url ?? undefined} target="_blank" rel="noopener noreferrer"
        className="flex aspect-[4/3] items-center justify-center overflow-hidden rounded-lg border border-border bg-muted">
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt={label ?? ''} className="h-full w-full object-cover" />
        ) : error ? (
          <ImageOff className="size-5 text-muted-foreground" />
        ) : (
          <span className="size-5 animate-pulse rounded-full bg-muted-foreground/20" />
        )}
      </a>
      {label && <figcaption className="text-[11px] text-muted-foreground">{label}</figcaption>}
    </figure>
  )
}

export default function VehiculoClient({ vehiculo, resumen, checklists, novedades, plan, services, empleados, qr, canEdit }: Props) {
  const supabase = createClient()
  const router = useRouter()
  const [saving, setSaving] = useState(false)

  const abiertas = novedades.filter((n) => n.estado === 'abierta')
  const cerradas = novedades.filter((n) => n.estado !== 'abierta')

  async function usuarioId() {
    const { data } = await supabase.auth.getUser()
    return data.user?.id ?? null
  }

  // ── Novedades ─────────────────────────────────────────────────────────────
  const [resolviendo, setResolviendo] = useState<string | null>(null)
  const [resForm, setResForm] = useState({ resolucion: '', costo: '' })
  const [verCerradas, setVerCerradas] = useState(false)
  const [nuevaNov, setNuevaNov] = useState<null | { titulo: string; gravedad: string; descripcion: string }>(null)

  async function cerrarNovedad(n: Novedad, estado: 'resuelta' | 'descartada') {
    const resolucion = resForm.resolucion.trim()
    if (estado === 'resuelta' && !resolucion) return toast.error('Contá qué se hizo para resolverla.')
    const costo = num(resForm.costo)
    if (costo != null && (!Number.isFinite(costo) || costo < 0)) return toast.error('El costo tiene que ser un número.')
    setSaving(true)
    const { error } = await supabase.from('vehiculo_novedades').update({
      estado,
      resolucion: resolucion || (estado === 'descartada' ? 'Descartada' : null),
      costo,
      resuelta_at: new Date().toISOString(),
      resuelta_por: await usuarioId(),
    }).eq('id', n.id)
    setSaving(false)
    if (error) return toast.error(`No se pudo guardar. ${error.message}`)
    toast.success(estado === 'resuelta' ? 'Novedad resuelta.' : 'Novedad descartada.')
    setResolviendo(null)
    setResForm({ resolucion: '', costo: '' })
    router.refresh()
  }

  async function crearNovedad() {
    if (!nuevaNov || nuevaNov.titulo.trim().length < 3) return toast.error('Escribí qué hay que resolver.')
    setSaving(true)
    const { error } = await supabase.from('vehiculo_novedades').insert({
      vehiculo_id: vehiculo.id, empresa_id: vehiculo.empresaId, origen: 'gestion', item: 'gestion',
      titulo: nuevaNov.titulo.trim(), gravedad: nuevaNov.gravedad, descripcion: nuevaNov.descripcion.trim() || null,
      km: vehiculo.kmActual,
    })
    setSaving(false)
    if (error) return toast.error(`No se pudo crear. ${error.message}`)
    setNuevaNov(null)
    toast.success('Novedad cargada.')
    router.refresh()
  }

  // ── Mantenimiento ─────────────────────────────────────────────────────────
  const hoy = diaClaveAR(new Date())
  const SERVICE_VACIO = { tipo: plan[0]?.tipo ?? 'service', fecha: hoy, km: vehiculo.kmActual?.toString() ?? '', taller: '', costo: '', notas: '' }
  const [servForm, setServForm] = useState<typeof SERVICE_VACIO | null>(null)
  const [editPlan, setEditPlan] = useState<Record<string, { cada_km: string; cada_meses: string }>>({})
  const [nuevoTipo, setNuevoTipo] = useState('')

  async function registrarService() {
    if (!servForm) return
    const km = num(servForm.km)
    const costo = num(servForm.costo)
    if (!servForm.fecha) return toast.error('La fecha es obligatoria.')
    if (km != null && (!Number.isInteger(km) || km < 0)) return toast.error('Los km tienen que ser un número entero.')
    if (costo != null && (!Number.isFinite(costo) || costo < 0)) return toast.error('El costo tiene que ser un número.')
    setSaving(true)
    const { error } = await supabase.from('vehiculo_services').insert({
      vehiculo_id: vehiculo.id, empresa_id: vehiculo.empresaId, tipo: servForm.tipo, fecha: servForm.fecha,
      km, taller: servForm.taller.trim() || null, costo, notas: servForm.notas.trim() || null,
    })
    if (!error && km != null && (vehiculo.kmActual == null || km > vehiculo.kmActual)) {
      // El km del taller también es una lectura del odómetro.
      await supabase.from('vehiculos').update({ km_actual: km, km_actualizado_at: new Date().toISOString() }).eq('id', vehiculo.id)
    }
    setSaving(false)
    if (error) return toast.error(`No se pudo registrar. ${error.message}`)
    setServForm(null)
    toast.success(`${nombreMantenimiento(servForm.tipo)} registrado.`)
    router.refresh()
  }

  async function guardarPlan(p: Plan) {
    const e = editPlan[p.id]
    if (!e) return
    const cada_km = num(e.cada_km)
    const cada_meses = num(e.cada_meses)
    if (cada_km == null && cada_meses == null) return toast.error('Poné un intervalo en km, en meses o en los dos.')
    if ((cada_km != null && (!Number.isInteger(cada_km) || cada_km <= 0)) || (cada_meses != null && (!Number.isInteger(cada_meses) || cada_meses <= 0))) {
      return toast.error('Los intervalos tienen que ser números enteros mayores a cero.')
    }
    const { error } = await supabase.from('vehiculo_mantenimiento_plan').update({ cada_km, cada_meses }).eq('id', p.id)
    if (error) return toast.error(`No se pudo guardar. ${error.message}`)
    setEditPlan((prev) => { const c = { ...prev }; delete c[p.id]; return c })
    router.refresh()
  }

  async function agregarTipo() {
    if (!nuevoTipo) return
    const { error } = await supabase.from('vehiculo_mantenimiento_plan').insert({
      vehiculo_id: vehiculo.id, empresa_id: vehiculo.empresaId, tipo: nuevoTipo, cada_km: nuevoTipo === 'distribucion' ? 60000 : 20000, cada_meses: null,
    })
    if (error) return toast.error(error.code === '23505' ? 'Ese mantenimiento ya está en el plan.' : `No se pudo agregar. ${error.message}`)
    setNuevoTipo('')
    router.refresh()
  }

  async function quitarTipo(p: Plan) {
    if (!confirm(`¿Sacar "${nombreMantenimiento(p.tipo)}" del plan? El historial de services se conserva.`)) return
    const { error } = await supabase.from('vehiculo_mantenimiento_plan').delete().eq('id', p.id)
    if (error) return toast.error(`No se pudo quitar. ${error.message}`)
    router.refresh()
  }

  // ── Datos ─────────────────────────────────────────────────────────────────
  const DATOS = {
    marca: vehiculo.marca ?? '', modelo: vehiculo.modelo ?? '', anio: vehiculo.anio?.toString() ?? '',
    conductor: vehiculo.conductorId ?? '', km: vehiculo.kmActual?.toString() ?? '',
    cada: vehiculo.checklistCadaDias.toString(), activo: vehiculo.checklistActivo,
  }
  const [datos, setDatos] = useState(DATOS)
  const datosCambiaron = JSON.stringify(datos) !== JSON.stringify(DATOS)

  async function guardarDatos(e: React.FormEvent) {
    e.preventDefault()
    const anio = num(datos.anio)
    const km = num(datos.km)
    const cada = num(datos.cada)
    if (anio != null && (!Number.isInteger(anio) || anio < 1980 || anio > 2100)) return toast.error('El año no es válido.')
    if (km != null && (!Number.isInteger(km) || km < 0)) return toast.error('Los km tienen que ser un número entero.')
    if (cada == null || !Number.isInteger(cada) || cada < 1 || cada > 90) return toast.error('El checklist tiene que ser cada 1 a 90 días.')
    setSaving(true)
    const kmCambio = km !== vehiculo.kmActual
    const { error } = await supabase.from('vehiculos').update({
      marca: datos.marca.trim() || null, modelo: datos.modelo.trim() || null, anio,
      conductor_id: datos.conductor || null, checklist_cada_dias: cada, checklist_activo: datos.activo,
      ...(kmCambio ? { km_actual: km, km_actualizado_at: new Date().toISOString() } : {}),
    }).eq('id', vehiculo.id)
    setSaving(false)
    if (error) return toast.error(`No se pudo guardar. ${error.message}`)
    toast.success('Datos guardados.')
    router.refresh()
  }

  // ── QR ────────────────────────────────────────────────────────────────────
  async function rotarQR() {
    if (!confirm('Se genera un QR nuevo y el que está pegado en la camioneta deja de funcionar. Hay que imprimir y pegar el nuevo. ¿Seguir?')) return
    const bytes = new Uint8Array(12)
    crypto.getRandomValues(bytes)
    const token = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
    const { error } = await supabase.from('vehiculos').update({ checklist_token: token }).eq('id', vehiculo.id)
    if (error) return toast.error(`No se pudo generar. ${error.message}`)
    toast.success('QR nuevo generado. Imprimilo y reemplazá el de la camioneta.')
    router.refresh()
  }

  // ── Checklists ────────────────────────────────────────────────────────────
  const [abierto, setAbierto] = useState<string | null>(checklists[0]?.id ?? null)
  const [comparar, setComparar] = useState(false)

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6 lg:p-8">
      <div>
        <Link href={`/flota?empresa=${vehiculo.empresa.slug}`} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" /> Flota de {vehiculo.empresa.nombre}
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="font-mono text-2xl font-semibold tracking-wide">{vehiculo.patente}</h1>
          <EstadoPill estado={SEMAFORO[resumen.semaforo].estado} label={SEMAFORO[resumen.semaforo].label} />
        </div>
        <p className="mt-0.5 text-sm text-muted-foreground">
          {[[vehiculo.marca, vehiculo.modelo, vehiculo.anio].filter(Boolean).join(' ') || vehiculo.descripcion,
            vehiculo.kmActual != null ? `${vehiculo.kmActual.toLocaleString('es-AR')} km` : null,
            resumen.kmDia != null ? `${Math.round(resumen.kmDia)} km por día` : null,
          ].filter(Boolean).join(' · ')}
        </p>
      </div>

      {resumen.motivos.length > 0 && (
        <div className={cn('rounded-2xl border px-5 py-4', resumen.semaforo === 'rojo' ? 'border-danger/30 bg-danger-subtle' : 'border-warning/30 bg-warning-subtle')}>
          <ul className={cn('space-y-1 text-sm', resumen.semaforo === 'rojo' ? 'text-danger' : 'text-warning')}>
            {resumen.motivos.map((m) => <li key={m}>· {m}</li>)}
          </ul>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-6">
          {/* ── Novedades ── */}
          <section className={card}>
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4">
              <div>
                <h2 className="text-lg font-semibold tracking-tight">Para resolver</h2>
                <p className="text-sm text-muted-foreground">
                  {abiertas.length === 0 ? 'Nada pendiente' : `${abiertas.length} ${abiertas.length === 1 ? 'novedad abierta' : 'novedades abiertas'}`}
                </p>
              </div>
              {canEdit && !nuevaNov && (
                <button type="button" onClick={() => setNuevaNov({ titulo: '', gravedad: 'media', descripcion: '' })} className={btnSecundario}>
                  <Plus className="size-4" /> Cargar novedad
                </button>
              )}
            </div>

            {nuevaNov && (
              <div className="space-y-3 border-b border-border bg-muted/40 px-5 py-4">
                <input id="nn-titulo" value={nuevaNov.titulo} onChange={(e) => setNuevaNov({ ...nuevaNov, titulo: e.target.value })} placeholder="Qué hay que resolver" className={input} />
                <div className="flex flex-wrap gap-2">
                  {(['baja', 'media', 'alta'] as const).map((g) => (
                    <button key={g} type="button" onClick={() => setNuevaNov({ ...nuevaNov, gravedad: g })}
                      className={cn('rounded-lg border px-3 py-1.5 text-sm', nuevaNov.gravedad === g ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-card')}>
                      {GRAVEDAD[g].label}
                    </button>
                  ))}
                </div>
                <textarea id="nn-desc" value={nuevaNov.descripcion} onChange={(e) => setNuevaNov({ ...nuevaNov, descripcion: e.target.value })} rows={2} placeholder="Detalle (opcional)" className={input} />
                <div className="flex gap-2">
                  <button type="button" onClick={crearNovedad} disabled={saving} className={btnPrimario}>Guardar</button>
                  <button type="button" onClick={() => setNuevaNov(null)} className={btnSecundario}>Cancelar</button>
                </div>
              </div>
            )}

            <ul className="divide-y divide-border">
              {abiertas.map((n) => {
                const fotos = comoLista(n.fotos)
                return (
                  <li key={n.id} className="px-5 py-4">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-medium">{n.titulo}</p>
                        <p className="text-xs text-muted-foreground">
                          {fmtFechaAR(n.created_at)} · {n.origen === 'checklist' ? 'del checklist' : n.origen === 'reporte' ? 'reportada por QR' : 'cargada en Gestión'}
                          {n.reportado_por_nombre && ` · ${n.reportado_por_nombre}`}
                          {n.km != null && ` · ${n.km.toLocaleString('es-AR')} km`}
                        </p>
                      </div>
                      <span className={cn('rounded-md px-2 py-0.5 text-xs font-medium', GRAVEDAD[n.gravedad]?.cls)}>{GRAVEDAD[n.gravedad]?.label}</span>
                    </div>
                    {n.descripcion && <p className="mt-2 text-sm text-muted-foreground">{n.descripcion}</p>}
                    {fotos.length > 0 && (
                      <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
                        {fotos.map((p) => <FotoR2 key={p} path={p} />)}
                      </div>
                    )}
                    {canEdit && (resolviendo === n.id ? (
                      <div className="mt-3 space-y-2 rounded-xl border border-border bg-muted/40 p-3">
                        <textarea id={`res-${n.id}`} value={resForm.resolucion} onChange={(e) => setResForm({ ...resForm, resolucion: e.target.value })}
                          rows={2} placeholder="Qué se hizo (taller, repuesto, quién lo resolvió)" className={input} />
                        <input id={`costo-${n.id}`} value={resForm.costo} onChange={(e) => setResForm({ ...resForm, costo: e.target.value })}
                          inputMode="decimal" placeholder="Costo en pesos (opcional)" className={input} />
                        <div className="flex flex-wrap gap-2">
                          <button type="button" onClick={() => cerrarNovedad(n, 'resuelta')} disabled={saving} className={btnPrimario}>
                            <Check className="size-4" /> Marcar resuelta
                          </button>
                          <button type="button" onClick={() => cerrarNovedad(n, 'descartada')} disabled={saving} className={btnSecundario}>Descartar</button>
                          <button type="button" onClick={() => setResolviendo(null)} className="px-2 text-sm text-muted-foreground">Cancelar</button>
                        </div>
                      </div>
                    ) : (
                      <button type="button" onClick={() => { setResolviendo(n.id); setResForm({ resolucion: '', costo: '' }) }} className={cn(btnSecundario, 'mt-3')}>
                        <Wrench className="size-4" strokeWidth={1.75} /> Resolver
                      </button>
                    ))}
                  </li>
                )
              })}
            </ul>

            {cerradas.length > 0 && (
              <div className="border-t border-border">
                <button type="button" onClick={() => setVerCerradas((v) => !v)} className="flex w-full items-center justify-between px-5 py-3 text-sm text-muted-foreground hover:text-foreground">
                  Historial · {cerradas.length} resueltas o descartadas
                  <ChevronDown className={cn('size-4 transition-transform', verCerradas && 'rotate-180')} />
                </button>
                {verCerradas && (
                  <ul className="divide-y divide-border border-t border-border">
                    {cerradas.map((n) => (
                      <li key={n.id} className="px-5 py-3 text-sm">
                        <div className="flex flex-wrap justify-between gap-2">
                          <span className={n.estado === 'descartada' ? 'text-muted-foreground line-through' : ''}>{n.titulo}</span>
                          <span className="text-xs text-muted-foreground">
                            {n.resuelta_at && fmtFechaAR(n.resuelta_at)}{n.costo != null && ` · ${pesos(n.costo)}`}
                          </span>
                        </div>
                        {n.resolucion && <p className="text-xs text-muted-foreground">{n.resolucion}</p>}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </section>

          {/* ── Checklists ── */}
          <section className={card}>
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4">
              <div>
                <h2 className="text-lg font-semibold tracking-tight">Checklists</h2>
                <p className="text-sm text-muted-foreground">
                  {checklists.length === 0 ? 'Todavía no se hizo ninguno' : `Cada ${vehiculo.checklistCadaDias} días · ${checklists.length} registrados`}
                </p>
              </div>
              {checklists.length > 1 && (
                <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-muted-foreground">
                  <input type="checkbox" checked={comparar} onChange={(e) => setComparar(e.target.checked)} className="size-4 accent-[var(--primary)]" />
                  Comparar fotos con el anterior
                </label>
              )}
            </div>
            {checklists.length === 0 ? (
              <p className="px-5 py-8 text-center text-sm text-muted-foreground">
                Imprimí el QR, pegalo en la camioneta y el primer checklist aparece acá.
              </p>
            ) : (
              <ul className="divide-y divide-border">
                {checklists.map((c, idx) => {
                  const isOpen = abierto === c.id
                  const resultado = c.resultado as Resultado
                  const respuestas = comoMapa(c.respuestas)
                  const notas = comoMapa(c.notas_items)
                  const fotos = comoMapa(c.fotos)
                  const anterior = checklists[idx + 1]
                  const fotosAnt = anterior ? comoMapa(anterior.fotos) : {}
                  const excepciones = SECCIONES_CHECKLIST.flatMap((s) => s.items.filter((i) => respuestas[i.id] && respuestas[i.id] !== 'ok'))
                  return (
                    <li key={c.id}>
                      <button type="button" onClick={() => setAbierto(isOpen ? null : c.id)} className="flex w-full items-center gap-3 px-5 py-3 text-left hover:bg-muted/40">
                        <ClipboardCheck className="size-4 shrink-0 text-muted-foreground" strokeWidth={1.75} />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium">{fmtFechaHoraAR(c.created_at)}</p>
                          <p className="truncate text-xs text-muted-foreground">
                            {c.realizado_por_nombre}
                            {c.km != null && ` · ${c.km.toLocaleString('es-AR')} km`}
                            {c.km_inconsistente && ' (revisar)'}
                          </p>
                        </div>
                        <EstadoPill estado={RESULTADO_PILL[resultado] ?? 'sin_fecha'} label={RESULTADO_LABEL[resultado] ?? resultado} />
                        <ChevronDown className={cn('size-4 shrink-0 text-muted-foreground transition-transform', isOpen && 'rotate-180')} />
                      </button>
                      {isOpen && (
                        <div className="space-y-4 border-t border-border bg-muted/30 px-5 py-4">
                          {excepciones.length === 0 ? (
                            <p className="text-sm text-success">Todos los ítems bien.</p>
                          ) : (
                            <ul className="space-y-1.5">
                              {excepciones.map((i) => (
                                <li key={i.id} className="flex items-start gap-2 text-sm">
                                  <span className={cn('mt-0.5 shrink-0 rounded px-1.5 text-[11px] font-medium', respuestas[i.id] === 'no_ok' ? 'bg-danger-subtle text-danger' : 'bg-warning-subtle text-warning')}>
                                    {respuestas[i.id] === 'no_ok' ? 'Mal' : 'Obs.'}
                                  </span>
                                  <span>{itemPorId(i.id)?.label ?? i.id}{notas[i.id] && <span className="text-muted-foreground"> — {notas[i.id]}</span>}</span>
                                </li>
                              ))}
                            </ul>
                          )}
                          {c.observaciones && <p className="text-sm text-muted-foreground">“{c.observaciones}”</p>}
                          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                            {FOTOS_CHECKLIST.filter((f) => fotos[f.slot]).map((f) => (
                              <Fragment key={f.slot}>
                                {comparar && anterior ? (
                                  <div className="col-span-2 grid grid-cols-2 gap-2 sm:col-span-3">
                                    <FotoR2 path={fotos[f.slot]} label={`${SLOT_LABEL.get(f.slot)} · este`} />
                                    {fotosAnt[f.slot]
                                      ? <FotoR2 path={fotosAnt[f.slot]} label={`anterior (${fmtFechaAR(anterior.created_at)})`} />
                                      : <div className="flex aspect-[4/3] items-center justify-center rounded-lg border border-dashed border-border text-xs text-muted-foreground">Sin foto anterior</div>}
                                  </div>
                                ) : (
                                  <FotoR2 path={fotos[f.slot]} label={SLOT_LABEL.get(f.slot)} />
                                )}
                              </Fragment>
                            ))}
                          </div>
                        </div>
                      )}
                    </li>
                  )
                })}
              </ul>
            )}
          </section>
        </div>

        <div className="space-y-6">
          {/* ── Mantenimiento ── */}
          <section className={card}>
            <div className="border-b border-border px-5 py-4">
              <h2 className="text-lg font-semibold tracking-tight">Mantenimiento</h2>
              <p className="text-sm text-muted-foreground">Se proyecta con los km de los checklists</p>
            </div>
            <ul className="divide-y divide-border">
              {resumen.mantenimientos.map((m) => {
                const p = plan.find((x) => x.tipo === m.tipo)!
                const ultimo = services.find((s) => s.tipo === m.tipo)
                const ed = editPlan[p.id]
                return (
                  <li key={m.tipo} className="space-y-1.5 px-5 py-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium">{m.nombre}</p>
                      <EstadoPill estado={MANT_PILL[m.estado]} label={MANT_LABEL[m.estado]} />
                    </div>
                    <p className={cn('text-xs', m.estado === 'vencido' ? 'text-danger' : m.estado === 'proximo' ? 'text-warning' : 'text-muted-foreground')}>{m.motivo}</p>
                    <p className="text-xs text-muted-foreground">
                      Último: {ultimo ? `${fmtFechaAR(ultimo.fecha)}${ultimo.km != null ? ` · ${ultimo.km.toLocaleString('es-AR')} km` : ''}` : 'sin registrar'}
                    </p>
                    {ed ? (
                      <div className="flex flex-wrap items-center gap-2 pt-1">
                        <input value={ed.cada_km} onChange={(e) => setEditPlan({ ...editPlan, [p.id]: { ...ed, cada_km: e.target.value } })} placeholder="km" inputMode="numeric" className={cn(input, 'w-24')} />
                        <input value={ed.cada_meses} onChange={(e) => setEditPlan({ ...editPlan, [p.id]: { ...ed, cada_meses: e.target.value } })} placeholder="meses" inputMode="numeric" className={cn(input, 'w-20')} />
                        <button type="button" onClick={() => guardarPlan(p)} className={btnPrimario}>Guardar</button>
                        <button type="button" onClick={() => quitarTipo(p)} className="text-xs text-danger/80 hover:text-danger">Quitar</button>
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        Cada {[p.cada_km ? `${p.cada_km.toLocaleString('es-AR')} km` : null, p.cada_meses ? `${p.cada_meses} meses` : null].filter(Boolean).join(' o ')}
                        {canEdit && (
                          <button type="button" onClick={() => setEditPlan({ ...editPlan, [p.id]: { cada_km: p.cada_km?.toString() ?? '', cada_meses: p.cada_meses?.toString() ?? '' } })}
                            className="ml-2 text-primary hover:underline">cambiar</button>
                        )}
                      </p>
                    )}
                  </li>
                )
              })}
            </ul>
            {canEdit && (
              <div className="space-y-3 border-t border-border px-5 py-4">
                {servForm ? (
                  <div className="space-y-2">
                    <select value={servForm.tipo} onChange={(e) => setServForm({ ...servForm, tipo: e.target.value })} className={input}>
                      {plan.map((p) => <option key={p.tipo} value={p.tipo}>{nombreMantenimiento(p.tipo)}</option>)}
                    </select>
                    <div className="grid grid-cols-2 gap-2">
                      <input type="date" value={servForm.fecha} max={hoy} onChange={(e) => setServForm({ ...servForm, fecha: e.target.value })} className={input} />
                      <input value={servForm.km} onChange={(e) => setServForm({ ...servForm, km: e.target.value })} placeholder="km" inputMode="numeric" className={input} />
                    </div>
                    <input value={servForm.taller} onChange={(e) => setServForm({ ...servForm, taller: e.target.value })} placeholder="Taller (opcional)" className={input} />
                    <input value={servForm.costo} onChange={(e) => setServForm({ ...servForm, costo: e.target.value })} placeholder="Costo en pesos (opcional)" inputMode="decimal" className={input} />
                    <input value={servForm.notas} onChange={(e) => setServForm({ ...servForm, notas: e.target.value })} placeholder="Qué se hizo (opcional)" className={input} />
                    <div className="flex gap-2">
                      <button type="button" onClick={registrarService} disabled={saving} className={btnPrimario}>Registrar</button>
                      <button type="button" onClick={() => setServForm(null)} className={btnSecundario}>Cancelar</button>
                    </div>
                  </div>
                ) : (
                  <button type="button" onClick={() => setServForm(SERVICE_VACIO)} className={cn(btnPrimario, 'w-full')}>
                    <Wrench className="size-4" strokeWidth={1.75} /> Registrar un service
                  </button>
                )}
                <div className="flex gap-2">
                  <select value={nuevoTipo} onChange={(e) => setNuevoTipo(e.target.value)} className={input}>
                    <option value="">Sumar al plan…</option>
                    {Object.entries(TIPOS_MANTENIMIENTO).filter(([t]) => !plan.some((p) => p.tipo === t)).map(([t, n]) => <option key={t} value={t}>{n}</option>)}
                  </select>
                  <button type="button" onClick={agregarTipo} disabled={!nuevoTipo} className={btnSecundario}><Plus className="size-4" /></button>
                </div>
              </div>
            )}
            {services.length > 0 && (
              <details className="border-t border-border">
                <summary className="cursor-pointer px-5 py-3 text-sm text-muted-foreground hover:text-foreground">Historial · {services.length} services</summary>
                <ul className="divide-y divide-border border-t border-border">
                  {services.map((s) => (
                    <li key={s.id} className="px-5 py-2.5 text-xs">
                      <p className="font-medium">{nombreMantenimiento(s.tipo)} · {fmtFechaAR(s.fecha)}</p>
                      <p className="text-muted-foreground">
                        {[s.km != null ? `${s.km.toLocaleString('es-AR')} km` : null, s.taller, s.costo != null ? pesos(s.costo) : null, s.notas].filter(Boolean).join(' · ')}
                      </p>
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </section>

          {/* ── Datos ── */}
          <section className={card}>
            <div className="border-b border-border px-5 py-4">
              <h2 className="text-lg font-semibold tracking-tight">Datos</h2>
            </div>
            <form onSubmit={guardarDatos} className="space-y-3 px-5 py-4">
              <div className="grid grid-cols-2 gap-2">
                <input id="d-marca" value={datos.marca} onChange={(e) => setDatos({ ...datos, marca: e.target.value })} placeholder="Marca" disabled={!canEdit} className={input} />
                <input id="d-modelo" value={datos.modelo} onChange={(e) => setDatos({ ...datos, modelo: e.target.value })} placeholder="Modelo" disabled={!canEdit} className={input} />
                <input id="d-anio" value={datos.anio} onChange={(e) => setDatos({ ...datos, anio: e.target.value })} placeholder="Año" inputMode="numeric" disabled={!canEdit} className={input} />
                <input id="d-km" value={datos.km} onChange={(e) => setDatos({ ...datos, km: e.target.value })} placeholder="Km actual" inputMode="numeric" disabled={!canEdit} className={input} />
              </div>
              <div>
                <label htmlFor="d-conductor" className="mb-1 block text-xs text-muted-foreground">Conductor habitual</label>
                <select id="d-conductor" value={datos.conductor} onChange={(e) => setDatos({ ...datos, conductor: e.target.value })} disabled={!canEdit} className={input}>
                  <option value="">Sin asignar</option>
                  {empleados.map((e) => <option key={e.id} value={e.id}>{e.nombre}</option>)}
                </select>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <label className="inline-flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={datos.activo} onChange={(e) => setDatos({ ...datos, activo: e.target.checked })} disabled={!canEdit} className="size-4 accent-[var(--primary)]" />
                  Checklist cada
                </label>
                <input id="d-cada" value={datos.cada} onChange={(e) => setDatos({ ...datos, cada: e.target.value })} inputMode="numeric" disabled={!canEdit || !datos.activo} className={cn(input, 'w-16')} />
                <span className="text-sm text-muted-foreground">días</span>
              </div>
              {vehiculo.kmActualizadoAt && <p className="text-xs text-muted-foreground">Km actualizados el {fmtFechaAR(vehiculo.kmActualizadoAt)}</p>}
              {canEdit && (
                <button type="submit" disabled={!datosCambiaron || saving} className={btnPrimario}>Guardar datos</button>
              )}
            </form>
          </section>

          {/* ── QR ── */}
          <section className={card}>
            <div className="flex items-center justify-between gap-2 border-b border-border px-5 py-4">
              <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight">
                <QrCode className="size-5 text-muted-foreground" strokeWidth={1.75} /> QR de la camioneta
              </h2>
            </div>
            <div className="space-y-3 px-5 py-4">
              <div className="mx-auto w-44 rounded-xl border border-border bg-white p-2 [&_svg]:h-auto [&_svg]:w-full" dangerouslySetInnerHTML={{ __html: qr.svg }} />
              <div className="flex flex-wrap justify-center gap-2">
                <Link href={`/flota/qr?empresa=${vehiculo.empresa.slug}&vehiculo=${vehiculo.id}`} className={btnSecundario}>
                  <Printer className="size-4" strokeWidth={1.75} /> Imprimir
                </Link>
                <button type="button" onClick={() => navigator.clipboard.writeText(qr.url).then(() => toast.success('Link copiado.'))} className={btnSecundario}>
                  <Copy className="size-4" strokeWidth={1.75} /> Copiar link
                </button>
                {canEdit && (
                  <button type="button" onClick={rotarQR} className={btnSecundario}>
                    <RefreshCw className="size-4" strokeWidth={1.75} /> QR nuevo
                  </button>
                )}
              </div>
              <p className="text-center text-xs text-muted-foreground">
                Si el QR se pierde o se filtra, generá uno nuevo: el anterior deja de funcionar.
              </p>
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
