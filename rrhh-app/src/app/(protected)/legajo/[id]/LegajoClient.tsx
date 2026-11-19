'use client'

import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  ArrowLeft, ArrowSquareOut, ArrowsClockwise, CaretDown, CaretUp, Check, DotsThree, FilePdf, Package, PencilSimple, Plus, Trash,
  UploadSimple, UserCheck, UserMinus,
} from '@phosphor-icons/react'
import { createClient } from '@/lib/supabase/client'
import { getEstadoVencimiento } from '@/types'
import type { Empleado, TipoCertificado, Empresa, Archivo, Recibo } from '@/types'
import RecibosSueldo from './RecibosSueldo'
import EppEntregado, { type MovimientoEpp } from './EppEntregado'
import type { Tables } from '@/types/database'
import { AvatarPersona, IconoEmpresa } from '@/components/ui/empresa'
import { BotonIcono, HojaCabecera } from '@/components/ui/hoja'
import { Chip, EstadoTexto, Vacio } from '@/components/ui/datos'
import { diaClaveAR } from '@/lib/fechas-ar'
import { mensajeError } from '@/lib/errores'
import { abrirArchivo, borrarArchivo, subirArchivosACertificado } from '@/lib/archivos-client'
import {
  ALERTA_DIAS_DEFECTO, ALERTA_DIAS_MAX, AVISO_SIN_VENCIMIENTO, alertaComoTexto, llevarALaVista, useEnfocarAlAbrir,
  validarAlertaDias,
} from '@/lib/formularios'
import clsx from 'clsx'
import { diasHastaVencimiento } from '@/types'

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
  /** EPP y ropa entregados desde Stock. */
  epp: MovimientoEpp[]
  isAdmin: boolean
  canEdit: boolean
  /** Certificado a abrir al entrar (?cert=<id>, desde el dashboard o vencimientos). */
  certInicial?: string | null
  /** Recién creado (?nuevo=1): el formulario de certificado arranca abierto. */
  abrirAlta?: boolean
  /** ?cargar=1 (desde "Cargar certificado" del Inicio): el alta arranca abierta, sin el aviso de "Empleado creado". */
  abrirCarga?: boolean
  /** ?renovar=1 junto a ?cert= (desde el Inicio): el certificado se abre con las fechas nuevas para guardar. */
  renovarInicial?: boolean
  /**
   * 'pagina' = /legajo/[id] de siempre; 'hoja' = dentro de la hoja lateral de Empleados (?legajo=).
   * En la hoja, dar de baja no te saca de la lista y aparecen anterior/siguiente.
   */
  modo?: 'pagina' | 'hoja'
  onCerrar?: () => void
  onNav?: (dir: 1 | -1) => void
}

