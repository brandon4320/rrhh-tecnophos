'use client'

import { useState, type KeyboardEvent } from 'react'
import { useRouter } from 'next/navigation'
import { format } from 'date-fns'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { getEstadoVencimiento } from '@/types'
import { EstadoPill } from '@/components/ui/estado-pill'
import { mensajeError } from '@/lib/errores'
import { abrirArchivo, borrarArchivo, subirArchivosACertificado } from '@/lib/archivos-client'
import {
  ALERTA_DIAS_DEFECTO, ALERTA_DIAS_MAX, AVISO_SIN_VENCIMIENTO, alertaComoTexto, useEnfocarAlAbrir, validarAlertaDias,
} from '@/lib/formularios'

interface Archivo {
  id: string
  nombre: string
  path: string
}

interface CertEmpresa {
  id: string
  tipo_id?: string | null
  tipo_nombre_custom?: string | null
  numero_documento?: string | null
  fecha_vencimiento?: string | null
  alerta_dias?: number | null
  notas?: string | null
  tipo?: { nombre: string } | null
  archivos?: Archivo[]
}

interface FormState {
  nombre: string
  fecha_vencimiento: string
  numero_documento: string
  /** Texto crudo: se valida al guardar (ver validarAlertaDias). */
  alerta_dias: string
  notas: string
}

const FORM_EMPTY: FormState = {
  nombre: '',
  fecha_vencimiento: '',
  numero_documento: '',
  alerta_dias: String(ALERTA_DIAS_DEFECTO),
  notas: '',
}

const inputCls =
  'w-full px-3 py-2 rounded-lg border border-input text-sm focus:outline-none focus:ring-2 focus:ring-ring bg-card'

interface Props {
  certs: CertEmpresa[]
  canEdit: boolean
  empresaSlug: string
  empresaId: string
  /** Título de la sección. Default: habilitaciones de empresa. */
  titulo?: string
  /** Nombre del documento en singular, para textos ("habilitación", "programa"). */
  etiqueta?: string
  /** Placeholder del campo nombre en el alta. */
  placeholderNombre?: string
  /** certificados.categoria con el que se crean los documentos de esta sección
   *  (null = habilitación clásica; 'programa_seguridad' = programas de seguridad). */
  categoria?: string | null
}

