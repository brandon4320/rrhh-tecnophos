'use client'

import { useMemo, useState, type KeyboardEvent } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import { ChevronRight, Plus, Search } from 'lucide-react'
import { Monograma } from '@/components/ui/monograma'
import { EstadoPill } from '@/components/ui/estado-pill'
import { EncabezadoOrdenable } from '@/components/ui/encabezado-ordenable'
import { RANGO_ESTADO, alternarOrden, comparar, escribirOrden, leerOrden, type Orden } from '@/lib/orden'
import { createClient } from '@/lib/supabase/client'
import { coincide } from '@/lib/texto'
import { mensajeError } from '@/lib/errores'
import { cn } from '@/lib/utils'
import { ESTADO_LABELS, type EstadoVencimiento } from '@/types'

export interface FilaEmpleado {
  id: string
  nombre: string
  apellido: string | null
  nombreCompleto: string
  sector: string | null
  empresaNombre: string | null
  activo: boolean
  certificados: number
  estado: EstadoVencimiento
}

interface Props {
  filas: FilaEmpleado[]
  empresaSel: { id: string; nombre: string; slug: string } | null
  /** "ADC S.R.L., Serviwhite" o "todas las empresas": lo tildado en el selector del menú. */
  alcance: string
  puedeEditar: boolean
}

const CAMPOS = ['nombre', 'empresa', 'sector', 'certificados', 'estado'] as const
type Campo = (typeof CAMPOS)[number]
const ORDEN_INICIAL: Orden<Campo> = { campo: 'nombre', dir: 'asc' }
const ESTADOS: EstadoVencimiento[] = ['vencido', 'proximo', 'vigente', 'sin_fecha']

function valorDe(f: FilaEmpleado, campo: Campo): string | number | null {
  if (campo === 'nombre') return f.nombreCompleto
  if (campo === 'empresa') return f.empresaNombre
  if (campo === 'sector') return f.sector?.trim() || null
  if (campo === 'certificados') return f.certificados
  return RANGO_ESTADO[f.estado]
}

/** Reemplaza un parámetro de la URL sin navegar (la búsqueda sobrevive al volver atrás). */
function reemplazarParam(clave: string, valor: string | null) {
  try {
    const url = new URL(window.location.href)
    if (valor) url.searchParams.set(clave, valor)
    else url.searchParams.delete(clave)
    window.history.replaceState(null, '', url)
  } catch { /* la URL es cosmética */ }
}

