'use client'

import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { format } from 'date-fns'
import { toast } from 'sonner'
import { UserX } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { getEstadoVencimiento } from '@/types'
import type { Empleado, TipoCertificado, Empresa, Archivo, Recibo } from '@/types'
import RecibosSueldo from './RecibosSueldo'
import type { Tables } from '@/types/database'
import { Monograma } from '@/components/ui/monograma'
import { EstadoPill } from '@/components/ui/estado-pill'
import { mensajeError } from '@/lib/errores'
import { abrirArchivo, borrarArchivo, subirArchivosACertificado } from '@/lib/archivos-client'
import {
  ALERTA_DIAS_DEFECTO, ALERTA_DIAS_MAX, AVISO_SIN_VENCIMIENTO, alertaComoTexto, llevarALaVista, useEnfocarAlAbrir,
  validarAlertaDias,
} from '@/lib/formularios'
import clsx from 'clsx'

/** Certificado tal como lo devuelve la query del legajo (con relaciones). */
type CertConRelaciones = Tables<'certificados'> & {
  tipo: { nombre: string; orden: number | null } | null
  archivos: Archivo[]
}

interface Props {
  empleado: Empleado & { empresa: Empresa | null }
  certificados: CertConRelaciones[]
  tiposCertificado: TipoCertificado[]
  empresas: Empresa[]
  recibos: Recibo[]
  /** Puede ver los recibos de sueldo (perfiles.ve_recibos). */
  veRecibos: boolean
  isAdmin: boolean
  canEdit: boolean
  /** Certificado a abrir al entrar (?cert=<id>, desde el dashboard o vencimientos). */
  certInicial?: string | null
  /** Recién creado (?nuevo=1): el formulario de certificado arranca abierto. */
  abrirAlta?: boolean
}

const FORM_VACIO = {
  tipo_id: '',
  tipo_nombre_custom: '',
  fecha_vencimiento: '',
  fecha_emision: '',
  numero_documento: '',
  notas: '',
  /** Texto crudo: se valida al guardar (ver validarAlertaDias). */
  alerta_dias: String(ALERTA_DIAS_DEFECTO),
}

const inputCls =
  'w-full px-3.5 py-2.5 rounded-lg border border-input bg-card text-sm focus:outline-none focus:ring-2 focus:ring-ring'

