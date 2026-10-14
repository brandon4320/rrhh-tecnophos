import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getSignedDownloadUrl } from '@/lib/r2/operations'
import { vehiculoPorToken } from '@/modules/flota/servidor'

const UUID = /^[0-9a-f-]{36}$/i

/**
 * Documento del vehículo (seguro, VTV, cédula…) desde el QR de la camioneta, para
 * mostrarlo en un control sin buscar papeles. Público como el resto de /v: la
 * autorización es el token del vehículo, y solo se abren archivos de certificados
 * de ESE vehículo (nada de legajos ni de otros vehículos). Redirige a una URL
 * firmada de R2 de pocos minutos, que se abre en el navegador del celular.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ token: string; archivoId: string }> }) {
  const { token, archivoId } = await params
  if (!UUID.test(archivoId)) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })

  const admin = createAdminClient()
  let vehiculo
  try {
    vehiculo = await vehiculoPorToken(admin, token)
  } catch {
    return NextResponse.json({ error: 'El sistema no está disponible. Probá en unos minutos.' }, { status: 503 })
  }
  if (!vehiculo) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })

  const { data: archivo } = await admin
    .from('archivos')
    .select('path, nombre, certificado:certificados!inner(vehiculo_id)')
    .eq('id', archivoId)
    .maybeSingle()
  const cert = archivo?.certificado as { vehiculo_id: string | null } | { vehiculo_id: string | null }[] | null | undefined
  const vehiculoDelArchivo = Array.isArray(cert) ? cert[0]?.vehiculo_id : cert?.vehiculo_id
  if (!archivo?.path || vehiculoDelArchivo !== vehiculo.id) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })

  const url = await getSignedDownloadUrl(archivo.path, 300, archivo.nombre ?? undefined)
  return NextResponse.redirect(url, { status: 302, headers: { 'Cache-Control': 'no-store' } })
}
