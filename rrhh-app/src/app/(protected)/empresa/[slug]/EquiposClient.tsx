'use client'

import { useEffect, useMemo, useState, type KeyboardEvent } from 'react'
import { useRouter } from 'next/navigation'
import { format } from 'date-fns'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { getEstadoVencimiento } from '@/types'
import { EstadoPill } from '@/components/ui/estado-pill'
import type { Equipo, TipoCertificado } from '@/types'
import { mensajeError } from '@/lib/errores'
import { abrirArchivo, borrarArchivo, subirArchivosACertificado } from '@/lib/archivos-client'
import {
  ALERTA_DIAS_DEFECTO, ALERTA_DIAS_MAX, AVISO_SIN_VENCIMIENTO, alertaComoTexto, llevarALaVista, useEnfocarAlAbrir,
  validarAlertaDias,
} from '@/lib/formularios'
import clsx from 'clsx'

type ArchivoCert = { id: string; nombre: string; path: string }

interface CertEquipo {
  id: string
  tipo_id?: string | null
  tipo_nombre_custom?: string | null
  fecha_vencimiento?: string | null
  notas?: string | null
  alerta_dias: number | null
  tipo?: { nombre: string } | null
  archivos?: ArchivoCert[]
}

interface EquipoConCerts extends Equipo {
  certificados: CertEquipo[]
}

interface Seccion {
  id: string
  nombre: string
}

interface Props {
  equipos: EquipoConCerts[]
  secciones: Seccion[]
  tiposCertificado: TipoCertificado[]
  canEdit: boolean
  empresaSlug: string
  empresaId: string
  /** Ítem a mostrar abierto al entrar (?equipo=<id>, desde el dashboard o vencimientos). */
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

const ITEM_EMPTY = { nombre: '', tipo: '', numero_serie: '' }

// Sugerencias para el datalist de secciones nuevas
const SECCIONES_SUGERIDAS = ['Equipos de medición', 'Matafuegos', 'Herramientas', 'Instalaciones']

const inputCls = 'w-full px-3 py-2 rounded-lg border border-input text-sm focus:outline-none focus:ring-2 focus:ring-ring bg-card'

function escCancela(cancelar: () => void) {
  return (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault()
      cancelar()
    }
  }
}

