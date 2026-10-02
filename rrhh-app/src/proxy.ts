// ============================================================
// Middleware de Next 16 (archivo `proxy.ts`, export `proxy`).
// - Refresca la sesión de Supabase en cada request (patrón @supabase/ssr).
// - Protege rutas en el borde: sin sesión -> /login.
// NOTA: en proxy NO se puede usar redirect() de next/navigation; se usa NextResponse.
// ============================================================
import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { env } from '@/lib/env'
import { SUPABASE_JWKS } from '@/lib/supabase/jwks'

// /control-plagas.html es la app de registro para operarios (estática, datos
// en el dispositivo): los iPads la abren sin sesión del portal.
// /api/arcor/ingest lo llama el servidor de ARCOR (máquina a máquina): no hay
// sesión de navegador, la ruta valida su propio token (ver el route handler).
// /v/<token> y /api/v/<token>: el checklist de flota que se abre con el QR
// pegado en cada camioneta. Lo completa quien maneja, sin cuenta en el sistema;
// la autorización es el token del vehículo (ver modules/flota/servidor.ts).
// /api/cron/*: los llama Vercel; cada ruta valida CRON_SECRET.
const PUBLIC_PATHS = ['/login', '/control-plagas.html', '/api/arcor/ingest', '/v', '/api/v', '/api/cron']

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request })

  const supabase = createServerClient(env.supabaseUrl, env.supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
        response = NextResponse.next({ request })
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options)
        )
      },
    },
  })

  // IMPORTANTE: getClaims() verifica la firma del token — no confía en la cookie
  // sola. Con la clave pública fija (lib/supabase/jwks.ts) la verificación es
  // local, sin bajar el JWKS: cero round-trips a Supabase Auth por navegación.
  const { data } = await supabase.auth.getClaims(undefined, { jwks: SUPABASE_JWKS })
  const user = data?.claims ?? null

  const { pathname } = request.nextUrl
  const isPublic = PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + '/'))

  if (!user && !isPublic) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    // Volver adonde iba después de entrar (links de avisos, marcadores).
    url.search = pathname !== '/' ? `?next=${encodeURIComponent(pathname + request.nextUrl.search)}` : ''
    return NextResponse.redirect(url)
  }

  if (user && pathname === '/login') {
    const url = request.nextUrl.clone()
    url.pathname = '/'
    return NextResponse.redirect(url)
  }

  return response
}

export const config = {
  // Corre en todo menos assets estáticos, imágenes y las rutas públicas de
  // máquinas y choferes (QR de flota, cron, ingest de ARCOR, control de plagas):
  // no tienen sesión de navegador y validan su propio token. /login queda adentro.
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|v/|api/v/|api/cron/|api/arcor/ingest|control-plagas\\.html|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
}
