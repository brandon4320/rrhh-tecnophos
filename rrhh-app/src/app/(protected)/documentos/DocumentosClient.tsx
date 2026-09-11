'use client'

import { useMemo, useRef, useState, type DragEvent } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import clsx from 'clsx'
import {
  ChevronLeft, ChevronRight, ExternalLink, FileText, Folder, FolderOpen, Plus, Trash2, Upload, Users, X,
} from 'lucide-react'
import { EstadoPill } from '@/components/ui/estado-pill'
import type { DocumentoMensual } from '@/types'
import { subirDocumento } from '@/lib/upload-client'
import { labelPeriodo } from '@/lib/recibos'
import {
  CARPETAS_FIJAS, CARPETA_RAIZ, CARPETA_RECIBOS, ESTADO_MES_LABEL, LABEL_RAIZ, MESES_CORTOS, agruparPorCarpeta, anioMesAR,
  carpetasDelMes, carpetasExtra, completitudMes, esCarpetaFija, estadoMes, fmtBytes, normalizarCarpeta, periodoActual,
  periodoAnterior, periodoDe, validarArchivoDocumento,
} from '@/modules/documentos/reglas'
import { fmtFechaAR } from '@/lib/fechas-ar'

interface Props {
  empresa: { id: string; nombre: string; slug: string }
  anio: number
  documentos: DocumentoMensual[]
  /** periodo → cantidad de empleados ACTIVOS con recibo mensual cargado en el legajo */
  recibosPorPeriodo: Record<string, number>
  empleadosActivos: number
  canEdit: boolean
}

const OTRA = '__otra__'
/** Subidas en paralelo: cada archivo son 3 requests (firma, PUT a R2, registro). */
const SUBIDAS_EN_PARALELO = 3

const inputCls =
  'w-full px-3.5 py-2.5 rounded-lg border border-input bg-card text-sm focus:outline-none focus:ring-2 focus:ring-ring'
const labelCls = 'mb-1 block text-xs font-medium text-foreground'
const btnPrimary =
  'inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50'
const btnMini = 'inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition-colors disabled:opacity-50'

/**
 * Réplica de las carpetas en disco de la oficinista: AÑO → MES → carpetas fijas
 * (+ sueltos). Los archivos van directo a R2 y la fila a documentos_mensuales
 * vía /api/documentos (RLS). Cuando exista la carga automática, esos archivos
 * aparecen acá mismo con origen='automatico' — la UI no cambia.
 *
 * Estado local `docs` + router.refresh(): misma convención que StockClient. Las
 * altas/bajas propias se reflejan al instante; lo que cargue otro usuario
 * aparece al cambiar de año/empresa o recargar.
 */