export default function EquiposClient({
  equipos: initEquipos,
  secciones: initSecciones,
  tiposCertificado,
  canEdit,
  empresaSlug,
  empresaId,
  abiertoInicial = null,
}: Props) {
  const supabase = createClient()
  const router = useRouter()
  const [equipos, setEquipos] = useState(initEquipos)
  const [secciones, setSecciones] = useState(initSecciones)
  const [expandedId, setExpandedId] = useState<string | null>(abiertoInicial)
  const [editingCert, setEditingCert] = useState<string | null>(null)
  const [addingTo, setAddingTo] = useState<string | null>(null)
  const [form, setForm] = useState(FORM_EMPTY)
  const [saving, setSaving] = useState(false)
  const [uploadingCert, setUploadingCert] = useState<string | null>(null)
  // Cada apertura del formulario de certificado lo trae a la vista con el foco puesto.
  const [aperturas, setAperturas] = useState(0)
  const formRef = useEnfocarAlAbrir<HTMLFormElement>(aperturas, 'nearest')

  // Alta de sección (solo el título)
  const [nuevaSeccionOpen, setNuevaSeccionOpen] = useState(false)
  const [nombreSeccion, setNombreSeccion] = useState('')
  const [savingSeccion, setSavingSeccion] = useState(false)

  // Alta de ítem dentro de una sección (nombre de la sección, o null)
  const [creandoItemEn, setCreandoItemEn] = useState<string | null>(null)
  const [itemForm, setItemForm] = useState(ITEM_EMPTY)
  const [savingItem, setSavingItem] = useState(false)

  // Link profundo (?equipo=): el ítem ya arranca abierto; falta llevarlo a la vista.
  useEffect(() => {
    if (!abiertoInicial) return
    const el = document.getElementById(`equipo-${abiertoInicial}`)
    if (el) llevarALaVista(el, 'start')
  }, [abiertoInicial])

  // Secciones a mostrar: tabla de secciones ∪ categorías usadas por equipos
  // (por si quedó algún equipo con categoría sin fila de sección)
  const nombresSecciones = useMemo(() => {
    const set = new Set<string>(secciones.map((s) => s.nombre))
    for (const e of equipos) set.add(e.categoria || 'Equipos de medición')
    return [...set].sort((a, b) =>
      a === 'Equipos de medición' ? -1 : b === 'Equipos de medición' ? 1 : a.localeCompare(b, 'es')
    )
  }, [secciones, equipos])

  async function handleCrearSeccion() {
    const nombre = nombreSeccion.trim()
    if (!nombre) return
    if (nombresSecciones.some((n) => n.toLowerCase() === nombre.toLowerCase())) {
      toast.error('Ya existe una sección con ese nombre.')
      return
    }
    setSavingSeccion(true)
    const { data, error: err } = await supabase
      .from('activo_secciones')
      .insert({ empresa_id: empresaId, nombre })
      .select('id, nombre')
      .single()

    setSavingSeccion(false)
    if (err || !data) {
      toast.error(mensajeError(err, 'crear la sección'))
      return
    }
    setSecciones((prev) => [...prev, data])
    setNombreSeccion('')
    setNuevaSeccionOpen(false)
    toast.success(`Sección "${nombre}" creada`)
    router.refresh()
  }

  async function handleEliminarSeccion(nombre: string) {
    const fila = secciones.find((s) => s.nombre === nombre)
    if (!fila) return
    if (!confirm(`¿Eliminar la sección "${nombre}"?`)) return
    const { data, error: err } = await supabase.from('activo_secciones').delete().eq('id', fila.id).select('id')
    if (err || !data?.length) {
      toast.error(err ? mensajeError(err, 'eliminar la sección') : 'No se pudo eliminar: la sección ya no existe o no tenés permiso.')
      return
    }
    setSecciones((prev) => prev.filter((s) => s.id !== fila.id))
    toast.success('Sección eliminada')
    router.refresh()
  }

  function abrirAltaItem(seccion: string) {
    setItemForm(ITEM_EMPTY)
    setCreandoItemEn(seccion)
  }

  function cerrarAltaItem() {
    setCreandoItemEn(null)
    setItemForm(ITEM_EMPTY)
  }

  async function handleCrearItem() {
    if (!itemForm.nombre.trim() || !creandoItemEn) return
    setSavingItem(true)
    const { data, error: err } = await supabase
      .from('equipos')
      .insert({
        nombre: itemForm.nombre.trim(),
        tipo: itemForm.tipo.trim() || null,
        numero_serie: itemForm.numero_serie.trim() || null,
        categoria: creandoItemEn,
        empresa_id: empresaId,
      })
      .select('*')
      .single()

    setSavingItem(false)
    if (err || !data) {
      toast.error(mensajeError(err, 'crear el ítem'))
      return
    }

    setEquipos((prev) => [...prev, { ...data, certificados: [] }])
    cerrarAltaItem()
    setExpandedId(data.id)
    toast.success(`"${data.nombre}" agregado`)
    router.refresh()
  }

  async function handleDeleteEquipo(eq: EquipoConCerts) {
    const n = eq.certificados.length
    const detalle = n > 0 ? ` y ${n === 1 ? 'su certificado' : `sus ${n} certificados`} (con los archivos adjuntos)` : ''
    if (!confirm(`¿Eliminar "${eq.nombre}"${detalle}? No se puede deshacer.`)) return
    const { data, error: err } = await supabase.from('equipos').delete().eq('id', eq.id).select('id')
    if (err || !data?.length) {
      toast.error(err ? mensajeError(err, 'eliminar el ítem') : 'No se pudo eliminar: el ítem ya no existe o no tenés permiso.')
      return
    }
    setEquipos((prev) => prev.filter((e) => e.id !== eq.id))
    toast.success('Ítem eliminado')
    router.refresh()
  }

  function openAdd(equipoId: string) {
    setForm(FORM_EMPTY)
    setEditingCert(null)
    setAddingTo(equipoId)
    setExpandedId(equipoId)
    setAperturas((n) => n + 1)
  }

  function openEdit(cert: CertEquipo) {
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

  async function handleSave(equipoId: string) {
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
      equipo_id: equipoId,
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
      setEquipos((prev) =>
        prev.map((eq) =>
          eq.id === equipoId
            ? { ...eq, certificados: eq.certificados.map((c) => (c.id === certId ? { ...data, archivos: c.archivos } : c)) }
            : eq
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

      setEquipos((prev) =>
        prev.map((eq) =>
          eq.id === equipoId ? { ...eq, certificados: [...eq.certificados, { ...data, archivos: [] }] } : eq
        )
      )
      toast.success('Certificado agregado', sinVencimiento)
    }

    cancelarForm()
    router.refresh()
  }

  async function handleDelete(equipoId: string, cert: CertEquipo) {
    const n = cert.archivos?.length ?? 0
    const adjuntos = n > 0 ? ` y ${n === 1 ? 'su archivo adjunto' : `sus ${n} archivos adjuntos`}` : ''
    if (!confirm(`¿Eliminar el certificado "${cert.tipo?.nombre ?? cert.tipo_nombre_custom ?? 'Sin tipo'}"${adjuntos}? No se puede deshacer.`)) return

    // .select() devuelve lo borrado: si la RLS no dejó borrar nada no hay error, pero tampoco filas.
    const { data, error: err } = await supabase.from('certificados').delete().eq('id', cert.id).select('id')

    if (err || !data?.length) {
      toast.error(err ? mensajeError(err, 'eliminar el certificado') : 'No se pudo eliminar: el certificado ya no existe o no tenés permiso.')
      return
    }

    setEquipos((prev) =>
      prev.map((eq) =>
        eq.id === equipoId
          ? { ...eq, certificados: eq.certificados.filter((c) => c.id !== cert.id) }
          : eq
      )
    )
    toast.success('Certificado eliminado')
    router.refresh()
  }

  async function handleUploadArchivo(equipoId: string, certId: string, files: File[]) {
    setUploadingCert(certId)
    const ok = await subirArchivosACertificado(files, certId, { empresaSlug }, (archivo) =>
      setEquipos((prev) =>
        prev.map((eq) =>
          eq.id === equipoId
            ? { ...eq, certificados: eq.certificados.map((c) => (c.id === certId ? { ...c, archivos: [...(c.archivos ?? []), archivo] } : c)) }
            : eq
        )
      )
    )
    setUploadingCert(null)
    if (ok > 0) router.refresh()
  }

  async function handleDeleteArchivo(equipoId: string, certId: string, archivo: ArchivoCert) {
    if (!confirm(`¿Eliminar el archivo "${archivo.nombre}"?`)) return
    if (!(await borrarArchivo(archivo.id))) return
    setEquipos((prev) =>
      prev.map((eq) =>
        eq.id === equipoId
          ? { ...eq, certificados: eq.certificados.map((c) => (c.id === certId ? { ...c, archivos: (c.archivos ?? []).filter((a) => a.id !== archivo.id) } : c)) }
          : eq
      )
    )
    router.refresh()
  }

  function renderEquipoCard(eq: EquipoConCerts) {
    const isOpen = expandedId === eq.id
    const isAddingHere = addingTo === eq.id

    const worstEstado =
      eq.certificados.length > 0
        ? eq.certificados.reduce((worst, c) => {
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

    const subtitulo = [eq.tipo, eq.numero_serie ? `N° ${eq.numero_serie}` : null]
      .filter(Boolean)
      .join(' · ')

    return (
      <div
        key={eq.id}
        id={`equipo-${eq.id}`}
        className={clsx(
          'scroll-mt-6 bg-card rounded-xl border overflow-hidden',
          abiertoInicial === eq.id ? 'border-primary/40' : 'border-border'
        )}
      >
        <div
          className="flex items-center gap-4 px-5 py-4 cursor-pointer hover:bg-accent transition-colors"
          onClick={() => setExpandedId(isOpen ? null : eq.id)}
        >
          <span className={clsx('w-2 h-2 rounded-full shrink-0', estadoColor)} />
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-foreground">{eq.nombre}</p>
            {subtitulo && <p className="text-xs text-muted-foreground">{subtitulo}</p>}
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground">
              {eq.certificados.length} certificado
              {eq.certificados.length !== 1 ? 's' : ''}
            </span>

            {canEdit && (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  openAdd(eq.id)
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
              {eq.certificados.length === 0 && (
                <p className="text-xs text-muted-foreground py-2">Sin certificados. Agregá el primero.</p>
              )}

              {eq.certificados.map((cert) => {
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
                              onClick={() => handleDelete(eq.id, cert)}
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
                                <button onClick={() => handleDeleteArchivo(eq.id, cert.id, a)} className="text-muted-foreground hover:text-red-500" aria-label="Eliminar archivo">×</button>
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
                                  // Copiar la lista ANTES de vaciar el input (FileList es una vista
                                  // viva). Vaciarlo permite volver a elegir el mismo archivo tras un error.
                                  const files = Array.from(e.target.files ?? [])
                                  e.target.value = ''
                                  if (files.length) handleUploadArchivo(eq.id, cert.id, files)
                                }} />
                            </label>
                          )}
                        </div>
                      </div>
                    )}

                    {isEditing && renderForm(eq.id, 'Guardar', 'px-4 py-4')}
                  </div>
                )
              })}
            </div>

            {isAddingHere && canEdit && (
              <div className="bg-card rounded-lg border border-primary/30">
                {renderForm(eq.id, 'Agregar', 'p-4', 'Nuevo certificado')}
              </div>
            )}

            {canEdit && (
              <div className="mt-3 text-right">
                <button
                  onClick={() => handleDeleteEquipo(eq)}
                  className="text-xs text-muted-foreground hover:text-red-500 transition-colors"
                >
                  Eliminar ítem
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="mb-8 space-y-8">
      {nombresSecciones.map((nombre) => {
        const items = equipos.filter((e) => (e.categoria || 'Equipos de medición') === nombre)
        const agregandoAca = creandoItemEn === nombre

        return (
          <div key={nombre}>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-semibold text-foreground">{nombre}</h2>
              {canEdit && !agregandoAca && (
                <button
                  onClick={() => abrirAltaItem(nombre)}
                  className="text-xs font-medium text-primary hover:text-primary bg-primary/10 hover:bg-primary/20 px-2.5 py-1 rounded-lg transition-colors"
                >
                  + Agregar ítem
                </button>
              )}
            </div>

            <div className="space-y-3">
              {agregandoAca && canEdit && (
                <form
                  onSubmit={(e) => { e.preventDefault(); handleCrearItem() }}
                  onKeyDown={escCancela(cerrarAltaItem)}
                  className="bg-card rounded-xl border border-primary/30 p-4"
                >
                  <p className="text-sm font-medium text-foreground mb-3">Nuevo ítem en {nombre}</p>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-foreground mb-1">Nombre / identificador</label>
                      <input
                        type="text"
                        value={itemForm.nombre}
                        onChange={(e) => setItemForm((f) => ({ ...f, nombre: e.target.value }))}
                        className={inputCls}
                        placeholder="Ej: Matafuego ABC 5kg — Galpón"
                        autoFocus
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-foreground mb-1">Tipo / marca</label>
                      <input
                        type="text"
                        value={itemForm.tipo}
                        onChange={(e) => setItemForm((f) => ({ ...f, tipo: e.target.value }))}
                        className={inputCls}
                        placeholder="Ej: ABC / CO2 (opcional)"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-foreground mb-1">N° de serie</label>
                      <input
                        type="text"
                        value={itemForm.numero_serie}
                        onChange={(e) => setItemForm((f) => ({ ...f, numero_serie: e.target.value }))}
                        className={inputCls}
                        placeholder="Opcional"
                      />
                    </div>
                  </div>
                  <div className="flex gap-2 mt-3">
                    <button
                      type="submit"
                      disabled={savingItem || !itemForm.nombre.trim()}
                      className="bg-primary hover:bg-primary/90 disabled:opacity-50 text-primary-foreground text-xs font-medium px-4 py-2 rounded-lg"
                    >
                      {savingItem ? 'Creando...' : 'Crear ítem'}
                    </button>
                    <button type="button" onClick={cerrarAltaItem} className="text-xs text-muted-foreground px-3 py-2">
                      Cancelar
                    </button>
                  </div>
                </form>
              )}

              {items.map((eq) => renderEquipoCard(eq))}

              {items.length === 0 && !agregandoAca && (
                <div className="bg-card rounded-xl border border-dashed border-border px-5 py-6 text-center">
                  <p className="text-sm text-muted-foreground">
                    Sin ítems en esta sección.
                    {canEdit && ' Agregá el primero con "+ Agregar ítem".'}
                  </p>
                  {canEdit && secciones.some((s) => s.nombre === nombre) && (
                    <button
                      onClick={() => handleEliminarSeccion(nombre)}
                      className="mt-2 text-xs text-muted-foreground hover:text-red-500 transition-colors"
                    >
                      Eliminar sección
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        )
      })}

      {canEdit && (
        nuevaSeccionOpen ? (
          <form
            onSubmit={(e) => { e.preventDefault(); handleCrearSeccion() }}
            onKeyDown={escCancela(() => { setNuevaSeccionOpen(false); setNombreSeccion('') })}
            className="bg-card rounded-xl border border-primary/30 p-4"
          >
            <p className="text-sm font-medium text-foreground mb-3">Nueva sección</p>
            <div className="flex flex-wrap items-end gap-2">
              <div className="flex-1 min-w-[220px]">
                <label className="block text-xs font-medium text-foreground mb-1">Título de la sección</label>
                <input
                  type="text"
                  list="secciones-sugeridas"
                  value={nombreSeccion}
                  onChange={(e) => setNombreSeccion(e.target.value)}
                  className={inputCls}
                  placeholder="Ej: Matafuegos"
                  autoFocus
                />
                <datalist id="secciones-sugeridas">
                  {SECCIONES_SUGERIDAS.filter((s) => !nombresSecciones.includes(s)).map((s) => (
                    <option key={s} value={s} />
                  ))}
                </datalist>
              </div>
              <button
                type="submit"
                disabled={savingSeccion || !nombreSeccion.trim()}
                className="bg-primary hover:bg-primary/90 disabled:opacity-50 text-primary-foreground text-xs font-medium px-4 py-2 rounded-lg"
              >
                {savingSeccion ? 'Creando...' : 'Crear sección'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setNuevaSeccionOpen(false)
                  setNombreSeccion('')
                }}
                className="text-xs text-muted-foreground px-3 py-2"
              >
                Cancelar
              </button>
            </div>
          </form>
        ) : (
          <button
            onClick={() => setNuevaSeccionOpen(true)}
            className="w-full rounded-xl border border-dashed border-border px-5 py-3 text-sm font-medium text-muted-foreground hover:border-primary/40 hover:text-primary transition-colors"
          >
            + Nueva sección (ej: Matafuegos, Herramientas…)
          </button>
        )
      )}
    </div>
  )

  function renderForm(equipoId: string, textoBoton: string, className: string, titulo?: string) {
    return (
      <form
        ref={formRef}
        onSubmit={(e) => { e.preventDefault(); handleSave(equipoId) }}
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
                placeholder="Ej: Recarga anual"
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