export default function EmpresaCertsClient({
  certs: initial,
  canEdit,
  empresaSlug,
  empresaId,
  titulo = 'Habilitaciones de empresa',
  etiqueta = 'habilitación',
  placeholderNombre = 'Ej: Registro de Inscripción Santa Fe',
  categoria = null,
}: Props) {
  const supabase = createClient()
  const router = useRouter()
  const [certs, setCerts] = useState<CertEmpresa[]>(initial)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [showNewForm, setShowNewForm] = useState(false)
  const [form, setForm] = useState<FormState>(FORM_EMPTY)
  const [newForm, setNewForm] = useState<FormState>(FORM_EMPTY)
  const [saving, setSaving] = useState(false)
  const [savingNew, setSavingNew] = useState(false)
  const [uploadingCert, setUploadingCert] = useState<string | null>(null)
  // Cada apertura de un formulario lo trae a la vista y le pone el foco.
  const [aperturas, setAperturas] = useState(0)
  const formRef = useEnfocarAlAbrir<HTMLFormElement>(aperturas, 'nearest')

  // Artículo según el género de la etiqueta ("la habilitación", "el programa").
  const art = etiqueta === 'programa' ? 'el' : 'la'

  function openNew() {
    setNewForm(FORM_EMPTY)
    setEditingId(null)
    setShowNewForm(true)
    setAperturas((n) => n + 1)
  }

  function closeNew() {
    setShowNewForm(false)
    setNewForm(FORM_EMPTY)
  }

  function openEdit(cert: CertEmpresa) {
    setForm({
      nombre: cert.tipo_nombre_custom ?? cert.tipo?.nombre ?? '',
      fecha_vencimiento: cert.fecha_vencimiento?.slice(0, 10) ?? '',
      numero_documento: cert.numero_documento ?? '',
      alerta_dias: alertaComoTexto(cert.alerta_dias),
      notas: cert.notas ?? '',
    })
    setShowNewForm(false)
    setEditingId(cert.id)
    setAperturas((n) => n + 1)
  }

  function cancelEdit() {
    setEditingId(null)
    setForm(FORM_EMPTY)
  }

  /** Esc cancela el formulario en el que se está escribiendo. */
  function escCancela(cancelar: () => void) {
    return (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        cancelar()
      }
    }
  }

  async function handleSave(certId: string) {
    const alerta = validarAlertaDias(form.alerta_dias)
    if (!alerta.ok) {
      toast.error(alerta.error)
      return
    }
    setSaving(true)

    const { data, error: err } = await supabase
      .from('certificados')
      .update({
        fecha_vencimiento: form.fecha_vencimiento || null,
        numero_documento: form.numero_documento || null,
        alerta_dias: alerta.valor,
        notas: form.notas || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', certId)
      .select('*, tipo:tipos_certificado(nombre)')
      .single()

    setSaving(false)
    if (err || !data) {
      toast.error(mensajeError(err, 'guardar los cambios')) // el form queda abierto con lo tipeado
      return
    }

    setCerts((prev) => prev.map((c) => (c.id === certId ? { ...data, archivos: c.archivos } : c)))
    toast.success('Cambios guardados', form.fecha_vencimiento ? undefined : { description: AVISO_SIN_VENCIMIENTO })
    cancelEdit()
    router.refresh()
  }

  async function handleCreate() {
    if (!newForm.nombre.trim()) {
      toast.error('Escribí el nombre.')
      return
    }
    const alerta = validarAlertaDias(newForm.alerta_dias)
    if (!alerta.ok) {
      toast.error(alerta.error)
      return
    }
    setSavingNew(true)

    const { data, error: err } = await supabase
      .from('certificados')
      .insert({
        empresa_id: empresaId,
        categoria,
        tipo_nombre_custom: newForm.nombre.trim(),
        fecha_vencimiento: newForm.fecha_vencimiento || null,
        numero_documento: newForm.numero_documento || null,
        alerta_dias: alerta.valor,
        notas: newForm.notas || null,
      })
      .select('*, tipo:tipos_certificado(nombre)')
      .single()

    setSavingNew(false)
    if (err || !data) {
      toast.error(mensajeError(err, `crear ${art} ${etiqueta}`))
      return
    }

    setCerts((prev) => [...prev, { ...data, archivos: [] }])
    toast.success(
      etiqueta === 'programa' ? 'Programa agregado' : 'Habilitación agregada',
      newForm.fecha_vencimiento ? undefined : { description: AVISO_SIN_VENCIMIENTO }
    )
    closeNew()
    router.refresh()
  }

  async function handleDelete(cert: CertEmpresa) {
    const n = cert.archivos?.length ?? 0
    const adjuntos = n > 0 ? ` y ${n === 1 ? 'su archivo adjunto' : `sus ${n} archivos adjuntos`}` : ''
    if (!confirm(`¿Eliminar ${art} ${etiqueta} "${cert.tipo?.nombre ?? cert.tipo_nombre_custom ?? ''}"${adjuntos}? No se puede deshacer.`)) return
    // .select() devuelve lo borrado: si la RLS no dejó borrar nada, no hay error
    // pero tampoco filas, y antes la fila desaparecía de la pantalla igual.
    const { data, error: err } = await supabase.from('certificados').delete().eq('id', cert.id).select('id')
    if (err || !data?.length) {
      toast.error(err ? mensajeError(err, 'eliminar') : `No se pudo eliminar: ${art} ${etiqueta} ya no existe o no tenés permiso.`)
      return
    }
    setCerts((prev) => prev.filter((c) => c.id !== cert.id))
    toast.success(etiqueta === 'programa' ? 'Programa eliminado' : 'Habilitación eliminada')
    router.refresh()
  }

  async function handleUploadArchivo(certId: string, files: File[]) {
    setUploadingCert(certId)
    const ok = await subirArchivosACertificado(files, certId, { empresaSlug }, (archivo) =>
      setCerts((prev) =>
        prev.map((c) => (c.id === certId ? { ...c, archivos: [...(c.archivos ?? []), archivo] } : c))
      )
    )
    setUploadingCert(null)
    if (ok > 0) router.refresh()
  }

  async function handleDeleteArchivo(certId: string, archivo: Archivo) {
    if (!confirm(`¿Eliminar el archivo "${archivo.nombre}"?`)) return
    if (!(await borrarArchivo(archivo.id))) return
    setCerts((prev) =>
      prev.map((c) =>
        c.id === certId ? { ...c, archivos: (c.archivos ?? []).filter((a) => a.id !== archivo.id) } : c
      )
    )
    router.refresh()
  }

  function campoAlerta(valor: string, onChange: (v: string) => void) {
    return (
      <div>
        <label className="block text-xs font-medium text-foreground mb-1">Alerta, días antes</label>
        <input
          type="number"
          inputMode="numeric"
          min={1}
          max={ALERTA_DIAS_MAX}
          value={valor}
          onChange={(e) => onChange(e.target.value)}
          className={inputCls}
        />
      </div>
    )
  }

  function campoVencimiento(valor: string, onChange: (v: string) => void) {
    return (
      <div>
        <label className="block text-xs font-medium text-foreground mb-1">Fecha de vencimiento</label>
        <input type="date" value={valor} onChange={(e) => onChange(e.target.value)} className={inputCls} />
        {!valor && <p className="mt-1 text-[11px] text-warning">{AVISO_SIN_VENCIMIENTO}</p>}
      </div>
    )
  }

  return (
    <div className="mb-8">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-base font-semibold text-foreground">{titulo}</h2>
        {canEdit && !showNewForm && (
          <button
            onClick={openNew}
            className="flex items-center gap-1.5 text-xs font-medium text-primary bg-primary/10 hover:bg-primary/20 px-3 py-1.5 rounded-lg transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Agregar
          </button>
        )}
      </div>

      {/* Formulario de nueva habilitación */}
      {showNewForm && canEdit && (
        <form
          ref={formRef}
          onSubmit={(e) => { e.preventDefault(); handleCreate() }}
          onKeyDown={escCancela(closeNew)}
          className="mb-3 rounded-xl border border-primary/30 bg-primary/5 p-4"
        >
          <p className="text-sm font-medium text-foreground mb-3">Nueva {etiqueta}</p>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div className="col-span-2">
              <label className="block text-xs font-medium text-foreground mb-1">Nombre *</label>
              <input
                type="text"
                value={newForm.nombre}
                onChange={(e) => setNewForm((f) => ({ ...f, nombre: e.target.value }))}
                className={inputCls}
                placeholder={placeholderNombre}
              />
            </div>
            {campoVencimiento(newForm.fecha_vencimiento, (v) => setNewForm((f) => ({ ...f, fecha_vencimiento: v })))}
            <div>
              <label className="block text-xs font-medium text-foreground mb-1">N° de documento</label>
              <input
                type="text"
                value={newForm.numero_documento}
                onChange={(e) => setNewForm((f) => ({ ...f, numero_documento: e.target.value }))}
                className={inputCls}
                placeholder="Resolución, acta, etc."
              />
            </div>
            {campoAlerta(newForm.alerta_dias, (v) => setNewForm((f) => ({ ...f, alerta_dias: v })))}
            <div>
              <label className="block text-xs font-medium text-foreground mb-1">Notas</label>
              <input
                type="text"
                value={newForm.notas}
                onChange={(e) => setNewForm((f) => ({ ...f, notas: e.target.value }))}
                className={inputCls}
                placeholder="Información adicional..."
              />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={savingNew}
              className="bg-primary hover:bg-primary/90 disabled:opacity-50 text-primary-foreground text-xs font-medium px-4 py-2 rounded-lg transition-colors"
            >
              {savingNew ? 'Guardando...' : `Agregar ${etiqueta}`}
            </button>
            <button
              type="button"
              onClick={closeNew}
              className="text-xs text-muted-foreground hover:text-foreground px-2 py-2"
            >
              Cancelar
            </button>
          </div>
        </form>
      )}

      {certs.length === 0 && !showNewForm && (
        <div className="rounded-xl border border-dashed border-border px-6 py-8 text-center text-sm text-muted-foreground">
          Sin {etiqueta === 'habilitación' ? 'habilitaciones' : 'programas'} registrados.{' '}
          {canEdit && (
            <button onClick={openNew} className="text-primary hover:underline">
              Agregar {etiqueta === 'programa' ? 'el primero' : 'la primera'}
            </button>
          )}
        </div>
      )}

      {certs.length > 0 && (
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          <div className="divide-y divide-border">
            {certs.map((cert) => {
              const estado = getEstadoVencimiento(cert.fecha_vencimiento, cert.alerta_dias ?? undefined)
              const isEditing = editingId === cert.id

              return (
                <div key={cert.id}>
                  {/* Fila principal */}
                  <div className="flex items-center gap-4 px-5 py-3.5">
                    <div className="flex-1">
                      <p className="text-sm font-medium text-foreground">
                        {cert.tipo?.nombre ?? cert.tipo_nombre_custom}
                      </p>
                      {cert.numero_documento && !isEditing && (
                        <p className="text-xs text-muted-foreground">{cert.numero_documento}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      {!isEditing && (
                        <EstadoPill
                          estado={estado}
                          label={cert.fecha_vencimiento
                            ? format(new Date(cert.fecha_vencimiento.slice(0, 10) + 'T12:00:00'), 'dd/MM/yyyy')
                            : undefined}
                        />
                      )}
                      {canEdit && !isEditing && (
                        <>
                          <button
                            onClick={() => openEdit(cert)}
                            className="text-xs text-muted-foreground hover:text-primary transition-colors"
                          >
                            Editar
                          </button>
                          <button
                            onClick={() => handleDelete(cert)}
                            className="text-xs text-muted-foreground hover:text-red-500 transition-colors"
                          >
                            Eliminar
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Formulario de edición inline */}
                  {isEditing && (
                    <form
                      ref={formRef}
                      onSubmit={(e) => { e.preventDefault(); handleSave(cert.id) }}
                      onKeyDown={escCancela(cancelEdit)}
                      className="border-t border-primary/20 bg-primary/5 px-5 py-4"
                    >
                      <div className="grid grid-cols-2 gap-3 mb-3">
                        {campoVencimiento(form.fecha_vencimiento, (v) => setForm((f) => ({ ...f, fecha_vencimiento: v })))}
                        <div>
                          <label className="block text-xs font-medium text-foreground mb-1">N° de documento</label>
                          <input
                            type="text"
                            value={form.numero_documento}
                            onChange={(e) => setForm((f) => ({ ...f, numero_documento: e.target.value }))}
                            className={inputCls}
                            placeholder="Resolución, acta, etc."
                          />
                        </div>
                        {campoAlerta(form.alerta_dias, (v) => setForm((f) => ({ ...f, alerta_dias: v })))}
                        <div>
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
                      <div className="flex items-center gap-3">
                        <button
                          type="submit"
                          disabled={saving}
                          className="bg-primary hover:bg-primary/90 disabled:opacity-50 text-primary-foreground text-xs font-medium px-4 py-2 rounded-lg transition-colors"
                        >
                          {saving ? 'Guardando...' : 'Guardar cambios'}
                        </button>
                        <button
                          type="button"
                          onClick={cancelEdit}
                          className="text-xs text-muted-foreground hover:text-foreground px-2 py-2"
                        >
                          Cancelar
                        </button>
                      </div>
                    </form>
                  )}

                  {/* Archivos adjuntos */}
                  <div className="border-t border-border px-5 py-2.5">
                    <div className="flex flex-wrap items-center gap-2">
                      {(cert.archivos ?? []).map((a) => (
                        <span
                          key={a.id}
                          className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-1 text-xs"
                        >
                          <button
                            type="button"
                            onClick={() => abrirArchivo(a.path)}
                            className="max-w-[160px] truncate text-left text-primary hover:underline"
                          >
                            {a.nombre}
                          </button>
                          {canEdit && (
                            <button
                              onClick={() => handleDeleteArchivo(cert.id, a)}
                              className="text-muted-foreground hover:text-red-500"
                              aria-label="Eliminar archivo"
                            >
                              ×
                            </button>
                          )}
                        </span>
                      ))}
                      {(cert.archivos ?? []).length === 0 && (
                        <span className="text-xs text-muted-foreground">Sin archivos</span>
                      )}
                      {canEdit && (
                        <label className="inline-flex cursor-pointer items-center rounded-md border border-input px-2 py-1 text-xs text-muted-foreground hover:bg-accent">
                          {uploadingCert === cert.id ? 'Subiendo…' : '+ Adjuntar'}
                          <input
                            type="file"
                            multiple
                            accept="application/pdf,image/*"
                            className="hidden"
                            disabled={uploadingCert === cert.id}
                            onChange={(e) => {
                              const files = Array.from(e.target.files ?? [])
                              // Vaciar el input: si no, volver a elegir el mismo archivo
                              // después de un error no dispara onChange.
                              e.target.value = ''
                              if (files.length) handleUploadArchivo(cert.id, files)
                            }}
                          />
                        </label>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
