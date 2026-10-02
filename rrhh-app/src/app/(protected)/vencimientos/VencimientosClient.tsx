'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { ChevronRight, FileX, Search } from 'lucide-react'
import { Monograma } from '@/components/ui/monograma'
import { EstadoPill } from '@/components/ui/estado-pill'
import { coincide } from '@/lib/texto'
import { cn } from '@/lib/utils'
import type { EstadoVencimiento } from '@/types'

export type VistaVencimientos = 'pendientes' | 'vencido' | 'proximo' | 'vigente' | 'todos'

export interface FilaVencimiento {
  id: string
  titular: string
  empresaNombre: string | null
  tipoNombre: string
  /** 'YYYY-MM-DD' */
  fecha: string
  dias: number
  estado: EstadoVencimiento
  href: string | null
  sinArchivo: boolean
}

interface Props {
  filas: FilaVencimiento[]
  vista: VistaVencimientos
  /** true si el server trajo también los vigentes (vistas Vigentes / Todos). */
  incluyeVigentes: boolean
  empresa?: string
  tipo?: string
  empresas: { id: string; nombre: string; slug: string }[]
  tipos: { id: string; nombre: string }[]
}

const PESTANIAS: { vista: VistaVencimientos; label: string }[] = [
  { vista: 'pendientes', label: 'Pendientes' },
  { vista: 'vencido', label: 'Vencidos' },
  { vista: 'proximo', label: 'Por vencer' },
  { vista: 'vigente', label: 'Vigentes' },
  { vista: 'todos', label: 'Todos' },
]

function entra(f: FilaVencimiento, vista: VistaVencimientos): boolean {
  if (vista === 'todos') return true
  if (vista === 'pendientes') return f.estado === 'vencido' || f.estado === 'proximo'
  return f.estado === vista
}

function relativo(dias: number): string {
  if (dias < 0) return `hace ${Math.abs(dias)} ${Math.abs(dias) === 1 ? 'día' : 'días'}`
  if (dias === 0) return 'vence hoy'
  return `en ${dias} ${dias === 1 ? 'día' : 'días'}`
}

function fmtFecha(f: string): string {
  const [a, m, d] = f.split('-')
  return `${d}/${m}/${a}`
}

/**
 * Tabla de vencimientos. Empresa y tipo filtran en el server (cambian los datos);
 * las pestañas y la búsqueda son locales sobre lo que ya llegó, así que son
 * instantáneas y las cantidades de cada pestaña siguen a la búsqueda. Solo
 * Vigentes / Todos vuelven al server la primera vez (traen la tabla entera).
 */
