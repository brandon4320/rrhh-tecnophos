// ============================================================
// Validación de variables de entorno. Falla rápido y claro si falta algo,
// en vez de romper en runtime con un error críptico.
// ============================================================

function required(name: string, value: string | undefined): string {
  if (!value || value.trim() === '') {
    throw new Error(`[env] Falta la variable de entorno requerida: ${name}`)
  }
  return value
}

/** Públicas (se inyectan en el cliente). */
export const env = {
  supabaseUrl: required('NEXT_PUBLIC_SUPABASE_URL', process.env.NEXT_PUBLIC_SUPABASE_URL),
  supabaseAnonKey: required('NEXT_PUBLIC_SUPABASE_ANON_KEY', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
}

/** Solo servidor — lazy, así nunca rompe ni se filtra al bundle del cliente. */
export const serverEnv = {
  supabaseServiceRoleKey: () =>
    required('SUPABASE_SERVICE_ROLE_KEY', process.env.SUPABASE_SERVICE_ROLE_KEY),
  // R2 no va acá: el account id y el bucket se resuelven en `lib/r2/client.ts`,
  // que valida la forma del account id. Tener dos fuentes para lo mismo fue parte
  // del problema del 23/10/2026 (ver el comentario de ese archivo), así que esto
  // queda con un solo dueño. No importar el cliente de R2 desde acá: `env` lo usa
  // el proxy, que corre en el edge.
}
