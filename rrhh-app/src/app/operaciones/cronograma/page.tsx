import { createClient } from '@/lib/supabase/server'
import { CronogramaClient } from './CronogramaClient'

export default async function CronogramaPage() {
  const supabase = await createClient()
  const [{ data: areas }, { data: personal }] = await Promise.all([
    supabase.from('limpieza_areas').select('id, nombre').eq('activo', true).order('nombre'),
    supabase.from('limpieza_personal').select('id, nombre, apellido').eq('activo', true).order('apellido'),
  ])
  return <CronogramaClient areas={areas ?? []} personal={personal ?? []} />
}
