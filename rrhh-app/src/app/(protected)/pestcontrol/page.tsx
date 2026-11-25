import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { requireSesion } from '@/lib/auth/session'
import { mensajeError } from '@/lib/errores'
import { traerTodo } from '@/lib/paginar'
import { pdb } from '@/modules/pestcontrol/db'
import { armarLibro, llevaPestcontrol, type PestInsumo, type PestLinea, type PestMovimiento } from '@/modules/pestcontrol/reglas'
import PestcontrolClient from './PestcontrolClient'

export const dynamic = 'force-dynamic'

type FilaMovimiento = Omit<PestMovimiento, 'lineas' | 'adjuntos'> & {
  lineas: { insumo_id: string; entrada: number | string; salida: number | string }[] | null
  adj: { id: string }[] | null
}

/**
 * Recursos → Pestcontrol (?empresa=slug): stock de insumos de fumigación de barcos.
 * Solo quien tiene `ve_pestcontrol` y solo en las empresas que lo llevan
 * (EMPRESAS_PESTCONTROL); la RLS de la migración 37 exige lo mismo.
 */
export default async function PestcontrolPage({ searchParams }: { searchParams: Promise<{ empresa?: string }> }) {
  const { empresa } = await searchParams
  const sesion = await requireSesion()
  if (!sesion.vePestcontrol) redirect('/')
  if (!llevaPestcontrol(empresa)) notFound()

  const supabase = await createClient()
  const { data: emp } = await supabase.from('empresas').select('id, nombre, slug').eq('slug', empresa!).maybeSingle()
  if (!emp) notFound()

  const db = pdb(supabase)
  const [insumosRes, movsRes] = await Promise.all([
    db.from('pest_insumos').select('id, codigo, nombre, unidad, por_caja, orden').eq('empresa_id', emp.id).eq('activo', true).order('orden'),
    traerTodo<FilaMovimiento>((desde, hasta) =>
      db
        .from('pest_movimientos')
        .select('id, fecha, barco, detalle, comprobante, lugar, notas, orden, lineas:pest_lineas(insumo_id, entrada, salida), adj:pest_adjuntos(id)')
        .eq('empresa_id', emp.id)
        .order('fecha')
        .order('orden')
        .range(desde, hasta)
    ),
  ])

  // Nunca tragarse un error de Supabase (AGENTS.md §10): un libro vacío por un error
  // de lectura no puede parecer un stock en cero.
  const error = insumosRes.error ?? movsRes.error
  if (error) {
    return (
      <div className="mx-auto max-w-6xl px-4 pt-2 pb-8 md:px-7 md:pt-6 md:pb-10">
        <h1 className="text-[28px] leading-tight font-semibold tracking-[-0.02em]">Pestcontrol</h1>
        <div className="mt-6 rounded-2xl border border-danger/30 bg-danger-subtle px-5 py-4 text-sm text-danger-text">
          {mensajeError(error, 'cargar el stock de Pestcontrol')}
        </div>
      </div>
    )
  }

  const insumos: PestInsumo[] = ((insumosRes.data ?? []) as PestInsumo[]).map((i) => ({
    ...i,
    por_caja: i.por_caja == null ? null : Number(i.por_caja),
  }))
  const libro = armarLibro(
    insumos,
    (movsRes.data ?? []).map(({ adj, lineas, ...m }) => ({
      ...m,
      adjuntos: adj?.length ?? 0,
      lineas: (lineas ?? []).map((l): PestLinea => ({ insumo_id: l.insumo_id, entrada: Number(l.entrada), salida: Number(l.salida) })),
    }))
  )

  return <PestcontrolClient key={emp.id} empresa={emp} insumos={insumos} libro={libro} />
}
