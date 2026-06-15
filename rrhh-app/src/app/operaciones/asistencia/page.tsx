import { createClient } from '@/lib/supabase/server'
import { AsistenciaClient } from './AsistenciaClient'

export default async function AsistenciaPage() {
  const supabase = await createClient()
  const { data: personal } = await supabase
    .from('limpieza_personal')
    .select('id, nombre, apellido, funcion')
    .eq('activo', true)
    .order('apellido', { ascending: true })

  return <AsistenciaClient personal={personal ?? []} />
}
