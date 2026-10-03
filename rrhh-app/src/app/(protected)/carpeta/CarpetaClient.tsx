'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import clsx from 'clsx'
import { ChevronRight, Download, Search } from 'lucide-react'
import { zip, strToU8, type Zippable } from 'fflate'
import type { EstadoVencimiento } from '@/types'
import { EstadoPill } from '@/components/ui/estado-pill'
import { coincide } from '@/lib/texto'
import { fmtFechaCompletaAR, diaClaveAR } from '@/lib/fechas-ar'
import { mensajeError } from '@/lib/errores'
import { labelPeriodo } from '@/lib/recibos'
import { fechaParaArchivo, fmtTamano, nombreArchivoCertificado, nombreSeguro, rutasUnicas } from '@/modules/documentos/carpeta'

export interface ArchivoCarpeta { id: string; nombre: string; bytes: number }
export interface CertCarpeta { id: string; titulo: string; vence: string | null; estado: EstadoVencimiento; archivos: ArchivoCarpeta[] }
export interface DuenoCarpeta { id: string; nombre: string; detalle: string | null; certificados: CertCarpeta[] }
export interface MesCarpeta { periodo: string; docs: { id: string; carpeta: string; nombre: string; bytes: number }[] }

type Marca = 'todo' | 'parte' | 'nada'
const SUELTOS = 'Archivos sueltos del mes'

/** Claves de selección: `a:<archivo>` (adjunto de certificado) o `m:<documento mensual>`. */
const kA = (id: string) => `a:${id}`
const kM = (id: string) => `m:${id}`

function marcaDe(claves: string[], sel: Set<string>): Marca {
  if (claves.length === 0) return 'nada'
  const n = claves.filter((k) => sel.has(k)).length
  return n === 0 ? 'nada' : n === claves.length ? 'todo' : 'parte'
}

/** Lo que entra al tocar "todo" en un dueño: sin los vencidos, salvo que se pidan. */
function clavesDe(certs: CertCarpeta[], conVencidos: boolean): string[] {
  return certs.filter((c) => conVencidos || c.estado !== 'vencido').flatMap((c) => c.archivos.map((a) => kA(a.id)))
}
const todasLasClaves = (certs: CertCarpeta[]) => certs.flatMap((c) => c.archivos.map((a) => kA(a.id)))

function Check({ marca, onChange, label, disabled }: { marca: Marca; onChange: () => void; label: string; disabled?: boolean }) {
  const ref = useRef<HTMLInputElement>(null)
  useEffect(() => { if (ref.current) ref.current.indeterminate = marca === 'parte' }, [marca])
  return (
    <input
      ref={ref}
      type="checkbox"
      aria-label={label}
      checked={marca === 'todo'}
      disabled={disabled}
      onChange={onChange}
      className="size-4 shrink-0 cursor-pointer rounded border-input accent-[var(--primary)] disabled:cursor-not-allowed disabled:opacity-40"
    />
  )
}

/**
 * Armar carpeta para planta: selección múltiple de la documentación de personas,
 * vehículos, empresa y mensual, y descarga de un ZIP armado en el navegador (los
 * archivos vienen directo de R2 con URLs firmadas: no pasan por Vercel).
 */