export default function LegajoClient({
  empleado,
  certificados: initCerts,
  tiposCertificado,
  empresas,
  recibos,
  veRecibos,
  canEdit,
  certInicial = null,
  abrirAlta = false,
}: Props) {
  const supabase = createClient()
  const router = useRouter()
  const [certs, setCerts] = useState(initCerts)
  const [showForm, setShowForm] = useState(abrirAlta && canEdit)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState<string | null>(null)
  const [activeCertId, setActiveCertId] = useState<string | null>(certInicial)
  // Certificado a llevar a la vista: el del link profundo al entrar, o el recién creado.
  const [certALaVista, setCertALaVista] = useState<string | null>(certInicial)
  const [editingEmpleado, setEditingEmpleado] = useState(false)
  const [savingEmpleado, setSavingEmpleado] = useState(false)
  const [activo, setActivo] = useState(empleado.activo !== false)
  const [cambiandoAlta, setCambiandoAlta] = useState(false)
  const [empleadoData, setEmpleadoData] = useState({
    nombre: empleado.nombre ?? '',
    apellido: empleado.apellido ?? '',
    empresa_id: empleado.empresa_id ?? '',
    sector: empleado.sector ?? '',
  })
  const [form, setForm] = useState(FORM_VACIO)
  // Cada apertura del formulario lo trae a la vista con el foco en el primer campo
  // (vive debajo de la lista: antes "Agregar certificado" lo abría fuera de pantalla).
  const [aperturas, setAperturas] = useState(abrirAlta && canEdit ? 1 : 0)
  const formRef = useEnfocarAlAbrir<HTMLFormElement>(aperturas, 'center')
  const avisoNuevo = useRef(false)

  const nombreCompleto = useMemo(() => {
    return [empleadoData.nombre, empleadoData.apellido].filter(Boolean).join(' ')
  }, [empleadoData])

  useEffect(() => {
    if (!certALaVista) return
    const el = document.getElementById(`cert-${certALaVista}`)
    if (el) llevarALaVista(el, 'center')
  }, [certALaVista])

  // ?nuevo=1 viene del alta de empleado: se avisa una vez y se saca de la URL
  // para que recargar no vuelva a abrir el formulario.
  useEffect(() => {
    if (!abrirAlta || avisoNuevo.current) return
    avisoNuevo.current = true
    toast.success('Empleado creado', { description: 'Cargá su primer certificado.' })
    try {
      const url = new URL(window.location.href)
      url.searchParams.delete('nuevo')
      window.history.replaceState(null, '', url)
    } catch { /* la URL es cosmética */ }
  }, [abrirAlta])

  function resetForm() {
    setForm(FORM_VACIO)
    setShowForm(false)
    setEditingId(null)
  }

  function abrirNuevo() {
    setForm(FORM_VACIO)
    setEditingId(null)
    setShowForm(true)
    setAperturas((n) => n + 1)
  }

  function openEdit(cert: CertConRelaciones) {
    setForm({
      // Un certificado "Otro" tiene tipo_id null y el nombre en tipo_nombre_custom:
      // sin esto el select quedaba en "Seleccionar..." y no se podía guardar.
      tipo_id: cert.tipo_id ?? (cert.tipo_nombre_custom ? 'otro' : ''),
      tipo_nombre_custom: cert.tipo_nombre_custom ?? '',
      fecha_vencimiento: cert.fecha_vencimiento?.slice(0, 10) ?? '',
      fecha_emision: cert.fecha_emision?.slice(0, 10) ?? '',
      numero_documento: cert.numero_documento ?? '',
      notas: cert.notas ?? '',
      alerta_dias: alertaComoTexto(cert.alerta_dias),
    })
    setEditingId(cert.id)
    setShowForm(true)
    setAperturas((n) => n + 1)
  }

  function escCancela(cancelar: () => void) {
    return (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        cancelar()
      }
    }
  }

  async function handleSave() {
    if (!form.tipo_id) {
      toast.error('Elegí el tipo de certificado.')
      return
    }
    if (form.tipo_id === 'otro' && !form.tipo_nombre_custom.trim()) {
      toast.error('Especificá el nombre del certificado.')
      return
    }
    const alerta = validarAlertaDias(form.alerta_dias)
    if (!alerta.ok) {
      toast.error(alerta.error)
      return
    }
    setSaving(true)

    const payload = {
      empleado_id: empleado.id,
      // "otro" no es un UUID: el tipo custom va en tipo_nombre_custom
      tipo_id: form.tipo_id === 'otro' ? null : form.tipo_id || null,
      tipo_nombre_custom: form.tipo_id === 'otro' ? form.tipo_nombre_custom.trim() : null,
      fecha_vencimiento: form.fecha_vencimiento || null,
      fecha_emision: form.fecha_emision || null,
      numero_documento: form.numero_documento || null,
      notas: form.notas || null,
      alerta_dias: alerta.valor,
    }
    const sinVencimiento = form.fecha_vencimiento ? undefined : { description: AVISO_SIN_VENCIMIENTO }

    if (editingId) {
      const certId = editingId
      const { data, error } = await supabase
        .from('certificados')
        .update({ ...payload, updated_at: new Date().toISOString() })
        .eq('id', certId)
        .select('*, tipo:tipos_certificado(nombre, orden)')
        .single()

      setSaving(false)
      if (error || !data) {
        toast.error(mensajeError(error, 'guardar el certificado'))
        return // el form queda abierto, no se pierde lo tipeado
      }
      setCerts((prev) =>
        prev.map((c) => (c.id === certId ? { ...data, archivos: c.archivos } : c))
      )
      toast.success('Certificado actualizado', sinVencimiento)
      setActiveCertId(certId)
      setCertALaVista(certId)
    } else {
      const { data, error } = await supabase
        .from('certificados')
        .insert(payload)
        .select('*, tipo:tipos_certificado(nombre, orden)')
        .single()

      setSaving(false)
      if (error || !data) {
        toast.error(mensajeError(error, 'agregar el certificado'))
        return
      }
      setCerts((prev) => [...prev, { ...data, archivos: [] }])
      toast.success('Certificado agregado', sinVencimiento ?? { description: 'Ya podés adjuntarle el archivo.' })
      // Se abre la tarjeta nueva: lo siguiente casi siempre es subir el escaneo.
      setActiveCertId(data.id)
      setCertALaVista(data.id)
    }
    resetForm()
    router.refresh()
  }

  async function handleDelete(cert: CertConRelaciones) {
    const n = cert.archivos?.length ?? 0
    const adjuntos = n > 0 ? ` y ${n === 1 ? 'su archivo adjunto' : `sus ${n} archivos adjuntos`}` : ''
    if (!confirm(`¿Eliminar el certificado "${cert.tipo?.nombre ?? cert.tipo_nombre_custom ?? 'Sin tipo'}"${adjuntos}? No se puede deshacer.`)) return
    // .select() devuelve lo borrado: si la RLS no dejó borrar nada no hay error, pero tampoco filas.
    const { data, error } = await supabase.from('certificados').delete().eq('id', cert.id).select('id')
    if (error || !data?.length) {
      toast.error(error ? mensajeError(error, 'eliminar el certificado') : 'No se pudo eliminar: el certificado ya no existe o no tenés permiso.')
      return
    }
    setCerts((prev) => prev.filter((c) => c.id !== cert.id))
    if (editingId === cert.id) resetForm()
    toast.success('Certificado eliminado')
    router.refresh()
  }

  async function handleSaveEmpleado() {
    if (!empleadoData.nombre.trim() || !empleadoData.empresa_id) {
      toast.error('Completá al menos nombre y empresa.')
      return
    }

    setSavingEmpleado(true)

    const { error } = await supabase
      .from('empleados')
      .update({
        nombre: empleadoData.nombre.trim(),
        apellido: empleadoData.apellido.trim() || null,
        empresa_id: empleadoData.empresa_id,
        sector: empleadoData.sector.trim() || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', empleado.id)

    setSavingEmpleado(false)

    if (error) {
      toast.error(mensajeError(error, 'guardar los datos del empleado'))
      return
    }

    toast.success('Datos del empleado guardados')
    setEditingEmpleado(false)
    router.refresh()
  }

  /** "Eliminar" nunca borró: desactiva el legajo (borrado lógico, reversible). */
  async function handleDarDeBaja() {
    const ok = confirm(
      `¿Dar de baja a ${nombreCompleto}?\n\n` +
        'Deja de aparecer en Empleados, Vencimientos y el Dashboard. ' +
        'Sus certificados, archivos y comprobantes se conservan, y lo podés reactivar ' +
        'desde Empleados → Dados de baja.'
    )
    if (!ok) return
    setCambiandoAlta(true)
    const { data, error } = await supabase
      .from('empleados')
      .update({ activo: false, updated_at: new Date().toISOString() })
      .eq('id', empleado.id)
      .select('id')
    setCambiandoAlta(false)

    if (error || !data?.length) {
      toast.error(error ? mensajeError(error, 'dar de baja al empleado') : 'No se pudo dar de baja: no tenés permiso sobre este legajo.')
      return
    }

    toast.success(`${nombreCompleto} quedó dado de baja`)
    router.push('/empleados')
    router.refresh()
  }

  async function handleReactivar() {
    setCambiandoAlta(true)
    const { data, error } = await supabase
      .from('empleados')
      .update({ activo: true, updated_at: new Date().toISOString() })
      .eq('id', empleado.id)
      .select('id')
    setCambiandoAlta(false)
    if (error || !data?.length) {
      toast.error(error ? mensajeError(error, 'reactivar al empleado') : 'No se pudo reactivar: no tenés permiso sobre este legajo.')
      return
    }
    setActivo(true)
    toast.success(`${nombreCompleto} está activo de nuevo`)
    router.refresh()
  }

  async function handleFileUpload(certId: string, files: File[]) {
    setUploading(certId)
    const ok = await subirArchivosACertificado(
      files,
      certId,
      { empleadoId: empleado.id, empresaSlug: empleado.empresa?.slug ?? '' },
      (archivo) =>
        setCerts((prev) =>
          prev.map((c) => (c.id === certId ? { ...c, archivos: [...c.archivos, archivo as Archivo] } : c))
        )
    )
    setUploading(null)
    if (ok > 0) router.refresh()
  }

  async function handleDeleteArchivo(certId: string, archivo: Archivo) {
    if (!confirm(`¿Eliminar el archivo "${archivo.nombre}"?`)) return
    if (!(await borrarArchivo(archivo.id))) return
    setCerts((prev) =>
      prev.map((c) =>
        c.id === certId ? { ...c, archivos: c.archivos.filter((a) => a.id !== archivo.id) } : c
      )
    )
    router.refresh()
  }

  const slug = empleado.empresa?.slug ?? ''
  const vencidos = certs.filter(
    (c) => getEstadoVencimiento(c.fecha_vencimiento, c.alerta_dias) === 'vencido'
  ).length
  const proximos = certs.filter(
    (c) => getEstadoVencimiento(c.fecha_vencimiento, c.alerta_dias) === 'proximo'
  ).length

  return (
    <div className="mx-auto max-w-4xl p-4 sm:p-6 lg:p-8">
      <div className="mb-6 flex items-center gap-2 text-sm text-muted-foreground">
        <Link href={`/empresa/${slug}`} className="transition-colors hover:text-foreground">
          {empleado.empresa?.nombre}
        </Link>
        <span>/</span>
        <span className="font-medium text-foreground">{nombreCompleto}</span>
      </div>

      {!activo && (
        <div className="mb-6 flex flex-wrap items-center gap-3 rounded-xl border border-warning/30 bg-warning-subtle px-4 py-3 text-sm">
          <UserX className="size-4 shrink-0 text-warning" strokeWidth={1.75} />
          <p className="min-w-0 flex-1 text-foreground">
            <span className="font-medium">Este empleado está dado de baja.</span>{' '}
            <span className="text-muted-foreground">
              No aparece en Empleados, Vencimientos ni en el Dashboard. Sus certificados y archivos se conservan.
            </span>
          </p>
          {canEdit && (
            <button
              onClick={handleReactivar}
              disabled={cambiandoAlta}
              className="shrink-0 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-50"
            >
              {cambiandoAlta ? 'Reactivando…' : 'Reactivar'}
            </button>
          )}
        </div>
      )}

      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <Monograma nombre={nombreCompleto} size="lg" variant="accent" />
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{nombreCompleto}</h1>
            <div className="mt-1 flex flex-wrap items-center gap-3">
              <span className="text-sm text-muted-foreground">{empleado.empresa?.nombre}</span>
              {empleadoData.sector && (
                <>
                  <span className="text-muted-foreground">·</span>
                  <span className="text-sm text-muted-foreground">{empleadoData.sector}</span>
                </>
              )}
              {vencidos > 0 && <EstadoPill estado="vencido" label={`${vencidos} ${vencidos > 1 ? 'vencidos' : 'vencido'}`} />}
              {proximos > 0 && <EstadoPill estado="proximo" label={`${proximos} por vencer`} />}
            </div>
          </div>
        </div>

        {canEdit && (
          <div className="flex flex-wrap items-center justify-end gap-2">
            <button
              onClick={() => setEditingEmpleado((prev) => !prev)}
              className="rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              Editar
            </button>
            <button
              onClick={abrirNuevo}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
            >
              <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              Agregar certificado
            </button>
          </div>
        )}
      </div>

      {canEdit && editingEmpleado && (
        <form
          onSubmit={(e) => { e.preventDefault(); handleSaveEmpleado() }}
          onKeyDown={escCancela(() => setEditingEmpleado(false))}
          className="bg-card rounded-xl border border-border p-6 mb-8"
        >
          <h3 className="font-semibold text-foreground mb-5">Editar empleado</h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Nombre</label>
              <input
                type="text"
                value={empleadoData.nombre}
                onChange={(e) =>
                  setEmpleadoData((prev) => ({ ...prev, nombre: e.target.value }))
                }
                className={inputCls}
                autoFocus
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Apellido</label>
              <input
                type="text"
                value={empleadoData.apellido}
                onChange={(e) =>
                  setEmpleadoData((prev) => ({ ...prev, apellido: e.target.value }))
                }
                className={inputCls}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Empresa</label>
              <select
                value={empleadoData.empresa_id}
                onChange={(e) =>
                  setEmpleadoData((prev) => ({ ...prev, empresa_id: e.target.value }))
                }
                className={inputCls}
              >
                {empresas.map((empresaItem) => (
                  <option key={empresaItem.id} value={empresaItem.id}>
                    {empresaItem.nombre}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Sector</label>
              <input
                type="text"
                value={empleadoData.sector}
                onChange={(e) =>
                  setEmpleadoData((prev) => ({ ...prev, sector: e.target.value }))
                }
                className={inputCls}
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="submit"
              disabled={savingEmpleado}
              className="bg-primary hover:bg-primary/90 disabled:opacity-50 text-primary-foreground text-sm font-medium px-5 py-2.5 rounded-lg transition-colors"
            >
              {savingEmpleado ? 'Guardando...' : 'Guardar cambios'}
            </button>
            <button
              type="button"
              onClick={() => setEditingEmpleado(false)}
              className="text-sm text-muted-foreground hover:text-foreground px-3 py-2.5"
            >
              Cancelar
            </button>
            {/* La baja vive acá y no al lado de "Agregar certificado": es una acción
                rara y antes se confundía con borrar. */}
            {activo && (
              <button
                type="button"
                onClick={handleDarDeBaja}
                disabled={cambiandoAlta}
                className="ml-auto inline-flex items-center gap-2 rounded-lg border border-danger/30 px-4 py-2 text-sm font-medium text-danger transition-colors hover:bg-danger-subtle disabled:opacity-50"
              >
                <UserX className="size-4" strokeWidth={1.75} />
                {cambiandoAlta ? 'Dando de baja…' : 'Dar de baja'}
              </button>
            )}
          </div>
        </form>
      )}

      <div className="space-y-3 mb-8">
        {certs.length === 0 && (
          <div className="text-center py-12 text-muted-foreground text-sm bg-card rounded-xl border border-border">
            Sin certificados registrados. Agregá el primero.
          </div>
        )}

        {certs.map((cert) => {
          const estado = getEstadoVencimiento(cert.fecha_vencimiento, cert.alerta_dias)
          const isOpen = activeCertId === cert.id

          return (
            <div
              key={cert.id}
              id={`cert-${cert.id}`}
              className={clsx(
                'scroll-mt-6 bg-card rounded-xl border overflow-hidden',
                isOpen && certALaVista === cert.id ? 'border-primary/40' : 'border-border'
              )}
            >
              <div
                className="flex items-center gap-4 px-5 py-4 cursor-pointer hover:bg-accent transition-colors"
                onClick={() => setActiveCertId(isOpen ? null : cert.id)}
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">
                    {cert.tipo?.nombre ?? cert.tipo_nombre_custom ?? 'Sin tipo'}
                  </p>
                  {cert.numero_documento && (
                    <p className="text-xs text-muted-foreground mt-0.5">{cert.numero_documento}</p>
                  )}
                </div>
                <div className="text-right shrink-0">
                  <EstadoPill estado={estado} />
                  {cert.fecha_vencimiento && (
                    <p className="text-xs text-muted-foreground mt-1 tabular-nums">
                      {format(new Date(cert.fecha_vencimiento.slice(0, 10) + 'T12:00:00'), 'dd/MM/yyyy')}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {cert.archivos?.length > 0 && (
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <svg
                        className="w-3.5 h-3.5"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M18.375 12.739l-7.693 7.693a4.5 4.5 0 01-6.364-6.364l10.94-10.94A3 3 0 1119.5 7.372L8.552 18.32m.009-.01l-.01.01m5.699-9.941l-7.81 7.81a1.5 1.5 0 002.112 2.13"
                        />
                      </svg>
                      {cert.archivos.length}
                    </span>
                  )}
                  <svg
                    className={clsx('w-4 h-4 text-muted-foreground transition-transform', isOpen && 'rotate-180')}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                  </svg>
                </div>
              </div>

              {isOpen && (
                <div className="border-t border-border px-5 py-4 bg-muted">
                  <div className="grid grid-cols-3 gap-4 mb-4 text-sm">
                    {cert.fecha_emision && (
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Fecha de emisión</p>
                        <p className="text-foreground">
                          {format(new Date(cert.fecha_emision.slice(0, 10) + 'T12:00:00'), 'dd/MM/yyyy')}
                        </p>
                      </div>
                    )}

                    {cert.fecha_vencimiento && (
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Vencimiento</p>
                        <p className="text-foreground">
                          {format(new Date(cert.fecha_vencimiento.slice(0, 10) + 'T12:00:00'), 'dd/MM/yyyy')}
                        </p>
                      </div>
                    )}

                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Alerta previa</p>
                      <p className="text-foreground">{cert.alerta_dias ?? ALERTA_DIAS_DEFECTO} días</p>
                    </div>

                    {cert.notas && (
                      <div className="col-span-3">
                        <p className="text-xs text-muted-foreground mb-1">Notas</p>
                        <p className="text-foreground">{cert.notas}</p>
                      </div>
                    )}
                  </div>

                  <div className="mb-4">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                      Archivos adjuntos
                    </p>

                    <div className="space-y-2">
                      {cert.archivos?.map((archivo) => (
                        <div
                          key={archivo.id}
                          className="flex items-center gap-3 bg-card rounded-lg border border-border px-3 py-2"
                        >
                          <svg
                            className="w-4 h-4 text-muted-foreground shrink-0"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth={1.8}
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
                            />
                          </svg>

                          <span className="flex-1 text-sm text-foreground truncate">{archivo.nombre}</span>

                          {archivo.size_bytes && (
                            <span className="text-xs text-muted-foreground shrink-0">
                              {(archivo.size_bytes / 1024).toFixed(0)} KB
                            </span>
                          )}

                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => abrirArchivo(archivo.path)}
                              className="text-xs text-primary hover:underline"
                            >
                              Ver
                            </button>

                            {canEdit && (
                              <button
                                onClick={() => handleDeleteArchivo(cert.id, archivo)}
                                className="text-xs text-danger/80 hover:text-danger"
                              >
                                Eliminar
                              </button>
                            )}
                          </div>
                        </div>
                      ))}

                      {cert.archivos?.length === 0 && (
                        <p className="text-xs text-muted-foreground">Sin archivos adjuntos</p>
                      )}
                    </div>
                  </div>

                  {canEdit && (
                    <div className="flex items-center gap-3 pt-3 border-t border-border">
                      <label
                        className={clsx(
                          'flex items-center gap-2 text-xs font-medium px-3 py-1.5 rounded-lg border cursor-pointer transition-colors',
                          uploading === cert.id
                            ? 'border-border text-muted-foreground bg-muted'
                            : 'border-primary/30 text-primary bg-primary/10 hover:bg-primary/20'
                        )}
                      >
                        <svg
                          className="w-3.5 h-3.5"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={2}
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"
                          />
                        </svg>
                        {uploading === cert.id ? 'Subiendo...' : 'Subir archivo'}
                        <input
                          type="file"
                          multiple
                          className="sr-only"
                          accept=".pdf,.jpg,.jpeg,.png,.webp"
                          disabled={uploading === cert.id}
                          onChange={(e) => {
                            const files = Array.from(e.target.files ?? [])
                            // Vaciar el input: si no, volver a elegir el mismo archivo
                            // después de un error no dispara onChange.
                            e.target.value = ''
                            if (files.length) handleFileUpload(cert.id, files)
                          }}
                        />
                      </label>

                      <button
                        onClick={() => openEdit(cert)}
                        className="flex items-center gap-2 text-xs font-medium px-3 py-1.5 rounded-lg border border-border text-muted-foreground hover:bg-accent transition-colors"
                      >
                        <svg
                          className="w-3.5 h-3.5"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={2}
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125"
                          />
                        </svg>
                        Editar
                      </button>

                      <button
                        onClick={() => handleDelete(cert)}
                        className="flex items-center gap-2 text-xs font-medium px-3 py-1.5 rounded-lg border border-danger/30 text-danger hover:bg-danger-subtle transition-colors"
                      >
                        <svg
                          className="w-3.5 h-3.5"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={2}
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0"
                          />
                        </svg>
                        Eliminar
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {canEdit && showForm && (
        <form
          key={editingId ?? 'nuevo'}
          ref={formRef}
          id="cert-form"
          onSubmit={(e) => { e.preventDefault(); handleSave() }}
          onKeyDown={escCancela(resetForm)}
          className="scroll-mt-6 bg-card rounded-xl border border-primary/30 p-6 shadow-sm"
        >
          <h3 className="font-semibold text-foreground mb-5">
            {editingId ? 'Editar certificado' : 'Nuevo certificado'}
          </h3>

          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="col-span-2">
              <label className="block text-sm font-medium text-foreground mb-1.5">
                Tipo de certificado
              </label>
              <select
                value={form.tipo_id}
                onChange={(e) => setForm((f) => ({ ...f, tipo_id: e.target.value }))}
                className={inputCls}
              >
                <option value="">Seleccionar...</option>
                {tiposCertificado.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.nombre}
                  </option>
                ))}
                <option value="otro">Otro, especificar</option>
              </select>
            </div>

            {form.tipo_id === 'otro' && (
              <div className="col-span-2">
                <label className="block text-sm font-medium text-foreground mb-1.5">
                  Nombre del certificado
                </label>
                <input
                  type="text"
                  value={form.tipo_nombre_custom}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, tipo_nombre_custom: e.target.value }))
                  }
                  className={inputCls}
                  placeholder="Ej: Curso de Primeros Auxilios"
                />
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">
                Fecha de emisión
              </label>
              <input
                type="date"
                value={form.fecha_emision}
                onChange={(e) => setForm((f) => ({ ...f, fecha_emision: e.target.value }))}
                className={inputCls}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">
                Fecha de vencimiento
              </label>
              <input
                type="date"
                value={form.fecha_vencimiento}
                onChange={(e) =>
                  setForm((f) => ({ ...f, fecha_vencimiento: e.target.value }))
                }
                className={inputCls}
              />
              {!form.fecha_vencimiento && (
                <p className="mt-1 text-xs text-warning">{AVISO_SIN_VENCIMIENTO}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">
                N° de documento
              </label>
              <input
                type="text"
                value={form.numero_documento}
                onChange={(e) =>
                  setForm((f) => ({ ...f, numero_documento: e.target.value }))
                }
                className={inputCls}
                placeholder="Nro. de resolución, carnet, etc."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">
                Alertar con días de anticipación
              </label>
              <input
                type="number"
                inputMode="numeric"
                min={1}
                max={ALERTA_DIAS_MAX}
                value={form.alerta_dias}
                onChange={(e) => setForm((f) => ({ ...f, alerta_dias: e.target.value }))}
                className={inputCls}
              />
            </div>

            <div className="col-span-2">
              <label className="block text-sm font-medium text-foreground mb-1.5">Notas</label>
              <textarea
                value={form.notas}
                onChange={(e) => setForm((f) => ({ ...f, notas: e.target.value }))}
                rows={3}
                className={clsx(inputCls, 'resize-none')}
                placeholder="Información adicional..."
              />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={saving || !form.tipo_id}
              className="bg-primary hover:bg-primary/90 disabled:opacity-50 text-primary-foreground text-sm font-medium px-5 py-2.5 rounded-lg transition-colors"
            >
              {saving ? 'Guardando...' : editingId ? 'Guardar cambios' : 'Agregar certificado'}
            </button>
            <button
              type="button"
              onClick={resetForm}
              className="text-sm text-muted-foreground hover:text-foreground px-3 py-2.5"
            >
              Cancelar
            </button>
            <span className="ml-auto hidden text-xs text-muted-foreground sm:inline">Enter guarda · Esc cancela</span>
          </div>
        </form>
      )}

      {veRecibos && (
        <RecibosSueldo
          empleadoId={empleado.id}
          empresaSlug={empleado.empresa?.slug ?? 'docs'}
          recibos={recibos}
          canEdit={canEdit}
        />
      )}
    </div>
  )
}
