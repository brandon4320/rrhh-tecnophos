import { createClient } from '@/lib/supabase/server'
import { StockClient } from './StockClient'

export default async function StockPage() {
  const supabase = await createClient()
  const { data } = await supabase
    .from('limpieza_consumibles')
    .select('*')
    .eq('activo', true)
    .order('nombre')
  return <StockClient inicial={data ?? []} />
}
