'use client'

import { useState } from 'react'
import { format } from 'date-fns'
import { createClient } from '@/lib/supabase/client'
import { getEstadoVencimiento, ESTADO_COLORS, ESTADO_LABELS } from '@/types'
import type { Vehiculo, TipoCertificado } from '@/types'
import clsx from 'clsx'

interface CertVehiculo {
  id: string
  tipo_id?: string
  tipo_nombre_custom?: string
  fecha_vencimiento?: string
  notas?: string
  alerta_dias: number
  tipo?: { nombre: string }
}

interface VehiculoConCerts extends Vehiculo {
  certificados: CertVehiculo[]
}

interface Props {
  vehiculos: VehiculoConCerts[]
  tiposCertificado: TipoCertificado[]
  canEdit: boolean
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
}: Props) {
  const supabase = createClient()
  const [vehiculos, setVehiculos] = useState(initVehiculos)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [editingCert, setEditingCert] = useState<string | null>(null)
  const [addingTo, setAddingTo] = useState<string | null>(null)
  const [form, setForm] = useState(FORM_EMPTY)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

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
      fecha_vencimiento: cert.fecha_vencimiento ?? '',
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

  if (vehiculos.length === 0) return null

  return (
    <div className="mb-8">
      <h2 className="text-base font-semibold text-gray-800 mb-3">Vehículos</h2>

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
              sin_fecha: 'bg-gray-300',
            }[worstEstado] ?? 'bg-gray-300'

          return (
            <div key={veh.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div
                className="flex items-center gap-4 px-5 py-4 cursor-pointer hover:bg-gray-50 transition-colors"
                onClick={() => setExpandedId(isOpen ? null : veh.id)}
              >
                <span className={clsx('w-2 h-2 rounded-full shrink-0', estadoColor)} />
                <div className="flex-1">
                  <p className="font-mono font-semibold text-gray-900">{veh.patente}</p>
                  {veh.descripcion && <p className="text-xs text-gray-400">{veh.descripcion}</p>}
                </div>

                <div className="flex items-center gap-3">
                  <span className="text-xs text-gray-400">
                    {veh.certificados.length} certificado
                    {veh.certificados.length !== 1 ? 's' : ''}
                  </span>

                  {canEdit && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        openAdd(veh.id)
                      }}
                      className="text-xs font-medium text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 px-2.5 py-1 rounded-lg transition-colors"
                    >
                      + Agregar
                    </button>
                  )}

                  <svg
                    className={clsx('w-4 h-4 text-gray-400 transition-transform', isOpen && 'rotate-180')}
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
                <div className="border-t border-gray-100 bg-gray-50 px-5 py-4">
                  <div className="space-y-2 mb-4">
                    {veh.certificados.length === 0 && (
                      <p className="text-xs text-gray-400 py-2">Sin certificados. Agregá el primero.</p>
                    )}

                    {veh.certificados.map((cert) => {
                      const estado = getEstadoVencimiento(cert.fecha_vencimiento, cert.alerta_dias)
                      const isEditing = editingCert === cert.id

                      return (
                        <div key={cert.id} className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                          {isEditing ? (
                            <div className="p-4">{renderForm(veh.id, true)}</div>
                          ) : (
                            <div className="flex items-center gap-3 px-4 py-3">
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-gray-900">
                                  {cert.tipo?.nombre ?? cert.tipo_nombre_custom ?? 'Sin tipo'}
                                </p>
                                {cert.notas && (
                                  <p className="text-xs text-gray-400 mt-0.5 truncate">{cert.notas}</p>
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
                                    className="text-xs text-gray-400 hover:text-indigo-600 transition-colors"
                                  >
                                    Editar
                                  </button>
                                  <button
                                    onClick={() => handleDelete(veh.id, cert.id)}
                                    className="text-xs text-gray-400 hover:text-red-500 transition-colors"
                                  >
                                    Eliminar
                                  </button>
                                </div>
                              )}
                            </div>
                          )}

                          {isEditing && (
                            <div className="px-4 pb-4">
                              {renderFormFields()}
                              <div className="flex gap-2 mt-3">
                                <button
                                  onClick={() => handleSave(veh.id)}
                                  disabled={saving || !form.tipo_id}
                                  className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-medium px-4 py-2 rounded-lg"
                                >
                                  {saving ? 'Guardando...' : 'Guardar'}
                                </button>
                                <button
                                  onClick={() => {
                                    setEditingCert(null)
                                    setForm(FORM_EMPTY)
                                  }}
                                  className="text-xs text-gray-500 px-3 py-2"
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
                    <div className="bg-white rounded-lg border border-indigo-200 p-4">
                      <p className="text-sm font-medium text-gray-900 mb-3">Nuevo certificado</p>
                      {renderFormFields()}
                      <div className="flex gap-2 mt-3">
                        <button
                          onClick={() => handleSave(veh.id)}
                          disabled={saving || !form.tipo_id}
                          className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-medium px-4 py-2 rounded-lg"
                        >
                          {saving ? 'Guardando...' : 'Agregar'}
                        </button>
                        <button
                          onClick={() => {
                            setAddingTo(null)
                            setForm(FORM_EMPTY)
                          }}
                          className="text-xs text-gray-500 px-3 py-2"
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
          <label className="block text-xs font-medium text-gray-700 mb-1">Tipo de certificado</label>
          <select
            value={form.tipo_id}
            onChange={(e) => setForm((f) => ({ ...f, tipo_id: e.target.value }))}
            className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
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
            <label className="block text-xs font-medium text-gray-700 mb-1">Nombre del certificado</label>
            <input
              type="text"
              value={form.tipo_nombre_custom}
              onChange={(e) => setForm((f) => ({ ...f, tipo_nombre_custom: e.target.value }))}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="Ej: Matafuegos CO2"
            />
          </div>
        )}

        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Vencimiento</label>
          <input
            type="date"
            value={form.fecha_vencimiento}
            onChange={(e) => setForm((f) => ({ ...f, fecha_vencimiento: e.target.value }))}
            className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Alerta, días antes</label>
          <input
            type="number"
            min={1}
            max={365}
            value={form.alerta_dias}
            onChange={(e) =>
              setForm((f) => ({ ...f, alerta_dias: parseInt(e.target.value) || 30 }))
            }
            className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <div className="col-span-2">
          <label className="block text-xs font-medium text-gray-700 mb-1">Notas</label>
          <input
            type="text"
            value={form.notas}
            onChange={(e) => setForm((f) => ({ ...f, notas: e.target.value }))}
            className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
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
