import { createClient } from '@/lib/supabase/server'
import { AsignacionesClient } from './AsignacionesClient'

export default async function AsignacionesPage() {
  const supabase = await createClient()
  const [{ data: areas }, { data: personal }] = await Promise.all([
    supabase.from('limpieza_areas').select('id, nombre, tipo, prioridad').eq('activo', true).order('nombre'),
    supabase.from('limpieza_personal').select('id, nombre, apellido, funcion').eq('activo', true).order('apellido'),
  ])
  return <AsignacionesClient areas={areas ?? []} personal={personal ?? []} />
}
