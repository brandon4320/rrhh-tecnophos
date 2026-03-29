'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { format } from 'date-fns'
import { createClient } from '@/lib/supabase/client'
import { getEstadoVencimiento, ESTADO_COLORS, ESTADO_LABELS } from '@/types'
import type { Empleado, Certificado, TipoCertificado, Empresa } from '@/types'
import clsx from 'clsx'

const EMPRESA_COLORS: Record<string, string> = {
  'tecnophos-bb': 'bg-indigo-500',
  'tecnophos-rosario': 'bg-sky-500',
  'tecnophos-necochea': 'bg-emerald-500',
  adc: 'bg-amber-500',
}

interface Props {
  empleado: Empleado & { empresa: any }
  certificados: (Certificado & { tipo: any; archivos: any[] })[]
  tiposCertificado: TipoCertificado[]
  empresas: Empresa[]
  canManageEmployees: boolean
  canManageCertificates: boolean
}

export default function LegajoClient({
  empleado,
  certificados: initCerts,
  tiposCertificado,
  empresas,
  canManageEmployees,
  canManageCertificates,
}: Props) {
  const supabase = createClient()
  const router = useRouter()
  const [certs, setCerts] = useState(initCerts)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState<string | null>(null)
  const [activeCertId, setActiveCertId] = useState<string | null>(null)
  const [editingEmpleado, setEditingEmpleado] = useState(false)
  const [savingEmpleado, setSavingEmpleado] = useState(false)
  const [empleadoData, setEmpleadoData] = useState({
    nombre: empleado.nombre ?? '',
    apellido: empleado.apellido ?? '',
    empresa_id: empleado.empresa_id ?? '',
    sector: empleado.sector ?? '',
  })

  const [form, setForm] = useState({
    tipo_id: '',
    tipo_nombre_custom: '',
    fecha_vencimiento: '',
    fecha_emision: '',
    numero_documento: '',
    notas: '',
    alerta_dias: 30,
  })

  const nombreCompleto = useMemo(() => {
    return [empleadoData.nombre, empleadoData.apellido].filter(Boolean).join(' ')
  }, [empleadoData])

  function resetForm() {
    setForm({ tipo_id: '', tipo_nombre_custom: '', fecha_vencimiento: '', fecha_emision: '', numero_documento: '', notas: '', alerta_dias: 30 })
    setShowForm(false)
    setEditingId(null)
  }

  function openEdit(cert: any) {
    setForm({
      tipo_id: cert.tipo_id ?? '',
      tipo_nombre_custom: cert.tipo_nombre_custom ?? '',
      fecha_vencimiento: cert.fecha_vencimiento ?? '',
      fecha_emision: cert.fecha_emision ?? '',
      numero_documento: cert.numero_documento ?? '',
      notas: cert.notas ?? '',
      alerta_dias: cert.alerta_dias ?? 30,
    })
    setEditingId(cert.id)
    setShowForm(true)
    setTimeout(() => document.getElementById('cert-form')?.scrollIntoView({ behavior: 'smooth' }), 100)
  }

  async function handleSave() {
    setSaving(true)
    const payload = {
      empleado_id: empleado.id,
      tipo_id: form.tipo_id || null,
      tipo_nombre_custom: form.tipo_id === 'otro' ? form.tipo_nombre_custom : null,
      fecha_vencimiento: form.fecha_vencimiento || null,
      fecha_emision: form.fecha_emision || null,
      numero_documento: form.numero_documento || null,
      notas: form.notas || null,
      alerta_dias: form.alerta_dias,
    }

    if (editingId) {
      const { data, error } = await supabase
        .from('certificados')
        .update({ ...payload, updated_at: new Date().toISOString() })
        .eq('id', editingId)
        .select('*, tipo:tipos_certificado(nombre, orden), archivos(*)')
        .single()

      if (!error && data) {
        setCerts((prev) => prev.map((c) => (c.id === editingId ? { ...data, archivos: c.archivos } : c)))
      }
    } else {
      const { data, error } = await supabase
        .from('certificados')
        .insert(payload)
        .select('*, tipo:tipos_certificado(nombre, orden), archivos(*)')
        .single()

      if (!error && data) {
        setCerts((prev) => [...prev, { ...data, archivos: [] }])
      }
    }

    setSaving(false)
    resetForm()
  }

  async function handleDelete(certId: string) {
    if (!confirm('¿Eliminar este certificado?')) return
    await supabase.from('certificados').delete().eq('id', certId)
    setCerts((prev) => prev.filter((c) => c.id !== certId))
  }

  async function handleSaveEmpleado() {
    if (!empleadoData.nombre.trim() || !empleadoData.empresa_id) {
      alert('Completá al menos nombre y empresa.')
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
      alert('No se pudo actualizar el empleado.')
      return
    }

    setEditingEmpleado(false)
    router.refresh()
  }

  async function handleDeleteEmpleado() {
    if (!confirm('¿Eliminar este empleado? Esta acción desactiva el legajo actual.')) return

    const { error } = await supabase
      .from('empleados')
      .update({ activo: false, updated_at: new Date().toISOString() })
      .eq('id', empleado.id)

    if (error) {
      alert('No se pudo eliminar el empleado.')
      return
    }

    router.push('/empleados')
    router.refresh()
  }

  async function handleFileUpload(certId: string, files: FileList) {
    setUploading(certId)
    for (const file of Array.from(files)) {
      const ext = file.name.split('.').pop()
      const path = `${empleado.empresa.slug}/${empleado.id}/${certId}/${Date.now()}.${ext}`

      const { error: uploadError } = await supabase.storage.from('certificados').upload(path, file)

      if (!uploadError) {
        const { data: archivo } = await supabase
          .from('archivos')
          .insert({ certificado_id: certId, nombre: file.name, path, mime_type: file.type, size_bytes: file.size })
          .select()
          .single()

        if (archivo) {
          const { data: signed } = await supabase.storage.from('certificados').createSignedUrl(path, 3600)
          setCerts((prev) =>
            prev.map((c) =>
              c.id === certId ? { ...c, archivos: [...c.archivos, { ...archivo, url: signed?.signedUrl }] } : c
            )
          )
        }
      }
    }
    setUploading(null)
  }

  async function handleDeleteArchivo(certId: string, archivoId: string, path: string) {
    if (!confirm('¿Eliminar este archivo?')) return
    await supabase.storage.from('certificados').remove([path])
    await supabase.from('archivos').delete().eq('id', archivoId)
    setCerts((prev) =>
      prev.map((c) => (c.id === certId ? { ...c, archivos: c.archivos.filter((a: any) => a.id !== archivoId) } : c))
    )
  }

  const slug = empleado.empresa?.slug ?? ''
  const vencidos = certs.filter((c) => getEstadoVencimiento(c.fecha_vencimiento) === 'vencido').length
  const proximos = certs.filter((c) => getEstadoVencimiento(c.fecha_vencimiento) === 'proximo').length

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="flex items-center gap-2 text-sm text-gray-400 mb-6">
        <Link href={`/empresa/${slug}`} className="hover:text-gray-600 transition-colors">
          {empleado.empresa?.nombre}
        </Link>
        <span>/</span>
        <span className="text-gray-700 font-medium">{nombreCompleto}</span>
      </div>

      <div className="flex items-start justify-between mb-8 gap-4">
        <div className="flex items-center gap-4">
          <div className={clsx('w-12 h-12 rounded-xl flex items-center justify-center text-white font-semibold text-lg', EMPRESA_COLORS[slug] ?? 'bg-gray-400')}>
            {(nombreCompleto || 'E')[0].toUpperCase()}
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">{nombreCompleto}</h1>
            <div className="flex items-center gap-3 mt-1 flex-wrap">
              <span className="text-sm text-gray-500">{empleado.empresa?.nombre}</span>
              {empleadoData.sector && (
                <>
                  <span className="text-gray-300">·</span>
                  <span className="text-sm text-gray-500">{empleadoData.sector}</span>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 flex-wrap justify-end">
          {vencidos > 0 && (
            <span className="flex items-center gap-1.5 text-sm font-medium text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
              {vencidos} vencido{vencidos > 1 ? 's' : ''}
            </span>
          )}
          {proximos > 0 && (
            <span className="flex items-center gap-1.5 text-sm font-medium text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
              {proximos} por vencer
            </span>
          )}
          {canManageEmployees && (
            <>
              <button
                onClick={() => setEditingEmpleado((prev) => !prev)}
                className="flex items-center gap-2 border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 text-sm font-medium px-4 py-2 rounded-lg transition-colors"
              >
                Editar empleado
              </button>
              <button
                onClick={handleDeleteEmpleado}
                className="flex items-center gap-2 border border-red-200 bg-red-50 hover:bg-red-100 text-red-600 text-sm font-medium px-4 py-2 rounded-lg transition-colors"
              >
                Eliminar empleado
              </button>
            </>
          )}
          {canManageCertificates && (
            <button
              onClick={() => {
                resetForm()
                setShowForm(true)
              }}
              className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              Agregar certificado
            </button>
          )}
        </div>
      </div>

      {canManageEmployees && editingEmpleado && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-8">
          <h3 className="font-semibold text-gray-900 mb-5">Editar empleado</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Nombre</label>
              <input type="text" value={empleadoData.nombre} onChange={(e) => setEmpleadoData((prev) => ({ ...prev, nombre: e.target.value }))} className="w-full px-3.5 py-2.5 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Apellido</label>
              <input type="text" value={empleadoData.apellido} onChange={(e) => setEmpleadoData((prev) => ({ ...prev, apellido: e.target.value }))} className="w-full px-3.5 py-2.5 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Empresa</label>
              <select value={empleadoData.empresa_id} onChange={(e) => setEmpleadoData((prev) => ({ ...prev, empresa_id: e.target.value }))} className="w-full px-3.5 py-2.5 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                {empresas.map((empresaItem) => (
                  <option key={empresaItem.id} value={empresaItem.id}>
                    {empresaItem.nombre}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Sector</label>
              <input type="text" value={empleadoData.sector} onChange={(e) => setEmpleadoData((prev) => ({ ...prev, sector: e.target.value }))} className="w-full px-3.5 py-2.5 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={handleSaveEmpleado} disabled={savingEmpleado} className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-medium px-5 py-2.5 rounded-lg transition-colors">
              {savingEmpleado ? 'Guardando...' : 'Guardar cambios'}
            </button>
            <button onClick={() => setEditingEmpleado(false)} className="text-sm text-gray-500 hover:text-gray-700 px-3 py-2.5">
              Cancelar
            </button>
          </div>
        </div>
      )}

      <div className="space-y-3 mb-8">
        {certs.length === 0 && <div className="text-center py-12 text-gray-400 text-sm bg-white rounded-xl border border-gray-200">Sin certificados registrados. Agregá el primero.</div>}

        {certs.map((cert) => {
          const estado = getEstadoVencimiento(cert.fecha_vencimiento, cert.alerta_dias)
          const isOpen = activeCertId === cert.id

          return (
            <div key={cert.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="flex items-center gap-4 px-5 py-4 cursor-pointer hover:bg-gray-50 transition-colors" onClick={() => setActiveCertId(isOpen ? null : cert.id)}>
                <div className={clsx('w-1.5 h-8 rounded-full shrink-0', {
                  'bg-red-500': estado === 'vencido',
                  'bg-amber-400': estado === 'proximo',
                  'bg-green-500': estado === 'vigente',
                  'bg-gray-300': estado === 'sin_fecha',
                })} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900">{cert.tipo?.nombre ?? cert.tipo_nombre_custom ?? 'Sin tipo'}</p>
                  {cert.numero_documento && <p className="text-xs text-gray-400 mt-0.5">{cert.numero_documento}</p>}
                </div>
                <div className="text-right shrink-0">
                  <span className={clsx('inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border', ESTADO_COLORS[estado])}>{ESTADO_LABELS[estado]}</span>
                  {cert.fecha_vencimiento && <p className="text-xs text-gray-400 mt-1">{format(new Date(cert.fecha_vencimiento), 'dd/MM/yyyy')}</p>}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {cert.archivos?.length > 0 && <span className="flex items-center gap-1 text-xs text-gray-400">{cert.archivos.length}</span>}
                  <svg className={clsx('w-4 h-4 text-gray-400 transition-transform', isOpen && 'rotate-180')} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                  </svg>
                </div>
              </div>

              {isOpen && (
                <div className="border-t border-gray-100 px-5 py-4 bg-gray-50">
                  <div className="grid grid-cols-3 gap-4 mb-4 text-sm">
                    {cert.fecha_emision && <div><p className="text-xs text-gray-400 mb-1">Fecha de emisión</p><p className="text-gray-700">{format(new Date(cert.fecha_emision), 'dd/MM/yyyy')}</p></div>}
                    {cert.fecha_vencimiento && <div><p className="text-xs text-gray-400 mb-1">Vencimiento</p><p className="text-gray-700">{format(new Date(cert.fecha_vencimiento), 'dd/MM/yyyy')}</p></div>}
                    <div><p className="text-xs text-gray-400 mb-1">Alerta previa</p><p className="text-gray-700">{cert.alerta_dias} días</p></div>
                    {cert.notas && <div className="col-span-3"><p className="text-xs text-gray-400 mb-1">Notas</p><p className="text-gray-700">{cert.notas}</p></div>}
                  </div>

                  <div className="mb-4">
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Archivos adjuntos</p>
                    <div className="space-y-2">
                      {cert.archivos?.map((archivo: any) => (
                        <div key={archivo.id} className="flex items-center gap-3 bg-white rounded-lg border border-gray-200 px-3 py-2">
                          <span className="flex-1 text-sm text-gray-700 truncate">{archivo.nombre}</span>
                          {archivo.size_bytes && <span className="text-xs text-gray-400 shrink-0">{(archivo.size_bytes / 1024).toFixed(0)} KB</span>}
                          <div className="flex items-center gap-2">
                            {archivo.url && <a href={archivo.url} target="_blank" rel="noopener noreferrer" className="text-xs text-indigo-600 hover:underline">Ver</a>}
                            {canManageCertificates && <button onClick={() => handleDeleteArchivo(cert.id, archivo.id, archivo.path)} className="text-xs text-red-400 hover:text-red-600">Eliminar</button>}
                          </div>
                        </div>
                      ))}

                      {cert.archivos?.length === 0 && <p className="text-xs text-gray-400">Sin archivos adjuntos</p>}
                    </div>
                  </div>

                  {canManageCertificates && (
                    <div className="flex items-center gap-3 pt-3 border-t border-gray-200">
                      <label className={clsx('flex items-center gap-2 text-xs font-medium px-3 py-1.5 rounded-lg border cursor-pointer transition-colors', uploading === cert.id ? 'border-gray-200 text-gray-400 bg-gray-50' : 'border-indigo-200 text-indigo-600 bg-indigo-50 hover:bg-indigo-100')}>
                        {uploading === cert.id ? 'Subiendo...' : 'Subir archivo'}
                        <input type="file" multiple className="sr-only" accept=".pdf,.jpg,.jpeg,.png,.webp" disabled={uploading === cert.id} onChange={(e) => e.target.files && handleFileUpload(cert.id, e.target.files)} />
                      </label>
                      <button onClick={() => openEdit(cert)} className="flex items-center gap-2 text-xs font-medium px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-100 transition-colors">Editar</button>
                      <button onClick={() => handleDelete(cert.id)} className="flex items-center gap-2 text-xs font-medium px-3 py-1.5 rounded-lg border border-red-200 text-red-500 hover:bg-red-50 transition-colors">Eliminar</button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {canManageCertificates && showForm && (
        <div id="cert-form" className="bg-white rounded-xl border border-indigo-200 p-6 shadow-sm">
          <h3 className="font-semibold text-gray-900 mb-5">{editingId ? 'Editar certificado' : 'Nuevo certificado'}</h3>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Tipo de certificado</label>
              <select value={form.tipo_id} onChange={(e) => setForm((f) => ({ ...f, tipo_id: e.target.value }))} className="w-full px-3.5 py-2.5 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                <option value="">Seleccionar...</option>
                {tiposCertificado.map((t) => <option key={t.id} value={t.id}>{t.nombre}</option>)}
                <option value="otro">Otro (especificar)</option>
              </select>
            </div>
            {form.tipo_id === 'otro' && <div className="col-span-2"><label className="block text-sm font-medium text-gray-700 mb-1.5">Nombre del certificado</label><input type="text" value={form.tipo_nombre_custom} onChange={(e) => setForm((f) => ({ ...f, tipo_nombre_custom: e.target.value }))} className="w-full px-3.5 py-2.5 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" placeholder="Ej: Curso de Primeros Auxilios" /></div>}
            <div><label className="block text-sm font-medium text-gray-700 mb-1.5">Fecha de emisión</label><input type="date" value={form.fecha_emision} onChange={(e) => setForm((f) => ({ ...f, fecha_emision: e.target.value }))} className="w-full px-3.5 py-2.5 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" /></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1.5">Fecha de vencimiento</label><input type="date" value={form.fecha_vencimiento} onChange={(e) => setForm((f) => ({ ...f, fecha_vencimiento: e.target.value }))} className="w-full px-3.5 py-2.5 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" /></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1.5">N° de documento</label><input type="text" value={form.numero_documento} onChange={(e) => setForm((f) => ({ ...f, numero_documento: e.target.value }))} className="w-full px-3.5 py-2.5 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" placeholder="Nro. de resolución, carnet, etc." /></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1.5">Alertar con días de anticipación</label><input type="number" min={1} max={365} value={form.alerta_dias} onChange={(e) => setForm((f) => ({ ...f, alerta_dias: parseInt(e.target.value) || 30 }))} className="w-full px-3.5 py-2.5 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" /></div>
            <div className="col-span-2"><label className="block text-sm font-medium text-gray-700 mb-1.5">Notas</label><textarea value={form.notas} onChange={(e) => setForm((f) => ({ ...f, notas: e.target.value }))} rows={3} className="w-full px-3.5 py-2.5 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none" placeholder="Información adicional..." /></div>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={handleSave} disabled={saving || !form.tipo_id} className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-medium px-5 py-2.5 rounded-lg transition-colors">{saving ? 'Guardando...' : editingId ? 'Guardar cambios' : 'Agregar certificado'}</button>
            <button onClick={resetForm} className="text-sm text-gray-500 hover:text-gray-700 px-3 py-2.5">Cancelar</button>
          </div>
        </div>
      )}
    </div>
  )
}
