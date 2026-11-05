// ============================================================
// Tokens de las integraciones máquina a máquina (sin sesión de navegador).
//
// De cada token se guarda SOLO su sha256 en `integraciones` (migración 27).
// La tabla tiene RLS prendida y ninguna política: la lee únicamente la service
// role, desde las rutas que están en PUBLIC_PATHS del proxy y validan su
// propio token.
//
// Para rotar uno: generar otro token, actualizar token_hash en esa fila y
// cargar el nuevo del otro lado. El hash NO se commitea: este repo es público.
// ============================================================
import 'server-only'
import { createHash, timingSafeEqual } from 'node:crypto'
import type { createAdminClient } from '@/lib/supabase/admin'

type Admin = ReturnType<typeof createAdminClient>

/** Largo mínimo creíble para un token: descarta basura sin tocar la base. */
const LARGO_MINIMO = 32

/**
 * ¿El Authorization trae el token de esta integración?
 *
 * Que la base falle o que falte el hash NO es "token inválido": lanza, para
 * que la ruta responda 503 y nadie salga a rotar un token que está bien.
 */
export async function tokenDeIntegracionValido(
  admin: Admin,
  req: Request,
  clave: string
): Promise<boolean> {
  const auth = req.headers.get('authorization') ?? ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : ''
  if (token.length < LARGO_MINIMO) return false

  const { data, error } = await admin
    .from('integraciones').select('token_hash').eq('clave', clave).maybeSingle()
  if (error) throw new Error(`integraciones: ${error.message}`)
  if (!data?.token_hash) throw new Error(`integraciones sin el hash de "${clave}"`)

  // Comparación en tiempo constante: con `===` el tiempo de respuesta filtra
  // cuántos caracteres acertó quien prueba.
  const a = Buffer.from(createHash('sha256').update(token).digest('hex'), 'utf8')
  const b = Buffer.from(data.token_hash, 'utf8')
  return a.length === b.length && timingSafeEqual(a, b)
}
