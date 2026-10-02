'use client'

import { useEffect, useState, type KeyboardEvent } from 'react'
import { useRouter } from 'next/navigation'
import { format } from 'date-fns'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { getEstadoVencimiento } from '@/types'
import { EstadoPill } from '@/components/ui/estado-pill'
import type { Vehiculo, TipoCertificado } from '@/types'
import { mensajeError } from '@/lib/errores'
import { abrirArchivo, borrarArchivo, subirArchivosACertificado } from '@/lib/archivos-client'
import {
  ALERTA_DIAS_DEFECTO, ALERTA_DIAS_MAX, AVISO_SIN_VENCIMIENTO, alertaComoTexto, llevarALaVista, useEnfocarAlAbrir,
  validarAlertaDias,
} from '@/lib/formularios'
import clsx from 'clsx'

type ArchivoCert = { id: string; nombre: string; path: string }

interface CertVehiculo {
  id: string
  tipo_id?: string | null
  tipo_nombre_custom?: string | null
  fecha_vencimiento?: string | null
  notas?: string | null
  alerta_dias: number | null
  tipo?: { nombre: string } | null
  archivos?: ArchivoCert[]
}

interface VehiculoConCerts extends Vehiculo {
  certificados: CertVehiculo[]
}

interface Props {
  vehiculos: VehiculoConCerts[]
  tiposCertificado: TipoCertificado[]
  canEdit: boolean
  empresaSlug: string
  empresaId: string
  /** Vehículo a mostrar abierto al entrar (?veh=<id>, desde el dashboard o vencimientos). */
  abiertoInicial?: string | null
}

const FORM_EMPTY = {
  tipo_id: '',
  tipo_nombre_custom: '',
  fecha_vencimiento: '',
  notas: '',
  /** Texto crudo: se valida al guardar (ver validarAlertaDias). */
  alerta_dias: String(ALERTA_DIAS_DEFECTO),
}

const VEH_EMPTY = {
  patente: '',
  descripcion: '',
}

const inputCls = 'w-full px-3 py-2 rounded-lg border border-input text-sm focus:outline-none focus:ring-2 focus:ring-ring bg-card'

function escCancela(cancelar: () => void) {
  return (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault()
      cancelar()
    }
  }
}