export default function EmpleadosClient({ filas: filasServer, empresaSel, alcance, puedeEditar }: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()
  // Las filas salen SIEMPRE de las props (cambiar de empresa o router.refresh las
  // renueva); lo único local es lo reactivado acá, para verlo al instante.
  const [reactivados, setReactivados] = useState<ReadonlySet<string>>(() => new Set())
  const filas = useMemo(
    () => (reactivados.size ? filasServer.map((f) => (reactivados.has(f.id) ? { ...f, activo: true } : f)) : filasServer),
    [filasServer, reactivados]
  )
  // La búsqueda se lee de la URL al montar: al volver de un legajo sigue escrita.
  const [busqueda, setBusqueda] = useState(() => searchParams.get('q') ?? '')
  const [verBajas, setVerBajas] = useState(() => searchParams.get('baja') === '1')
  // Orden y filtros también de la URL (al volver de un legajo quedan como estaban).
  const [orden, setOrden] = useState(() => leerOrden(searchParams.get('orden'), CAMPOS, ORDEN_INICIAL))
  const [sector, setSector] = useState(() => searchParams.get('sector') ?? '')
  const [estado, setEstado] = useState(() => (ESTADOS as string[]).includes(searchParams.get('estado') ?? '') ? (searchParams.get('estado') as EstadoVencimiento) : '')
  const [seleccion, setSeleccion] = useState(0)
  const [reactivando, setReactivando] = useState<string | null>(null)

  const activos = useMemo(() => filas.filter((f) => f.activo).length, [filas])
  const bajas = filas.length - activos

  // Sectores de lo que se está mirando (activos o bajas), sin repetir mayúsculas/minúsculas.
  const sectores = useMemo(() => {
    const vistos = new Map<string, string>()
    for (const f of filas) {
      const s = f.sector?.trim()
      if (f.activo !== verBajas && s && !vistos.has(s.toLocaleLowerCase('es'))) vistos.set(s.toLocaleLowerCase('es'), s)
    }
    return [...vistos.values()].sort((a, b) => comparar(a, b))
  }, [filas, verBajas])

  const visibles = useMemo(
    () =>
      filas
        .filter(
          (f) =>
            f.activo !== verBajas &&
            (!sector || f.sector?.trim().toLocaleLowerCase('es') === sector.toLocaleLowerCase('es')) &&
            (!estado || f.estado === estado) &&
            coincide(busqueda, f.nombre, f.apellido, f.sector, f.empresaNombre)
        )
        // Empate: por nombre, así el orden no salta entre iguales.
        .sort((a, b) => comparar(valorDe(a, orden.campo), valorDe(b, orden.campo), orden.dir) || comparar(a.nombreCompleto, b.nombreCompleto)),
    [filas, verBajas, busqueda, sector, estado, orden]
  )

  function alternar(campo: Campo) {
    // Los números (certificados) arrancan de mayor a menor; el resto, de la A a la Z / lo más urgente primero.
    const nuevo = alternarOrden(orden, campo, campo === 'certificados' ? 'desc' : 'asc')
    setOrden(nuevo)
    setSeleccion(0)
    reemplazarParam('orden', nuevo.campo === ORDEN_INICIAL.campo && nuevo.dir === ORDEN_INICIAL.dir ? null : escribirOrden(nuevo))
  }

  function cambiarSector(v: string) {
    setSector(v)
    setSeleccion(0)
    reemplazarParam('sector', v || null)
  }

  function cambiarEstado(v: EstadoVencimiento | '') {
    setEstado(v)
    setSeleccion(0)
    reemplazarParam('estado', v || null)
  }
  const sel = Math.min(seleccion, visibles.length - 1)

  function cambiarBusqueda(v: string) {
    setBusqueda(v)
    setSeleccion(0)
    reemplazarParam('q', v.trim() ? v : null)
  }

  function cambiarVista(bajasSi: boolean) {
    setVerBajas(bajasSi)
    setSeleccion(0)
    reemplazarParam('baja', bajasSi ? '1' : null)
  }

  function mover(i: number) {
    const fila = visibles[i]
    if (!fila) return
    setSeleccion(i)
    document.getElementById(`emp-${fila.id}`)?.scrollIntoView({ block: 'nearest' })
  }

  function onTeclado(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      mover(Math.min(sel + 1, visibles.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      mover(Math.max(sel - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const fila = visibles[sel]
      if (fila) router.push(`/legajo/${fila.id}`)
    } else if (e.key === 'Escape' && busqueda) {
      e.preventDefault()
      cambiarBusqueda('')
    }
  }

  async function reactivar(fila: FilaEmpleado) {
    setReactivando(fila.id)
    const supabase = createClient()
    const { data, error } = await supabase
      .from('empleados')
      .update({ activo: true, updated_at: new Date().toISOString() })
      .eq('id', fila.id)
      .select('id')
    setReactivando(null)
    if (error || !data?.length) {
      toast.error(error ? mensajeError(error, 'reactivar al empleado') : 'No se pudo reactivar: no tenés permiso sobre este legajo.')
      return
    }
    setReactivados((prev) => new Set(prev).add(fila.id))
    toast.success(`${fila.nombreCompleto} está activo de nuevo`)
    router.refresh()
  }

  const hrefNuevo = `/admin/empleados/nuevo${empresaSel ? `?empresa=${empresaSel.slug}` : ''}`

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6 lg:p-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-[28px] leading-tight font-semibold tracking-[-0.02em]">Empleados</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {visibles.length} {visibles.length === 1 ? 'resultado' : 'resultados'}
            {` · ${alcance}`}
          </p>
        </div>
        {puedeEditar && (
          <Link
            href={hrefNuevo}
            className="inline-flex items-center gap-2 rounded-[10px] bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-[background-color,transform] hover:bg-primary-hover active:scale-[0.97]"
          >
            <Plus className="size-4" strokeWidth={2.5} />
            Nuevo empleado
          </Link>
        )}
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[260px] flex-1 sm:max-w-md">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" strokeWidth={1.75} />
          <input
            type="search"
            value={busqueda}
            onChange={(e) => cambiarBusqueda(e.target.value)}
            onKeyDown={onTeclado}
            autoFocus
            placeholder="Buscar por nombre, apellido o sector…"
            aria-label="Buscar empleados"
            className="min-h-10 w-full rounded-[10px] border border-input bg-card py-2 pl-9 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-ring/15 focus:border-ring"
          />
        </div>
        <div className="inline-flex items-center gap-1 rounded-[12px] bg-muted p-1">
          {[
            { bajasSi: false, label: `Activos · ${activos}` },
            { bajasSi: true, label: `Dados de baja · ${bajas}` },
          ].map((t) => (
            <button
              key={t.label}
              type="button"
              onClick={() => cambiarVista(t.bajasSi)}
              className={cn(
                'inline-flex h-8 cursor-pointer items-center rounded-[9px] px-3.5 text-sm font-medium transition-colors',
                verBajas === t.bajasSi ? 'bg-card text-foreground shadow-[0_1px_2px_rgba(23,22,31,0.08),0_1px_1px_rgba(23,22,31,0.04)]' : 'text-texto-2 hover:text-foreground'
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
        {sectores.length > 1 && (
          <select
            value={sector}
            onChange={(e) => cambiarSector(e.target.value)}
            aria-label="Sector"
            className="min-h-10 max-w-[220px] rounded-[10px] border border-input bg-card px-3 py-2 text-sm focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/15"
          >
            <option value="">Todos los sectores</option>
            {sectores.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        )}
        <select
          value={estado}
          onChange={(e) => cambiarEstado(e.target.value as EstadoVencimiento | '')}
          aria-label="Estado"
          className="min-h-10 rounded-[10px] border border-input bg-card px-3 py-2 text-sm focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/15"
        >
          <option value="">Todos los estados</option>
          {ESTADOS.map((e) => (
            <option key={e} value={e}>
              {e === 'vigente' ? 'OK' : e === 'sin_fecha' ? 'Sin datos' : ESTADO_LABELS[e]}
            </option>
          ))}
        </select>
      </div>

      {/* Lista */}
      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-tarjeta">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <EncabezadoOrdenable campo="nombre" etiqueta="Nombre" orden={orden} onAlternar={alternar} className="px-5" />
              <EncabezadoOrdenable campo="empresa" etiqueta="Empresa" orden={orden} onAlternar={alternar} className="px-4" />
              <EncabezadoOrdenable campo="sector" etiqueta="Sector" orden={orden} onAlternar={alternar} className="hidden px-4 sm:table-cell" />
              <EncabezadoOrdenable campo="certificados" etiqueta="Certificados" orden={orden} onAlternar={alternar} alinear="centro" className="hidden px-4 sm:table-cell" />
              <EncabezadoOrdenable campo="estado" etiqueta="Estado" orden={orden} onAlternar={alternar} className="px-4" />
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {visibles.map((emp, i) => (
              <tr
                key={emp.id}
                id={`emp-${emp.id}`}
                // relative + link estirado (after:inset-0): toda la fila abre el legajo,
                // y sigue siendo un <a> de verdad (clic medio, abrir en pestaña nueva).
                className={cn('relative transition-colors hover:bg-muted/40', i === sel && 'bg-muted/60')}
                onMouseEnter={() => setSeleccion(i)}
              >
                <td className="px-5 py-3">
                  <div className="flex items-center gap-3">
                    <Monograma nombre={emp.nombreCompleto} size="sm" />
                    <Link
                      href={`/legajo/${emp.id}`}
                      className="font-medium after:absolute after:inset-0 focus:outline-none focus-visible:underline"
                    >
                      {emp.nombreCompleto}
                    </Link>
                  </div>
                </td>
                <td className="px-4 py-3 text-muted-foreground">{emp.empresaNombre ?? '—'}</td>
                <td className="hidden px-4 py-3 text-muted-foreground sm:table-cell">{emp.sector ?? '—'}</td>
                <td className="hidden px-4 py-3 text-center tabular-nums text-muted-foreground sm:table-cell">{emp.certificados}</td>
                <td className="px-4 py-3">
                  <EstadoPill estado={emp.estado} />
                </td>
                <td className="px-4 py-3 text-right">
                  {!emp.activo && puedeEditar ? (
                    <button
                      type="button"
                      onClick={() => reactivar(emp)}
                      disabled={reactivando === emp.id}
                      // Por encima del link estirado de la fila.
                      className="relative z-10 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
                    >
                      {reactivando === emp.id ? 'Reactivando…' : 'Reactivar'}
                    </button>
                  ) : (
                    <ChevronRight className="ml-auto size-4 text-muted-foreground/50" strokeWidth={1.75} />
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {visibles.length === 0 && (
          <div className="py-12 text-center text-sm text-muted-foreground">
            {sector || estado
              ? 'No hay empleados con esos filtros.'
              : busqueda.trim()
              ? `No hay empleados ${verBajas ? 'dados de baja ' : ''}que coincidan con “${busqueda.trim()}”.`
              : verBajas
                ? 'No hay empleados dados de baja.'
                : 'No hay empleados activos.'}
          </div>
        )}
      </div>
    </div>
  )
}