export default function DocumentosClient({ empresa, anio, documentos, recibosPorPeriodo, empleadosActivos, canEdit }: Props) {
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)
  // "Hoy" fijo por montaje (y en hora AR): así el SSR en UTC y el browser coinciden
  // y el memo de meses tiene una dependencia estable.
  const [hoy] = useState(() => new Date())
  const anioActual = anioMesAR(hoy).anio
  const limiteActual = periodoActual(hoy)

  const [docs, setDocs] = useState<DocumentoMensual[]>(documentos)
  const [mesSel, setMesSel] = useState<number>(() => {
    if (anio < anioActual) return 12
    if (anio > anioActual) return 1
    const ant = periodoAnterior(hoy)
    return ant.startsWith(String(anio)) ? Number(ant.slice(5, 7)) : 1
  })
  const [form, setForm] = useState<{ abierto: boolean; mes: number; carpeta: string; otra: string; notas: string; archivos: File[] }>({
    abierto: false, mes: mesSel, carpeta: CARPETAS_FIJAS[0], otra: '', notas: '', archivos: [],
  })
  const [progreso, setProgreso] = useState<{ actual: number; total: number } | null>(null)
  const subiendo = progreso !== null
  const [borrando, setBorrando] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState<string | null>(null)

  // ── Derivados por mes ──
  const meses = useMemo(() => {
    const porPeriodo = new Map<string, DocumentoMensual[]>()
    for (const d of docs) {
      if (!porPeriodo.has(d.periodo)) porPeriodo.set(d.periodo, [])
      porPeriodo.get(d.periodo)!.push(d)
    }
    return Array.from({ length: 12 }, (_, i) => {
      const periodo = periodoDe(anio, i + 1)
      const delMes = porPeriodo.get(periodo) ?? []
      const conRecibo = recibosPorPeriodo[periodo] ?? 0
      const recibosCompletos = empleadosActivos > 0 && conRecibo >= empleadosActivos
      const completitud = completitudMes(delMes, recibosCompletos ? [CARPETA_RECIBOS] : [])
      return {
        mes: i + 1, periodo, docs: delMes, conRecibo, recibosCompletos, completitud,
        estado: estadoMes(periodo, completitud, delMes.length, hoy),
      }
    })
  }, [docs, anio, recibosPorPeriodo, empleadosActivos, hoy])

  const actual = meses[mesSel - 1]
  const porCarpeta = useMemo(() => agruparPorCarpeta(actual.docs), [actual])
  const carpetas = useMemo(() => carpetasDelMes(actual.docs), [actual])
  // Carpetas extra de TODO el año, para ofrecerlas en el selector del formulario.
  const extrasDelAnio = useMemo(() => carpetasExtra(docs), [docs])

  // "X de Y meses completos" se mide sobre los meses ya transcurridos, para que
  // completar el mes en curso no dé "9 de 8".
  const transcurridos = meses.filter((m) => m.periodo < limiteActual)
  const completos = transcurridos.filter((m) => m.estado === 'vigente').length

  // ── Formulario de carga ──
  function abrirCarga(carpeta: string, archivos: File[] = []) {
    if (subiendo) {
      toast.error('Esperá a que termine la carga en curso.')
      return
    }
    const conocida = esCarpetaFija(carpeta) || extrasDelAnio.includes(carpeta) || carpeta === CARPETA_RAIZ
    setForm({ abierto: true, mes: mesSel, carpeta: conocida ? carpeta : OTRA, otra: conocida ? '' : carpeta, notas: '', archivos })
  }
  function cerrarCarga() {
    setForm((f) => ({ ...f, abierto: false, archivos: [], notas: '', otra: '' }))
    if (fileRef.current) fileRef.current.value = ''
  }
  function agregarArchivos(lista: FileList | File[] | null) {
    if (!lista || subiendo) return
    const nuevos = Array.from(lista)
    setForm((f) => {
      const claves = new Set(f.archivos.map((a) => `${a.name}|${a.size}`))
      return { ...f, archivos: [...f.archivos, ...nuevos.filter((a) => !claves.has(`${a.name}|${a.size}`))] }
    })
  }
  function quitarArchivo(i: number) {
    setForm((f) => ({ ...f, archivos: f.archivos.filter((_, idx) => idx !== i) }))
  }

  async function subir() {
    if (subiendo) return
    if (form.archivos.length === 0) return toast.error('Elegí al menos un archivo.')
    const carpeta = form.carpeta === OTRA ? normalizarCarpeta(form.otra) : form.carpeta
    if (form.carpeta === OTRA && !carpeta) return toast.error('Escribí el nombre de la carpeta.')
    for (const a of form.archivos) {
      const invalido = validarArchivoDocumento(a)
      if (invalido) return toast.error(invalido)
    }
    const periodo = periodoDe(anio, form.mes)
    const archivos = form.archivos
    const opts = { empresaId: empresa.id, periodo: periodo.slice(0, 7), carpeta, notas: form.notas }
    const total = archivos.length
    let hechos = 0
    let ok = 0
    const errores: string[] = []
    setProgreso({ actual: 0, total })

    // Pool chico: N subidas en vuelo, cada una firma → PUT → registra.
    let siguiente = 0
    const worker = async () => {
      while (siguiente < archivos.length) {
        const a = archivos[siguiente++]
        try {
          const nuevo = await subirDocumento(a, opts)
          setDocs((prev) => [nuevo as DocumentoMensual, ...prev])
          ok++
        } catch (e) {
          errores.push(e instanceof Error ? e.message : `No se pudo cargar "${a.name}".`)
        } finally {
          hechos++
          setProgreso({ actual: hechos, total })
        }
      }
    }
    await Promise.all(Array.from({ length: Math.min(SUBIDAS_EN_PARALELO, total) }, worker))

    setProgreso(null)
    if (ok > 0) {
      toast.success(`${ok} ${ok === 1 ? 'archivo cargado' : 'archivos cargados'} en ${carpeta || LABEL_RAIZ.toLowerCase()} · ${labelPeriodo(periodo)}.`)
      setMesSel(form.mes)
      cerrarCarga()
      router.refresh()
    }
    for (const err of errores) toast.error(err)
  }

  // ── Acciones sobre archivos ──
  async function ver(d: DocumentoMensual) {
    const res = await fetch(`/api/archivo?path=${encodeURIComponent(d.path)}`)
    if (!res.ok) return toast.error('No se pudo abrir el archivo.')
    const { url } = await res.json()
    window.open(url, '_blank', 'noopener,noreferrer')
  }
  async function eliminar(d: DocumentoMensual) {
    if (!confirm(`¿Eliminar "${d.nombre_archivo}" de ${labelPeriodo(d.periodo)}?`)) return
    setBorrando(d.id)
    const res = await fetch(`/api/documentos?id=${d.id}`, { method: 'DELETE' })
    setBorrando(null)
    if (!res.ok) {
      const payload = await res.json().catch(() => null)
      return toast.error(payload?.error ?? 'No se pudo eliminar el archivo.')
    }
    setDocs((prev) => prev.filter((x) => x.id !== d.id))
    toast.success('Archivo eliminado.')
    router.refresh()
  }

  // ── Drag & drop sobre una carpeta ──
  function onDragOver(e: DragEvent, carpeta: string) {
    if (!canEdit || subiendo) return
    e.preventDefault()
    if (dragOver !== carpeta) setDragOver(carpeta)
  }
  function onDrop(e: DragEvent, carpeta: string) {
    if (!canEdit || subiendo) return
    e.preventDefault()
    setDragOver(null)
    const archivos = Array.from(e.dataTransfer.files ?? [])
    if (archivos.length === 0) return
    abrirCarga(carpeta, archivos)
  }

  const opcionesCarpeta = [...CARPETAS_FIJAS, ...extrasDelAnio]

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6 lg:p-8">
      {/* ── Header ── */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Documentación mensual</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {empresa.nombre}
            {transcurridos.length > 0 && ` · ${completos} de ${transcurridos.length} ${transcurridos.length === 1 ? 'mes completo' : 'meses completos'}`}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex items-center rounded-lg border border-border bg-card">
            <Link href={`/documentos?empresa=${empresa.slug}&anio=${anio - 1}`} className="p-2 text-muted-foreground hover:text-foreground" aria-label="Año anterior">
              <ChevronLeft className="size-4" strokeWidth={2} />
            </Link>
            <span className="px-2 text-sm font-semibold tabular-nums">{anio}</span>
            {anio < anioActual + 1 ? (
              <Link href={`/documentos?empresa=${empresa.slug}&anio=${anio + 1}`} className="p-2 text-muted-foreground hover:text-foreground" aria-label="Año siguiente">
                <ChevronRight className="size-4" strokeWidth={2} />
              </Link>
            ) : (
              <span className="p-2 text-muted-foreground/40"><ChevronRight className="size-4" strokeWidth={2} /></span>
            )}
          </div>
          {canEdit && (
            <button onClick={() => abrirCarga(CARPETAS_FIJAS[0])} className={btnPrimary} disabled={subiendo}>
              <Upload className="size-4" strokeWidth={2} />
              Cargar archivos
            </button>
          )}
        </div>
      </div>

      {/* ── Meses ── */}
      <div className="grid grid-cols-4 gap-2 sm:grid-cols-6 lg:grid-cols-12">
        {meses.map((m) => {
          const sel = m.mes === mesSel
          return (
            <button
              key={m.mes}
              onClick={() => setMesSel(m.mes)}
              className={clsx(
                'rounded-xl border px-2.5 py-2 text-left transition-colors',
                sel ? 'border-primary bg-primary/5' : 'border-border bg-card hover:bg-muted'
              )}
              title={`${labelPeriodo(m.periodo)} · ${ESTADO_MES_LABEL[m.estado]}`}
            >
              <div className="flex items-baseline justify-between">
                <span className={clsx('text-sm font-medium', sel ? 'text-primary' : 'text-foreground')}>{MESES_CORTOS[m.mes - 1]}</span>
                <span className="text-[11px] tabular-nums text-muted-foreground">
                  {m.completitud.completas.length}/{m.completitud.total}
                </span>
              </div>
              <div className="mt-1.5 flex gap-0.5">
                {CARPETAS_FIJAS.map((c) => (
                  <span
                    key={c}
                    className={clsx('h-1 flex-1 rounded-full', m.completitud.completas.includes(c) ? 'bg-primary' : 'bg-border')}
                  />
                ))}
              </div>
            </button>
          )
        })}
      </div>

      {/* ── Formulario de carga ── */}
      {canEdit && form.abierto && (
        <div className="rounded-2xl border border-primary/30 bg-primary/5 p-5">
          <div className="mb-4 flex items-center justify-between">
            <p className="text-sm font-semibold text-foreground">Cargar archivos</p>
            <button onClick={cerrarCarga} className="text-muted-foreground hover:text-foreground disabled:opacity-50" aria-label="Cerrar" disabled={subiendo}>
              <X className="size-4" strokeWidth={2} />
            </button>
          </div>
          <fieldset disabled={subiendo} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className={labelCls}>Mes *</label>
              <select value={form.mes} onChange={(e) => setForm((f) => ({ ...f, mes: Number(e.target.value) }))} className={inputCls}>
                {meses.map((m) => (
                  <option key={m.mes} value={m.mes}>{labelPeriodo(m.periodo)}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>Carpeta *</label>
              <select value={form.carpeta} onChange={(e) => setForm((f) => ({ ...f, carpeta: e.target.value }))} className={inputCls}>
                {opcionesCarpeta.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
                <option value={CARPETA_RAIZ}>{LABEL_RAIZ}</option>
                <option value={OTRA}>Otra carpeta…</option>
              </select>
            </div>
            {form.carpeta === OTRA && (
              <div className="sm:col-span-2">
                <label className={labelCls}>Nombre de la carpeta nueva *</label>
                <input type="text" value={form.otra} onChange={(e) => setForm((f) => ({ ...f, otra: e.target.value }))} className={inputCls} placeholder="Ej.: Seguros, Sindicato, Habilitaciones…" autoFocus />
              </div>
            )}
            <div className="sm:col-span-2">
              <label className={labelCls}>
                Archivos * <span className="font-normal text-muted-foreground">(PDF, imágenes, Excel, Word, TXT o ZIP · hasta 25 MB cada uno · podés elegir varios)</span>
              </label>
              <input
                ref={fileRef}
                type="file"
                multiple
                accept=".pdf,.jpg,.jpeg,.png,.webp,.xls,.xlsx,.csv,.doc,.docx,.txt,.zip,application/pdf,image/*"
                onChange={(e) => { agregarArchivos(e.target.files); e.target.value = '' }}
                className="block w-full text-sm text-muted-foreground file:mr-3 file:rounded-lg file:border-0 file:bg-muted file:px-3 file:py-2 file:text-sm file:font-medium file:text-foreground hover:file:bg-accent"
              />
              {form.archivos.length > 0 && (
                <ul className="mt-2 divide-y divide-border overflow-hidden rounded-lg border border-border bg-card">
                  {form.archivos.map((a, i) => (
                    <li key={`${a.name}|${a.size}`} className="flex items-center gap-3 px-3 py-2 text-sm">
                      <FileText className="size-4 shrink-0 text-muted-foreground" strokeWidth={1.75} />
                      <span className="min-w-0 flex-1 truncate">{a.name}</span>
                      <span className="text-xs tabular-nums text-muted-foreground">{fmtBytes(a.size)}</span>
                      <button onClick={() => quitarArchivo(i)} className="text-muted-foreground hover:text-foreground disabled:opacity-50" aria-label="Quitar">
                        <X className="size-3.5" strokeWidth={2} />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="sm:col-span-2">
              <label className={labelCls}>Notas</label>
              <input type="text" value={form.notas} onChange={(e) => setForm((f) => ({ ...f, notas: e.target.value }))} className={inputCls} placeholder="Opcional: rectificativa, complementaria, etc." />
            </div>
          </fieldset>
          <div className="mt-4 flex items-center gap-3">
            <button onClick={subir} disabled={subiendo || form.archivos.length === 0} className={btnPrimary}>
              <Upload className="size-4" strokeWidth={2} />
              {progreso
                ? `Subiendo ${progreso.actual} de ${progreso.total}…`
                : form.archivos.length > 1 ? `Cargar ${form.archivos.length} archivos` : 'Cargar archivo'}
            </button>
            <button onClick={cerrarCarga} className="px-2 py-2 text-sm text-muted-foreground hover:text-foreground disabled:opacity-50" disabled={subiendo}>
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* ── Mes seleccionado ── */}
      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-lg font-semibold tracking-tight">{labelPeriodo(actual.periodo)}</h2>
            <EstadoPill estado={actual.estado} label={ESTADO_MES_LABEL[actual.estado]} />
            {actual.completitud.faltantes.length > 0 && actual.completitud.faltantes.length < CARPETAS_FIJAS.length && (
              <span className="text-xs text-muted-foreground">Faltan: {actual.completitud.faltantes.join(', ')}</span>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            {actual.docs.length === 0 ? 'Sin archivos' : `${actual.docs.length} ${actual.docs.length === 1 ? 'archivo' : 'archivos'}`}
            {canEdit && ' · arrastrá archivos a una carpeta para cargarlos ahí'}
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {[...carpetas, CARPETA_RAIZ].map((c) => {
            const esRaiz = c === CARPETA_RAIZ
            const docsCarpeta = porCarpeta.get(c) ?? []
            return (
              <CarpetaCard
                key={c || '__raiz__'}
                nombre={esRaiz ? LABEL_RAIZ : c}
                docs={docsCarpeta}
                canEdit={canEdit}
                subiendo={subiendo}
                // Con contenido se pinta con el acento; la de recibos también si el legajo ya la cubre.
                cubierta={docsCarpeta.length > 0 || (c === CARPETA_RECIBOS && actual.recibosCompletos)}
                suelta={esRaiz}
                dragOver={dragOver === c}
                borrando={borrando}
                className={esRaiz ? 'sm:col-span-2 xl:col-span-3' : undefined}
                onAgregar={() => abrirCarga(c)}
                onVer={ver}
                onEliminar={eliminar}
                onDragOver={(e) => onDragOver(e, c)}
                onDragLeave={() => setDragOver(null)}
                onDrop={(e) => onDrop(e, c)}
                extra={
                  c === CARPETA_RECIBOS ? (
                    <div className="flex items-center justify-between gap-2 rounded-lg bg-muted/60 px-3 py-2 text-xs">
                      <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                        <Users className="size-3.5" strokeWidth={2} />
                        {empleadosActivos === 0
                          ? 'Sin empleados activos'
                          : `${actual.conRecibo} de ${empleadosActivos} empleados activos con recibo en el legajo`}
                      </span>
                      <Link href={`/empleados?empresa=${empresa.slug}`} className="shrink-0 font-medium text-primary hover:underline">
                        Ver empleados
                      </Link>
                    </div>
                  ) : null
                }
              />
            )
          })}
        </div>
      </section>
    </div>
  )
}

// ── Carpeta ─────────────────────────────────────────────────────────────────

function CarpetaCard({
  nombre, docs, canEdit, subiendo, cubierta, suelta, dragOver, borrando, extra, className,
  onAgregar, onVer, onEliminar, onDragOver, onDragLeave, onDrop,
}: {
  nombre: string
  docs: DocumentoMensual[]
  canEdit: boolean
  subiendo: boolean
  cubierta: boolean
  suelta?: boolean
  dragOver: boolean
  borrando: string | null
  extra?: React.ReactNode
  className?: string
  onAgregar: () => void
  onVer: (d: DocumentoMensual) => void
  onEliminar: (d: DocumentoMensual) => void
  onDragOver: (e: DragEvent) => void
  onDragLeave: () => void
  onDrop: (e: DragEvent) => void
}) {
  const Icono = docs.length > 0 ? FolderOpen : Folder
  return (
    <div
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      className={clsx(
        'flex flex-col rounded-2xl border bg-card transition-colors',
        dragOver ? 'border-primary bg-primary/5' : 'border-border',
        className
      )}
    >
      <div className="flex items-center gap-3 px-4 py-3">
        <span className={clsx('inline-flex size-8 shrink-0 items-center justify-center rounded-lg', cubierta ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground')}>
          <Icono className="size-4" strokeWidth={1.75} />
        </span>
        <div className="min-w-0 flex-1">
          <p className={clsx('truncate text-sm font-medium', suelta ? 'text-muted-foreground' : 'text-foreground')}>{nombre}</p>
          <p className="text-[11px] text-muted-foreground">
            {docs.length === 0 ? 'Vacía' : `${docs.length} ${docs.length === 1 ? 'archivo' : 'archivos'}`}
          </p>
        </div>
        {canEdit && (
          <button onClick={onAgregar} disabled={subiendo} className={clsx(btnMini, 'bg-primary/10 text-primary hover:bg-primary/20')} title={`Agregar a ${nombre}`}>
            <Plus className="size-3.5" strokeWidth={2.5} />
            Agregar
          </button>
        )}
      </div>

      {extra && <div className="px-4 pb-3">{extra}</div>}

      {docs.length > 0 && (
        <ul className="divide-y divide-border border-t border-border">
          {docs.map((d) => (
            <li key={d.id} className="flex items-center gap-3 px-4 py-2.5">
              <FileText className="size-4 shrink-0 text-muted-foreground" strokeWidth={1.75} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-foreground" title={d.nombre_archivo}>{d.nombre_archivo}</p>
                <p className="truncate text-[11px] text-muted-foreground">
                  {[fmtBytes(d.size_bytes), d.created_at ? `cargado el ${fmtFechaAR(d.created_at)}` : '', d.origen === 'automatico' ? 'automático' : '', d.notas ?? '']
                    .filter(Boolean).join(' · ')}
                </p>
              </div>
              <button onClick={() => onVer(d)} className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-primary hover:underline">
                Ver <ExternalLink className="size-3" strokeWidth={2} />
              </button>
              {canEdit && (
                <button
                  onClick={() => onEliminar(d)}
                  disabled={borrando === d.id}
                  className="shrink-0 text-danger/70 hover:text-danger disabled:opacity-50"
                  title="Eliminar archivo"
                >
                  <Trash2 className="size-3.5" strokeWidth={1.75} />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
