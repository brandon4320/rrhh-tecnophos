import { createClient } from '@/lib/supabase/server'
import { FeedbackClient } from './FeedbackClient'

export default async function FeedbackPage() {
  const supabase = await createClient()
  const [{ data: feedback }, { data: areas }] = await Promise.all([
    supabase.from('limpieza_feedback').select('*').order('created_at', { ascending: false }),
    supabase.from('limpieza_areas').select('id, nombre').eq('activo', true).order('nombre'),
  ])
  return <FeedbackClient inicial={feedback ?? []} areas={areas ?? []} />
}