export default function CarpetaClient({
  empresa, empleados, vehiculos, deEmpresa, meses,
}: {
  empresa: { id: string; nombre: string; slug: string }
  empleados: DuenoCarpeta[]
  vehiculos: DuenoCarpeta[]
  deEmpresa: CertCarpeta[]
  meses: MesCarpeta[]
}) {
  const [sel, setSel] = useState<Set<string>>(() => new Set())
  const [abiertos, setAbiertos] = useState<Set<string>>(() => new Set(['empresa']))
  const [q, setQ] = useState('')
  const [sector, setSector] = useState<string | null>(null)
  const [conVencidos, setConVencidos] = useState(false)
  const [periodo, setPeriodo] = useState(meses[0]?.periodo ?? '')
  const [nombreZip, setNombreZip] = useState(() => `Documentación ${empresa.nombre} - ${fechaParaArchivo(diaClaveAR(new Date()))}`)
  const [progreso, setProgreso] = useState<{ hechos: number; total: number } | null>(null)

  const sectores = useMemo(
    () => [...new Set(empleados.map((e) => e.detalle).filter((s): s is string => !!s))].sort((a, b) => a.localeCompare(b)),
    [empleados]
  )
  const visibles = useMemo(
    () => empleados.filter((e) => (!sector || e.detalle === sector) && coincide(q, e.nombre, e.detalle)),
    [empleados, sector, q]
  )
  const mesSel = meses.find((m) => m.periodo === periodo)
  const carpetasMes = useMemo(() => {
    const g = new Map<string, MesCarpeta['docs']>()
    for (const d of mesSel?.docs ?? []) {
      const raiz = d.carpeta.split('/')[0] || SUELTOS
      g.set(raiz, [...(g.get(raiz) ?? []), d])
    }
    return [...g.entries()].sort(([a], [b]) => (a === SUELTOS ? 1 : b === SUELTOS ? -1 : a.localeCompare(b)))
  }, [mesSel])

  // Índice de todo lo seleccionable: clave → dónde va en el ZIP y cuánto pesa.
  const indice = useMemo(() => {
    const m = new Map<string, { ruta: string; bytes: number; kind: 'a' | 'm'; id: string; vencido: boolean; dueno: string }>()
    const deDueno = (seccion: string, d: { id: string; nombre: string }, certs: CertCarpeta[]) => {
      for (const c of certs) {
        c.archivos.forEach((a, i) => {
          const carpeta = seccion === 'Empresa' ? 'Empresa' : `${seccion}/${nombreSeguro(d.nombre)}`
          m.set(kA(a.id), {
            ruta: `${carpeta}/${nombreArchivoCertificado(c.titulo, c.vence, a.nombre, i + 1, c.archivos.length)}`,
            bytes: a.bytes, kind: 'a', id: a.id, vencido: c.estado === 'vencido', dueno: `${seccion}:${d.id}`,
          })
        })
      }
    }
    empleados.forEach((e) => deDueno('Empleados', e, e.certificados))
    vehiculos.forEach((v) => deDueno('Vehículos', v, v.certificados))
    deDueno('Empresa', { id: empresa.id, nombre: empresa.nombre }, deEmpresa)
    for (const mes of meses) {
      for (const d of mes.docs) {
        const tramos = d.carpeta ? d.carpeta.split('/').map((t) => nombreSeguro(t)) : [SUELTOS]
        m.set(kM(d.id), {
          ruta: `Documentación mensual/${labelPeriodo(mes.periodo)}/${tramos.join('/')}/${nombreSeguro(d.nombre, 150)}`,
          bytes: d.bytes, kind: 'm', id: d.id, vencido: false, dueno: `mes:${mes.periodo}`,
        })
      }
    }
    return m
  }, [empleados, vehiculos, deEmpresa, meses, empresa])

  const resumen = useMemo(() => {
    let bytes = 0, vencidos = 0
    const personas = new Set<string>(), autos = new Set<string>()
    for (const k of sel) {
      const it = indice.get(k)
      if (!it) continue
      bytes += it.bytes
      if (it.vencido) vencidos++
      if (it.dueno.startsWith('Empleados:')) personas.add(it.dueno)
      if (it.dueno.startsWith('Vehículos:')) autos.add(it.dueno)
    }
    return { archivos: sel.size, bytes, vencidos, personas: personas.size, vehiculos: autos.size }
  }, [sel, indice])

  /** Un documento, un archivo o una carpeta del mes: si ya está todo elegido se saca; si no, se suma. */
  function alternarClaves(claves: string[]) {
    setSel((prev) => {
      const next = new Set(prev)
      if (claves.every((k) => prev.has(k))) claves.forEach((k) => next.delete(k))
      else claves.forEach((k) => next.add(k))
      return next
    })
  }
  /**
   * Una persona o vehículo entero: suma su documentación (sin los vencidos, salvo que se
   * pidan) y, si eso ya estaba elegido, saca todo lo suyo. Si solo tiene vencidos, los suma.
   */
  function alternarDueno(certs: CertCarpeta[]) {
    const todas = todasLasClaves(certs)
    const base = clavesDe(certs, conVencidos)
    const objetivo = base.length > 0 ? base : todas
    setSel((prev) => {
      const next = new Set(prev)
      if (objetivo.every((k) => prev.has(k))) todas.forEach((k) => next.delete(k))
      else objetivo.forEach((k) => next.add(k))
      return next
    })
  }
  const abrir = (id: string) => setAbiertos((p) => { const n = new Set(p); if (n.has(id)) n.delete(id); else n.add(id); return n })

  function seleccionarVisibles() {
    setSel((prev) => {
      const next = new Set(prev)
      for (const e of visibles) clavesDe(e.certificados, conVencidos).forEach((k) => next.add(k))
      return next
    })
  }

  async function descargar() {
    if (progreso) return
    const elegidos = [...sel].map((k) => indice.get(k)).filter((x): x is NonNullable<typeof x> => !!x)
    if (elegidos.length === 0) return toast.error('Elegí al menos un documento.')
    const raiz = nombreSeguro(nombreZip, 80)
    const rutas = rutasUnicas(elegidos.map((e) => `${raiz}/${e.ruta}`))

    setProgreso({ hechos: 0, total: elegidos.length })
    try {
      const res = await fetch('/api/carpeta', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          archivos: elegidos.filter((e) => e.kind === 'a').map((e) => e.id),
          mensuales: elegidos.filter((e) => e.kind === 'm').map((e) => e.id),
        }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body.error ?? 'No se pudo preparar la descarga.')
      const urls: Record<string, string> = body.urls ?? {}

      const archivos: Zippable = {}
      const fallidos: string[] = []
      let hechos = 0
      let siguiente = 0
      // De a 4 en paralelo: rápido sin ahogar la conexión.
      await Promise.all(Array.from({ length: Math.min(4, elegidos.length) }, async () => {
        while (siguiente < elegidos.length) {
          const i = siguiente++
          const e = elegidos[i]
          const url = urls[e.id]
          try {
            if (!url) throw new Error('sin permiso')
            let datos: ArrayBuffer
            try {
              const r = await fetch(url)
              if (!r.ok) throw new Error(`HTTP ${r.status}`)
              datos = await r.arrayBuffer()
            } catch {
              // Plan B: a través del server de la app (sirve para archivos de hasta ~4 MB).
              const r = await fetch(`/api/carpeta/archivo?id=${e.id}&tipo=${e.kind}`)
              if (!r.ok) throw new Error(`HTTP ${r.status}`)
              datos = await r.arrayBuffer()
            }
            // level 0: PDF y fotos ya vienen comprimidos; comprimir de nuevo solo gasta tiempo.
            archivos[rutas[i]] = [new Uint8Array(datos), { level: 0 }]
          } catch {
            fallidos.push(e.ruta)
          }
          hechos++
          setProgreso({ hechos, total: elegidos.length })
        }
      }))
      if (Object.keys(archivos).length === 0) throw new Error('No se pudo bajar ningún archivo. Revisá la conexión y probá de nuevo.')
      if (fallidos.length > 0) {
        archivos[`${raiz}/NO SE PUDIERON DESCARGAR.txt`] = strToU8(`Estos archivos no se pudieron bajar (probá de nuevo o descargalos a mano):\r\n\r\n${fallidos.join('\r\n')}\r\n`)
      }

      const datos = await new Promise<Uint8Array>((ok, mal) => zip(archivos, { level: 0 }, (err, d) => (err ? mal(err) : ok(d))))
      const blob = new Blob([datos as BlobPart], { type: 'application/zip' })
      const href = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = href
      a.download = `${raiz}.zip`
      document.body.appendChild(a)
      a.click()
      a.remove()
      setTimeout(() => URL.revokeObjectURL(href), 60_000)

      const n = Object.keys(archivos).length - (fallidos.length > 0 ? 1 : 0)
      if (fallidos.length > 0) toast.warning(`Carpeta lista con ${n} archivos. ${fallidos.length} no se pudieron bajar (están listados adentro).`)
      else toast.success(`Carpeta lista: ${n} ${n === 1 ? 'archivo' : 'archivos'}.`)
    } catch (e) {
      toast.error(e instanceof Error && !/fetch|network/i.test(e.message) ? e.message : mensajeError(e, 'armar la carpeta'))
    } finally {
      setProgreso(null)
    }
  }

  const btn = 'rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground'
  const chip = (activo: boolean) =>
    clsx('rounded-full border px-3 py-1 text-xs font-medium transition-colors', activo ? 'border-primary bg-accent text-primary' : 'border-border bg-card text-muted-foreground hover:bg-muted')

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 pb-32 sm:p-6 sm:pb-32 lg:p-8 lg:pb-32">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Armar carpeta para planta</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          {empresa.nombre} · Elegí personas, vehículos y documentos, y bajá todo en un ZIP con los nombres ordenados para mandar a la planta.
        </p>
      </div>

      {/* ── Personas ── */}
      <section className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="mr-auto text-base font-semibold">Personas</h2>
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <input type="checkbox" checked={conVencidos} onChange={(e) => setConVencidos(e.target.checked)} className="size-4 accent-[var(--primary)]" />
            Incluir vencidos al elegir «todo»
          </label>
          <button type="button" onClick={seleccionarVisibles} className={btn}>Elegir toda la documentación de la lista</button>
          {sel.size > 0 && <button type="button" onClick={() => setSel(new Set())} className={btn}>Limpiar selección</button>}
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" strokeWidth={1.75} />
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar persona o sector…"
            className="w-full rounded-xl border border-input bg-card py-2.5 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        {sectores.length > 1 && (
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => setSector(null)} className={chip(sector === null)}>Todos los sectores</button>
            {sectores.map((s) => <button key={s} type="button" onClick={() => setSector(s)} className={chip(sector === s)}>{s}</button>)}
          </div>
        )}
        <ListaDuenos
          duenos={visibles}
          sel={sel}
          abiertos={abiertos}
          prefijo="e"
          vacio={empleados.length === 0 ? 'No hay empleados activos.' : 'Nadie coincide con la búsqueda.'}
          onAlternarClaves={alternarClaves}
          onAlternarDueno={alternarDueno}
          onAbrir={abrir}
        />
      </section>

      {/* ── Empresa ── */}
      {deEmpresa.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-base font-semibold">Documentación de la empresa</h2>
          <ListaDuenos
            duenos={[{ id: 'empresa', nombre: empresa.nombre, detalle: 'Habilitaciones, seguros, programas', certificados: deEmpresa }]}
            sel={sel}
            abiertos={abiertos}
              prefijo=""
            vacio=""
            onAlternarClaves={alternarClaves}
          onAlternarDueno={alternarDueno}
            onAbrir={abrir}
          />
        </section>
      )}

      {/* ── Vehículos ── */}
      {vehiculos.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-base font-semibold">Vehículos</h2>
          <ListaDuenos
            duenos={vehiculos}
            sel={sel}
            abiertos={abiertos}
              prefijo="v"
            mono
            vacio=""
            onAlternarClaves={alternarClaves}
          onAlternarDueno={alternarDueno}
            onAbrir={abrir}
          />
        </section>
      )}

      {/* ── Mensual ── */}
      {meses.length > 0 && (
        <section className="space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="mr-auto text-base font-semibold">Documentación mensual</h2>
            <select
              value={periodo}
              onChange={(e) => setPeriodo(e.target.value)}
              aria-label="Mes"
              className="rounded-lg border border-input bg-card px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              {meses.map((m) => <option key={m.periodo} value={m.periodo}>{labelPeriodo(m.periodo)}</option>)}
            </select>
          </div>
          <div className="divide-y divide-border rounded-2xl border border-border bg-card">
            {carpetasMes.map(([carpeta, docs]) => {
              const claves = docs.map((d) => kM(d.id))
              const marca = marcaDe(claves, sel)
              const id = `m:${periodo}:${carpeta}`
              const abierto = abiertos.has(id)
              return (
                <div key={carpeta}>
                  <div className="flex items-center gap-3 px-4 py-3">
                    <Check marca={marca} onChange={() => alternarClaves(claves)} label={`Elegir ${carpeta}`} />
                    <button type="button" onClick={() => abrir(id)} className="flex min-w-0 flex-1 items-center gap-2 text-left">
                      <ChevronRight className={clsx('size-4 shrink-0 text-muted-foreground transition-transform', abierto && 'rotate-90')} strokeWidth={1.75} />
                      <span className="truncate text-sm font-medium">{carpeta}</span>
                      <span className="shrink-0 text-xs text-muted-foreground">{docs.length} {docs.length === 1 ? 'archivo' : 'archivos'}</span>
                    </button>
                  </div>
                  {abierto && (
                    <ul className="border-t border-border bg-muted/30 py-1">
                      {docs.map((d) => {
                        const k = kM(d.id)
                        return (
                          <li key={d.id} className="flex items-center gap-3 py-1.5 pl-11 pr-4 text-sm">
                            <Check marca={sel.has(k) ? 'todo' : 'nada'} onChange={() => alternarClaves([k])} label={`Elegir ${d.nombre}`} />
                            <span className="min-w-0 flex-1 truncate">{d.carpeta.includes('/') ? `${d.carpeta.split('/').slice(1).join(' / ')} · ` : ''}{d.nombre}</span>
                            <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{fmtTamano(d.bytes)}</span>
                          </li>
                        )
                      })}
                    </ul>
                  )}
                </div>
              )
            })}
            {carpetasMes.length === 0 && <p className="px-4 py-6 text-center text-sm text-muted-foreground">No hay documentación cargada en ese mes.</p>}
          </div>
        </section>
      )}

      {/* ── Barra de descarga ── */}
      <div className="sticky bottom-4 z-20">
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-card/95 px-4 py-3 shadow-lg backdrop-blur sm:px-5">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">
              {resumen.archivos === 0
                ? 'Todavía no elegiste nada'
                : `${resumen.archivos} ${resumen.archivos === 1 ? 'archivo' : 'archivos'} · ${fmtTamano(resumen.bytes)}`}
            </p>
            <p className="truncate text-xs text-muted-foreground">
              {[
                resumen.personas > 0 && `${resumen.personas} ${resumen.personas === 1 ? 'persona' : 'personas'}`,
                resumen.vehiculos > 0 && `${resumen.vehiculos} ${resumen.vehiculos === 1 ? 'vehículo' : 'vehículos'}`,
              ].filter(Boolean).join(' · ')}
              {resumen.vencidos > 0 && <span className="text-danger">{resumen.personas + resumen.vehiculos > 0 ? ' · ' : ''}{resumen.vencidos} vencido{resumen.vencidos === 1 ? '' : 's'}</span>}
            </p>
          </div>
          <input
            value={nombreZip}
            onChange={(e) => setNombreZip(e.target.value)}
            aria-label="Nombre de la carpeta"
            placeholder="Nombre de la carpeta"
            className="w-full rounded-lg border border-input bg-card px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring sm:w-72"
          />
          <button
            type="button"
            onClick={descargar}
            disabled={resumen.archivos === 0 || !!progreso}
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
          >
            <Download className="size-4" strokeWidth={1.75} />
            {progreso ? `Bajando ${progreso.hechos} de ${progreso.total}…` : 'Descargar ZIP'}
          </button>
        </div>
      </div>
    </div>
  )
}

