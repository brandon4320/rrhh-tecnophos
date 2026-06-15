import { createClient } from '@/lib/supabase/server'
import { AreasClient } from './AreasClient'

export default async function AreasPage() {
  const supabase = await createClient()
  const { data } = await supabase
    .from('limpieza_areas')
    .select('*')
    .order('nombre', { ascending: true })

  return <AreasClient inicial={data ?? []} />
}