/** 'YYYY-MM-DD' + n días (mediodía UTC: sin corrimientos de huso). */
function sumarDiasIso(f: string, n: number): string {
  const d = new Date(f + 'T12:00:00Z')
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}
const MESES_C = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
/** "12 nov 2026" (fecha date-only, sin pasar por el huso del navegador). */
function fLarga(f: string): string {
  const [y, m, d] = f.slice(0, 10).split('-')
  return `${Number(d)} ${MESES_C[Number(m) - 1]} ${y}`
}
const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`

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

export default function LegajoClient({
  empleado,
  certificados: initCerts,
  tiposCertificado,
  empresas,
  recibos,
  veRecibos,
  epp,
  canEdit,
  certInicial = null,
  abrirAlta = false,
  abrirCarga = false,
  renovarInicial = false,
  modo = 'pagina',
  onCerrar,
  onNav,
}: Props) {
  const supabase = createClient()
  const router = useRouter()
  const [certs, setCerts] = useState(initCerts)
  const [showForm, setShowForm] = useState((abrirAlta || abrirCarga) && canEdit)
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
  // Renovar = editar el mismo certificado con las fechas nuevas ya puestas (la persona guarda).
  const [renovando, setRenovando] = useState(false)
  const [pestana, setPestana] = useState<'certs' | 'sueldo' | 'epp' | 'datos'>('certs')
  const [menu, setMenu] = useState(false)
  // Cada apertura del formulario lo trae a la vista con el foco en el primer campo
  // (vive debajo de la lista: antes "Agregar certificado" lo abría fuera de pantalla).
  const [aperturas, setAperturas] = useState((abrirAlta || abrirCarga) && canEdit ? 1 : 0)
  const formRef = useEnfocarAlAbrir<HTMLFormElement>(aperturas, 'center')
  const avisoNuevo = useRef(false)

  const nombreCompleto = useMemo(() => {
    return [empleadoData.nombre, empleadoData.apellido].filter(Boolean).join(' ')
  }, [empleadoData])

  // ?renovar=1: abre el certificado del link con las fechas nuevas (una sola vez).
  const renovarHecho = useRef(false)
  useEffect(() => {
    if (!renovarInicial || !certInicial || !canEdit || renovarHecho.current) return
    renovarHecho.current = true
    const c = initCerts.find((x) => x.id === certInicial)
    if (c) openRenovar(c)
    try {
      const url = new URL(window.location.href)
      url.searchParams.delete('renovar')
      window.history.replaceState(null, '', url)
    } catch { /* la URL es cosmética */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo al montar
  }, [])

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

  useEffect(() => {
    if (!abrirCarga) return
    try {
      const url = new URL(window.location.href)
      url.searchParams.delete('cargar')
      window.history.replaceState(null, '', url)
    } catch { /* la URL es cosmética */ }
  }, [abrirCarga])

  function resetForm() {
    setForm(FORM_VACIO)
    setShowForm(false)
    setEditingId(null)
    setRenovando(false)
  }

  function abrirNuevo() {
    setForm(FORM_VACIO)
    setEditingId(null)
    setRenovando(false)
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
    setRenovando(false)
    setShowForm(true)
    setAperturas((n) => n + 1)
  }

  /** Renovar: emisión hoy y el vencimiento corrido lo que duraba el anterior (o un año). */
  function openRenovar(cert: CertConRelaciones) {
    const hoy = diaClaveAR(new Date())
    const venc = cert.fecha_vencimiento?.slice(0, 10) ?? null
    const emi = cert.fecha_emision?.slice(0, 10) ?? null
    const dur = venc && emi && venc > emi ? Math.round((Date.parse(venc + 'T12:00:00Z') - Date.parse(emi + 'T12:00:00Z')) / 86_400_000) : 365
    const base = venc && venc > hoy ? venc : hoy
    openEdit(cert)
    setForm((f) => ({ ...f, fecha_emision: hoy, fecha_vencimiento: sumarDiasIso(base, dur) }))
    setRenovando(true)
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
      toast.success(renovando ? 'Certificado renovado' : 'Certificado actualizado', sinVencimiento ?? (renovando ? { description: 'Subí el archivo nuevo si lo tenés.' } : undefined))
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

  /**
   * "Eliminar" nunca borró: desactiva el legajo (borrado lógico, reversible). Como el servidor
   * ya permite volver atrás (Reactivar), la confirmación pasó a un Deshacer en el aviso (skill §0b).
   */
  async function handleDarDeBaja() {
    setMenu(false)
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

    setActivo(false)
    toast.success(`${nombreCompleto} quedó dado de baja`, {
      description: 'Sus certificados, archivos y comprobantes se conservan.',
      duration: 8000,
      action: { label: 'Deshacer', onClick: () => { void handleReactivar() } },
    })
    if (modo === 'pagina') router.push('/empleados')
    router.refresh()
  }

  async function handleReactivar() {
    setMenu(false)
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

  const vigentes = certs.filter((c) => getEstadoVencimiento(c.fecha_vencimiento, c.alerta_dias) === 'vigente').length
  const proximoCert = certs
    .filter((c) => c.fecha_vencimiento && diasHastaVencimiento(c.fecha_vencimiento) >= 0)
    .sort((a, b) => (a.fecha_vencimiento! < b.fecha_vencimiento! ? -1 : 1))[0]
  const nombreTipo = (c: CertConRelaciones) => c.tipo?.nombre ?? c.tipo_nombre_custom ?? 'Sin tipo'
  const empresaNombre = empresas.find((e) => e.id === empleadoData.empresa_id)?.nombre ?? empleado.empresa?.nombre ?? ''
  const tituloId = `legajo-${empleado.id}`
  const R = 32
  const CIR = 2 * Math.PI * R
  const frac = certs.length ? vigentes / certs.length : 0
  const tabs = [
    { k: 'certs' as const, t: 'Certificados', n: certs.length },
    // Recibos: solo con permiso (la RLS ya devuelve vacío sin él; la pestaña ni aparece).
    ...(veRecibos ? [{ k: 'sueldo' as const, t: 'Sueldo', n: recibos.length }] : []),
    { k: 'epp' as const, t: 'EPP', n: epp.length },
    { k: 'datos' as const, t: 'Datos', n: null },
  ]
  const formId = `cert-form-${empleado.id}`
  const campoCls = 'h-[52px] w-full rounded-xl border border-border-strong bg-card px-3 text-base shadow-min outline-none transition-[border-color,box-shadow] focus:border-primary focus:shadow-[0_0_0_3px_color-mix(in_oklch,var(--primary)_16%,transparent)] md:h-10 md:text-sm'
  const rotuloCls = 'text-[13px] font-medium text-texto-2'
  const btnCls = 'inline-flex h-11 cursor-pointer items-center gap-1.5 rounded-lg border border-border bg-card px-3 text-[13px] font-medium shadow-min transition-colors hover:bg-hover disabled:opacity-50 md:h-7'
  const tituloForm = renovando ? 'Renovar certificado' : editingId ? 'Editar certificado' : 'Nuevo certificado'

  // ── Cabecera: la de la hoja o la de la página ──
  const cabecera = showForm && canEdit ? (
    <HojaCabecera
      tituloId={tituloId}
      rotulo={nombreCompleto}
      titulo={tituloForm}
      onCerrar={onCerrar ?? resetForm}
      tile={<BotonIcono etiqueta="Volver al legajo" onClick={resetForm}><ArrowLeft size={17} /></BotonIcono>}
    />
  ) : (
    <HojaCabecera
      tituloId={tituloId}
      rotulo={[empresaNombre, empleadoData.sector].filter(Boolean).join(' · ')}
      titulo={nombreCompleto}
      onCerrar={onCerrar ?? (() => router.push(`/empleados${slug ? `?empresa=${slug}` : ''}`))}
      tile={<AvatarPersona nombre={nombreCompleto} slug={slug} tamano={48} />}
    >
      {onNav && (
        <span className="hidden gap-1 md:flex">
          <BotonIcono etiqueta="Anterior (↑)" onClick={() => onNav(-1)}><CaretUp size={17} /></BotonIcono>
          <BotonIcono etiqueta="Siguiente (↓)" onClick={() => onNav(1)}><CaretDown size={17} /></BotonIcono>
        </span>
      )}
      {canEdit && (
        <span className="relative">
          <BotonIcono etiqueta="Más acciones" aria-haspopup="menu" aria-expanded={menu} onClick={() => setMenu(!menu)}><DotsThree size={17} /></BotonIcono>
          {menu && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setMenu(false)} />
              <div role="menu" data-menu-abierto className="absolute top-[calc(100%+6px)] right-0 z-50 w-[240px] rounded-2xl border border-border bg-popover p-1.5 shadow-flotante">
                <button type="button" role="menuitem" onClick={() => { setMenu(false); setPestana('datos'); setEditingEmpleado(true) }} className="flex min-h-10 w-full cursor-pointer items-center gap-2 rounded-[10px] px-2 text-left text-sm font-medium hover:bg-muted"><PencilSimple size={17} className="text-muted-foreground" />Editar datos</button>
                <button type="button" role="menuitem" onClick={() => { setMenu(false); abrirNuevo() }} className="flex min-h-10 w-full cursor-pointer items-center gap-2 rounded-[10px] px-2 text-left text-sm font-medium hover:bg-muted"><Plus size={17} className="text-muted-foreground" />Agregar certificado</button>
                {modo === 'hoja' && <Link role="menuitem" href={`/legajo/${empleado.id}`} className="flex min-h-10 w-full items-center gap-2 rounded-[10px] px-2 text-sm font-medium hover:bg-muted"><ArrowSquareOut size={17} className="text-muted-foreground" />Legajo completo</Link>}
                <div role="separator" className="mx-1 my-1 h-px bg-divisor" />
                {activo
                  ? <button type="button" role="menuitem" disabled={cambiandoAlta} onClick={handleDarDeBaja} className="flex min-h-10 w-full cursor-pointer items-center gap-2 rounded-[10px] px-2 text-left text-sm font-medium text-danger hover:bg-muted"><UserMinus size={17} />Dar de baja</button>
                  : <button type="button" role="menuitem" disabled={cambiandoAlta} onClick={handleReactivar} className="flex min-h-10 w-full cursor-pointer items-center gap-2 rounded-[10px] px-2 text-left text-sm font-medium hover:bg-muted"><UserCheck size={17} className="text-muted-foreground" />Reactivar</button>}
              </div>
            </>
          )}
        </span>
      )}
    </HojaCabecera>
  )

  // ── Formulario de certificado (nuevo, editar o renovar): mismos campos y el mismo guardado ──
  const formulario = (
    <form
      key={editingId ?? 'nuevo'}
      ref={formRef}
      id={formId}
      onSubmit={(e) => { e.preventDefault(); handleSave() }}
      onKeyDown={escCancela(resetForm)}
      className="flex flex-col gap-4"
    >
      <div className="flex flex-col gap-1.5">
        <label className={rotuloCls} htmlFor={`${formId}-tipo`}>Tipo</label>
        <select id={`${formId}-tipo`} data-autofocus value={form.tipo_id} onChange={(e) => setForm((f) => ({ ...f, tipo_id: e.target.value }))} className={campoCls} disabled={renovando}>
          <option value="">Elegí el tipo</option>
          {tiposCertificado.map((t) => (
            <option key={t.id} value={t.id}>{t.nombre}</option>
          ))}
          <option value="otro">Otro, especificar</option>
        </select>
      </div>
      {form.tipo_id === 'otro' && (
        <div className="flex flex-col gap-1.5">
          <label className={rotuloCls} htmlFor={`${formId}-otro`}>Nombre del certificado</label>
          <input id={`${formId}-otro`} type="text" value={form.tipo_nombre_custom} onChange={(e) => setForm((f) => ({ ...f, tipo_nombre_custom: e.target.value }))} className={campoCls} placeholder="Ej.: Curso de primeros auxilios" />
        </div>
      )}
      <div className="grid gap-4 md:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label className={rotuloCls} htmlFor={`${formId}-emi`}>Emisión</label>
          <input id={`${formId}-emi`} type="date" value={form.fecha_emision} onChange={(e) => setForm((f) => ({ ...f, fecha_emision: e.target.value }))} className={campoCls} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className={rotuloCls} htmlFor={`${formId}-ven`}>Vencimiento</label>
          <input id={`${formId}-ven`} type="date" value={form.fecha_vencimiento} onChange={(e) => setForm((f) => ({ ...f, fecha_vencimiento: e.target.value }))} className={campoCls} />
          {!form.fecha_vencimiento
            ? <small className="text-xs text-warning">{AVISO_SIN_VENCIMIENTO}</small>
            : <small className="text-xs text-muted-foreground">Avisamos {Number(form.alerta_dias) || ALERTA_DIAS_DEFECTO} días antes, el {fLarga(sumarDiasIso(form.fecha_vencimiento, -(Number(form.alerta_dias) || ALERTA_DIAS_DEFECTO)))}</small>}
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label className={rotuloCls} htmlFor={`${formId}-num`}>N.º de documento</label>
          <input id={`${formId}-num`} type="text" value={form.numero_documento} onChange={(e) => setForm((f) => ({ ...f, numero_documento: e.target.value }))} className={campoCls} placeholder="Ej.: resolución o carnet" />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className={rotuloCls} htmlFor={`${formId}-al`}>Avisar antes</label>
          <div className="relative">
            <input id={`${formId}-al`} type="number" inputMode="numeric" min={1} max={ALERTA_DIAS_MAX} value={form.alerta_dias} onChange={(e) => setForm((f) => ({ ...f, alerta_dias: e.target.value }))} className={clsx(campoCls, 'pr-16')} />
            <span className="absolute top-1/2 right-3 -translate-y-1/2 rounded-md bg-muted px-1.5 py-0.5 text-xs font-medium text-muted-foreground">días</span>
          </div>
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <label className={rotuloCls} htmlFor={`${formId}-not`}>Notas</label>
        <textarea id={`${formId}-not`} value={form.notas} onChange={(e) => setForm((f) => ({ ...f, notas: e.target.value }))} rows={3} className={clsx(campoCls, 'h-auto resize-none py-2 leading-normal')} placeholder="Información adicional" />
      </div>
      {!editingId && <p className="text-[13px] text-texto-2">El archivo se sube en el certificado, después de guardarlo.</p>}
    </form>
  )

  // ── Contenido de cada pestaña ──
  const certificados = certs.length === 0 ? (
    <Vacio titulo="Sin certificados" className="py-8" accion={canEdit ? <button type="button" onClick={abrirNuevo} className={btnCls}><Plus size={14} />Agregar el primero</button> : undefined}>
      Apto médico, licencia, cursos o seguro.
    </Vacio>
  ) : (
    <div className="overflow-hidden rounded-[16px] border border-border">
      {certs.map((cert) => {
        const estado = getEstadoVencimiento(cert.fecha_vencimiento, cert.alerta_dias)
        const isOpen = activeCertId === cert.id
        const d = cert.fecha_vencimiento ? diasHastaVencimiento(cert.fecha_vencimiento) : null
        return (
          <div key={cert.id} id={`cert-${cert.id}`} className={clsx('scroll-mt-6 border-t border-divisor first:border-t-0', isOpen && 'bg-bandeja', isOpen && certALaVista === cert.id && 'destello')}>
            <button type="button" aria-expanded={isOpen} onClick={() => setActiveCertId(isOpen ? null : cert.id)} className="grid min-h-16 w-full cursor-pointer grid-cols-[minmax(0,1fr)_auto_20px] items-center gap-3 px-4 py-2 text-left transition-colors hover:bg-hover md:min-h-14">
              <span className="min-w-0">
                <b className="block truncate text-sm font-medium">{nombreTipo(cert)}</b>
                <small className="mt-0.5 block truncate text-xs text-muted-foreground">
                  {cert.fecha_vencimiento ? `Vence ${fLarga(cert.fecha_vencimiento)}` : 'Sin fecha de vencimiento'}
                  {cert.numero_documento ? ` · ${cert.numero_documento}` : ''}
                  {!cert.archivos?.length ? ' · falta el archivo' : ''}
                </small>
              </span>
              {estado === 'vencido' ? <Chip tono="ro">Venció hace {plural(-(d ?? 0), 'día', 'días')}</Chip>
                : estado === 'proximo' ? <Chip tono="am">{d === 0 ? 'Vence hoy' : `En ${plural(d ?? 0, 'día', 'días')}`}</Chip>
                : <EstadoTexto estado={estado} />}
              <CaretDown size={14} className={clsx('text-muted-foreground transition-transform duration-200', isOpen && 'rotate-180')} aria-hidden />
            </button>
            {isOpen && (
              <div className="flex flex-col gap-4 px-4 pt-1 pb-4">
                <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
                  <div><small className="block text-xs font-medium text-muted-foreground">Emisión</small><div className="mt-0.5 text-sm">{cert.fecha_emision ? fLarga(cert.fecha_emision) : '—'}</div></div>
                  <div><small className="block text-xs font-medium text-muted-foreground">Vencimiento</small><div className="mt-0.5 text-sm">{cert.fecha_vencimiento ? fLarga(cert.fecha_vencimiento) : '—'}</div></div>
                  <div><small className="block text-xs font-medium text-muted-foreground">Aviso previo</small><div className="mt-0.5 text-sm">{cert.alerta_dias ?? ALERTA_DIAS_DEFECTO} días</div></div>
                  {cert.notas && <div className="col-span-full"><small className="block text-xs font-medium text-muted-foreground">Notas</small><div className="mt-0.5 text-sm">{cert.notas}</div></div>}
                </div>
                <div className="flex flex-col gap-1.5">
                  {cert.archivos?.map((archivo) => (
                    <div key={archivo.id} className="flex h-[52px] items-center gap-2 rounded-xl border border-border bg-card pr-1 pl-2 text-[13px] md:h-11">
                      <span className="grid size-7 shrink-0 place-items-center rounded-lg text-rojo-g" style={{ background: 'color-mix(in oklch, var(--rojo-g) var(--cuadro-pct), var(--card))' }}><FilePdf size={15} aria-hidden /></span>
                      <span className="min-w-0 flex-1 truncate font-medium">{archivo.nombre}</span>
                      {archivo.size_bytes && <span className="shrink-0 font-mono text-xs text-muted-foreground">{(archivo.size_bytes / 1024).toFixed(0)} KB</span>}
                      <BotonIcono etiqueta={`Abrir ${archivo.nombre}`} onClick={() => abrirArchivo(archivo.path)}><ArrowSquareOut size={16} /></BotonIcono>
                      {canEdit && <BotonIcono etiqueta={`Eliminar ${archivo.nombre}`} onClick={() => handleDeleteArchivo(cert.id, archivo)}><Trash size={16} /></BotonIcono>}
                    </div>
                  ))}
                  {cert.archivos?.length === 0 && !canEdit && <p className="text-xs text-muted-foreground">Sin archivos adjuntos</p>}
                  {canEdit && (
                    <label className={clsx('flex h-[52px] cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-border-strong text-[13px] font-medium text-texto-2 transition-colors hover:border-primary hover:bg-accent hover:text-accent-foreground md:h-11', uploading === cert.id && 'pointer-events-none opacity-60')}>
                      <UploadSimple size={16} aria-hidden />
                      {uploading === cert.id ? 'Subiendo…' : 'Subir archivo'}
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
                  )}
                </div>
                {canEdit && (
                  <div className="flex flex-wrap gap-2">
                    {(estado === 'vencido' || estado === 'proximo') && <button type="button" onClick={() => openRenovar(cert)} className={btnCls}><ArrowsClockwise size={14} className="text-texto-2" />Renovar</button>}
                    <button type="button" onClick={() => openEdit(cert)} className={btnCls}><PencilSimple size={14} className="text-texto-2" />Editar</button>
                    <button type="button" onClick={() => handleDelete(cert)} className={clsx(btnCls, 'border-transparent bg-transparent text-danger shadow-none hover:bg-muted')}><Trash size={14} />Eliminar</button>
                  </div>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )

  const datos = canEdit && editingEmpleado ? (
    <form onSubmit={(e) => { e.preventDefault(); handleSaveEmpleado() }} onKeyDown={escCancela(() => setEditingEmpleado(false))} className="flex flex-col gap-4">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="flex flex-col gap-1.5"><label className={rotuloCls} htmlFor={`${tituloId}-nom`}>Nombre</label><input id={`${tituloId}-nom`} type="text" autoFocus value={empleadoData.nombre} onChange={(e) => setEmpleadoData((prev) => ({ ...prev, nombre: e.target.value }))} className={campoCls} /></div>
        <div className="flex flex-col gap-1.5"><label className={rotuloCls} htmlFor={`${tituloId}-ape`}>Apellido</label><input id={`${tituloId}-ape`} type="text" value={empleadoData.apellido} onChange={(e) => setEmpleadoData((prev) => ({ ...prev, apellido: e.target.value }))} className={campoCls} /></div>
      </div>
      <div className="flex flex-col gap-1.5">
        <label className={rotuloCls} htmlFor={`${tituloId}-emp`}>Empresa</label>
        <select id={`${tituloId}-emp`} value={empleadoData.empresa_id} onChange={(e) => setEmpleadoData((prev) => ({ ...prev, empresa_id: e.target.value }))} className={campoCls}>
          {empresas.map((empresaItem) => (
            <option key={empresaItem.id} value={empresaItem.id}>{empresaItem.nombre}</option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-1.5"><label className={rotuloCls} htmlFor={`${tituloId}-sec`}>Sector</label><input id={`${tituloId}-sec`} type="text" value={empleadoData.sector} onChange={(e) => setEmpleadoData((prev) => ({ ...prev, sector: e.target.value }))} className={campoCls} /></div>
      <div className="flex flex-wrap items-center gap-2">
        {/* La baja vive acá y no al lado de "Agregar certificado": es una acción rara y antes se confundía con borrar. */}
        {activo && <button type="button" onClick={handleDarDeBaja} disabled={cambiandoAlta} className={clsx(btnCls, 'border-transparent bg-transparent text-danger shadow-none hover:bg-muted')}><UserMinus size={14} />{cambiandoAlta ? 'Dando de baja…' : 'Dar de baja'}</button>}
        <button type="button" onClick={() => setEditingEmpleado(false)} className={clsx(btnCls, 'ml-auto md:h-[38px] md:px-4 md:text-sm md:rounded-xl')}>Cancelar</button>
        <button type="submit" disabled={savingEmpleado} className={clsx(btnCls, 'md:h-[38px] md:px-4 md:text-sm md:rounded-xl')}><Check size={15} />{savingEmpleado ? 'Guardando…' : 'Guardar cambios'}</button>
      </div>
    </form>
  ) : (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-x-5 gap-y-4">
        <div><small className="block text-xs font-medium text-muted-foreground">Nombre</small><div className="mt-0.5 text-sm">{empleadoData.nombre || '—'}</div></div>
        <div><small className="block text-xs font-medium text-muted-foreground">Apellido</small><div className="mt-0.5 text-sm">{empleadoData.apellido || '—'}</div></div>
        <div><small className="block text-xs font-medium text-muted-foreground">Empresa</small><div className="mt-0.5 flex items-center gap-2 text-sm">{slug && <IconoEmpresa slug={slug} nombre={empresaNombre} tamano={24} />}{empresaNombre || '—'}</div></div>
        <div><small className="block text-xs font-medium text-muted-foreground">Sector</small><div className="mt-0.5 text-sm">{empleadoData.sector || '—'}</div></div>
        <div><small className="block text-xs font-medium text-muted-foreground">Estado</small><div className="mt-0.5 text-sm">{activo ? 'Activo' : 'Dado de baja'}</div></div>
      </div>
      {canEdit && (
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => setEditingEmpleado(true)} className={btnCls}><PencilSimple size={14} className="text-texto-2" />Editar datos</button>
          {activo
            ? <button type="button" onClick={handleDarDeBaja} disabled={cambiandoAlta} className={clsx(btnCls, 'border-transparent bg-transparent text-danger shadow-none hover:bg-muted')}><UserMinus size={14} />{cambiandoAlta ? 'Dando de baja…' : 'Dar de baja'}</button>
            : <button type="button" onClick={handleReactivar} disabled={cambiandoAlta} className={btnCls}><UserCheck size={14} className="text-texto-2" />{cambiandoAlta ? 'Reactivando…' : 'Reactivar'}</button>}
        </div>
      )}
    </div>
  )

  const cuerpo = showForm && canEdit ? formulario : (
    <>
      {!activo && (
        <div className="flex items-center gap-3 rounded-[16px] border border-[color-mix(in_oklch,var(--warning)_22%,transparent)] bg-warning-subtle py-3 pr-3 pl-4 text-[13px]">
          <UserMinus size={18} className="shrink-0 text-warning" aria-hidden />
          <p className="min-w-0 flex-1"><b className="font-medium">Dado de baja.</b> No aparece en Empleados, Vencimientos ni en el Inicio; sus certificados y archivos se conservan.</p>
          {canEdit && <button type="button" onClick={handleReactivar} disabled={cambiandoAlta} className={btnCls}>{cambiandoAlta ? 'Reactivando…' : 'Reactivar'}</button>}
        </div>
      )}
      <div className="rounded-2xl border border-border bg-bandeja p-1">
        <div className="grid grid-cols-[76px_minmax(0,1fr)] items-center gap-4 rounded-interno border border-border bg-card p-4 shadow-min">
          <div className="relative size-[76px]" role="img" aria-label={`${vigentes} de ${certs.length} certificados al día`}>
            <svg viewBox="0 0 76 76" className="size-[76px] -rotate-90">
              <circle cx="38" cy="38" r={R} fill="none" stroke="var(--muted)" strokeWidth="7" />
              <circle cx="38" cy="38" r={R} fill="none" stroke={vencidos ? 'var(--rojo-g)' : proximos ? 'var(--ambar-g)' : 'var(--verde-g)'} strokeWidth="7" strokeLinecap="round" strokeDasharray={CIR} strokeDashoffset={CIR * (1 - frac)} className="transition-[stroke-dashoffset] duration-700" />
            </svg>
            <b className="absolute inset-0 grid place-items-center text-xl font-medium tracking-[-0.02em]"><span>{vigentes}<small className="text-xs font-normal text-muted-foreground">/{certs.length}</small></span></b>
          </div>
          <div className="min-w-0">
            <div className="text-xl leading-tight font-medium tracking-[-0.02em]">{certs.length ? `${vigentes} de ${plural(certs.length, 'certificado', 'certificados')} al día` : 'Sin certificados'}</div>
            <div className="mt-1 text-[13px] text-texto-2">
              {proximoCert ? `Próximo: ${nombreTipo(proximoCert)}, ${diasHastaVencimiento(proximoCert.fecha_vencimiento!) === 0 ? 'hoy' : `en ${plural(diasHastaVencimiento(proximoCert.fecha_vencimiento!), 'día', 'días')}`}` : 'Nada por vencer'}
            </div>
            {(vencidos > 0 || proximos > 0) && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {vencidos > 0 && <Chip tono="ro">{plural(vencidos, 'vencido', 'vencidos')}</Chip>}
                {proximos > 0 && <Chip tono="am">{proximos} por vencer</Chip>}
              </div>
            )}
          </div>
        </div>
      </div>
      <div role="tablist" aria-label="Partes del legajo" className="flex max-w-full gap-0.5 self-start overflow-x-auto rounded-xl bg-muted p-[3px] [scrollbar-width:none]">
        {tabs.map((t) => (
          <button key={t.k} type="button" role="tab" aria-selected={pestana === t.k} onClick={() => { setPestana(t.k); setEditingEmpleado(false) }} className={clsx('inline-flex h-11 shrink-0 cursor-pointer items-center gap-1.5 rounded-[9px] px-3 text-[13px] font-medium whitespace-nowrap transition-colors md:h-7', pestana === t.k ? 'bg-card text-foreground shadow-[0_1px_2px_rgb(23_22_31/.1),0_0_0_1px_var(--border)] dark:bg-foreground dark:text-card' : 'text-texto-2 hover:text-foreground')}>
            {t.t}{t.n != null && <span className={pestana === t.k ? 'text-muted-foreground dark:text-card/70' : 'text-muted-foreground'}>{t.n}</span>}
          </button>
        ))}
      </div>
      <section className="-mt-2">
        {pestana === 'certs' && certificados}
        {pestana === 'sueldo' && veRecibos && (
          <RecibosSueldo empleadoId={empleado.id} empresaSlug={empleado.empresa?.slug ?? 'docs'} recibos={recibos} canEdit={canEdit} />
        )}
        {pestana === 'epp' && <EppEntregado movimientos={epp} empresaSlug={empleado.empresa?.slug ?? null} />}
        {pestana === 'datos' && datos}
      </section>
    </>
  )

  const pie = showForm && canEdit ? (
    <div className="flex items-center gap-2 border-t border-divisor bg-bandeja px-4 py-3 pb-[calc(12px+env(safe-area-inset-bottom))] md:px-5 md:pb-3">
      <span className="mr-auto hidden text-xs text-muted-foreground md:inline">Enter guarda · Esc cancela</span>
      <button type="button" onClick={resetForm} className="inline-flex h-[46px] flex-1 cursor-pointer items-center justify-center rounded-xl border border-border bg-card px-4 text-sm font-medium shadow-min hover:bg-hover md:h-[38px] md:flex-none">Cancelar</button>
      <button type="submit" form={formId} disabled={saving || !form.tipo_id} className="inline-flex h-[46px] flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground shadow-principal hover:bg-primary-hover disabled:opacity-50 md:h-[38px] md:flex-none dark:bg-foreground dark:text-card">
        <Check size={16} aria-hidden />{saving ? 'Guardando…' : renovando ? 'Guardar renovación' : editingId ? 'Guardar cambios' : 'Guardar certificado'}
      </button>
    </div>
  ) : (
    <div className="flex items-center gap-2 border-t border-divisor bg-bandeja px-4 py-3 pb-[calc(12px+env(safe-area-inset-bottom))] md:px-5 md:pb-3">
      {modo === 'hoja' && (
        <Link href={`/legajo/${empleado.id}`} className="mr-auto hidden h-9 items-center gap-1.5 text-[13px] font-medium text-texto-2 hover:text-foreground md:inline-flex"><ArrowSquareOut size={15} aria-hidden />Legajo completo</Link>
      )}
      {modo === 'pagina' && slug && (
        <Link href={`/stock?empresa=${slug}`} className="mr-auto hidden h-9 items-center gap-1.5 text-[13px] font-medium text-texto-2 hover:text-foreground md:inline-flex"><Package size={15} aria-hidden />Ir a Stock</Link>
      )}
      {canEdit && (
        <button type="button" onClick={abrirNuevo} className="inline-flex h-[46px] flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl bg-primary pr-4 pl-3 text-sm font-medium text-primary-foreground shadow-principal hover:bg-primary-hover md:h-[38px] md:flex-none dark:bg-foreground dark:text-card">
          <Plus size={17} aria-hidden />Agregar certificado
        </button>
      )}
    </div>
  )

  if (modo === 'hoja') {
    return (
      <>
        {cabecera}
        <div className="flex flex-1 flex-col gap-6 overflow-y-auto overscroll-contain p-4 md:px-5 md:pt-5 md:pb-6">{cuerpo}</div>
        {(canEdit || modo === 'hoja') && pie}
      </>
    )
  }

  // /legajo/[id]: la misma ficha, en una tarjeta en el panel (los links de siempre siguen llegando acá).
  return (
    <div className="px-4 pt-2 pb-24 text-sm md:px-7 md:pt-6 md:pb-10">
      <div className="mb-4 flex items-center gap-2 text-[13px] text-muted-foreground">
        <Link href={`/empresa/${slug}`} className="transition-colors hover:text-foreground">{empleado.empresa?.nombre}</Link>
        <span>/</span>
        <span className="font-medium text-foreground">{nombreCompleto}</span>
      </div>
      <div className="mx-auto flex max-w-[720px] flex-col overflow-hidden rounded-2xl border border-border bg-card">
        {cabecera}
        <div className="flex flex-col gap-6 p-4 md:p-5">{cuerpo}</div>
        {canEdit && pie}
      </div>
    </div>
  )
}
