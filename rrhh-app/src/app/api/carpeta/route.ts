import { NextRequest, NextResponse } from 'next/server'
import { sesionApi } from '@/lib/auth/session'
import { RRHH_ROLES } from '@/lib/auth/roles'
import { getSignedDownloadUrl } from '@/lib/r2/operations'

const MAX_ARCHIVOS = 800
const UUID = /^[0-9a-f-]{36}$/i

/** De a 150 ids por consulta: el filtro .in() viaja en la URL de PostgREST. */
function enTandas<T>(lista: T[], tam = 150): T[][] {
  const out: T[][] = []
  for (let i = 0; i < lista.length; i += tam) out.push(lista.slice(i, i + tam))
  return out
}

/**
 * "Armar carpeta para planta": devuelve URLs firmadas (10 min) para bajar desde el
 * navegador los archivos elegidos y armar el ZIP ahí (sin pasar los archivos por
 * Vercel, que corta en 4,5 MB). Igual que /api/archivo, se firma SOLO lo que la RLS
 * deja ver al usuario: certificados de sus empresas y documentación mensual (los
 * recibos de sueldo solo con perfiles.ve_recibos, migración 23). Lo que no vuelve
 * de la consulta, simplemente no se firma.
 */
export async function POST(request: NextRequest) {
  const s = await sesionApi(RRHH_ROLES, 'No tenés permisos para descargar documentación.')
  if ('error' in s) return s.error
  const { supabase } = s

  const body = await request.json().catch(() => null)
  const archivos = Array.isArray(body?.archivos) ? (body.archivos as unknown[]).filter((x): x is string => typeof x === 'string' && UUID.test(x)) : []
  const mensuales = Array.isArray(body?.mensuales) ? (body.mensuales as unknown[]).filter((x): x is string => typeof x === 'string' && UUID.test(x)) : []
  if (archivos.length + mensuales.length === 0) return NextResponse.json({ error: 'No elegiste ningún archivo.' }, { status: 400 })
  if (archivos.length + mensuales.length > MAX_ARCHIVOS) {
    return NextResponse.json({ error: `Son demasiados archivos para una sola carpeta (máximo ${MAX_ARCHIVOS}). Dividila en dos.` }, { status: 400 })
  }

  const paths = new Map<string, string>()
  for (const tanda of enTandas(archivos)) {
    const { data, error } = await supabase.from('archivos').select('id, path').in('id', tanda)
    if (error) return NextResponse.json({ error: 'No se pudo leer la documentación.' }, { status: 500 })
    for (const a of data ?? []) paths.set(a.id, a.path)
  }
  for (const tanda of enTandas(mensuales)) {
    const { data, error } = await supabase.from('documentos_mensuales').select('id, path').in('id', tanda)
    if (error) return NextResponse.json({ error: 'No se pudo leer la documentación mensual.' }, { status: 500 })
    for (const d of data ?? []) paths.set(d.id, d.path)
  }

  // Firmar es local (no va a R2): se puede hacer todo en paralelo.
  const urls: Record<string, string> = {}
  await Promise.all([...paths].map(async ([id, path]) => { urls[id] = await getSignedDownloadUrl(path, 600) }))
  return NextResponse.json({ urls })
}