function ListaDuenos({
  duenos, sel, abiertos, prefijo, mono, vacio, onAlternarClaves, onAlternarDueno, onAbrir,
}: {
  duenos: DuenoCarpeta[]
  sel: Set<string>
  abiertos: Set<string>
  prefijo: string
  mono?: boolean
  vacio: string
  onAlternarClaves: (claves: string[]) => void
  onAlternarDueno: (certs: CertCarpeta[]) => void
  onAbrir: (id: string) => void
}) {
  if (duenos.length === 0) return <p className="rounded-2xl border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">{vacio}</p>
  return (
    <div className="divide-y divide-border rounded-2xl border border-border bg-card">
      {duenos.map((d) => {
        const todas = todasLasClaves(d.certificados)
        const marca = marcaDe(todas, sel)
        const id = prefijo ? `${prefijo}:${d.id}` : d.id
        const abierto = abiertos.has(id)
        const conArchivo = d.certificados.filter((c) => c.archivos.length > 0)
        const vencidos = conArchivo.filter((c) => c.estado === 'vencido').length
        const sinArchivo = d.certificados.length - conArchivo.length
        return (
          <div key={d.id}>
            <div className="flex items-center gap-3 px-4 py-3">
              <Check
                marca={marca}
                onChange={() => onAlternarDueno(d.certificados)}
                label={`Elegir toda la documentación de ${d.nombre}`}
                disabled={todas.length === 0}
              />
              <button type="button" onClick={() => onAbrir(id)} className="flex min-w-0 flex-1 items-center gap-2 text-left">
                <ChevronRight className={clsx('size-4 shrink-0 text-muted-foreground transition-transform', abierto && 'rotate-90')} strokeWidth={1.75} />
                <span className={clsx('truncate text-sm font-medium', mono && 'font-mono tracking-wide')}>{d.nombre}</span>
                {d.detalle && <span className="hidden truncate text-xs text-muted-foreground sm:inline">{d.detalle}</span>}
              </button>
              <span className="shrink-0 text-right text-xs text-muted-foreground">
                {conArchivo.length} {conArchivo.length === 1 ? 'documento' : 'documentos'}
                {vencidos > 0 && <span className="text-danger"> · {vencidos} vencido{vencidos === 1 ? '' : 's'}</span>}
                {sinArchivo > 0 && <span> · {sinArchivo} sin archivo</span>}
              </span>
            </div>
            {abierto && (
              <ul className="border-t border-border bg-muted/30 py-1">
                {d.certificados.map((c) => {
                  const claves = c.archivos.map((a) => kA(a.id))
                  const m = marcaDe(claves, sel)
                  const bytes = c.archivos.reduce((t, a) => t + a.bytes, 0)
                  return (
                    <li key={c.id} className="flex items-center gap-3 py-1.5 pl-11 pr-4 text-sm">
                      <Check marca={m} onChange={() => onAlternarClaves(claves)} label={`Elegir ${c.titulo}`} disabled={claves.length === 0} />
                      <span className={clsx('min-w-0 flex-1 truncate', claves.length === 0 && 'text-muted-foreground')}>{c.titulo}</span>
                      <span className="hidden w-28 shrink-0 text-xs tabular-nums text-muted-foreground sm:inline">{c.vence ? `vence ${fmtFechaCompletaAR(c.vence)}` : 'sin vencimiento'}</span>
                      <span className="w-20 shrink-0"><EstadoPill estado={c.estado} /></span>
                      <span className="w-24 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
                        {claves.length === 0 ? 'sin archivo' : `${claves.length > 1 ? `${claves.length} archivos · ` : ''}${fmtTamano(bytes)}`}
                      </span>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        )
      })}
    </div>
  )
}