export default function VehiculosClient({
  vehiculos: initVehiculos,
  tiposCertificado,
  canEdit,
  empresaSlug,
  empresaId,
  abiertoInicial = null,
}: Props) {
  const supabase = createClient()
  const router = useRouter()
  const [vehiculos, setVehiculos] = useState(initVehiculos)
  const [expandedId, setExpandedId] = useState<string | null>(abiertoInicial)
  const [editingCert, setEditingCert] = useState<string | null>(null)
  const [addingTo, setAddingTo] = useState<string | null>(null)
  const [form, setForm] = useState(FORM_EMPTY)
  const [saving, setSaving] = useState(false)
  const [uploadingCert, setUploadingCert] = useState<string | null>(null)
  const [showNewVeh, setShowNewVeh] = useState(false)
  const [vehForm, setVehForm] = useState(VEH_EMPTY)
  const [savingVeh, setSavingVeh] = useState(false)
  // Cada apertura del formulario de certificado lo trae a la vista con el foco puesto.
  const [aperturas, setAperturas] = useState(0)
  const formRef = useEnfocarAlAbrir<HTMLFormElement>(aperturas, 'nearest')

  // Link profundo (?veh=): el vehículo ya arranca abierto; falta llevarlo a la vista.
  useEffect(() => {
    if (!abiertoInicial) return
    const el = document.getElementById(`veh-${abiertoInicial}`)
    if (el) llevarALaVista(el, 'start')
  }, [abiertoInicial])

  function openNewVeh() {
    setVehForm(VEH_EMPTY)
    setShowNewVeh(true)
  }

  function closeNewVeh() {
    setVehForm(VEH_EMPTY)
    setShowNewVeh(false)
  }

  async function handleCrearVehiculo() {
    const patente = vehForm.patente.trim().toUpperCase()
    if (!patente) {
      toast.error('La patente es requerida.')
      return
    }
    if (vehiculos.some((v) => v.patente.trim().toUpperCase() === patente)) {
      toast.error('Ya existe un vehículo con esa patente.')
      return
    }

    setSavingVeh(true)

    const { data, error: err } = await supabase
      .from('vehiculos')
      .insert({
        empresa_id: empresaId,
        patente,
        descripcion: vehForm.descripcion.trim() || null,
        activo: true,
      })
      .select('*')
      .single()

    setSavingVeh(false)

    if (err || !data) {
      toast.error(mensajeError(err, 'crear el vehículo'))
      return
    }

    // Mismo criterio que la query del server: .order('patente')
    setVehiculos((prev) =>
      [...prev, { ...data, certificados: [] }].sort((a, b) => a.patente.localeCompare(b.patente, 'es'))
    )
    toast.success(`Vehículo ${patente} agregado`)
    closeNewVeh()
    setExpandedId(data.id)
    router.refresh()
  }

  function openAdd(vehiculoId: string) {
    setForm(FORM_EMPTY)
    setEditingCert(null)
    setAddingTo(vehiculoId)
    setExpandedId(vehiculoId)
    setAperturas((n) => n + 1)
  }

  function openEdit(cert: CertVehiculo) {
    setForm({
      // Un certificado "Otro" tiene tipo_id null y el nombre en tipo_nombre_custom:
      // sin esto el select quedaba en "Seleccionar..." y no se podía guardar.
      tipo_id: cert.tipo_id ?? (cert.tipo_nombre_custom ? 'otro' : ''),
      tipo_nombre_custom: cert.tipo_nombre_custom ?? '',
      fecha_vencimiento: cert.fecha_vencimiento?.slice(0, 10) ?? '',
      notas: cert.notas ?? '',
      alerta_dias: alertaComoTexto(cert.alerta_dias),
    })
    setEditingCert(cert.id)
    setAddingTo(null)
    setAperturas((n) => n + 1)
  }

  function cancelarForm() {
    setEditingCert(null)
    setAddingTo(null)
    setForm(FORM_EMPTY)
  }

  async function handleSave(vehiculoId: string) {
    if (!form.tipo_id) {
      toast.error('Elegí el tipo de certificado.')
      return
    }
    if (form.tipo_id === 'otro' && !form.tipo_nombre_custom.trim()) {
      toast.error('Escribí el nombre del certificado.')
      return
    }
    const alerta = validarAlertaDias(form.alerta_dias)
    if (!alerta.ok) {
      toast.error(alerta.error)
      return
    }
    setSaving(true)

    const payload = {
      vehiculo_id: vehiculoId,
      // "otro" no es un UUID: el tipo custom va en tipo_nombre_custom
      tipo_id: form.tipo_id === 'otro' ? null : form.tipo_id || null,
      tipo_nombre_custom: form.tipo_id === 'otro' ? form.tipo_nombre_custom.trim() : null,
      fecha_vencimiento: form.fecha_vencimiento || null,
      notas: form.notas || null,
      alerta_dias: alerta.valor,
    }
    const sinVencimiento = form.fecha_vencimiento ? undefined : { description: AVISO_SIN_VENCIMIENTO }

    if (editingCert) {
      const certId = editingCert
      const { data, error: err } = await supabase
        .from('certificados')
        .update({ ...payload, updated_at: new Date().toISOString() })
        .eq('id', certId)
        .select('*, tipo:tipos_certificado(nombre)')
        .single()

      setSaving(false)
      if (err || !data) {
        toast.error(mensajeError(err, 'guardar el certificado')) // el form queda abierto con lo tipeado
        return
      }

      // El update no trae los adjuntos: se conservan los que ya estaban (antes la
      // fila se reemplazaba entera y los archivos "desaparecían" hasta recargar).
      setVehiculos((prev) =>
        prev.map((v) =>
          v.id === vehiculoId
            ? {
                ...v,
                certificados: v.certificados.map((c) => (c.id === certId ? { ...data, archivos: c.archivos } : c)),
              }
            : v
        )
      )
      toast.success('Certificado actualizado', sinVencimiento)
    } else {
      const { data, error: err } = await supabase
        .from('certificados')
        .insert(payload)
        .select('*, tipo:tipos_certificado(nombre)')
        .single()

      setSaving(false)
      if (err || !data) {
        toast.error(mensajeError(err, 'agregar el certificado'))
        return
      }

      setVehiculos((prev) =>
        prev.map((v) =>
          v.id === vehiculoId ? { ...v, certificados: [...v.certificados, { ...data, archivos: [] }] } : v
        )
      )
      toast.success('Certificado agregado', sinVencimiento)
    }

    cancelarForm()
    router.refresh()
  }

  async function handleDelete(vehiculoId: string, cert: CertVehiculo) {
    const n = cert.archivos?.length ?? 0
    const adjuntos = n > 0 ? ` y ${n === 1 ? 'su archivo adjunto' : `sus ${n} archivos adjuntos`}` : ''
    if (!confirm(`¿Eliminar el certificado "${cert.tipo?.nombre ?? cert.tipo_nombre_custom ?? 'Sin tipo'}"${adjuntos}? No se puede deshacer.`)) return

    // .select() devuelve lo borrado: si la RLS no dejó borrar nada no hay error, pero tampoco filas.
    const { data, error: err } = await supabase.from('certificados').delete().eq('id', cert.id).select('id')

    if (err || !data?.length) {
      toast.error(err ? mensajeError(err, 'eliminar el certificado') : 'No se pudo eliminar: el certificado ya no existe o no tenés permiso.')
      return
    }

    setVehiculos((prev) =>
      prev.map((v) =>
        v.id === vehiculoId
          ? { ...v, certificados: v.certificados.filter((c) => c.id !== cert.id) }
          : v
      )
    )
    toast.success('Certificado eliminado')
    router.refresh()
  }

  async function handleUploadArchivo(vehiculoId: string, certId: string, files: File[]) {
    setUploadingCert(certId)
    const ok = await subirArchivosACertificado(files, certId, { empresaSlug }, (archivo) =>
      setVehiculos((prev) =>
        prev.map((v) =>
          v.id === vehiculoId
            ? { ...v, certificados: v.certificados.map((c) => (c.id === certId ? { ...c, archivos: [...(c.archivos ?? []), archivo] } : c)) }
            : v
        )
      )
    )
    setUploadingCert(null)
    if (ok > 0) router.refresh()
  }

  async function handleDeleteArchivo(vehiculoId: string, certId: string, archivo: ArchivoCert) {
    if (!confirm(`¿Eliminar el archivo "${archivo.nombre}"?`)) return
    if (!(await borrarArchivo(archivo.id))) return
    setVehiculos((prev) =>
      prev.map((v) =>
        v.id === vehiculoId
          ? { ...v, certificados: v.certificados.map((c) => (c.id === certId ? { ...c, archivos: (c.archivos ?? []).filter((a) => a.id !== archivo.id) } : c)) }
          : v
      )
    )
    router.refresh()
  }

  return (
    <div className="mb-8">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-base font-semibold text-foreground">Vehículos</h2>
        {canEdit && !showNewVeh && (
          <button
            onClick={openNewVeh}
            className="flex items-center gap-1.5 text-xs font-medium text-primary bg-primary/10 hover:bg-primary/20 px-3 py-1.5 rounded-lg transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Agregar
          </button>
        )}
      </div>

      {/* Formulario de nuevo vehículo */}
      {showNewVeh && canEdit && (
        <form
          onSubmit={(e) => { e.preventDefault(); handleCrearVehiculo() }}
          onKeyDown={escCancela(closeNewVeh)}
          className="mb-3 rounded-xl border border-primary/30 bg-primary/5 p-4"
        >
          <p className="text-sm font-medium text-foreground mb-3">Nuevo vehículo</p>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <label className="block text-xs font-medium text-foreground mb-1">Patente *</label>
              <input
                type="text"
                value={vehForm.patente}
                onChange={(e) => setVehForm((f) => ({ ...f, patente: e.target.value.toUpperCase() }))}
                className={clsx(inputCls, 'font-mono')}
                placeholder="Ej: AD113UY"
                autoFocus
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-foreground mb-1">Descripción</label>
              <input
                type="text"
                value={vehForm.descripcion}
                onChange={(e) => setVehForm((f) => ({ ...f, descripcion: e.target.value }))}
                className={inputCls}
                placeholder="Ej: Ford Ranger — Bahía Blanca"
              />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={savingVeh}
              className="bg-primary hover:bg-primary/90 disabled:opacity-50 text-primary-foreground text-xs font-medium px-4 py-2 rounded-lg transition-colors"
            >
              {savingVeh ? 'Guardando...' : 'Agregar vehículo'}
            </button>
            <button
              type="button"
              onClick={closeNewVeh}
              className="text-xs text-muted-foreground hover:text-foreground px-2 py-2"
            >
              Cancelar
            </button>
          </div>
        </form>
      )}

      {vehiculos.length === 0 && !showNewVeh && (
        <div className="rounded-xl border border-dashed border-border px-6 py-8 text-center text-sm text-muted-foreground">
          Sin vehículos registrados.{' '}
          {canEdit && (
            <button onClick={openNewVeh} className="text-primary hover:underline">
              Agregar el primero
            </button>
          )}
        </div>
      )}

      <div className="space-y-3">
        {vehiculos.map((veh) => {
          const isOpen = expandedId === veh.id
          const isAddingHere = addingTo === veh.id

          const worstEstado =
            veh.certificados.length > 0
              ? veh.certificados.reduce((worst, c) => {
                  const e = getEstadoVencimiento(c.fecha_vencimiento, c.alerta_dias)
                  if (e === 'vencido') return 'vencido'
                  if (e === 'proximo' && worst !== 'vencido') return 'proximo'
                  return worst
                }, 'vigente' as string)
              : 'sin_fecha'

          const estadoColor =
            {
              vencido: 'bg-danger',
              proximo: 'bg-warning',
              vigente: 'bg-success',
              sin_fecha: 'bg-muted-foreground/40',
            }[worstEstado] ?? 'bg-muted-foreground/40'

          return (
            <div
              key={veh.id}
              id={`veh-${veh.id}`}
              className={clsx(
                'scroll-mt-6 bg-card rounded-xl border overflow-hidden',
                abiertoInicial === veh.id ? 'border-primary/40' : 'border-border'
              )}
            >
              <div
                className="flex items-center gap-4 px-5 py-4 cursor-pointer hover:bg-accent transition-colors"
                onClick={() => setExpandedId(isOpen ? null : veh.id)}
              >
                <span className={clsx('w-2 h-2 rounded-full shrink-0', estadoColor)} />
                <div className="flex-1">
                  <p className="font-mono font-semibold text-foreground">{veh.patente}</p>
                  {veh.descripcion && <p className="text-xs text-muted-foreground">{veh.descripcion}</p>}
                </div>

                <div className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground">
                    {veh.certificados.length} certificado
                    {veh.certificados.length !== 1 ? 's' : ''}
                  </span>

                  {canEdit && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        openAdd(veh.id)
                      }}
                      className="text-xs font-medium text-primary hover:text-primary bg-primary/10 hover:bg-primary/20 px-2.5 py-1 rounded-lg transition-colors"
                    >
                      + Agregar
                    </button>
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
                <div className="border-t border-border bg-muted px-5 py-4">
                  <div className="space-y-2 mb-4">
                    {veh.certificados.length === 0 && (
                      <p className="text-xs text-muted-foreground py-2">Sin certificados. Agregá el primero.</p>
                    )}

                    {veh.certificados.map((cert) => {
                      const estado = getEstadoVencimiento(cert.fecha_vencimiento, cert.alerta_dias)
                      const isEditing = editingCert === cert.id

                      return (
                        <div key={cert.id} className="bg-card rounded-lg border border-border overflow-hidden">
                          {!isEditing && (
                            <div className="flex items-center gap-3 px-4 py-3">
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-foreground">
                                  {cert.tipo?.nombre ?? cert.tipo_nombre_custom ?? 'Sin tipo'}
                                </p>
                                {cert.notas && (
                                  <p className="text-xs text-muted-foreground mt-0.5 truncate">{cert.notas}</p>
                                )}
                              </div>

                              <EstadoPill
                                estado={estado}
                                className="shrink-0"
                                label={cert.fecha_vencimiento
                                  ? format(new Date(cert.fecha_vencimiento.slice(0, 10) + 'T12:00:00'), 'dd/MM/yyyy')
                                  : undefined}
                              />

                              {canEdit && (
                                <div className="flex items-center gap-2 shrink-0">
                                  <button
                                    onClick={() => openEdit(cert)}
                                    className="text-xs text-muted-foreground hover:text-primary transition-colors"
                                  >
                                    Editar
                                  </button>
                                  <button
                                    onClick={() => handleDelete(veh.id, cert)}
                                    className="text-xs text-muted-foreground hover:text-red-500 transition-colors"
                                  >
                                    Eliminar
                                  </button>
                                </div>
                              )}
                            </div>
                          )}

                          {!isEditing && (
                            <div className="border-t border-border px-4 py-2.5">
                              <div className="flex flex-wrap items-center gap-2">
                                {(cert.archivos ?? []).map((a) => (
                                  <span key={a.id} className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-1 text-xs">
                                    <button type="button" onClick={() => abrirArchivo(a.path)} className="max-w-[160px] truncate text-left text-primary hover:underline">{a.nombre}</button>
                                    {canEdit && (
                                      <button onClick={() => handleDeleteArchivo(veh.id, cert.id, a)} className="text-muted-foreground hover:text-red-500" aria-label="Eliminar archivo">×</button>
                                    )}
                                  </span>
                                ))}
                                {(cert.archivos ?? []).length === 0 && (
                                  <span className="text-xs text-muted-foreground">Sin archivos</span>
                                )}
                                {canEdit && (
                                  <label className="inline-flex cursor-pointer items-center rounded-md border border-input px-2 py-1 text-xs text-muted-foreground hover:bg-accent">
                                    {uploadingCert === cert.id ? 'Subiendo…' : '+ Adjuntar'}
                                    <input type="file" multiple accept="application/pdf,image/*" className="hidden" disabled={uploadingCert === cert.id}
                                      onChange={(e) => {
                                        const files = Array.from(e.target.files ?? [])
                                        // Vaciar el input: si no, volver a elegir el mismo archivo después de un error no hace nada.
                                        e.target.value = ''
                                        if (files.length) handleUploadArchivo(veh.id, cert.id, files)
                                      }} />
                                  </label>
                                )}
                              </div>
                            </div>
                          )}

                          {isEditing && renderForm(veh.id, 'Guardar', 'p-4')}
                        </div>
                      )
                    })}
                  </div>

                  {isAddingHere && canEdit && (
                    <div className="bg-card rounded-lg border border-primary/30">
                      {renderForm(veh.id, 'Agregar', 'p-4', 'Nuevo certificado')}
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )

  function renderForm(vehiculoId: string, textoBoton: string, className: string, titulo?: string) {
    return (
      <form
        ref={formRef}
        onSubmit={(e) => { e.preventDefault(); handleSave(vehiculoId) }}
        onKeyDown={escCancela(cancelarForm)}
        className={clsx('scroll-mt-6', className)}
      >
        {titulo && <p className="text-sm font-medium text-foreground mb-3">{titulo}</p>}
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <label className="block text-xs font-medium text-foreground mb-1">Tipo de certificado</label>
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
              <option value="otro">Otro (especificar)</option>
            </select>
          </div>

          {form.tipo_id === 'otro' && (
            <div className="col-span-2">
              <label className="block text-xs font-medium text-foreground mb-1">Nombre del certificado</label>
              <input
                type="text"
                value={form.tipo_nombre_custom}
                onChange={(e) => setForm((f) => ({ ...f, tipo_nombre_custom: e.target.value }))}
                className={inputCls}
                placeholder="Ej: Matafuegos CO2"
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-foreground mb-1">Vencimiento</label>
            <input
              type="date"
              value={form.fecha_vencimiento}
              onChange={(e) => setForm((f) => ({ ...f, fecha_vencimiento: e.target.value }))}
              className={inputCls}
            />
            {!form.fecha_vencimiento && <p className="mt-1 text-[11px] text-warning">{AVISO_SIN_VENCIMIENTO}</p>}
          </div>

          <div>
            <label className="block text-xs font-medium text-foreground mb-1">Alerta, días antes</label>
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
            <label className="block text-xs font-medium text-foreground mb-1">Notas</label>
            <input
              type="text"
              value={form.notas}
              onChange={(e) => setForm((f) => ({ ...f, notas: e.target.value }))}
              className={inputCls}
              placeholder="Información adicional..."
            />
          </div>
        </div>
        <div className="flex gap-2 mt-3">
          <button
            type="submit"
            disabled={saving || !form.tipo_id}
            className="bg-primary hover:bg-primary/90 disabled:opacity-50 text-primary-foreground text-xs font-medium px-4 py-2 rounded-lg"
          >
            {saving ? 'Guardando...' : textoBoton}
          </button>
          <button type="button" onClick={cancelarForm} className="text-xs text-muted-foreground px-3 py-2">
            Cancelar
          </button>
        </div>
      </form>
    )
  }
}
