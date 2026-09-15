// ============================================================
// Sesión del lado del servidor. Punto único para obtener el usuario
// actual + su perfil/rol, y para exigir auth/rol/módulo en páginas y actions.
// ============================================================
import { cache } from 'react'
import { redirect } from 'next/navigation'
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { type Rol, tieneRol } from './roles'
import { puedeAccederModulo, type ModuloKey } from '@/config/modules'

export interface Sesion {
  userId: string
  email: string | null
  nombre: string | null
  rol: Rol
  empresaAcceso: string | null
}

/** Sesión actual (o null). Cacheada por request para no repetir queries. */
export const getSesion = cache(async (): Promise<Sesion | null> => {
  const supabase = await createClient()
  // getClaims() verifica la FIRMA del JWT. Con signing keys asimétricas
  // (dashboard de Supabase → JWT Keys) la verificación es local (JWKS cacheado,
  // sin round-trip a Auth); con HS256 cae a validar contra el servidor, igual
  // que getUser(). Nunca confía en la cookie sin verificar.
  const { data } = await supabase.auth.getClaims()
  const claims = data?.claims
  if (!claims) return null

  const { data: perfil } = await supabase
    .from('perfiles')
    .select('nombre, rol, empresa_acceso')
    .eq('id', claims.sub)
    .single()

  // Sin perfil no hay rol confiable: tratarlo como no autenticado (antes caía
  // en rol 'usuario' por defecto, que es un rol RRHH con escritura).
  if (!perfil) return null

  return {
    userId: claims.sub,
    email: (claims.email as string | undefined) ?? null,
    nombre: perfil.nombre ?? null,
    rol: perfil.rol as Rol,
    empresaAcceso: perfil.empresa_acceso ?? null,
  }
})

/** Exige sesión; si no hay, redirige a /login. */
export async function requireSesion(): Promise<Sesion> {
  const s = await getSesion()
  if (!s) redirect('/login')
  return s
}

/** Exige uno de los roles dados; si no, manda al inicio. */
export async function requireRol(permitidos: readonly Rol[]): Promise<Sesion> {
  const s = await requireSesion()
  if (!tieneRol(s.rol, permitidos)) redirect('/')
  return s
}

/** Exige acceso a un módulo; si no, manda al inicio. */
export async function requireModulo(modulo: ModuloKey): Promise<Sesion> {
  const s = await requireSesion()
  if (!puedeAccederModulo(s.rol, modulo)) redirect('/')
  return s
}

/**
 * Variante para route handlers (JSON): en vez de redirigir devuelve la
 * respuesta de error lista para retornar. Uso:
 *   const s = await sesionApi(LEGAJO_ESCRITURA, 'No tenés permisos…')
 *   if ('error' in s) return s.error
 *   const { supabase, sesion } = s
 * El `supabase` es el cliente de sesión: la RLS sigue decidiendo.
 */
export async function sesionApi(
  permitidos: readonly Rol[],
  mensajeSinPermiso = 'No tenés permisos para esta acción.'
): Promise<{ error: NextResponse } | { supabase: Awaited<ReturnType<typeof createClient>>; sesion: Sesion }> {
  const sesion = await getSesion()
  if (!sesion) return { error: NextResponse.json({ error: 'No autorizado' }, { status: 401 }) }
  if (!tieneRol(sesion.rol, permitidos)) {
    return { error: NextResponse.json({ error: mensajeSinPermiso }, { status: 403 }) }
  }
  return { supabase: await createClient(), sesion }
}
