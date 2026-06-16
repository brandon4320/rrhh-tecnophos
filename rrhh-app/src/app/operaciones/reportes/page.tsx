import { createClient } from '@/lib/supabase/server'
import { ReporteClient } from './ReporteClient'

export default async function ReportesPage() {
  const supabase = await createClient()
  const { data: areas } = await supabase
    .from('limpieza_areas')
    .select('id, nombre, tipo')
    .eq('activo', true)
    .order('nombre')
  return <ReporteClient areas={areas ?? []} />
}
