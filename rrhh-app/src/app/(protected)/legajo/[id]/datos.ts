// Lo que lee un legajo. Lo usan /legajo/[id] (página) y Empleados (?legajo=, en la hoja lateral):
// UNA sola definición de las consultas para las dos vistas (overhaul 18/11/2026).
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import { getSesion } from '@/lib/auth/session'

export async function cargarLegajo(supabase: SupabaseClient<Database>, id: string) {
  // Todo en UN solo batch: ninguna query depende del fetch del empleado
  // (certificados filtra por empleado_id directo). notFound() se decide después.
  const [{ data: empleado }, { data: certificados }, { data: tiposCert }, { data: empresas }, sesion, { data: recibos }, { data: epp }] = await Promise.all([
    supabase
      .from('empleados')
      .select('*, empresa:empresas(*)')
      .eq('id', id)
      .single(),
    supabase
      .from('certificados')
      .select('*, tipo:tipos_certificado(nombre, orden), archivos(*)')
      .eq('empleado_id', id)
      .order('fecha_vencimiento', { ascending: true }),
    supabase
      .from('tipos_certificado')
      .select('*')
      .eq('aplica_personal', true)
      .order('orden'),
    supabase
      .from('empresas')
      .select('*')
      .order('nombre'),
    getSesion(), // cacheada por request: el layout ya la resolvió
    supabase
      .from('recibos_sueldo')
      .select('*')
      .eq('empleado_id', id)
      .order('periodo', { ascending: false }),
    // EPP y ropa entregados desde Stock (migración 24: stock_movimientos.empleado_id).
    // Con el nombre de la FK: hay dos hacia stock_items (item_id sola y item_id+empresa_id) y sin
    // decir cuál PostgREST corta con error (la sección quedaba vacía sin avisar).
    supabase
      .from('stock_movimientos')
      .select('id, fecha, tipo, cantidad, item:stock_items!stock_movimientos_item_id_fkey(nombre, unidad)')
      .eq('empleado_id', id)
      .in('tipo', ['consumo', 'devolucion'])
      .order('fecha', { ascending: false })
      .limit(200),
  ])

  return { empleado, certificados, tiposCert, empresas, sesion, recibos, epp }
}