export default function VencimientosClient({ filas, vista: vistaInicial, incluyeVigentes, empresa, tipo, empresas, tipos }: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [vista, setVista] = useState<VistaVencimientos>(vistaInicial)
  const [busqueda, setBusqueda] = useState(() => searchParams.get('q') ?? '')

  const buscadas = useMemo(
    () => filas.filter((f) => coincide(busqueda, f.titular, f.tipoNombre, f.empresaNombre)),
    [filas, busqueda]
  )
  const visibles = useMemo(() => buscadas.filter((f) => entra(f, vista)), [buscadas, vista])
  const cuenta = useMemo(() => {
    const c = { vencido: 0, proximo: 0, vigente: 0 }
    for (const f of buscadas) if (f.estado in c) c[f.estado as keyof typeof c]++
    return c
  }, [buscadas])

  function cantidad(v: VistaVencimientos): number | null {
    if (v === 'pendientes') return cuenta.vencido + cuenta.proximo
    if (v === 'vencido') return cuenta.vencido
    if (v === 'proximo') return cuenta.proximo
    if (!incluyeVigentes) return null // todavía no se trajeron
    return v === 'vigente' ? cuenta.vigente : buscadas.length
  }

  function url(cambios: { empresa?: string; tipo?: string; estado?: VistaVencimientos }) {
    const p = new URLSearchParams()
    const emp = 'empresa' in cambios ? cambios.empresa : empresa
    const tip = 'tipo' in cambios ? cambios.tipo : tipo
    const est = cambios.estado ?? vista
    if (emp) p.set('empresa', emp)
    if (tip) p.set('tipo', tip)
    if (est !== 'pendientes') p.set('estado', est)
    if (busqueda.trim()) p.set('q', busqueda)
    const qs = p.toString()
    return `${pathname}${qs ? `?${qs}` : ''}`
  }

  function reemplazarUrl(destino: string) {
    try {
      window.history.replaceState(null, '', destino)
    } catch { /* la URL es cosmética */ }
  }

  function elegirVista(v: VistaVencimientos) {
    if ((v === 'vigente' || v === 'todos') && !incluyeVigentes) {
      router.push(url({ estado: v })) // hay que traer la tabla entera
      return
    }
    setVista(v)
    reemplazarUrl(url({ estado: v }))
  }

  function cambiarBusqueda(v: string) {
    setBusqueda(v)
    try {
      const u = new URL(window.location.href)
      if (v.trim()) u.searchParams.set('q', v)
      else u.searchParams.delete('q')
      window.history.replaceState(null, '', u)
    } catch { /* la URL es cosmética */ }
  }

  const hayFiltros = Boolean(empresa || tipo || vista !== 'pendientes' || busqueda)

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6 lg:p-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Vencimientos</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          {visibles.length} {visibles.length === 1 ? 'registro' : 'registros'}
          {vista === 'pendientes' && ' · vencidos y por vencer dentro de su ventana de alerta'}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex flex-wrap items-center gap-1 rounded-xl bg-muted p-1">
          {PESTANIAS.map((t) => {
            const n = cantidad(t.vista)
            return (
              <button
                key={t.vista}
                type="button"
                onClick={() => elegirVista(t.vista)}
                className={cn(
                  'rounded-lg px-3.5 py-1.5 text-sm font-medium transition-colors',
                  vista === t.vista ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {t.label}
                {n !== null && <span className="ml-1.5 tabular-nums text-muted-foreground">{n}</span>}
              </button>
            )
          })}
        </div>

        <div className="relative min-w-[220px] flex-1 sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" strokeWidth={1.75} />
          <input
            type="search"
            value={busqueda}
            onChange={(e) => cambiarBusqueda(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Escape' && busqueda) { e.preventDefault(); cambiarBusqueda('') } }}
            placeholder="Buscar nombre, patente o tipo…"
            aria-label="Buscar vencimientos"
            className="w-full rounded-xl border border-border bg-card py-2 pl-9 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        <select
          value={empresa ?? ''}
          onChange={(e) => router.push(url({ empresa: e.target.value || undefined }))}
          aria-label="Empresa"
          className="rounded-xl border border-border bg-card px-3.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="">Todas las empresas</option>
          {empresas.map((e) => (
            <option key={e.id} value={e.slug}>
              {e.nombre}
            </option>
          ))}
        </select>

        <select
          value={tipo ?? ''}
          onChange={(e) => router.push(url({ tipo: e.target.value || undefined }))}
          aria-label="Tipo de certificado"
          className="max-w-[240px] rounded-xl border border-border bg-card px-3.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="">Todos los certificados</option>
          {tipos.map((t) => (
            <option key={t.id} value={t.id}>
              {t.nombre}
            </option>
          ))}
        </select>

        {hayFiltros && (
          <button
            type="button"
            onClick={() => {
              // La búsqueda y la pestaña son estado local: se limpian acá, no solo en la URL.
              setBusqueda('')
              setVista('pendientes')
              // Empresa y tipo filtran en el server; si no hay, los datos ya alcanzan.
              if (empresa || tipo) router.push(pathname)
              else reemplazarUrl(pathname)
            }}
            className="px-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            Limpiar
          </button>
        )}
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        {visibles.length === 0 ? (
          <div className="py-12 text-center text-sm text-muted-foreground">
            {busqueda.trim()
              ? `Nada coincide con “${busqueda.trim()}” en esta vista.`
              : vista === 'pendientes'
                ? 'No hay vencidos ni por vencer con estos filtros. Todo al día.'
                : 'No se encontraron registros con los filtros aplicados.'}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Titular</th>
                <th className="hidden px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground sm:table-cell">Empresa</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Certificado</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Vencimiento</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Estado</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {visibles.map((f) => (
                // relative + link estirado: toda la fila lleva al certificado exacto.
                <tr key={f.id} className={cn('transition-colors', f.href && 'relative hover:bg-muted/40')}>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <Monograma nombre={f.titular} size="sm" />
                      {f.href ? (
                        <Link href={f.href} className="font-medium after:absolute after:inset-0 focus:outline-none focus-visible:underline">
                          {f.titular}
                        </Link>
                      ) : (
                        <span className="font-medium">{f.titular}</span>
                      )}
                    </div>
                  </td>
                  <td className="hidden px-4 py-3 text-muted-foreground sm:table-cell">{f.empresaNombre ?? '—'}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    <span className="inline-flex items-center gap-1.5">
                      {f.tipoNombre}
                      {f.sinArchivo && (
                        <span title="Sin archivo adjunto" className="inline-flex">
                          <FileX className="size-3.5 shrink-0 text-muted-foreground/70" strokeWidth={1.75} aria-label="Sin archivo adjunto" />
                        </span>
                      )}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <p className="tabular-nums">{fmtFecha(f.fecha)}</p>
                    <p className="text-xs text-muted-foreground">{relativo(f.dias)}</p>
                  </td>
                  <td className="px-4 py-3">
                    <EstadoPill estado={f.estado} />
                  </td>
                  <td className="px-4 py-3 text-right">
                    {f.href && <ChevronRight className="ml-auto size-4 text-muted-foreground/50" strokeWidth={1.75} />}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
