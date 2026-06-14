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
  r2: () => ({
    accountId: required('CLOUDFLARE_ACCOUNT_ID', process.env.CLOUDFLARE_ACCOUNT_ID),
    accessKeyId: required('R2_ACCESS_KEY_ID', process.env.R2_ACCESS_KEY_ID),
    secretAccessKey: required('R2_SECRET_ACCESS_KEY', process.env.R2_SECRET_ACCESS_KEY),
    bucket: process.env.R2_BUCKET_NAME ?? 'brandon4320',
  }),
}
