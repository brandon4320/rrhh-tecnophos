import { createClient } from '@/lib/supabase/server'
import { PersonalClient } from './PersonalClient'

export default async function PersonalPage() {
  const supabase = await createClient()
  const { data } = await supabase
    .from('limpieza_personal')
    .select('*')
    .order('apellido', { ascending: true })

  return <PersonalClient inicial={data ?? []} />
}
