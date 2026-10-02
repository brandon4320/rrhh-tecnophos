'use client'

import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import {
  AlertTriangle, Camera, Check, ChevronLeft, ClipboardCheck, Loader2, RotateCcw, Wrench, X,
} from 'lucide-react'
import { EstadoPill } from '@/components/ui/estado-pill'
import type { EstadoVencimiento } from '@/types'
import { cn } from '@/lib/utils'
import { fmtFechaAR } from '@/lib/fechas-ar'
import {
  FOTOS_CHECKLIST, ITEMS_CHECKLIST, RESULTADO_LABEL, SECCIONES_CHECKLIST, calcularResultado,
  fmtDia, fotosFaltantes, itemsSinResponder, type EstadoChecklist, type Respuesta, type Resultado,
} from '@/modules/flota/reglas'

export interface DocumentoQR {
  nombre: string
  vence: string
  estado: EstadoVencimiento
}

interface Props {
  token: string
  vehiculo: { patente: string; detalle: string | null; empresa: string; kmActual: number | null; cadaDias: number }
  empleados: { id: string; nombre: string }[]
  ultimo: { fecha: string; quien: string; km: number | null } | null
  estado: { estado: EstadoChecklist; diasDesde: number | null; venceEn: number | null }
  documentos: DocumentoQR[]
}

interface Borrador {
  realizadoPor: string
  nombreLibre: string
  km: string
  fotos: Record<string, string>
  respuestas: Record<string, Respuesta>
  notas: Record<string, string>
  danio: string
  fotosDanio: string[]
  observaciones: string
}

const BORRADOR_VACIO: Borrador = {
  realizadoPor: '', nombreLibre: '', km: '', fotos: {}, respuestas: {}, notas: {}, danio: '', fotosDanio: [], observaciones: '',
}
const OTRO = '__otro'
const PASOS = ['Quién y kilómetros', 'Fotos', 'Revisión', 'Cierre'] as const

const ESTADO_PILL: Record<EstadoChecklist, EstadoVencimiento> = {
  al_dia: 'vigente', vence_pronto: 'proximo', vencido: 'vencido', nunca: 'sin_fecha',
}

