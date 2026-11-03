// ============================================================
// Lado servidor del link de firma. Todo esto corre con SERVICE ROLE después de
// validar el token, igual que `/api/v/<token>` de la flota: la página es
// pública y las tablas no tienen policies para anon.
//
// Nunca se guarda el token en claro: en la base va solo su sha256. El token
// vive en el mail del empleado y en ningún otro lado.
// ============================================================
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'
import type { createAdminClient } from '@/lib/supabase/admin'
import { estadoToken, evaluarIntento, vencimientoDesde, type EstadoToken, type ResultadoIntento } from './reglas'

// Mismo criterio que modules/flota/servidor.ts: el tipo sale del cliente real,
// así los nombres de columna se chequean contra el schema generado.
export type Admin = ReturnType<typeof createAdminClient>

/** 32 bytes al azar: no se puede adivinar ni enumerar. */
export function generarToken(): string {
  return randomBytes(32).toString('base64url')
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

export interface TokenConEmpleado {
  id: string
  empleado_id: string
  vence_at: string
  revocado: boolean
  bloqueado_hasta: string | null
  intentos: number
  empleado: { id: string; nombre: string; apellido: string | null; cuil: string | null; email: string | null }
}

/**
 * Busca el token por su hash. Devuelve null si no existe: hacia afuera eso se
 * ve igual que vencido o revocado (MENSAJE_LINK_INVALIDO), para que no se pueda
 * averiguar qué tokens existen.
 */
export async function buscarToken(admin: Admin, token: string): Promise<TokenConEmpleado | null> {
  if (!token || token.length < 20 || token.length > 100) return null
  const { data, error } = await admin
    .from('recibo_tokens')
    .select('id, empleado_id, vence_at, revocado, bloqueado_hasta, intentos, empleado:empleados(id, nombre, apellido, cuil, email)')
    .eq('token_hash', hashToken(token))
    .maybeSingle()
  if (error) throw new Error(`no se pudo leer el token: ${error.message}`)
  if (!data) return null
  const emp = Array.isArray(data.empleado) ? data.empleado[0] : data.empleado
  if (!emp) return null
  return { ...data, empleado: emp } as TokenConEmpleado
}

export function estadoDe(fila: TokenConEmpleado, ahora: Date = new Date()): EstadoToken {
  return estadoToken(fila, ahora)
}

/**
 * Compara los 4 dígitos en tiempo constante. Con 10.000 combinaciones y un
 * tope de intentos el riesgo es bajo igual, pero comparar con `===` filtra
 * información por el tiempo de respuesta y no cuesta nada evitarlo.
 */
export function comparaSegura(a: string, b: string): boolean {
  const ba = Buffer.from(a)
  const bb = Buffer.from(b)
  if (ba.length !== bb.length) return false
  return timingSafeEqual(ba, bb)
}

/** Guarda el resultado del intento (contador y bloqueo). */
export async function registrarIntento(admin: Admin, tokenId: string, r: ResultadoIntento): Promise<void> {
  const { error } = await admin
    .from('recibo_tokens')
    .update({
      intentos: r.intentos,
      bloqueado_hasta: r.bloqueadoHasta ? r.bloqueadoHasta.toISOString() : null,
      ...(r.ok ? { ultimo_uso_at: new Date().toISOString() } : {}),
    })
    .eq('id', tokenId)
  // Si no se puede anotar el intento, NO se sigue: sin contador no hay bloqueo
  // y el freno a la fuerza bruta deja de existir.
  if (error) throw new Error(`no se pudo registrar el intento: ${error.message}`)
}

export { evaluarIntento, vencimientoDesde }

export interface ReciboPendiente {
  id: string
  tipo: string
  periodo: string
  nombre_archivo: string
  path: string
}

/** Los recibos que este empleado todavía no firmó, del más nuevo al más viejo. */
export async function recibosPendientes(admin: Admin, empleadoId: string): Promise<ReciboPendiente[]> {
  const { data, error } = await admin
    .from('recibos_sueldo')
    .select('id, tipo, periodo, nombre_archivo, path')
    .eq('empleado_id', empleadoId)
    .eq('estado', 'pendiente')
    .order('periodo', { ascending: false })
  if (error) throw new Error(`no se pudieron leer los recibos: ${error.message}`)
  return (data ?? []) as ReciboPendiente[]
}

/**
 * Crea un link nuevo para un empleado y devuelve el token EN CLARO, que es lo
 * único que va al mail. Después de esto el token en claro no existe más del
 * lado del sistema.
 */
export async function crearToken(admin: Admin, empleadoId: string): Promise<{ token: string; id: string }> {
  const token = generarToken()
  const { data, error } = await admin
    .from('recibo_tokens')
    .insert({
      empleado_id: empleadoId,
      token_hash: hashToken(token),
      vence_at: vencimientoDesde().toISOString(),
    })
    .select('id')
    .single()
  if (error || !data) throw new Error(`no se pudo crear el link: ${error?.message ?? 'sin datos'}`)
  return { token, id: data.id }
}
