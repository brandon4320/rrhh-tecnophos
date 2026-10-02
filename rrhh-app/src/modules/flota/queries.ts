// ============================================================
// Flota: lectura del estado de los vehículos. Recibe el cliente para servir a
// las dos puntas: la pantalla (cliente de sesión, la RLS filtra por empresa)
// y el cron (service role, todas las empresas).
// ============================================================
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import type { DatosVehiculo } from './resumen'

type Db = SupabaseClient<Database>

export interface VehiculoFlota extends DatosVehiculo {
  empresa_id: string
  descripcion: string | null
  marca: string | null
  modelo: string | null
  anio: number | null
  km_actualizado_at: string | null
  conductor_id: string | null
}

export async function cargarFlota(db: Db, filtro: { empresaId?: string } = {}): Promise<VehiculoFlota[]> {
  let q = db
    .from('vehiculos')
    .select('id, patente, descripcion, marca, modelo, anio, empresa_id, km_actual, km_actualizado_at, checklist_cada_dias, checklist_activo, conductor_id')
    .eq('activo', true)
    .order('patente')
  if (filtro.empresaId) q = q.eq('empresa_id', filtro.empresaId)
  const { data: vehiculos, error } = await q
  if (error) throw error
  const lista = (vehiculos ?? []).filter((v) => v.empresa_id)
  if (lista.length === 0) return []
  const ids = lista.map((v) => v.id)

  const [chk, plan, serv, nov, cert] = await Promise.all([
    // Livianos y los más recientes primero: alcanza para el último de cada
    // vehículo y para los km de los últimos 120 días (más de 2 años de
    // historia a este ritmo antes de tocar el tope de 1000 filas).
    db.from('vehiculo_checklists')
      .select('vehiculo_id, created_at, km, km_inconsistente, resultado')
      .in('vehiculo_id', ids)
      .order('created_at', { ascending: false })
      .limit(1000),
    db.from('vehiculo_mantenimiento_plan').select('vehiculo_id, tipo, cada_km, cada_meses').in('vehiculo_id', ids),
    db.from('vehiculo_services').select('vehiculo_id, tipo, fecha, km').in('vehiculo_id', ids),
    db.from('vehiculo_novedades').select('vehiculo_id, gravedad, titulo, created_at').in('vehiculo_id', ids).eq('estado', 'abierta'),
    db.from('certificados')
      .select('vehiculo_id, fecha_vencimiento, alerta_dias, tipo_nombre_custom, tipo:tipos_certificado(nombre)')
      .in('vehiculo_id', ids)
      .not('fecha_vencimiento', 'is', null),
  ])
  // Una lectura que falla no puede parecer "todo en orden".
  for (const r of [chk, plan, serv, nov, cert]) if (r.error) throw r.error

  const de = <T extends { vehiculo_id: string | null }>(filas: T[] | null, id: string) =>
    (filas ?? []).filter((f) => f.vehiculo_id === id)

  return lista.map((v) => ({
    id: v.id,
    patente: v.patente,
    descripcion: v.descripcion,
    marca: v.marca,
    modelo: v.modelo,
    anio: v.anio,
    empresa_id: v.empresa_id as string,
    km_actual: v.km_actual,
    km_actualizado_at: v.km_actualizado_at,
    conductor_id: v.conductor_id,
    checklist_cada_dias: v.checklist_cada_dias,
    checklist_activo: v.checklist_activo,
    checklists: de(chk.data, v.id),
    plan: de(plan.data, v.id),
    services: de(serv.data, v.id),
    novedades: de(nov.data, v.id),
    certificados: de(cert.data, v.id).map((c) => ({
      nombre: c.tipo?.nombre ?? c.tipo_nombre_custom ?? 'Documento',
      fecha_vencimiento: c.fecha_vencimiento as string,
      alerta_dias: c.alerta_dias,
    })),
  }))
}