const GRAVEDADES = [
  { value: 'baja', label: 'Puede esperar' },
  { value: 'media', label: 'Hay que verlo pronto' },
  { value: 'alta', label: 'No se puede usar' },
] as const
const NOVEDADES_RAPIDAS = ['Golpe o rayón', 'Pinchadura', 'Falla mecánica', 'Luz quemada', 'Ruido raro']

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
  const [hayBorrador, setHayBorrador] = useState(false)
  const [subiendo, setSubiendo] = useState<Record<string, boolean>>({})
  const [previews, setPreviews] = useState<Record<string, string>>({})
  const [enviando, setEnviando] = useState(false)
  const [resultado, setResultado] = useState<{ titulo: string; detalle: string[]; tono: 'ok' | 'aviso' | 'grave' } | null>(null)

  // Novedad suelta
  const [nov, setNov] = useState({ titulo: '', descripcion: '', gravedad: 'media', km: '', fotos: [] as string[] })

  // Borrador previo y la última persona que usó este celular.
  useEffect(() => {
    const previo = leer<Borrador>(claveBorrador, BORRADOR_VACIO)
    const quien = leer<{ realizadoPor: string; nombreLibre: string }>('flota-quien', { realizadoPor: '', nombreLibre: '' })
    const tieneAlgo = Boolean(previo.km || Object.keys(previo.fotos).length || Object.keys(previo.respuestas).length)
    setHayBorrador(tieneAlgo)
    setB(tieneAlgo ? previo : { ...BORRADOR_VACIO, ...quien })
  }, [claveBorrador])

  function actualizar(cambio: Partial<Borrador> | ((prev: Borrador) => Borrador)) {
    setB((prev) => {
      const next = typeof cambio === 'function' ? cambio(prev) : { ...prev, ...cambio }
      guardar(claveBorrador, next)
      return next
    })
  }

  const quienOk = (b.realizadoPor && b.realizadoPor !== OTRO) || (b.realizadoPor === OTRO && b.nombreLibre.trim().length >= 3)
  const kmNum = Number(b.km)
  const kmOk = b.km !== '' && Number.isInteger(kmNum) && kmNum >= 0
  const faltanFotos = fotosFaltantes(b.fotos)
  const sinResponder = itemsSinResponder(b.respuestas)
  const algoSubiendo = Object.values(subiendo).some(Boolean)
  const resultadoPrevio: Resultado = calcularResultado(b.respuestas)
  const criticosMal = ITEMS_CHECKLIST.filter((i) => i.critico && b.respuestas[i.id] === 'no_ok')

  const pasoValido = [quienOk && kmOk, faltanFotos.length === 0 && !algoSubiendo, sinResponder.length === 0, !algoSubiendo][paso]

  const kmAviso = useMemo(() => {
    if (!kmOk || vehiculo.kmActual == null) return null
    if (kmNum < vehiculo.kmActual) return `Es menos que el último registro (${vehiculo.kmActual.toLocaleString('es-AR')} km). Revisá el tablero.`
    if (kmNum - vehiculo.kmActual > 20_000) return `Son ${(kmNum - vehiculo.kmActual).toLocaleString('es-AR')} km más que el último registro. ¿Está bien?`
    return null
  }, [kmOk, kmNum, vehiculo.kmActual])

  async function subirFoto(slot: string, file: File): Promise<string | null> {
    let blob: Blob = file
    try {
      blob = await comprimir(file)
    } catch {
      // El navegador no pudo leer la foto (formato raro): se sube tal cual si se puede.
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 4 * 1024 * 1024) {
        toast.error('No se pudo procesar esa foto. Sacala de nuevo con la cámara.')
        return null
      }
    }
    const fd = new FormData()
    fd.append('slot', slot)
    fd.append('archivo', blob, 'foto.jpg')
    try {
      const res = await fetch(`/api/v/${token}/foto`, { method: 'POST', body: fd })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || !json.path) {
        toast.error(json.error ?? 'No se pudo subir la foto. Probá de nuevo.')
        return null
      }
      return json.path as string
    } catch {
      toast.error('Sin conexión: la foto no se subió. Probá de nuevo cuando tengas señal.')
      return null
    }
  }

  async function fotoChecklist(slot: string, file: File | undefined) {
    if (!file) return
    setSubiendo((s) => ({ ...s, [slot]: true }))
    const preview = URL.createObjectURL(file)
    const path = await subirFoto(slot, file)
    setSubiendo((s) => ({ ...s, [slot]: false }))
    if (!path) {
      URL.revokeObjectURL(preview)
      return
    }
    setPreviews((p) => ({ ...p, [slot]: preview }))
    actualizar((prev) => ({ ...prev, fotos: { ...prev.fotos, [slot]: path } }))
  }

  async function fotoExtra(destino: 'danio' | 'novedad', file: File | undefined) {
    if (!file) return
    const clave = `${destino}-${Date.now()}`
    setSubiendo((s) => ({ ...s, [clave]: true }))
    const path = await subirFoto('novedad', file)
    setSubiendo((s) => ({ ...s, [clave]: false }))
    if (!path) return
    if (destino === 'danio') actualizar((prev) => ({ ...prev, fotosDanio: [...prev.fotosDanio, path] }))
    else setNov((n) => ({ ...n, fotos: [...n.fotos, path] }))
  }

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

  async function enviarChecklist() {
    setEnviando(true)
    try {
      const res = await fetch(`/api/v/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tipo: 'checklist',
          realizadoPor: b.realizadoPor && b.realizadoPor !== OTRO ? b.realizadoPor : null,
          nombreLibre: b.nombreLibre,
          km: kmNum,
          respuestas: b.respuestas,
          notas: b.notas,
          fotos: b.fotos,
          danio: b.danio,
          fotosDanio: b.fotosDanio,
          observaciones: b.observaciones,
        }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(json.error ?? 'No se pudo enviar el checklist. Probá de nuevo.')
        return
      }
      recordarQuien()
      borrar(claveBorrador)
      const detalle: string[] = []
      if (json.novedades > 0) {
        detalle.push(json.novedades === 1
          ? 'Se abrió 1 novedad para que tu encargado la revise.'
          : `Se abrieron ${json.novedades} novedades para que tu encargado las revise.`)
      }
      if (json.resultado === 'no_apto') detalle.push('Tu encargado ya lo puede ver en el sistema. No la uses hasta que la revisen.')
      if (json.kmInconsistente) detalle.push('El kilometraje no coincide con el último registro: lo va a revisar tu encargado.')
      setResultado({
        titulo: json.resultadoLabel ?? 'Checklist enviado',
        detalle,
        tono: json.resultado === 'no_apto' ? 'grave' : json.resultado === 'observaciones' ? 'aviso' : 'ok',
      })
      setModo('listo')
    } catch {
      toast.error('Sin conexión. Tu checklist quedó guardado en este celular: probá de nuevo cuando tengas señal.')
    } finally {
      setEnviando(false)
    }
  }

  async function enviarNovedad() {
    setEnviando(true)
    try {
      const res = await fetch(`/api/v/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tipo: 'novedad',
          realizadoPor: b.realizadoPor && b.realizadoPor !== OTRO ? b.realizadoPor : null,
          nombreLibre: b.nombreLibre,
          titulo: nov.titulo,
          descripcion: nov.descripcion,
          gravedad: nov.gravedad,
          km: nov.km ? Number(nov.km) : null,
          fotos: nov.fotos,
        }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(json.error ?? 'No se pudo enviar la novedad. Probá de nuevo.')
        return
      }
      recordarQuien()
      setResultado({ titulo: 'Novedad enviada', detalle: ['Tu encargado ya la puede ver en el sistema.'], tono: nov.gravedad === 'alta' ? 'grave' : 'ok' })
      setNov({ titulo: '', descripcion: '', gravedad: 'media', km: '', fotos: [] })
      setModo('listo')
    } catch {
      toast.error('Sin conexión. Probá de nuevo cuando tengas señal.')
    } finally {
      setEnviando(false)
    }
  }

  // ── Piezas ───────────────────────────────────────────────────────────────

  const encabezado = (
    <header className="border-b border-border bg-card px-5 pb-4 pt-6">
      <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{vehiculo.empresa}</p>
      <p className="mt-1 font-mono text-2xl font-semibold tracking-wide">{vehiculo.patente}</p>
      {vehiculo.detalle && <p className="text-sm text-muted-foreground">{vehiculo.detalle}</p>}
    </header>
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

  function botonFoto(slot: string, label: string, ayuda?: string, obligatoria = true) {
    const listo = Boolean(b.fotos[slot])
    const cargando = subiendo[slot]
    return (
      <label
        key={slot}
        className={cn(
          'relative flex aspect-[4/3] cursor-pointer flex-col items-center justify-center gap-1 overflow-hidden rounded-xl border-2 border-dashed p-2 text-center transition-colors',
          listo ? 'border-success/50 bg-success-subtle' : 'border-border bg-card active:bg-muted'
        )}
      >
        <input
          type="file"
          accept="image/*"
          capture="environment"
          className="sr-only"
          disabled={cargando}
          onChange={(e) => { fotoChecklist(slot, e.target.files?.[0]); e.target.value = '' }}
        />
        {previews[slot] && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={previews[slot]} alt="" className="absolute inset-0 h-full w-full object-cover opacity-40" />
        )}
        <span className="relative flex flex-col items-center gap-1">
          {cargando ? (
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          ) : listo ? (
            <Check className="size-6 text-success" strokeWidth={2.5} />
          ) : (
            <Camera className="size-6 text-muted-foreground" strokeWidth={1.75} />
          )}
          <span className="text-sm font-medium leading-tight">{label}</span>
          {!obligatoria && <span className="text-[11px] text-muted-foreground">opcional</span>}
          {ayuda && !listo && <span className="text-[11px] leading-tight text-muted-foreground">{ayuda}</span>}
          {listo && <span className="text-[11px] text-muted-foreground">Tocá para cambiarla</span>}
        </span>
      </label>
    )
  }

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
            onClick={() => { setModo('inicio'); setPaso(0); setResultado(null); setB({ ...BORRADOR_VACIO, realizadoPor: b.realizadoPor, nombreLibre: b.nombreLibre }); setHayBorrador(false); setPreviews({}) }}
            className="mt-8 h-12 w-full rounded-xl border border-border bg-card text-base font-medium"
          >
            Listo
          </button>
        </section>
      </main>
    )
  }

  if (modo === 'novedad') {
    const novOk = quienOk && nov.titulo.trim().length >= 3 && !algoSubiendo
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
          <FotosExtra fotos={nov.fotos} subiendo={algoSubiendo} onAgregar={(f) => fotoExtra('novedad', f)} onQuitar={(i) => setNov((n) => ({ ...n, fotos: n.fotos.filter((_, j) => j !== i) }))} />
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
                {FOTOS_CHECKLIST.map((f) => botonFoto(f.slot, f.label, f.ayuda, f.obligatoria))}
              </div>
              {faltanFotos.length > 0 && (
                <p className="text-sm text-muted-foreground">Faltan {faltanFotos.length} {faltanFotos.length === 1 ? 'foto' : 'fotos'} obligatorias.</p>
              )}
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
                {b.danio.trim() && (
                  <FotosExtra fotos={b.fotosDanio} subiendo={algoSubiendo} onAgregar={(f) => fotoExtra('danio', f)}
                    onQuitar={(i) => actualizar((prev) => ({ ...prev, fotosDanio: prev.fotosDanio.filter((_, j) => j !== i) }))} />
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
            </>
          )}
        </section>

        <BarraInferior>
          <button type="button" onClick={() => (paso === 0 ? setModo('inicio') : setPaso((p) => p - 1))}
            className="h-12 rounded-xl border border-border bg-card px-4 text-base font-medium">
            Atrás
          </button>
          {paso < PASOS.length - 1 ? (
            <button type="button" disabled={!pasoValido} onClick={() => { setPaso((p) => p + 1); window.scrollTo({ top: 0 }) }}
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

  const textoEstado =
    estado.estado === 'nunca' ? 'Todavía no se hizo ningún checklist'
      : estado.estado === 'vencido' ? `Vencido hace ${Math.abs(estado.venceEn!)} ${Math.abs(estado.venceEn!) === 1 ? 'día' : 'días'}`
      : estado.venceEn === 0 ? 'Vence hoy'
      : `El próximo vence en ${estado.venceEn} ${estado.venceEn === 1 ? 'día' : 'días'}`

  return (
    <main className="mx-auto min-h-dvh max-w-md bg-background">
      {encabezado}
      <section className="space-y-5 px-5 py-6">
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center justify-between gap-3">
            <p className="font-semibold">Checklist cada {vehiculo.cadaDias} días</p>
            <EstadoPill estado={ESTADO_PILL[estado.estado]} label={estado.estado === 'nunca' ? 'Pendiente' : estado.estado === 'al_dia' ? 'Al día' : estado.estado === 'vence_pronto' ? 'Vence pronto' : 'Vencido'} />
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{textoEstado}</p>
          {ultimo && (
            <p className="mt-2 text-xs text-muted-foreground">
              Último: {fmtFechaAR(ultimo.fecha)} · {ultimo.quien}{ultimo.km != null && ` · ${ultimo.km.toLocaleString('es-AR')} km`}
            </p>
          )}
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
          <button type="button" onClick={() => { setModo('checklist'); setPaso(0) }}
            className="flex h-14 w-full items-center justify-center gap-2 rounded-xl bg-primary text-base font-semibold text-primary-foreground">
            {hayBorrador ? <RotateCcw className="size-5" /> : <ClipboardCheck className="size-5" strokeWidth={1.75} />}
            {hayBorrador ? 'Seguir el checklist empezado' : 'Hacer el checklist'}
          </button>
          <button type="button" onClick={() => setModo('novedad')}
            className="flex min-h-14 w-full flex-col items-center justify-center rounded-xl border border-border bg-card px-4 py-2">
            <span className="inline-flex items-center gap-2 text-base font-medium"><Wrench className="size-5" strokeWidth={1.75} /> Reportar una novedad</span>
            <span className="text-xs text-muted-foreground">Un golpe, una falla, una pinchadura</span>
          </button>
          {hayBorrador && (
            <button type="button"
              onClick={() => { if (confirm('¿Descartar el checklist empezado?')) { borrar(claveBorrador); setB({ ...BORRADOR_VACIO, realizadoPor: b.realizadoPor, nombreLibre: b.nombreLibre }); setHayBorrador(false); setPreviews({}) } }}
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

function FotosExtra({ fotos, subiendo, onAgregar, onQuitar }: {
  fotos: string[]
  subiendo: boolean
  onAgregar: (f: File | undefined) => void
  onQuitar: (i: number) => void
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
      {fotos.length < 6 && (
        <label className="inline-flex h-11 cursor-pointer items-center gap-2 rounded-lg border border-dashed border-border bg-card px-3 text-sm">
          <input type="file" accept="image/*" capture="environment" className="sr-only" disabled={subiendo}
            onChange={(e) => { onAgregar(e.target.files?.[0]); e.target.value = '' }} />
          {subiendo ? <Loader2 className="size-4 animate-spin" /> : <Camera className="size-4" strokeWidth={1.75} />}
          Agregar foto
        </label>
      )}
    </div>
  )
}
