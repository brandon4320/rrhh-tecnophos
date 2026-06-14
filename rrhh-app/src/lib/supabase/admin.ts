import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import { env, serverEnv } from '@/lib/env'

/**
 * Cliente con service_role: BYPASEA RLS. Usar SOLO en el servidor
 * (route handlers / server actions) y nunca exponerlo al cliente.
 */
export function createAdminClient() {
  return createClient<Database>(env.supabaseUrl, serverEnv.supabaseServiceRoleKey(), {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}
