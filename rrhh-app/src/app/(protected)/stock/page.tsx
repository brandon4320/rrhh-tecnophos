import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getSesion } from '@/lib/auth/session'
import { tieneRol, LEGAJO_ESCRITURA } from '@/lib/auth/roles'
import StockClient from './StockClient'
import type { StockMovimiento } from '@/types'

export const dynamic = 'force-dynamic'

/**
 * Stock por empresa (?empresa=slug, igual que /empleados). Sin slug o con uno
 * inválido, se ofrece elegir. La RLS de stock_* ya limita a las empresas que
 * el usuario ve, así que la lista de empresas es la misma que la del sidebar.
 */
export default async function StockPage({
  searchParams,
}: {
  searchParams: Promise<{ empresa?: string }>
}) {
  const { empresa } = await searchParams
  const supabase = await createClient()
  const [{ data: empresas }, sesion] = await Promise.all([
    supabase.from('empresas').select('id, nombre, slug').order('nombre'),
    getSesion(),
  ])
  const lista = empresas ?? []
  const empresaSel = (empresa ? lista.find((e) => e.slug === empresa) : undefined) ?? (lista.length === 1 ? lista[0] : undefined)

  if (!empresaSel) {
    return (
      <div className="mx-auto max-w-6xl p-4 sm:p-6 lg:p-8">
        <h1 className="text-2xl font-semibold tracking-tight">Stock</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">Elegí la empresa cuyo inventario querés ver.</p>
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {lista.map((e) => (
            <Link
              key={e.id}
              href={`/stock?empresa=${e.slug}`}
              className="rounded-2xl border border-border bg-card px-5 py-4 text-sm font-medium transition-colors hover:bg-muted"
            >
              {e.nombre}
            </Link>
          ))}
        </div>
      </div>
    )
  }

  // El libro de movimientos se trae entero (el stock es su suma). PostgREST corta
  // en 1000 filas por request: se pagina para que un ítem viejo no "pierda" su
  // stock inicial cuando el libro crezca. Cuando esto pese, el camino es una vista
  // `stock_actual` en la DB + historial por ítem bajo demanda (AGENTS.md §11).
  const PAGINA = 1000
  async function todosLosMovimientos() {
    const out: StockMovimiento[] = []
    for (let desde = 0; ; desde += PAGINA) {
      const { data, error } = await supabase
        .from('stock_movimientos')
        .select('*')
        .eq('empresa_id', empresaSel!.id)
        .order('fecha', { ascending: false })
        .order('created_at', { ascending: false })
        .range(desde, desde + PAGINA - 1)
      if (error) return { data: null, error }
      out.push(...(data ?? []))
      if (!data || data.length < PAGINA) return { data: out, error: null }
    }
  }

  const [itemsRes, movsRes] = await Promise.all([
    supabase.from('stock_items').select('*').eq('empresa_id', empresaSel.id).order('nombre'),
    todosLosMovimientos(),
  ])

  // Nunca tragarse un error de Supabase (AGENTS.md §10): un inventario "vacío" por
  // un error de lectura no puede parecer un inventario vacío de verdad.
  const errorCarga = itemsRes.error ?? movsRes.error
  if (errorCarga) {
    return (
      <div className="mx-auto max-w-6xl p-4 sm:p-6 lg:p-8">
        <h1 className="text-2xl font-semibold tracking-tight">Stock</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">{empresaSel.nombre}</p>
        <div className="mt-6 rounded-2xl border border-danger/30 bg-danger-subtle px-5 py-4 text-sm text-danger">
          No se pudo cargar el stock. Detalle técnico: {errorCarga.message}
        </div>
      </div>
    )
  }

  return (
    <StockClient
      // Remonta al cambiar de empresa por ?empresa= (el estado local no se mezcla entre empresas).
      key={empresaSel.id}
      empresa={empresaSel}
      items={itemsRes.data ?? []}
      movimientos={movsRes.data ?? []}
      canEdit={tieneRol(sesion?.rol ?? null, LEGAJO_ESCRITURA)}
    />
  )
}
