// POST /api/mcp — el MCP de Gestión de Recursos (src/lib/mcp). Lo usa una IA (Grok, Claude…) con la
// clave de IA de una persona en `Authorization: Bearer ges_…` (menú de usuario → Conectar una IA).
// La clave dice quién es; solo lectura y solo las empresas que esa persona ve (src/lib/mcp/gestion.ts).
// Va en PUBLIC_PATHS de src/proxy.ts: no usa la sesión del navegador, solo la clave.
import { after, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { atenderMcp, claveDelPedido, hashClave } from '@/lib/mcp/servidor'
import { HERRAMIENTAS, INSTRUCCIONES, PREFIJO_CLAVE, type CtxGestion } from '@/lib/mcp/gestion'

export const dynamic = 'force-dynamic'

/** Cada cuánto se anota el "último uso" de una clave (no en cada pedido). */
const ANOTAR_USO_MS = 5 * 60_000

const noAutorizado = (mensaje: string, status: 401 | 403 = 401) =>
  NextResponse.json({ error: mensaje }, { status, headers: status === 401 ? { 'www-authenticate': 'Bearer realm="gestion"' } : undefined })

async function atender(req: Request): Promise<Response> {
  const clave = claveDelPedido(req, PREFIJO_CLAVE)
  if (!clave) return noAutorizado('Falta la clave de IA (Authorization: Bearer ges_…). Se crea en el menú de usuario → Conectar una IA.')
  const db = createAdminClient()
  const { data: registro, error } = await db.from('claves_ia').select('id, user_id, ultimo_uso_at').eq('hash', await hashClave(clave)).is('revocada_at', null).maybeSingle()
  if (error) return NextResponse.json({ error: 'No se pudo verificar la clave. Probá de nuevo en un rato.' }, { status: 503 })
  if (!registro) return noAutorizado('La clave no existe o fue revocada.')

  const [{ data: perfil }, { data: todas }] = await Promise.all([
    db.from('perfiles').select('nombre, rol, empresa_acceso').eq('id', registro.user_id).maybeSingle(),
    db.from('empresas').select('id, nombre, slug').order('nombre'),
  ])
  // Como la RLS: solo los roles de RRHH leen Gestión de Recursos.
  const rol = perfil?.rol ?? ''
  if (!perfil || !['admin', 'usuario'].includes(rol)) return noAutorizado('Ese usuario no tiene acceso a Gestión de Recursos.', 403)
  const empresas = (todas ?? []).filter((e) => perfil.empresa_acceso == null || e.id === perfil.empresa_acceso)
  if (!empresas.length) return noAutorizado('Ese usuario no tiene ninguna empresa asignada.', 403)

  if (!registro.ultimo_uso_at || Date.now() - new Date(registro.ultimo_uso_at).getTime() > ANOTAR_USO_MS) {
    after(async () => {
      const { error: e } = await db.from('claves_ia').update({ ultimo_uso_at: new Date().toISOString() }).eq('id', registro.id)
      if (e) console.error('mcp: último uso', e.message)
    })
  }

  const ctx: CtxGestion = {
    db,
    quien: { userId: registro.user_id, nombre: perfil.nombre, rol, todasLasEmpresas: perfil.empresa_acceso == null },
    empresas,
  }
  return atenderMcp(req, {
    nombre: 'gestion-de-recursos',
    titulo: 'Gestión de Recursos (Tecnophos · ADC · Serviwhite)',
    version: '1.0.0',
    instrucciones: INSTRUCCIONES,
    herramientas: HERRAMIENTAS,
    ctx,
    alFallar: (e, h) => console.error(`mcp: ${h}`, e),
  })
}

export const POST = atender
export const GET = atender
export const DELETE = atender
