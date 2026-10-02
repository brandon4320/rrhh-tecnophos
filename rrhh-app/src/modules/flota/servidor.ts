// ============================================================
// Flota: helpers de servidor (service role). Los usan las rutas públicas del
// QR y el cron, que no tienen sesión de usuario. NUNCA importar desde un
// client component.
// ============================================================
import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'
import { enviarWhatsApp, hayCanalWhatsApp } from '@/lib/whatsapp'

export type Admin = ReturnType<typeof createAdminClient>

/** URL pública de la app, para los links de los mensajes y los QR. */
export function urlApp(): string {
  return (process.env.NEXT_PUBLIC_APP_URL || 'https://gestion-tecnophos.vercel.app').replace(/\/$/, '')
}

/** El token tiene formato fijo: cualquier otra cosa ni se consulta. */
export function tokenConFormato(token: string): boolean {
  return /^[0-9a-f]{24}$/.test(token)
}

export interface VehiculoQR {
  id: string
  patente: string
  descripcion: string | null
  marca: string | null
  modelo: string | null
  empresa_id: string
  km_actual: number | null
  km_actualizado_at: string | null
  checklist_cada_dias: number
  empresa: { nombre: string; slug: string }
}

/**
 * El vehículo de un QR, o null. Un token inválido, de un vehículo dado de baja
 * o con el checklist desactivado responde igual: no hay forma de distinguir
 * "no existe" de "existe pero apagado" desde afuera.
 */
export async function vehiculoPorToken(admin: Admin, token: string): Promise<VehiculoQR | null> {
  if (!tokenConFormato(token)) return null
  const { data, error } = await admin
    .from('vehiculos')
    .select('id, patente, descripcion, marca, modelo, empresa_id, km_actual, km_actualizado_at, checklist_cada_dias, activo, checklist_activo, empresa:empresas(nombre, slug)')
    .eq('checklist_token', token)
    .maybeSingle()
  // Un error de base NO es "token inválido": se propaga para responder 503.
  if (error) throw error
  if (!data || data.activo === false || !data.checklist_activo || !data.empresa_id || !data.empresa) return null
  return {
    id: data.id,
    patente: data.patente,
    descripcion: data.descripcion,
    marca: data.marca,
    modelo: data.modelo,
    empresa_id: data.empresa_id,
    km_actual: data.km_actual,
    km_actualizado_at: data.km_actualizado_at,
    checklist_cada_dias: data.checklist_cada_dias,
    empresa: data.empresa as { nombre: string; slug: string },
  }
}

/**
 * Registra un aviso y lo manda por WhatsApp a los encargados activos de la
 * empresa. `clave` es única: si el aviso ya se registró (el cron corrió dos
 * veces, o se reintentó un envío), no se vuelve a mandar.
 * Nunca lanza: un WhatsApp que no salió no puede tirar abajo un checklist.
 */
export async function avisarEncargados(
  admin: Admin,
  aviso: { empresaId: string; vehiculoId?: string | null; tipo: string; clave: string; mensaje: string }
): Promise<void> {
  try {
    const { data: registrado, error: errIns } = await admin
      .from('flota_avisos')
      .insert({
        empresa_id: aviso.empresaId,
        vehiculo_id: aviso.vehiculoId ?? null,
        tipo: aviso.tipo,
        clave: aviso.clave,
        mensaje: aviso.mensaje,
        estado: 'pendiente',
      })
      .select('id')
      .single()
    // 23505: ya se avisó esto mismo. No es un error.
    if (errIns) {
      if (errIns.code !== '23505') console.error('[flota] no se pudo registrar el aviso', errIns.message)
      return
    }

    const { data: encargados } = await admin
      .from('flota_encargados')
      .select('telefono')
      .eq('empresa_id', aviso.empresaId)
      .eq('activo', true)
    const telefonos = (encargados ?? []).map((e) => e.telefono)

    if (!hayCanalWhatsApp() || telefonos.length === 0) {
      await admin.from('flota_avisos').update({ estado: 'sin_canal', destinatarios: 0 }).eq('id', registrado.id)
      return
    }

    const resultados = await Promise.all(telefonos.map((t) => enviarWhatsApp(t, aviso.mensaje)))
    const fallidos = resultados.filter((r) => !r.ok)
    await admin
      .from('flota_avisos')
      .update({
        estado: fallidos.length === resultados.length ? 'error' : 'enviado',
        destinatarios: resultados.length - fallidos.length,
        error: fallidos.length ? fallidos.map((f) => (f.ok ? '' : f.error)).join(' · ').slice(0, 500) : null,
      })
      .eq('id', registrado.id)
  } catch (e) {
    console.error('[flota] fallo inesperado al avisar', e)
  }
}
