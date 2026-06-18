'use client'

import { useState } from 'react'
import { format } from 'date-fns'
import { createClient } from '@/lib/supabase/client'
import { getEstadoVencimiento, ESTADO_COLORS } from '@/types'

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
  alerta_dias: number
  notas: string
}

const FORM_EMPTY: FormState = {
  nombre: '',
  fecha_vencimiento: '',
  numero_documento: '',
  alerta_dias: 30,
  notas: '',
}

interface Props {
  certs: CertEmpresa[]
  canEdit: boolean
  empresaSlug: string
  empresaId: string
}

export default function EmpresaCertsClient({ certs: initial, canEdit, empresaSlug, empresaId }: Props) {
  const supabase = createClient()
  const [certs, setCerts] = useState<CertEmpresa[]>(initial)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [showNewForm, setShowNewForm] = useState(false)
  const [form, setForm] = useState<FormState>(FORM_EMPTY)
  const [newForm, setNewForm] = useState<FormState>(FORM_EMPTY)
  const [saving, setSaving] = useState(false)
  const [savingNew, setSavingNew] = useState(false)
  const [error, setError] = useState('')
  const [errorNew, setErrorNew] = useState('')
  const [uploadingCert, setUploadingCert] = useState<string | null>(null)

  function openEdit(cert: CertEmpresa) {
    setForm({
      nombre: cert.tipo_nombre_custom ?? cert.tipo?.nombre ?? '',
      fecha_vencimiento: cert.fecha_vencimiento?.slice(0, 10) ?? '',
      numero_documento: cert.numero_documento ?? '',
      alerta_dias: cert.alerta_dias ?? 30,
      notas: cert.notas ?? '',
    })
    setEditingId(cert.id)
    setError('')
  }

  function cancelEdit() {
    setEditingId(null)
    setForm(FORM_EMPTY)
    setError('')
  }

  async function handleSave(certId: string) {
    setSaving(true)
    setError('')

    const { data, error: err } = await supabase
      .from('certificados')
      .update({
        fecha_vencimiento: form.fecha_vencimiento || null,
        numero_documento: form.numero_documento || null,
        alerta_dias: form.alerta_dias,
        notas: form.notas || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', certId)
      .select('*, tipo:tipos_certificado(nombre), archivos(id, nombre, path)')
      .single()

    if (err) {
      setError('No se pudo guardar.')
      setSaving(false)
      return
    }

    setCerts((prev) => prev.map((c) => (c.id === certId ? { ...data, archivos: c.archivos } : c)))
    setSaving(false)
    cancelEdit()
  }

  async function handleCreate() {
    if (!newForm.nombre.trim()) {
      setErrorNew('El nombre es requerido.')
      return
    }
    setSavingNew(true)
    setErrorNew('')

    const { data, error: err } = await supabase
      .from('certificados')
      .insert({
        empresa_id: empresaId,
        tipo_nombre_custom: newForm.nombre.trim(),
        fecha_vencimiento: newForm.fecha_vencimiento || null,
        numero_documento: newForm.numero_documento || null,
        alerta_dias: newForm.alerta_dias,
        notas: newForm.notas || null,
      })
      .select('*, tipo:tipos_certificado(nombre), archivos(id, nombre, path)')
      .single()

    if (err) {
      setErrorNew('No se pudo crear la habilitación.')
      setSavingNew(false)
      return
    }

    setCerts((prev) => [...prev, { ...data, archivos: [] }])
    setSavingNew(false)
    setNewForm(FORM_EMPTY)
    setShowNewForm(false)
  }

  async function handleDelete(certId: string) {
    if (!confirm('¿Eliminar esta habilitación?')) return
    const { error: err } = await supabase.from('certificados').delete().eq('id', certId)
    if (!err) setCerts((prev) => prev.filter((c) => c.id !== certId))
  }

  async function verArchivo(path: string) {
    const res = await fetch(`/api/archivo?path=${encodeURIComponent(path)}`)
    if (res.ok) {
      const { url } = await res.json()
      if (url) window.open(url, '_blank')
    } else {
      alert('No se pudo abrir el archivo.')
    }
  }

  async function handleUploadArchivo(certId: string, files: FileList) {
    setUploadingCert(certId)
    for (const file of Array.from(files)) {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('certId', certId)
      fd.append('empresaSlug', empresaSlug)
      const res = await fetch('/api/upload', { method: 'POST', body: fd })
      if (res.ok) {
        const { archivo } = await res.json()
        if (archivo) {
          setCerts((prev) =>
            prev.map((c) =>
              c.id === certId ? { ...c, archivos: [...(c.archivos ?? []), archivo] } : c
            )
          )
        }
      } else {
        const payload = await res.json().catch(() => null)
        alert(payload?.error ?? 'No se pudo subir el archivo.')
      }
    }
    setUploadingCert(null)
  }

  async function handleDeleteArchivo(certId: string, archivoId: string) {
    if (!confirm('¿Eliminar este archivo?')) return
    const res = await fetch(`/api/archivo?id=${archivoId}`, { method: 'DELETE' })
    if (res.ok) {
      setCerts((prev) =>
        prev.map((c) =>
          c.id === certId
            ? { ...c, archivos: (c.archivos ?? []).filter((a) => a.id !== archivoId) }
            : c
        )
      )
    }
  }

  return (
    <div className="mb-8">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-base font-semibold text-foreground">Habilitaciones de empresa</h2>
        {canEdit && !showNewForm && (
          <button
            onClick={() => { setShowNewForm(true); setNewForm(FORM_EMPTY); setErrorNew('') }}
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
        <div className="mb-3 rounded-xl border border-primary/30 bg-primary/5 p-4">
          <p className="text-sm font-medium text-foreground mb-3">Nueva habilitación</p>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div className="col-span-2">
              <label className="block text-xs font-medium text-foreground mb-1">Nombre *</label>
              <input
                type="text"
                value={newForm.nombre}
                onChange={(e) => setNewForm((f) => ({ ...f, nombre: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg border border-input text-sm focus:outline-none focus:ring-2 focus:ring-ring bg-card"
                placeholder="Ej: Registro de Inscripción Santa Fe"
                autoFocus
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-foreground mb-1">Fecha de vencimiento</label>
              <input
                type="date"
                value={newForm.fecha_vencimiento}
                onChange={(e) => setNewForm((f) => ({ ...f, fecha_vencimiento: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg border border-input text-sm focus:outline-none focus:ring-2 focus:ring-ring bg-card"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-foreground mb-1">N° de documento</label>
              <input
                type="text"
                value={newForm.numero_documento}
                onChange={(e) => setNewForm((f) => ({ ...f, numero_documento: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg border border-input text-sm focus:outline-none focus:ring-2 focus:ring-ring bg-card"
                placeholder="Resolución, acta, etc."
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-foreground mb-1">Alerta, días antes</label>
              <input
                type="number"
                min={1}
                max={365}
                value={newForm.alerta_dias}
                onChange={(e) => setNewForm((f) => ({ ...f, alerta_dias: parseInt(e.target.value) || 30 }))}
                className="w-full px-3 py-2 rounded-lg border border-input text-sm focus:outline-none focus:ring-2 focus:ring-ring bg-card"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-foreground mb-1">Notas</label>
              <input
                type="text"
                value={newForm.notas}
                onChange={(e) => setNewForm((f) => ({ ...f, notas: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg border border-input text-sm focus:outline-none focus:ring-2 focus:ring-ring bg-card"
                placeholder="Información adicional..."
              />
            </div>
          </div>
          {errorNew && <p className="text-xs text-red-500 mb-2">{errorNew}</p>}
          <div className="flex items-center gap-3">
            <button
              onClick={handleCreate}
              disabled={savingNew}
              className="bg-primary hover:brightness-110 disabled:opacity-50 text-white text-xs font-medium px-4 py-2 rounded-lg transition-colors"
            >
              {savingNew ? 'Guardando...' : 'Agregar habilitación'}
            </button>
            <button
              onClick={() => { setShowNewForm(false); setNewForm(FORM_EMPTY); setErrorNew('') }}
              className="text-xs text-muted-foreground hover:text-foreground px-2 py-2"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {certs.length === 0 && !showNewForm && (
        <div className="rounded-xl border border-dashed border-border px-6 py-8 text-center text-sm text-muted-foreground">
          Sin habilitaciones registradas.{' '}
          {canEdit && (
            <button
              onClick={() => { setShowNewForm(true); setNewForm(FORM_EMPTY) }}
              className="text-primary hover:underline"
            >
              Agregar la primera
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
                        <span
                          className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${ESTADO_COLORS[estado]}`}
                        >
                          {cert.fecha_vencimiento
                            ? format(new Date(cert.fecha_vencimiento + 'T12:00:00'), 'dd/MM/yyyy')
                            : '—'}
                        </span>
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
                            onClick={() => handleDelete(cert.id)}
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
                    <div className="border-t border-primary/20 bg-primary/5 px-5 py-4">
                      <div className="grid grid-cols-2 gap-3 mb-3">
                        <div>
                          <label className="block text-xs font-medium text-foreground mb-1">Fecha de vencimiento</label>
                          <input
                            type="date"
                            value={form.fecha_vencimiento}
                            onChange={(e) => setForm((f) => ({ ...f, fecha_vencimiento: e.target.value }))}
                            className="w-full px-3 py-2 rounded-lg border border-input text-sm focus:outline-none focus:ring-2 focus:ring-ring bg-card"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-foreground mb-1">N° de documento</label>
                          <input
                            type="text"
                            value={form.numero_documento}
                            onChange={(e) => setForm((f) => ({ ...f, numero_documento: e.target.value }))}
                            className="w-full px-3 py-2 rounded-lg border border-input text-sm focus:outline-none focus:ring-2 focus:ring-ring bg-card"
                            placeholder="Resolución, acta, etc."
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-foreground mb-1">Alerta, días antes</label>
                          <input
                            type="number"
                            min={1}
                            max={365}
                            value={form.alerta_dias}
                            onChange={(e) => setForm((f) => ({ ...f, alerta_dias: parseInt(e.target.value) || 30 }))}
                            className="w-full px-3 py-2 rounded-lg border border-input text-sm focus:outline-none focus:ring-2 focus:ring-ring bg-card"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-foreground mb-1">Notas</label>
                          <input
                            type="text"
                            value={form.notas}
                            onChange={(e) => setForm((f) => ({ ...f, notas: e.target.value }))}
                            className="w-full px-3 py-2 rounded-lg border border-input text-sm focus:outline-none focus:ring-2 focus:ring-ring bg-card"
                            placeholder="Información adicional..."
                          />
                        </div>
                      </div>
                      {error && <p className="text-xs text-red-500 mb-2">{error}</p>}
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => handleSave(cert.id)}
                          disabled={saving}
                          className="bg-primary hover:brightness-110 disabled:opacity-50 text-white text-xs font-medium px-4 py-2 rounded-lg transition-colors"
                        >
                          {saving ? 'Guardando...' : 'Guardar cambios'}
                        </button>
                        <button
                          onClick={cancelEdit}
                          className="text-xs text-muted-foreground hover:text-foreground px-2 py-2"
                        >
                          Cancelar
                        </button>
                      </div>
                    </div>
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
                            onClick={() => verArchivo(a.path)}
                            className="max-w-[160px] truncate text-left text-primary hover:underline"
                          >
                            {a.nombre}
                          </button>
                          {canEdit && (
                            <button
                              onClick={() => handleDeleteArchivo(cert.id, a.id)}
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
                            accept="application/pdf,image/*"
                            className="hidden"
                            disabled={uploadingCert === cert.id}
                            onChange={(e) => {
                              if (e.target.files?.length) handleUploadArchivo(cert.id, e.target.files)
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
