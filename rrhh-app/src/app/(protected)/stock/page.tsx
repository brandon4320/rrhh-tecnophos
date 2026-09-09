import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getSesion } from '@/lib/auth/session'
import { tieneRol, LEGAJO_ESCRITURA } from '@/lib/auth/roles'
import StockClient from './StockClient'

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

  const [{ data: items }, { data: movimientos }] = await Promise.all([
    supabase.from('stock_items').select('*').eq('empresa_id', empresaSel.id).order('nombre'),
    supabase
      .from('stock_movimientos')
      .select('*')
      .eq('empresa_id', empresaSel.id)
      .order('fecha', { ascending: false })
      .order('created_at', { ascending: false }),
  ])

  return (
    <StockClient
      empresa={empresaSel}
      items={items ?? []}
      movimientos={movimientos ?? []}
      canEdit={tieneRol(sesion?.rol ?? null, LEGAJO_ESCRITURA)}
    />
  )
}
