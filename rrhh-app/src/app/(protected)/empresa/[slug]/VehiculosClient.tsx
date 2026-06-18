'use client'

import { useState } from 'react'
import { format } from 'date-fns'
import { createClient } from '@/lib/supabase/client'
import { getEstadoVencimiento, ESTADO_COLORS, ESTADO_LABELS } from '@/types'
import type { Vehiculo, TipoCertificado } from '@/types'
import clsx from 'clsx'

interface CertVehiculo {
  id: string
  tipo_id?: string | null
  tipo_nombre_custom?: string | null
  fecha_vencimiento?: string | null
  notas?: string | null
  alerta_dias: number | null
  tipo?: { nombre: string } | null
  archivos?: { id: string; nombre: string; path: string }[]
}

interface VehiculoConCerts extends Vehiculo {
  certificados: CertVehiculo[]
}

interface Props {
  vehiculos: VehiculoConCerts[]
  tiposCertificado: TipoCertificado[]
  canEdit: boolean
  empresaSlug: string
}

const FORM_EMPTY = {
  tipo_id: '',
  tipo_nombre_custom: '',
  fecha_vencimiento: '',
  notas: '',
  alerta_dias: 30,
}

export default function VehiculosClient({
  vehiculos: initVehiculos,
  tiposCertificado,
  canEdit,
  empresaSlug,
}: Props) {
  const supabase = createClient()
  const [vehiculos, setVehiculos] = useState(initVehiculos)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [editingCert, setEditingCert] = useState<string | null>(null)
  const [addingTo, setAddingTo] = useState<string | null>(null)
  const [form, setForm] = useState(FORM_EMPTY)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [uploadingCert, setUploadingCert] = useState<string | null>(null)

  function openAdd(vehiculoId: string) {
    setForm(FORM_EMPTY)
    setEditingCert(null)
    setAddingTo(vehiculoId)
    setExpandedId(vehiculoId)
  }

  function openEdit(cert: CertVehiculo) {
    setForm({
      tipo_id: cert.tipo_id ?? '',
      tipo_nombre_custom: cert.tipo_nombre_custom ?? '',
      fecha_vencimiento: cert.fecha_vencimiento?.slice(0, 10) ?? '',
      notas: cert.notas ?? '',
      alerta_dias: cert.alerta_dias ?? 30,
    })
    setEditingCert(cert.id)
    setAddingTo(null)
  }

  async function handleSave(vehiculoId: string) {
    setSaving(true)
    setError('')

    const payload = {
      vehiculo_id: vehiculoId,
      tipo_id: form.tipo_id || null,
      tipo_nombre_custom: form.tipo_id === 'otro' ? form.tipo_nombre_custom : null,
      fecha_vencimiento: form.fecha_vencimiento || null,
      notas: form.notas || null,
      alerta_dias: form.alerta_dias,
    }

    if (editingCert) {
      const { data, error: err } = await supabase
        .from('certificados')
        .update({ ...payload, updated_at: new Date().toISOString() })
        .eq('id', editingCert)
        .select('*, tipo:tipos_certificado(nombre)')
        .single()

      if (err) {
        setError('Error al guardar')
        setSaving(false)
        return
      }

      setVehiculos((prev) =>
        prev.map((v) =>
          v.id === vehiculoId
            ? {
                ...v,
                certificados: v.certificados.map((c) => (c.id === editingCert ? data : c)),
              }
            : v
        )
      )
      setEditingCert(null)
    } else {
      const { data, error: err } = await supabase
        .from('certificados')
        .insert(payload)
        .select('*, tipo:tipos_certificado(nombre)')
        .single()

      if (err) {
        setError('Error al guardar')
        setSaving(false)
        return
      }

      setVehiculos((prev) =>
        prev.map((v) =>
          v.id === vehiculoId ? { ...v, certificados: [...v.certificados, data] } : v
        )
      )
      setAddingTo(null)
    }

    setForm(FORM_EMPTY)
    setSaving(false)
  }

  async function handleDelete(vehiculoId: string, certId: string) {
    if (!confirm('¿Eliminar este certificado?')) return

    const { error: err } = await supabase.from('certificados').delete().eq('id', certId)

    if (err) {
      setError('Error al eliminar')
      return
    }

    setVehiculos((prev) =>
      prev.map((v) =>
        v.id === vehiculoId
          ? { ...v, certificados: v.certificados.filter((c) => c.id !== certId) }
          : v
      )
    )
  }

  async function handleUploadArchivo(vehiculoId: string, certId: string, files: FileList) {
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
          setVehiculos((prev) =>
            prev.map((v) =>
              v.id === vehiculoId
                ? { ...v, certificados: v.certificados.map((c) => (c.id === certId ? { ...c, archivos: [...(c.archivos ?? []), archivo] } : c)) }
                : v
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

  async function verArchivo(path: string) {
    const res = await fetch(`/api/archivo?path=${encodeURIComponent(path)}`)
    if (res.ok) {
      const { url } = await res.json()
      if (url) window.open(url, '_blank')
    } else {
      alert('No se pudo abrir el archivo.')
    }
  }

  async function handleDeleteArchivo(vehiculoId: string, certId: string, archivoId: string) {
    if (!confirm('¿Eliminar este archivo?')) return
    const res = await fetch(`/api/archivo?id=${archivoId}`, { method: 'DELETE' })
    if (res.ok) {
      setVehiculos((prev) =>
        prev.map((v) =>
          v.id === vehiculoId
            ? { ...v, certificados: v.certificados.map((c) => (c.id === certId ? { ...c, archivos: (c.archivos ?? []).filter((a) => a.id !== archivoId) } : c)) }
            : v
        )
      )
    } else {
      alert('No se pudo eliminar el archivo.')
    }
  }

  if (vehiculos.length === 0) return null

  return (
    <div className="mb-8">
      <h2 className="text-base font-semibold text-foreground mb-3">Vehículos</h2>

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
              vencido: 'bg-red-500',
              proximo: 'bg-amber-400',
              vigente: 'bg-green-500',
              sin_fecha: 'bg-slate-600',
            }[worstEstado] ?? 'bg-slate-600'

          return (
            <div key={veh.id} className="bg-card rounded-xl border border-border overflow-hidden">
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
                          {isEditing ? (
                            <div className="p-4">{renderForm(veh.id, true)}</div>
                          ) : (
                            <div className="flex items-center gap-3 px-4 py-3">
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-foreground">
                                  {cert.tipo?.nombre ?? cert.tipo_nombre_custom ?? 'Sin tipo'}
                                </p>
                                {cert.notas && (
                                  <p className="text-xs text-muted-foreground mt-0.5 truncate">{cert.notas}</p>
                                )}
                              </div>

                              <span
                                className={clsx(
                                  'inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border shrink-0',
                                  ESTADO_COLORS[estado]
                                )}
                              >
                                {cert.fecha_vencimiento
                                  ? format(new Date(cert.fecha_vencimiento + 'T12:00:00'), 'dd/MM/yyyy')
                                  : ESTADO_LABELS[estado]}
                              </span>

                              {canEdit && (
                                <div className="flex items-center gap-2 shrink-0">
                                  <button
                                    onClick={() => openEdit(cert)}
                                    className="text-xs text-muted-foreground hover:text-primary transition-colors"
                                  >
                                    Editar
                                  </button>
                                  <button
                                    onClick={() => handleDelete(veh.id, cert.id)}
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
                                    <button type="button" onClick={() => verArchivo(a.path)} className="max-w-[160px] truncate text-left text-primary hover:underline">{a.nombre}</button>
                                    {canEdit && (
                                      <button onClick={() => handleDeleteArchivo(veh.id, cert.id, a.id)} className="text-muted-foreground hover:text-red-500" aria-label="Eliminar archivo">×</button>
                                    )}
                                  </span>
                                ))}
                                {(cert.archivos ?? []).length === 0 && (
                                  <span className="text-xs text-muted-foreground">Sin archivos</span>
                                )}
                                {canEdit && (
                                  <label className="inline-flex cursor-pointer items-center rounded-md border border-input px-2 py-1 text-xs text-muted-foreground hover:bg-accent">
                                    {uploadingCert === cert.id ? 'Subiendo…' : '+ Adjuntar'}
                                    <input type="file" accept="application/pdf,image/*" className="hidden" disabled={uploadingCert === cert.id}
                                      onChange={(e) => { if (e.target.files?.length) handleUploadArchivo(veh.id, cert.id, e.target.files) }} />
                                  </label>
                                )}
                              </div>
                            </div>
                          )}

                          {isEditing && (
                            <div className="px-4 pb-4">
                              {renderFormFields()}
                              <div className="flex gap-2 mt-3">
                                <button
                                  onClick={() => handleSave(veh.id)}
                                  disabled={saving || !form.tipo_id}
                                  className="bg-primary hover:brightness-110 disabled:opacity-50 text-white text-xs font-medium px-4 py-2 rounded-lg"
                                >
                                  {saving ? 'Guardando...' : 'Guardar'}
                                </button>
                                <button
                                  onClick={() => {
                                    setEditingCert(null)
                                    setForm(FORM_EMPTY)
                                  }}
                                  className="text-xs text-muted-foreground px-3 py-2"
                                >
                                  Cancelar
                                </button>
                              </div>
                              {error && <p className="text-xs text-red-500 mt-2">{error}</p>}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>

                  {isAddingHere && canEdit && (
                    <div className="bg-card rounded-lg border border-primary/30 p-4">
                      <p className="text-sm font-medium text-foreground mb-3">Nuevo certificado</p>
                      {renderFormFields()}
                      <div className="flex gap-2 mt-3">
                        <button
                          onClick={() => handleSave(veh.id)}
                          disabled={saving || !form.tipo_id}
                          className="bg-primary hover:brightness-110 disabled:opacity-50 text-white text-xs font-medium px-4 py-2 rounded-lg"
                        >
                          {saving ? 'Guardando...' : 'Agregar'}
                        </button>
                        <button
                          onClick={() => {
                            setAddingTo(null)
                            setForm(FORM_EMPTY)
                          }}
                          className="text-xs text-muted-foreground px-3 py-2"
                        >
                          Cancelar
                        </button>
                      </div>
                      {error && <p className="text-xs text-red-500 mt-2">{error}</p>}
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

  function renderFormFields() {
    return (
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <label className="block text-xs font-medium text-foreground mb-1">Tipo de certificado</label>
          <select
            value={form.tipo_id}
            onChange={(e) => setForm((f) => ({ ...f, tipo_id: e.target.value }))}
            className="w-full px-3 py-2 rounded-lg border border-input text-sm focus:outline-none focus:ring-2 focus:ring-ring"
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
              className="w-full px-3 py-2 rounded-lg border border-input text-sm focus:outline-none focus:ring-2 focus:ring-ring"
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
            className="w-full px-3 py-2 rounded-lg border border-input text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-foreground mb-1">Alerta, días antes</label>
          <input
            type="number"
            min={1}
            max={365}
            value={form.alerta_dias}
            onChange={(e) =>
              setForm((f) => ({ ...f, alerta_dias: parseInt(e.target.value) || 30 }))
            }
            className="w-full px-3 py-2 rounded-lg border border-input text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        <div className="col-span-2">
          <label className="block text-xs font-medium text-foreground mb-1">Notas</label>
          <input
            type="text"
            value={form.notas}
            onChange={(e) => setForm((f) => ({ ...f, notas: e.target.value }))}
            className="w-full px-3 py-2 rounded-lg border border-input text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            placeholder="Información adicional..."
          />
        </div>
      </div>
    )
  }

  function renderForm(_vehiculoId: string, _editing: boolean) {
    return null
  }
}
