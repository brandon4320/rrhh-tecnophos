import { createClient } from '@/lib/supabase/server'
import { TiemposClient } from './TiemposClient'

export default async function TiemposPage() {
  const supabase = await createClient()
  const [{ data: personal }, { data: areas }] = await Promise.all([
    supabase.from('limpieza_personal').select('id, nombre, apellido').eq('activo', true).order('apellido'),
    supabase.from('limpieza_areas').select('id, nombre').eq('activo', true).order('nombre'),
  ])
  return <TiemposClient personal={personal ?? []} areas={areas ?? []} />
}
