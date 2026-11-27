import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sesionApi } from '@/lib/auth/session'
import { LEGAJO_ESCRITURA } from '@/lib/auth/roles'
import { normalizarPatente, type DuplicadoPatente } from '@/lib/vehiculos'

/**
 * ¿Esta patente ya existe en OTRA empresa del grupo?
 *
 * ── Por qué hace falta una ruta y no se consulta desde la pantalla ──
 * Justamente porque la RLS hace bien su trabajo: quien tiene una sola empresa
 * asignada (`empresa_acceso`) no ve los vehículos de las demás, así que una
 * consulta desde el cliente le devolvería vacío siempre y el aviso nunca
 * saltaría. Y es EXACTAMENTE esa persona la que cargó el duplicado de la
 * AG493RP el 20/11/2026.
 *
 * ── Qué se cuida ──
 * Usa el cliente de servicio, así que contesta a mano lo mínimo: SOLO el
 * nombre de las empresas que tienen esa chapa y si están activas. Ni ids, ni
 * modelos, ni el token del QR, ni nada de los vehículos de la otra empresa.
 * Y solo a quien ya puede dar de alta vehículos.
 */
export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const s = await sesionApi(LEGAJO_ESCRITURA, 'No tenés permisos para esto.')
  if ('error' in s) return s.error

  const url = new URL(request.url)
  const patente = normalizarPatente(url.searchParams.get('patente'))
  const empresaId = url.searchParams.get('empresa') ?? ''
  if (patente.length < 3) return NextResponse.json({ duplicados: [] })

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('vehiculos')
    .select('patente, activo, empresa_id, empresas(nombre)')

  if (error) {
    // El aviso es una ayuda, no un control: si la consulta falla, el alta
    // sigue su camino en vez de trabarse. Lo que NO puede hacer es mentir
    // diciendo que no hay duplicados, así que se avisa aparte.
    console.error('[vehiculos/patente] leer:', error.message)
    return NextResponse.json({ duplicados: [], sinVerificar: true })
  }

  // La comparación se hace en JS y no con un `.eq()` para que entren las
  // chapas escritas con espacios o guiones ("AD 113-UY" es la misma que
  // "AD113UY"). Son pocas decenas de filas.
  const duplicados: DuplicadoPatente[] = (data ?? [])
    .filter((v) => v.empresa_id !== empresaId && normalizarPatente(v.patente) === patente)
    .map((v) => ({ empresa: nombreEmpresa(v.empresas), activo: v.activo !== false }))
    .filter((d) => d.empresa)

  return NextResponse.json({ duplicados })
}

/** supabase-js tipa la relación embebida como array aunque la FK devuelva un objeto. */
function nombreEmpresa(v: unknown): string {
  const e = Array.isArray(v) ? v[0] : v
  return (e as { nombre?: string } | null)?.nombre ?? ''
}
