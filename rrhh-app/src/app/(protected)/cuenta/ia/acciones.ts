'use server'

// Crear y revocar las claves de IA propias (tabla `claves_ia`, migración 29). La RLS deja tocar solo
// las de uno; la clave se devuelve UNA vez y en la base queda su SHA-256.
import { revalidatePath } from 'next/cache'
import { requireSesion } from '@/lib/auth/session'
import { tieneRol } from '@/lib/auth/roles'
import { createClient } from '@/lib/supabase/server'
import { hashClave, nuevaClave } from '@/lib/mcp/servidor'
import { PREFIJO_CLAVE } from '@/lib/mcp/gestion'

const MAX_CLAVES = 10

export async function crearClaveIa(nombre: string): Promise<{ clave?: string; error?: string }> {
  const sesion = await requireSesion()
  if (!tieneRol(sesion.rol, ['admin', 'usuario'])) return { error: 'Tu usuario no puede conectar una IA a Gestión de Recursos.' }
  const limpio = nombre.trim().slice(0, 60)
  if (!limpio) return { error: 'Ponele un nombre (por ejemplo, "Grok").' }
  const supabase = await createClient()
  const { count } = await supabase.from('claves_ia').select('id', { count: 'exact', head: true }).is('revocada_at', null)
  if ((count ?? 0) >= MAX_CLAVES) return { error: `Ya tenés ${MAX_CLAVES} claves. Revocá una que no uses.` }
  const clave = nuevaClave(PREFIJO_CLAVE)
  const { error } = await supabase.from('claves_ia').insert({ user_id: sesion.userId, nombre: limpio, prefijo: `${clave.slice(0, 8)}…`, hash: await hashClave(clave) })
  if (error) return { error: 'No se pudo crear la clave. Probá de nuevo.' }
  revalidatePath('/cuenta/ia')
  return { clave }
}

export async function revocarClaveIa(id: string): Promise<{ error?: string }> {
  await requireSesion()
  const supabase = await createClient()
  const { error } = await supabase.from('claves_ia').update({ revocada_at: new Date().toISOString() }).eq('id', id).is('revocada_at', null)
  if (error) return { error: 'No se pudo revocar la clave.' }
  revalidatePath('/cuenta/ia')
  return {}
}
