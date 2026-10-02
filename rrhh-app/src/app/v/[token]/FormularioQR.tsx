'use client'

import { useEffect, useEffectEvent, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import {
  AlertTriangle, Camera, Check, ChevronLeft, ClipboardCheck, Loader2, RotateCcw, Wrench, X,
} from 'lucide-react'
import { EstadoPill } from '@/components/ui/estado-pill'
import type { EstadoVencimiento } from '@/types'
import { cn } from '@/lib/utils'
import { fmtFechaAR } from '@/lib/fechas-ar'
import {
  ESTADO_CHECKLIST_LABEL, FOTOS_CHECKLIST, ITEMS_CHECKLIST, RESULTADO_LABEL, SECCIONES_CHECKLIST, SLOT_NOVEDAD,
  calcularResultado, evaluarKm, fmtDia, fotosFaltantes, frecuenciaChecklist, hastaCuando, itemsSinResponder,
  kmPideConfirmacion,
  type EstadoChecklist, type EstadoChecklistInfo, type Respuesta, type Resultado, type SlotFoto,
} from '@/modules/flota/reglas'

export interface DocumentoQR {
  nombre: string
  vence: string
  estado: EstadoVencimiento
}

interface Props {
  token: string
  vehiculo: {
    patente: string; detalle: string | null; empresa: string
    kmActual: number | null; kmActualizadoAt: string | null; cadaDias: number
  }
  empleados: { id: string; nombre: string }[]
  ultimo: { fecha: string; quien: string; km: number | null } | null
  estado: EstadoChecklistInfo
  documentos: DocumentoQR[]
}

interface Borrador {
  /** Lo genera el celular al empezar: un reintento con el mismo id no se guarda dos veces. */
  envioId: string
  /** Cuándo se empezó (ms) y de qué período es: un borrador viejo se descarta. */
  iniciadoAt: number
  periodo: string
  /** Dónde estaba: si la cámara cierra la pestaña (celulares viejos), se retoma ahí. */
  modo: 'inicio' | 'checklist'
  paso: number
  realizadoPor: string
  nombreLibre: string
  km: string
  /** El km que se confirmó a mano (primera lectura altísima). */
  kmConfirmado: string
  fotos: Record<string, string>
  respuestas: Record<string, Respuesta>
  notas: Record<string, string>
  danio: string
  fotosDanio: string[]
  observaciones: string
}

const BORRADOR_VACIO: Borrador = {
  envioId: '', iniciadoAt: 0, periodo: '', modo: 'inicio', paso: 0,
  realizadoPor: '', nombreLibre: '', km: '', kmConfirmado: '', fotos: {}, respuestas: {}, notas: {},
  danio: '', fotosDanio: [], observaciones: '',
}
const OTRO = '__otro'
const PASOS = ['Quién y kilómetros', 'Fotos', 'Revisión', 'Cierre'] as const

/** Un borrador de más de 12 horas no es "el checklist de hoy": se descarta. */
const VIGENCIA_BORRADOR_MS = 12 * 60 * 60 * 1000
const TIMEOUT_FOTO_MS = 45_000
const TIMEOUT_ENVIO_MS = 30_000
/** Espera antes de cada reintento automático de una foto (hasta 3). */
const ESPERAS_REINTENTO_MS = [2_000, 6_000, 15_000]
const MAX_FOTOS_EXTRA = 6
const TIPOS_FOTO = ['image/jpeg', 'image/png', 'image/webp']

const ESTADO_PILL: Record<EstadoChecklist, EstadoVencimiento> = {
  al_dia: 'vigente', vence_pronto: 'proximo', vencido: 'vencido', nunca: 'sin_fecha',
}

const GRAVEDADES = [
  { value: 'baja', label: 'Puede esperar' },
  { value: 'media', label: 'Hay que verlo pronto' },
  { value: 'alta', label: 'No se puede usar' },
] as const
const NOVEDADES_RAPIDAS = ['Golpe o rayón', 'Pinchadura', 'Falla mecánica', 'Luz quemada', 'Ruido raro']

const NOVEDAD_VACIA = { envioId: '', titulo: '', descripcion: '', gravedad: 'media', km: '', fotos: [] as string[] }

/** Foto sacada que todavía no está en el server. El blob queda en memoria para reintentar sin sacarla de nuevo. */
interface FotoPendiente {
  destino: 'checklist' | 'danio' | 'novedad'
  /** Slot que se manda al server (el del checklist, o `novedad`). */
  slot: string
  blob: Blob | null
  preview: string
  estado: 'subiendo' | 'error'
  error: string | null
}

// ── Persistencia local (el borrador sobrevive a un corte de señal o un reload) ──

function leer<T>(clave: string, fallback: T): T {
  try {
    const crudo = localStorage.getItem(clave)
    return crudo ? { ...fallback, ...JSON.parse(crudo) } : fallback
  } catch {
    return fallback
  }
}
function guardar(clave: string, valor: unknown) {
  try { localStorage.setItem(clave, JSON.stringify(valor)) } catch { /* sin almacenamiento: seguimos igual */ }
}
function borrar(clave: string) {
  try { localStorage.removeItem(clave) } catch { /* idem */ }
}

/** uuid v4. `crypto.randomUUID` no existe en los Chrome más viejos. */
function nuevoId(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  const b = new Uint8Array(16)
  crypto.getRandomValues(b)
  b[6] = (b[6] & 0x0f) | 0x40
  b[8] = (b[8] & 0x3f) | 0x80
  const h = Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('')
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`
}

function nuevoBorrador(periodo: string, quien: { realizadoPor: string; nombreLibre: string }): Borrador {
  return { ...BORRADOR_VACIO, ...quien, envioId: nuevoId(), iniciadoAt: Date.now(), periodo }
}

function tieneContenido(b: Borrador): boolean {
  return Boolean(b.km || Object.keys(b.fotos).length || Object.keys(b.respuestas).length)
}

function pasoValidoDe(n: unknown): number {
  const p = Math.trunc(Number(n))
  return Number.isFinite(p) ? Math.min(Math.max(p, 0), PASOS.length - 1) : 0
}

const esperar = (ms: number) => new Promise<void>((res) => setTimeout(res, ms))

/**
 * Achica la foto en el celular antes de subirla: una foto de cámara pesa 3–8 MB
 * y en una planta la señal es mala. A 1600 px y JPEG 72% queda en ~300–500 KB
 * y se lee perfecto (dibujo de las cubiertas, números del odómetro).
 */
async function comprimir(file: File): Promise<Blob> {
  const url = URL.createObjectURL(file)
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => {
      const i = new Image()
      i.onload = () => res(i)
      i.onerror = () => rej(new Error('formato'))
      i.src = url
    })
    const escala = Math.min(1, 1600 / Math.max(img.naturalWidth, img.naturalHeight))
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(img.naturalWidth * escala)
    canvas.height = Math.round(img.naturalHeight * escala)
    canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height)
    return await new Promise<Blob>((res, rej) =>
      canvas.toBlob((b) => (b ? res(b) : rej(new Error('formato'))), 'image/jpeg', 0.72)
    )
  } finally {
    URL.revokeObjectURL(url)
  }
}

export default function FormularioQR({ token, vehiculo, empleados, ultimo, estado, documentos }: Props) {
  const claveBorrador = `flota-checklist:${token}`
  const [modo, setModo] = useState<'inicio' | 'checklist' | 'novedad' | 'listo'>('inicio')
  const [paso, setPaso] = useState(0)
  const [b, setB] = useState<Borrador>(BORRADOR_VACIO)
  const [aviso, setAviso] = useState<string | null>(null)
  const [pendientes, setPendientes] = useState<Record<string, FotoPendiente>>({})
  const [previews, setPreviews] = useState<Record<string, string>>({})
  const [enviando, setEnviando] = useState(false)
  const [resultado, setResultado] = useState<{ titulo: string; detalle: string[]; tono: 'ok' | 'aviso' | 'grave' } | null>(null)
  // Versión de cada foto: si se saca otra (o se descarta) mientras la anterior
  // se sube, el resultado de la vieja se ignora.
  const versiones = useRef(new Map<string, number>())
  const enCurso = useRef(new Map<string, number>())

  // Novedad suelta
  const [nov, setNov] = useState(NOVEDAD_VACIA)

  // Borrador previo y la última persona que usó este celular. Un borrador de
  // otro período o de más de 12 horas se descarta; uno vigente se retoma donde
  // estaba (la cámara de algunos Android cierra la pestaña y la recarga).
  useEffect(() => {
    const previo = leer<Borrador>(claveBorrador, BORRADOR_VACIO)
    const quien = previo.realizadoPor
      ? { realizadoPor: previo.realizadoPor, nombreLibre: previo.nombreLibre }
      : leer<{ realizadoPor: string; nombreLibre: string }>('flota-quien', { realizadoPor: '', nombreLibre: '' })
    if (tieneContenido(previo)) {
      // Un borrador de antes de este formato no trae estos datos: se toma como recién empezado.
      const adoptado: Borrador = {
        ...previo,
        envioId: previo.envioId || nuevoId(),
        iniciadoAt: previo.iniciadoAt || Date.now(),
        periodo: previo.periodo || estado.periodo.desde,
        paso: pasoValidoDe(previo.paso),
      }
      const viejo = Date.now() - adoptado.iniciadoAt > VIGENCIA_BORRADOR_MS || adoptado.periodo !== estado.periodo.desde
      if (!viejo) {
        guardar(claveBorrador, adoptado)
        setB(adoptado)
        if (adoptado.modo === 'checklist') {
          setModo('checklist')
          setPaso(adoptado.paso)
          setAviso('Seguimos donde habías quedado. Si estabas sacando una foto, sacala de nuevo.')
        }
        return
      }
      borrar(claveBorrador)
      setAviso('El checklist que habías empezado era de otro día y se descartó: hay que hacerlo de nuevo.')
    }
    setB(nuevoBorrador(estado.periodo.desde, quien))
  }, [claveBorrador, estado.periodo.desde])

  function actualizar(cambio: Partial<Borrador> | ((prev: Borrador) => Borrador)) {
    setB((prev) => {
      const next = typeof cambio === 'function' ? cambio(prev) : { ...prev, ...cambio }
      guardar(claveBorrador, next)
      return next
    })
  }

  function irAPaso(n: number) {
    setPaso(n)
    setAviso(null)
    actualizar({ modo: 'checklist', paso: n })
    window.scrollTo({ top: 0 })
  }

  function empezarChecklist() {
    setModo('checklist')
    setAviso(null)
    if (tieneContenido(b)) {
      setPaso(pasoValidoDe(b.paso))
      actualizar({ modo: 'checklist' })
    } else {
      // Recién ahora empieza de verdad: de acá cuentan las 12 horas.
      setPaso(0)
      actualizar({ modo: 'checklist', paso: 0, iniciadoAt: Date.now(), periodo: estado.periodo.desde, envioId: b.envioId || nuevoId() })
    }
  }

  function volverAlInicio() {
    setModo('inicio')
    actualizar({ modo: 'inicio' })
  }

  const quienOk = (b.realizadoPor && b.realizadoPor !== OTRO) || (b.realizadoPor === OTRO && b.nombreLibre.trim().length >= 3)
  const kmNum = Number(b.km)
  const kmOk = b.km !== '' && Number.isInteger(kmNum) && kmNum >= 0
  const pideConfirmarKm = kmOk && kmPideConfirmacion(kmNum, vehiculo.kmActual)
  const kmConfirmadoOk = !pideConfirmarKm || b.kmConfirmado === b.km
  const sinResponder = itemsSinResponder(b.respuestas)
  const resultadoPrevio: Resultado = calcularResultado(b.respuestas)
  const criticosMal = ITEMS_CHECKLIST.filter((i) => i.critico && b.respuestas[i.id] === 'no_ok')

  // Fotos: subidas (en el borrador) y pendientes (en memoria, subiéndose o con error).
  const faltanFotos = fotosFaltantes(b.fotos)
  const faltanSacar = faltanFotos.filter((f) => !pendientes[f.slot])
  const pendientesChecklist = Object.entries(pendientes).filter(([, p]) => p.destino !== 'novedad')
  const pendientesNovedad = Object.entries(pendientes).filter(([, p]) => p.destino === 'novedad')
  const subiendoN = pendientesChecklist.filter(([, p]) => p.estado === 'subiendo').length
  const conError = pendientesChecklist.filter(([, p]) => p.estado === 'error')

  const datosOk = Boolean(quienOk && kmOk && kmConfirmadoOk)
  const listoParaEnviar = datosOk && faltanFotos.length === 0 && pendientesChecklist.length === 0 && sinResponder.length === 0
  // Se puede avanzar con fotos subiéndose: recién Enviar espera a que estén todas arriba.
  const pasoValido = [datosOk, faltanSacar.length === 0, sinResponder.length === 0, listoParaEnviar][paso]

  // El mismo control que hace el server al guardar (reglas.ts).
  const kmAviso = useMemo(() => {
    if (!kmOk) return null
    const ev = evaluarKm(kmNum, { km: vehiculo.kmActual, fecha: vehiculo.kmActualizadoAt })
    return ev.inconsistente ? `${ev.motivo}. Revisá el tablero; si está bien, seguí igual: lo revisa tu encargado.` : null
  }, [kmOk, kmNum, vehiculo.kmActual, vehiculo.kmActualizadoAt])

  // ── Fotos: subida con timeout, reintentos y el blob guardado en memoria ──

  function cambiarPendiente(clave: string, version: number, cambio: Partial<FotoPendiente> | null) {
    if (versiones.current.get(clave) !== version) return
    setPendientes((prev) => {
      if (!prev[clave]) return prev
      const next = { ...prev }
      if (cambio) next[clave] = { ...prev[clave], ...cambio }
      else delete next[clave]
      return next
    })
  }

  async function intentarSubida(slot: string, blob: Blob): Promise<{ ok: true; path: string } | { ok: false; error: string; reintentable: boolean }> {
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_FOTO_MS)
    try {
      const fd = new FormData()
      fd.append('slot', slot)
      fd.append('archivo', blob, 'foto.jpg')
      const res = await fetch(`/api/v/${token}/foto`, { method: 'POST', body: fd, signal: ctrl.signal })
      const json = await res.json().catch(() => ({}))
      if (res.ok && json.path) return { ok: true, path: json.path as string }
      return {
        ok: false,
        error: json.error ?? 'No se pudo subir la foto.',
        reintentable: res.status >= 500 || res.status === 408 || res.status === 429,
      }
    } catch {
      return { ok: false, error: ctrl.signal.aborted ? 'Tardó demasiado: la señal está lenta.' : 'Sin conexión.', reintentable: true }
    } finally {
      clearTimeout(timer)
    }
  }

  async function subir(clave: string, p: FotoPendiente) {
    const version = versiones.current.get(clave) ?? 0
    if (!p.blob || enCurso.current.get(clave) === version) return
    enCurso.current.set(clave, version)
    cambiarPendiente(clave, version, { estado: 'subiendo', error: null })
    try {
      let error = 'No se pudo subir la foto.'
      for (let intento = 0; intento <= ESPERAS_REINTENTO_MS.length; intento++) {
        if (intento > 0) await esperar(ESPERAS_REINTENTO_MS[intento - 1])
        if (versiones.current.get(clave) !== version) return
        const r = await intentarSubida(p.slot, p.blob)
        if (versiones.current.get(clave) !== version) return
        if (r.ok) {
          fotoSubida(clave, version, p, r.path)
          return
        }
        error = r.error
        // Sin señal no tiene sentido insistir: se reintenta sola cuando vuelve (evento `online`).
        if (!r.reintentable || !navigator.onLine) break
      }
      cambiarPendiente(clave, version, { estado: 'error', error })
    } finally {
      if (enCurso.current.get(clave) === version) enCurso.current.delete(clave)
    }
  }

  function fotoSubida(clave: string, version: number, p: FotoPendiente, path: string) {
    if (versiones.current.get(clave) !== version) return
    if (p.destino === 'checklist') {
      actualizar((prev) => ({ ...prev, fotos: { ...prev.fotos, [p.slot]: path } }))
      setPreviews((prev) => ({ ...prev, [p.slot]: p.preview }))
    } else {
      URL.revokeObjectURL(p.preview)
      if (p.destino === 'danio') actualizar((prev) => ({ ...prev, fotosDanio: [...prev.fotosDanio, path] }))
      else setNov((n) => ({ ...n, fotos: [...n.fotos, path] }))
    }
    cambiarPendiente(clave, version, null)
  }

  async function nuevaFoto(destino: FotoPendiente['destino'], file: File | undefined, slotChecklist?: string) {
    if (!file) return
    const clave = destino === 'checklist' ? slotChecklist! : `${destino}:${nuevoId()}`
    const slot = destino === 'checklist' ? slotChecklist! : SLOT_NOVEDAD
    const version = (versiones.current.get(clave) ?? 0) + 1
    versiones.current.set(clave, version)
    setPendientes((prev) => ({ ...prev, [clave]: { destino, slot, blob: null, preview: '', estado: 'subiendo', error: null } }))

    let blob: Blob = file
    try {
      blob = await comprimir(file)
    } catch {
      // El navegador no pudo leer la foto (formato raro): se sube tal cual si se puede.
      if (!TIPOS_FOTO.includes(file.type) || file.size > 4 * 1024 * 1024) {
        cambiarPendiente(clave, version, null)
        toast.error('No se pudo procesar esa foto. Sacala de nuevo con la cámara.')
        return
      }
    }
    if (versiones.current.get(clave) !== version) return
    const p: FotoPendiente = { destino, slot, blob, preview: URL.createObjectURL(blob), estado: 'subiendo', error: null }
    setPendientes((prev) => (prev[clave] ? { ...prev, [clave]: p } : prev))
    void subir(clave, p)
  }

  function reintentar(clave: string) {
    const p = pendientes[clave]
    if (p) void subir(clave, p)
  }

  function reintentarConError() {
    for (const [clave, p] of Object.entries(pendientes)) if (p.estado === 'error') void subir(clave, p)
  }

  function descartarPendiente(clave: string) {
    const p = pendientes[clave]
    versiones.current.set(clave, (versiones.current.get(clave) ?? 0) + 1)
    setPendientes((prev) => {
      const next = { ...prev }
      delete next[clave]
      return next
    })
    if (p?.preview && p.destino !== 'checklist') URL.revokeObjectURL(p.preview)
  }

  // Cuando vuelve la señal, las fotos que no se subieron se reintentan solas.
  const alVolverLaSenal = useEffectEvent(() => reintentarConError())
  useEffect(() => {
    const alVolver = () => alVolverLaSenal()
    window.addEventListener('online', alVolver)
    return () => window.removeEventListener('online', alVolver)
  }, [])

  function responder(itemId: string, r: Respuesta) {
    actualizar((prev) => ({ ...prev, respuestas: { ...prev.respuestas, [itemId]: r } }))
  }

  function todoBienEnSeccion(seccionId: string) {
    const seccion = SECCIONES_CHECKLIST.find((s) => s.id === seccionId)!
    actualizar((prev) => {
      const respuestas = { ...prev.respuestas }
      // Solo lo que falta responder: una excepción ya marcada no se pisa.
      for (const item of seccion.items) if (!respuestas[item.id]) respuestas[item.id] = 'ok'
      return { ...prev, respuestas }
    })
  }

  function recordarQuien() {
    guardar('flota-quien', { realizadoPor: b.realizadoPor, nombreLibre: b.nombreLibre })
  }

  function descartarBorrador() {
    for (const [clave] of pendientesChecklist) descartarPendiente(clave)
    borrar(claveBorrador)
    setB(nuevoBorrador(estado.periodo.desde, { realizadoPor: b.realizadoPor, nombreLibre: b.nombreLibre }))
    setPreviews({})
    setAviso(null)
  }

  /** POST con timeout: con señal mala, mejor un mensaje claro que una rueda que gira para siempre. */
  async function enviar(cuerpo: Record<string, unknown>) {
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_ENVIO_MS)
    try {
      const res = await fetch(`/api/v/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cuerpo),
        signal: ctrl.signal,
      })
      const json = await res.json().catch(() => ({}))
      return { ok: res.ok, json }
    } catch {
      return { ok: false, json: {}, sinRespuesta: ctrl.signal.aborted ? ('timeout' as const) : ('red' as const) }
    } finally {
      clearTimeout(timer)
    }
  }

  async function enviarChecklist() {
    if (!listoParaEnviar || enviando) return
    setEnviando(true)
    const envioId = b.envioId || nuevoId()
    if (!b.envioId) actualizar({ envioId })
    const r = await enviar({
      tipo: 'checklist',
      envioId,
      realizadoPor: b.realizadoPor && b.realizadoPor !== OTRO ? b.realizadoPor : null,
      nombreLibre: b.nombreLibre,
      km: kmNum,
      respuestas: b.respuestas,
      notas: b.notas,
      fotos: b.fotos,
      danio: b.danio,
      fotosDanio: b.fotosDanio,
      observaciones: b.observaciones,
    })
    setEnviando(false)
    if ('sinRespuesta' in r) {
      toast.error(r.sinRespuesta === 'timeout'
        ? 'La señal está lenta y no llegó la respuesta. Tu checklist quedó guardado en este celular: tocá Enviar de nuevo, no se va a cargar dos veces.'
        : 'Sin conexión. Tu checklist quedó guardado en este celular: probá de nuevo cuando tengas señal.')
      return
    }
    const json = r.json
    if (!r.ok) {
      toast.error(json.error ?? 'No se pudo enviar el checklist. Probá de nuevo.')
      return
    }
    recordarQuien()
    borrar(claveBorrador)
    const detalle: string[] = []
    if (json.repetido) detalle.push('Ya lo habíamos recibido antes: no se cargó dos veces.')
    if (json.novedades > 0) {
      detalle.push(json.novedades === 1
        ? 'Se abrió 1 novedad para que tu encargado la revise.'
        : `Se abrieron ${json.novedades} novedades para que tu encargado las revise.`)
    }
    if (json.yaReportadas > 0) {
      detalle.push(json.yaReportadas === 1
        ? '1 falla ya estaba reportada y sigue sin resolver.'
        : `${json.yaReportadas} fallas ya estaban reportadas y siguen sin resolver.`)
    }
    if (json.resultado === 'no_apto') detalle.push('Tu encargado ya lo puede ver en el sistema. No la uses hasta que la revisen.')
    if (json.kmInconsistente) detalle.push('El kilometraje no coincide con el último registro: lo va a revisar tu encargado.')
    setResultado({
      titulo: json.resultadoLabel ?? 'Checklist enviado',
      detalle,
      tono: json.resultado === 'no_apto' ? 'grave' : json.resultado === 'observaciones' ? 'aviso' : 'ok',
    })
    setModo('listo')
  }

  function abrirNovedad() {
    setNov((n) => (n.envioId ? n : { ...n, envioId: nuevoId() }))
    setModo('novedad')
  }

  async function enviarNovedad() {
    if (enviando) return
    setEnviando(true)
    const envioId = nov.envioId || nuevoId()
    if (!nov.envioId) setNov((n) => ({ ...n, envioId }))
    const r = await enviar({
      tipo: 'novedad',
      envioId,
      realizadoPor: b.realizadoPor && b.realizadoPor !== OTRO ? b.realizadoPor : null,
      nombreLibre: b.nombreLibre,
      titulo: nov.titulo,
      descripcion: nov.descripcion,
      gravedad: nov.gravedad,
      km: nov.km ? Number(nov.km) : null,
      fotos: nov.fotos,
    })
    setEnviando(false)
    if ('sinRespuesta' in r) {
      toast.error(r.sinRespuesta === 'timeout'
        ? 'La señal está lenta y no llegó la respuesta. Tocá Enviar de nuevo: no se va a cargar dos veces.'
        : 'Sin conexión. Probá de nuevo cuando tengas señal.')
      return
    }
    if (!r.ok) {
      toast.error(r.json.error ?? 'No se pudo enviar la novedad. Probá de nuevo.')
      return
    }
    recordarQuien()
    setResultado({
      titulo: 'Novedad enviada',
      detalle: [r.json.repetido ? 'Ya la habíamos recibido antes: no se cargó dos veces.' : 'Tu encargado ya la puede ver en el sistema.'],
      tono: nov.gravedad === 'alta' ? 'grave' : 'ok',
    })
    setNov(NOVEDAD_VACIA)
    setModo('listo')
  }

  // ── Piezas ───────────────────────────────────────────────────────────────

  const encabezado = (
    <header className="border-b border-border bg-card px-5 pb-4 pt-6">
      <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{vehiculo.empresa}</p>
      <p className="mt-1 font-mono text-2xl font-semibold tracking-wide">{vehiculo.patente}</p>
      {vehiculo.detalle && <p className="text-sm text-muted-foreground">{vehiculo.detalle}</p>}
    </header>
  )

  const cartelAviso = aviso && (
    <div className="flex items-start gap-2 rounded-xl border border-border bg-muted/60 px-4 py-3 text-sm">
      <p className="flex-1">{aviso}</p>
      <button type="button" onClick={() => setAviso(null)} aria-label="Cerrar aviso" className="text-muted-foreground">
        <X className="size-4" />
      </button>
    </div>
  )

  const selectorQuien = (
    <div className="space-y-2">
      <label htmlFor="quien" className="block text-sm font-medium">¿Quién sos?</label>
      <select
        id="quien"
        value={b.realizadoPor}
        onChange={(e) => actualizar({ realizadoPor: e.target.value })}
        className="h-12 w-full rounded-xl border border-input bg-card px-3 text-base"
      >
        <option value="">Elegí tu nombre…</option>
        {empleados.map((e) => <option key={e.id} value={e.id}>{e.nombre}</option>)}
        <option value={OTRO}>No estoy en la lista</option>
      </select>
      {b.realizadoPor === OTRO && (
        <input
          id="nombre-libre"
          value={b.nombreLibre}
          onChange={(e) => actualizar({ nombreLibre: e.target.value })}
          placeholder="Tu nombre y apellido"
          autoComplete="name"
          className="h-12 w-full rounded-xl border border-input bg-card px-3 text-base"
        />
      )}
    </div>
  )

  function inputCamara(onFile: (f: File | undefined) => void, disabled = false) {
    return (
      <input
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        disabled={disabled}
        onChange={(e) => { onFile(e.target.files?.[0]); e.target.value = '' }}
      />
    )
  }

  function botonFoto(f: SlotFoto) {
    const pend = pendientes[f.slot]
    const subida = Boolean(b.fotos[f.slot])
    const preview = pend?.preview || previews[f.slot]
    const imagen = preview && (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={preview} alt="" className="absolute inset-0 h-full w-full object-cover opacity-40" />
    )

    if (pend?.estado === 'error') {
      return (
        <div key={f.slot} className="relative flex min-h-36 flex-col overflow-hidden rounded-xl border-2 border-warning/60 bg-warning-subtle">
          {imagen}
          <button type="button" onClick={() => reintentar(f.slot)}
            className="relative flex flex-1 flex-col items-center justify-center gap-1 p-2 text-center">
            <RotateCcw className="size-6 text-warning" strokeWidth={1.75} />
            <span className="text-sm font-medium leading-tight">{f.label}</span>
            <span className="text-[11px] font-medium leading-tight text-warning">No se subió · tocá para reintentar</span>
          </button>
          <div className="relative flex divide-x divide-warning/30 border-t border-warning/30 bg-card/80 text-[11px] text-muted-foreground">
            <label className="flex-1 cursor-pointer py-2 text-center">
              {inputCamara((file) => nuevaFoto('checklist', file, f.slot))}
              Sacar otra
            </label>
            {subida && (
              <button type="button" onClick={() => descartarPendiente(f.slot)} className="flex-1 py-2">Dejar la anterior</button>
            )}
          </div>
        </div>
      )
    }

    const cargando = pend?.estado === 'subiendo'
    const listo = subida && !pend
    return (
      <label
        key={f.slot}
        className={cn(
          'relative flex aspect-[4/3] cursor-pointer flex-col items-center justify-center gap-1 overflow-hidden rounded-xl border-2 border-dashed p-2 text-center transition-colors',
          listo ? 'border-success/50 bg-success-subtle' : 'border-border bg-card active:bg-muted'
        )}
      >
        {inputCamara((file) => nuevaFoto('checklist', file, f.slot), cargando)}
        {imagen}
        <span className="relative flex flex-col items-center gap-1">
          {cargando ? (
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          ) : listo ? (
            <Check className="size-6 text-success" strokeWidth={2.5} />
          ) : (
            <Camera className="size-6 text-muted-foreground" strokeWidth={1.75} />
          )}
          <span className="text-sm font-medium leading-tight">{f.label}</span>
          {!f.obligatoria && !cargando && !listo && <span className="text-[11px] text-muted-foreground">opcional</span>}
          {cargando && <span className="text-[11px] text-muted-foreground">Subiendo…</span>}
          {f.ayuda && !listo && !cargando && <span className="text-[11px] leading-tight text-muted-foreground">{f.ayuda}</span>}
          {listo && <span className="text-[11px] text-muted-foreground">Tocá para cambiarla</span>}
        </span>
      </label>
    )
  }

  const nombreFoto = (p: FotoPendiente) =>
    p.destino === 'checklist' ? (FOTOS_CHECKLIST.find((f) => f.slot === p.slot)?.label ?? 'Foto') : 'Foto del daño'

  // ── Pantallas ────────────────────────────────────────────────────────────

  if (modo === 'listo' && resultado) {
    return (
      <main className="mx-auto min-h-dvh max-w-md bg-background">
        {encabezado}
        <section className="px-5 py-10 text-center">
          <div className={cn(
            'mx-auto flex size-16 items-center justify-center rounded-full',
            resultado.tono === 'grave' ? 'bg-danger-subtle text-danger' : resultado.tono === 'aviso' ? 'bg-warning-subtle text-warning' : 'bg-success-subtle text-success'
          )}>
            {resultado.tono === 'grave' ? <AlertTriangle className="size-8" /> : <Check className="size-8" strokeWidth={2.5} />}
          </div>
          <h1 className="mt-5 text-xl font-semibold">{resultado.titulo}</h1>
          <div className="mt-3 space-y-2 text-sm text-muted-foreground">
            {resultado.detalle.map((d) => <p key={d}>{d}</p>)}
          </div>
          <button
            type="button"
            onClick={() => {
              setModo('inicio'); setPaso(0); setResultado(null); setPreviews({})
              setB(nuevoBorrador(estado.periodo.desde, { realizadoPor: b.realizadoPor, nombreLibre: b.nombreLibre }))
            }}
            className="mt-8 h-12 w-full rounded-xl border border-border bg-card text-base font-medium"
          >
            Listo
          </button>
        </section>
      </main>
    )
  }

  if (modo === 'novedad') {
    const novOk = quienOk && nov.titulo.trim().length >= 3 && pendientesNovedad.length === 0
    const novConError = pendientesNovedad.some(([, p]) => p.estado === 'error')
    return (
      <main className="mx-auto min-h-dvh max-w-md bg-background pb-28">
        {encabezado}
        <section className="space-y-6 px-5 py-6">
          <button type="button" onClick={() => setModo('inicio')} className="-ml-1 inline-flex items-center gap-1 text-sm text-muted-foreground">
            <ChevronLeft className="size-4" /> Volver
          </button>
          <h1 className="text-xl font-semibold">Reportar una novedad</h1>
          {selectorQuien}
          <div className="space-y-2">
            <label htmlFor="nov-titulo" className="block text-sm font-medium">¿Qué pasó?</label>
            <div className="flex flex-wrap gap-2">
              {NOVEDADES_RAPIDAS.map((t) => (
                <button key={t} type="button" onClick={() => setNov((n) => ({ ...n, titulo: t }))}
                  className={cn('rounded-full border px-3 py-1.5 text-sm', nov.titulo === t ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-card')}>
                  {t}
                </button>
              ))}
            </div>
            <input id="nov-titulo" value={nov.titulo} onChange={(e) => setNov((n) => ({ ...n, titulo: e.target.value }))}
              placeholder="En pocas palabras" className="h-12 w-full rounded-xl border border-input bg-card px-3 text-base" />
          </div>
          <div className="space-y-2">
            <p className="text-sm font-medium">¿Qué tan urgente es?</p>
            <div className="grid grid-cols-3 gap-2">
              {GRAVEDADES.map((g) => (
                <button key={g.value} type="button" onClick={() => setNov((n) => ({ ...n, gravedad: g.value }))}
                  className={cn('min-h-12 rounded-xl border px-2 py-2 text-sm leading-tight',
                    nov.gravedad === g.value
                      ? g.value === 'alta' ? 'border-danger bg-danger-subtle text-danger' : 'border-primary bg-primary/10 text-primary'
                      : 'border-border bg-card')}>
                  {g.label}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <label htmlFor="nov-desc" className="block text-sm font-medium">Detalle <span className="font-normal text-muted-foreground">(opcional)</span></label>
            <textarea id="nov-desc" value={nov.descripcion} onChange={(e) => setNov((n) => ({ ...n, descripcion: e.target.value }))}
              rows={3} placeholder="Dónde, cuándo, qué se ve o se escucha" className="w-full rounded-xl border border-input bg-card px-3 py-2 text-base" />
          </div>
          <FotosExtra
            fotos={nov.fotos}
            pendientes={pendientesNovedad}
            onAgregar={(f) => nuevaFoto('novedad', f)}
            onQuitar={(i) => setNov((n) => ({ ...n, fotos: n.fotos.filter((_, j) => j !== i) }))}
            onReintentar={reintentar}
            onDescartar={descartarPendiente}
          />
          {pendientesNovedad.length > 0 && (
            <p className="text-sm text-muted-foreground">
              {novConError ? 'Una foto no se subió: reintentala o quitala para poder enviar.' : 'Esperá a que terminen de subirse las fotos.'}
            </p>
          )}
          <div className="space-y-2">
            <label htmlFor="nov-km" className="block text-sm font-medium">Kilómetros <span className="font-normal text-muted-foreground">(opcional)</span></label>
            <input id="nov-km" inputMode="numeric" value={nov.km} onChange={(e) => setNov((n) => ({ ...n, km: e.target.value.replace(/\D/g, '') }))}
              className="h-12 w-full rounded-xl border border-input bg-card px-3 text-base tabular-nums" />
          </div>
        </section>
        <BarraInferior>
          <button type="button" disabled={!novOk || enviando} onClick={enviarNovedad}
            className="h-12 flex-1 rounded-xl bg-primary text-base font-semibold text-primary-foreground disabled:opacity-40">
            {enviando ? 'Enviando…' : 'Enviar novedad'}
          </button>
        </BarraInferior>
      </main>
    )
  }

  if (modo === 'checklist') {
    const pendientesDanio = pendientesChecklist.filter(([, p]) => p.destino === 'danio')
    return (
      <main className="mx-auto min-h-dvh max-w-md bg-background pb-28">
        {encabezado}
        <div className="sticky top-0 z-10 border-b border-border bg-background/95 px-5 py-3 backdrop-blur">
          <p className="text-xs text-muted-foreground">Paso {paso + 1} de {PASOS.length}</p>
          <p className="font-semibold">{PASOS[paso]}</p>
          <div className="mt-2 flex gap-1">
            {PASOS.map((p, i) => <span key={p} className={cn('h-1 flex-1 rounded-full', i <= paso ? 'bg-primary' : 'bg-muted')} />)}
          </div>
        </div>

        <section className="space-y-6 px-5 py-6">
          {cartelAviso}

          {paso === 0 && (
            <>
              {selectorQuien}
              <div className="space-y-2">
                <label htmlFor="km" className="block text-sm font-medium">Kilómetros del tablero</label>
                <input id="km" inputMode="numeric" value={b.km}
                  onChange={(e) => actualizar({ km: e.target.value.replace(/\D/g, '') })}
                  placeholder={vehiculo.kmActual != null ? `Último: ${vehiculo.kmActual.toLocaleString('es-AR')}` : 'Ej: 85300'}
                  className="h-12 w-full rounded-xl border border-input bg-card px-3 text-lg tabular-nums" />
                {kmAviso && <p className="text-sm text-warning">{kmAviso}</p>}
                {pideConfirmarKm && (
                  <label className="flex items-start gap-3 rounded-xl border border-warning/40 bg-warning-subtle p-3 text-sm">
                    <input type="checkbox" checked={b.kmConfirmado === b.km}
                      onChange={(e) => actualizar({ kmConfirmado: e.target.checked ? b.km : '' })}
                      className="mt-0.5 size-5 shrink-0 accent-[var(--primary)]" />
                    <span>
                      Son <span className="font-semibold">{kmNum.toLocaleString('es-AR')} km</span>, muchísimo para una camioneta.
                      Mirá bien el tablero y confirmá que marca eso.
                    </span>
                  </label>
                )}
                <p className="text-xs text-muted-foreground">Sin puntos ni comas. En el paso siguiente se saca la foto del tablero.</p>
              </div>
            </>
          )}

          {paso === 1 && (
            <>
              <p className="text-sm text-muted-foreground">
                Tocá cada recuadro para sacar la foto. Las ruedas, de costado: que se vea la llanta y el dibujo de la cubierta.
              </p>
              <div className="grid grid-cols-2 gap-3">
                {FOTOS_CHECKLIST.map((f) => botonFoto(f))}
              </div>
              {faltanSacar.length > 0 ? (
                <p className="text-sm text-muted-foreground">Faltan {faltanSacar.length} {faltanSacar.length === 1 ? 'foto obligatoria' : 'fotos obligatorias'}.</p>
              ) : subiendoN > 0 ? (
                <p className="text-sm text-muted-foreground">Subiendo {subiendoN} {subiendoN === 1 ? 'foto' : 'fotos'}: podés seguir mientras tanto.</p>
              ) : null}
            </>
          )}

          {paso === 2 && (
            <>
              <p className="text-sm text-muted-foreground">
                Si una sección está bien, tocá <span className="font-medium text-foreground">Todo bien</span> y marcá solo lo que no.
              </p>
              {SECCIONES_CHECKLIST.map((s) => {
                const respondidos = s.items.filter((i) => b.respuestas[i.id]).length
                const completa = respondidos === s.items.length
                return (
                  <div key={s.id} className="overflow-hidden rounded-xl border border-border bg-card">
                    <div className="flex items-center justify-between gap-3 border-b border-border bg-muted/50 px-4 py-3">
                      <div>
                        <p className="font-semibold">{s.titulo}</p>
                        <p className="text-xs text-muted-foreground">{respondidos} de {s.items.length}</p>
                      </div>
                      {!completa && (
                        <button type="button" onClick={() => todoBienEnSeccion(s.id)}
                          className="h-10 shrink-0 rounded-lg bg-success px-3 text-sm font-semibold text-white">
                          {respondidos === 0 ? 'Todo bien' : 'El resto bien'}
                        </button>
                      )}
                    </div>
                    <ul className="divide-y divide-border">
                      {s.items.map((item) => {
                        const r = b.respuestas[item.id]
                        return (
                          <li key={item.id} className="px-4 py-3">
                            <p className="text-sm">{item.label}</p>
                            <div className="mt-2 grid grid-cols-3 gap-1.5">
                              {([['ok', 'Bien'], ['obs', 'Observación'], ['no_ok', 'Mal']] as const).map(([valor, label]) => (
                                <button key={valor} type="button" onClick={() => responder(item.id, valor)}
                                  className={cn('h-11 rounded-lg border text-sm font-medium transition-colors',
                                    r === valor
                                      ? valor === 'ok' ? 'border-success bg-success text-white'
                                        : valor === 'obs' ? 'border-warning bg-warning text-white'
                                        : 'border-danger bg-danger text-white'
                                      : 'border-border bg-background text-muted-foreground')}>
                                  {label}
                                </button>
                              ))}
                            </div>
                            {(r === 'obs' || r === 'no_ok') && (
                              <input value={b.notas[item.id] ?? ''}
                                onChange={(e) => actualizar((prev) => ({ ...prev, notas: { ...prev.notas, [item.id]: e.target.value } }))}
                                placeholder="¿Qué pasa?" className="mt-2 h-11 w-full rounded-lg border border-input bg-background px-3 text-base" />
                            )}
                            {r === 'no_ok' && item.critico && (
                              <p className="mt-1.5 text-xs font-medium text-danger">Esto deja la camioneta como no apta para circular.</p>
                            )}
                          </li>
                        )
                      })}
                    </ul>
                  </div>
                )
              })}
              {sinResponder.length > 0 && (
                <p className="text-sm text-muted-foreground">Faltan {sinResponder.length} ítems.</p>
              )}
            </>
          )}

          {paso === 3 && (
            <>
              <div className="space-y-2">
                <label htmlFor="danio" className="block text-sm font-medium">¿Algún golpe, rayón o daño nuevo?</label>
                <textarea id="danio" value={b.danio} onChange={(e) => actualizar({ danio: e.target.value })} rows={2}
                  placeholder="Si no hay, dejalo vacío" className="w-full rounded-xl border border-input bg-card px-3 py-2 text-base" />
                {(b.danio.trim() || pendientesDanio.length > 0) && (
                  <FotosExtra
                    fotos={b.fotosDanio}
                    pendientes={pendientesDanio}
                    onAgregar={(f) => nuevaFoto('danio', f)}
                    onQuitar={(i) => actualizar((prev) => ({ ...prev, fotosDanio: prev.fotosDanio.filter((_, j) => j !== i) }))}
                    onReintentar={reintentar}
                    onDescartar={descartarPendiente}
                  />
                )}
              </div>
              <div className="space-y-2">
                <label htmlFor="obs" className="block text-sm font-medium">Comentarios <span className="font-normal text-muted-foreground">(opcional)</span></label>
                <textarea id="obs" value={b.observaciones} onChange={(e) => actualizar({ observaciones: e.target.value })} rows={3}
                  className="w-full rounded-xl border border-input bg-card px-3 py-2 text-base" />
              </div>
              <div className={cn('rounded-xl border p-4',
                resultadoPrevio === 'no_apto' ? 'border-danger/40 bg-danger-subtle' : resultadoPrevio === 'observaciones' ? 'border-warning/40 bg-warning-subtle' : 'border-success/40 bg-success-subtle')}>
                <p className={cn('font-semibold',
                  resultadoPrevio === 'no_apto' ? 'text-danger' : resultadoPrevio === 'observaciones' ? 'text-warning' : 'text-success')}>
                  {RESULTADO_LABEL[resultadoPrevio]}
                </p>
                {criticosMal.length > 0 && (
                  <ul className="mt-2 space-y-1 text-sm">
                    {criticosMal.map((i) => <li key={i.id}>· {i.label}</li>)}
                  </ul>
                )}
                <p className="mt-2 text-xs text-muted-foreground">{vehiculo.patente} · {kmOk ? `${kmNum.toLocaleString('es-AR')} km` : ''}</p>
              </div>

              {/* Qué falta para poder enviar: las fotos se suben de fondo y recién acá se espera. */}
              {!listoParaEnviar && (
                <div className="space-y-3 rounded-xl border border-border bg-card p-4 text-sm">
                  {subiendoN > 0 && (
                    <p className="flex items-center gap-2 text-muted-foreground">
                      <Loader2 className="size-4 shrink-0 animate-spin" />
                      Subiendo {subiendoN} {subiendoN === 1 ? 'foto' : 'fotos'}… Podés enviar cuando terminen.
                    </p>
                  )}
                  {conError.length > 0 && (
                    <div className="space-y-2">
                      <p className="font-medium text-warning">
                        {conError.length === 1 ? '1 foto no se subió' : `${conError.length} fotos no se subieron`}
                      </p>
                      <ul className="space-y-0.5 text-xs text-muted-foreground">
                        {conError.map(([clave, p]) => <li key={clave}>· {nombreFoto(p)}{p.error ? `: ${p.error}` : ''}</li>)}
                      </ul>
                      <button type="button" onClick={reintentarConError}
                        className="inline-flex h-10 items-center gap-2 rounded-lg border border-border bg-background px-3 font-medium">
                        <RotateCcw className="size-4" strokeWidth={1.75} /> Reintentar ahora
                      </button>
                    </div>
                  )}
                  {faltanSacar.length > 0 && (
                    <p>
                      Falta sacar: {faltanSacar.map((f) => f.label.toLowerCase()).join(', ')}.{' '}
                      <button type="button" onClick={() => irAPaso(1)} className="font-medium text-primary underline underline-offset-2">Ir a las fotos</button>
                    </p>
                  )}
                  {sinResponder.length > 0 && (
                    <p>
                      Faltan {sinResponder.length} ítems por revisar.{' '}
                      <button type="button" onClick={() => irAPaso(2)} className="font-medium text-primary underline underline-offset-2">Ir a la revisión</button>
                    </p>
                  )}
                  {!datosOk && (
                    <p>
                      Falta quién lo hace o los kilómetros.{' '}
                      <button type="button" onClick={() => irAPaso(0)} className="font-medium text-primary underline underline-offset-2">Completar</button>
                    </p>
                  )}
                </div>
              )}
            </>
          )}
        </section>

        <BarraInferior>
          <button type="button" onClick={() => (paso === 0 ? volverAlInicio() : irAPaso(paso - 1))}
            className="h-12 rounded-xl border border-border bg-card px-4 text-base font-medium">
            Atrás
          </button>
          {paso < PASOS.length - 1 ? (
            <button type="button" disabled={!pasoValido} onClick={() => irAPaso(paso + 1)}
              className="h-12 flex-1 rounded-xl bg-primary text-base font-semibold text-primary-foreground disabled:opacity-40">
              Siguiente
            </button>
          ) : (
            <button type="button" disabled={!pasoValido || enviando} onClick={enviarChecklist}
              className="h-12 flex-1 rounded-xl bg-primary text-base font-semibold text-primary-foreground disabled:opacity-40">
              {enviando ? 'Enviando…' : 'Enviar checklist'}
            </button>
          )}
        </BarraInferior>
      </main>
    )
  }

  // ── Inicio ───────────────────────────────────────────────────────────────

  const empezado = tieneContenido(b)
  const dias = (n: number) => `${n} ${n === 1 ? 'día' : 'días'}`
  const textoEstado =
    estado.estado === 'nunca'
      ? estado.venceEn >= 0 ? `Todavía no se hizo ninguno. Tenés ${hastaCuando(estado)} para hacerlo.` : 'Todavía no se hizo ninguno: hacelo ahora.'
      : estado.estado === 'al_dia' ? `Ya está hecho. El próximo toca a partir del ${fmtDia(estado.proximo)}.`
      : estado.estado === 'vence_pronto' ? `Toca hacerlo: tenés ${hastaCuando(estado)}.`
      : `Venció hace ${dias(Math.abs(estado.venceEn))}: hacelo ahora.`

  return (
    <main className="mx-auto min-h-dvh max-w-md bg-background">
      {encabezado}
      <section className="space-y-5 px-5 py-6">
        {cartelAviso}
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center justify-between gap-3">
            <p className="font-semibold">Checklist {estado.periodo.mensual ? 'del mes' : 'de la quincena'}</p>
            <EstadoPill estado={ESTADO_PILL[estado.estado]} label={estado.estado === 'nunca' ? 'Pendiente' : ESTADO_CHECKLIST_LABEL[estado.estado]} />
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{textoEstado}</p>
          <p className="mt-2 text-xs text-muted-foreground">
            {frecuenciaChecklist(vehiculo.cadaDias)}
            {ultimo && <> · Último: {fmtFechaAR(ultimo.fecha)} · {ultimo.quien}{ultimo.km != null && ` · ${ultimo.km.toLocaleString('es-AR')} km`}</>}
          </p>
        </div>

        {documentos.length > 0 && (
          <div className="divide-y divide-border rounded-xl border border-border bg-card">
            {documentos.map((d) => (
              <div key={d.nombre} className="flex items-center justify-between gap-3 px-4 py-3">
                <div>
                  <p className="text-sm font-medium">{d.nombre}</p>
                  <p className="text-xs text-muted-foreground">Vence el {fmtDia(d.vence)}/{d.vence.slice(0, 4)}</p>
                </div>
                <EstadoPill estado={d.estado} />
              </div>
            ))}
          </div>
        )}

        <div className="space-y-3 pt-2">
          <button type="button" onClick={empezarChecklist}
            className="flex h-14 w-full items-center justify-center gap-2 rounded-xl bg-primary text-base font-semibold text-primary-foreground">
            {empezado ? <RotateCcw className="size-5" strokeWidth={1.75} /> : <ClipboardCheck className="size-5" strokeWidth={1.75} />}
            {empezado ? 'Seguir el checklist empezado' : 'Hacer el checklist'}
          </button>
          <button type="button" onClick={abrirNovedad}
            className="flex min-h-14 w-full flex-col items-center justify-center rounded-xl border border-border bg-card px-4 py-2">
            <span className="inline-flex items-center gap-2 text-base font-medium"><Wrench className="size-5" strokeWidth={1.75} /> Reportar una novedad</span>
            <span className="text-xs text-muted-foreground">Un golpe, una falla, una pinchadura</span>
          </button>
          {empezado && (
            <button type="button"
              onClick={() => { if (confirm('¿Descartar el checklist empezado?')) descartarBorrador() }}
              className="w-full py-2 text-sm text-muted-foreground">
              Descartar el checklist empezado
            </button>
          )}
        </div>
      </section>
    </main>
  )
}

function BarraInferior({ children }: { children: React.ReactNode }) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-background/95 backdrop-blur"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
      <div className="mx-auto flex max-w-md gap-2 px-5 py-3">{children}</div>
    </div>
  )
}

function FotosExtra({ fotos, pendientes, onAgregar, onQuitar, onReintentar, onDescartar }: {
  fotos: string[]
  pendientes: [string, FotoPendiente][]
  onAgregar: (f: File | undefined) => void
  onQuitar: (i: number) => void
  onReintentar: (clave: string) => void
  onDescartar: (clave: string) => void
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {fotos.map((_, i) => (
        <span key={i} className="inline-flex items-center gap-1 rounded-lg border border-success/40 bg-success-subtle px-2.5 py-1.5 text-sm text-success">
          <Check className="size-4" /> Foto {i + 1}
          <button type="button" onClick={() => onQuitar(i)} aria-label={`Quitar foto ${i + 1}`} className="ml-1 text-muted-foreground">
            <X className="size-4" />
          </button>
        </span>
      ))}
      {pendientes.map(([clave, p]) => (
        <span key={clave} className={cn('inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-sm',
          p.estado === 'error' ? 'border-warning/50 bg-warning-subtle text-warning' : 'border-border bg-card text-muted-foreground')}>
          {p.estado === 'error' ? (
            <button type="button" onClick={() => onReintentar(clave)} className="inline-flex items-center gap-1">
              <RotateCcw className="size-4" strokeWidth={1.75} /> No se subió · tocá para reintentar
            </button>
          ) : (
            <><Loader2 className="size-4 animate-spin" /> Subiendo…</>
          )}
          <button type="button" onClick={() => onDescartar(clave)} aria-label="Quitar esta foto" className="ml-1 text-muted-foreground">
            <X className="size-4" />
          </button>
        </span>
      ))}
      {fotos.length + pendientes.length < MAX_FOTOS_EXTRA && (
        <label className="inline-flex h-11 cursor-pointer items-center gap-2 rounded-lg border border-dashed border-border bg-card px-3 text-sm">
          <input type="file" accept="image/*" capture="environment" className="sr-only"
            onChange={(e) => { onAgregar(e.target.files?.[0]); e.target.value = '' }} />
          <Camera className="size-4" strokeWidth={1.75} />
          Agregar foto
        </label>
      )}
    </div>
  )
}
