import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getSesion } from '@/lib/auth/session'
import { tieneRol, LEGAJO_ESCRITURA } from '@/lib/auth/roles'
import DatosFlotaClient from './DatosFlotaClient'

export const dynamic = 'force-dynamic'

/** Marca, modelo y año de toda la flota en una sola pantalla (de una empresa o de todas). */
export default async function DatosFlotaPage({ searchParams }: { searchParams: Promise<{ empresa?: string }> }) {
  const { empresa } = await searchParams
  const volver = empresa ? `/flota?empresa=${empresa}` : '/flota'
  const sesion = await getSesion()
  if (!tieneRol(sesion?.rol ?? null, LEGAJO_ESCRITURA)) redirect(volver)

  const supabase = await createClient()
  let empresaId: string | undefined
  if (empresa) {
    const { data: emp } = await supabase.from('empresas').select('id').eq('slug', empresa).maybeSingle()
    if (!emp) redirect('/flota')
    empresaId = emp.id
  }

  let q = supabase
    .from('vehiculos')
    .select('id, patente, descripcion, marca, modelo, anio, empresa:empresas(nombre)')
    .eq('activo', true)
    .order('patente')
  if (empresaId) q = q.eq('empresa_id', empresaId)
  const { data, error } = await q
  if (error) throw error

  const vehiculos = (data ?? [])
    .map((v) => ({
      id: v.id,
      patente: v.patente,
      descripcion: v.descripcion,
      marca: v.marca,
      modelo: v.modelo,
      anio: v.anio,
      empresa: (v.empresa as { nombre: string } | null)?.nombre ?? '',
    }))
    .sort((a, b) => a.empresa.localeCompare(b.empresa) || a.patente.localeCompare(b.patente))

  return <DatosFlotaClient vehiculos={vehiculos} volver={volver} variasEmpresas={!empresaId} />
}
