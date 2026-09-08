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

export function rows<T>(x: unknown): T[] {
  return (x as T[] | null) ?? []
}
