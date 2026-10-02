import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'node:crypto'
import { createAdminClient } from '@/lib/supabase/admin'
import { uploadToR2 } from '@/lib/r2/operations'
import { diaClaveAR } from '@/lib/fechas-ar'
import { vehiculoPorToken } from '@/modules/flota/servidor'
import { SLOTS_VALIDOS, SLOT_NOVEDAD } from '@/modules/flota/reglas'

// Ruta PÚBLICA (proxy.ts → PUBLIC_PATHS): la usa el formulario del QR, sin
// sesión. La autorización es el token del vehículo.
//
// La foto llega ya comprimida desde el celular (~1600 px, JPEG): pasa por acá
// en vez de ir directo a R2 porque así no depende del CORS del bucket, y con
// ese tamaño nunca se acerca al límite de 4,5 MB de Vercel.

const TIPOS = new Map([
  ['image/jpeg', 'jpg'],
  ['image/png', 'png'],
  ['image/webp', 'webp'],
])
const MAX_BYTES = 4 * 1024 * 1024

export async function POST(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const admin = createAdminClient()

  let vehiculo
  try {
    vehiculo = await vehiculoPorToken(admin, token)
  } catch {
    return NextResponse.json({ error: 'El sistema no está disponible. Probá de nuevo en un rato.' }, { status: 503 })
  }
  if (!vehiculo) return NextResponse.json({ error: 'QR no válido' }, { status: 404 })

  let form: FormData
  try {
    form = await request.formData()
  } catch {
    return NextResponse.json({ error: 'La foto no llegó completa. Probá de nuevo.' }, { status: 400 })
  }
  const slot = String(form.get('slot') ?? '')
  const archivo = form.get('archivo')

  if (!SLOTS_VALIDOS.has(slot) && slot !== SLOT_NOVEDAD) {
    return NextResponse.json({ error: 'Foto no reconocida' }, { status: 400 })
  }
  if (!(archivo instanceof Blob) || archivo.size === 0) {
    return NextResponse.json({ error: 'No llegó ninguna foto' }, { status: 400 })
  }
  const extension = TIPOS.get(archivo.type)
  if (!extension) return NextResponse.json({ error: 'El archivo tiene que ser una foto' }, { status: 400 })
  if (archivo.size > MAX_BYTES) return NextResponse.json({ error: 'La foto es demasiado pesada' }, { status: 413 })

  const mes = diaClaveAR(new Date()).slice(0, 7)
  const path = `flota/${vehiculo.id}/${mes}/${randomUUID()}-${slot}.${extension}`
  try {
    await uploadToR2(path, new Uint8Array(await archivo.arrayBuffer()), archivo.type)
  } catch {
    return NextResponse.json({ error: 'No se pudo guardar la foto. Revisá la señal y probá de nuevo.' }, { status: 502 })
  }
  return NextResponse.json({ path })
}
