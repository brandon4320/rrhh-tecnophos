// ============================================================
// Acceso a las tablas arcor_*. No están en types/database.ts (criterio
// heredado de comercial_*): cliente casteado + interfaces en tipos.ts.
//   adb()      -> cliente de sesión, la RLS aplica (lecturas de la UI)
//   adbAdmin() -> service role, SOLO para el ingest (route handler)
// ============================================================
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

/* eslint-disable @typescript-eslint/no-explicit-any */
export async function adb(): Promise<any> {
  return createClient()
}

export function adbAdmin(): any {
  return createAdminClient()
}
/* eslint-enable @typescript-eslint/no-explicit-any */

/**
 * Filas de una consulta, o excepción si falló. En un módulo de OBSERVABILIDAD
 * un error de lectura no puede parecer "todo en cero, todo tranquilo": el
 * error.tsx de /arcor lo muestra como tal (AGENTS.md §10).
 */
export function rows<T>(res: { data: unknown; error: { message: string } | null }): T[] {
  if (res.error) throw new Error(`No se pudo leer el módulo ARCOR: ${res.error.message}`)
  return (res.data as T[] | null) ?? []
}
