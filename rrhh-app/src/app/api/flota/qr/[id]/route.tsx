import { NextResponse } from 'next/server'
import { ImageResponse } from 'next/og'
import QRCode from 'qrcode'
import { createClient } from '@/lib/supabase/server'
import { urlApp } from '@/modules/flota/servidor'

/**
 * Etiqueta del QR de una camioneta como PNG para descargar (la misma que sale en
 * la hoja de /flota/qr). La RLS decide: si el usuario no ve el vehículo, 404.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!/^[0-9a-f-]{36}$/.test(id)) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { data: v } = await supabase
    .from('vehiculos')
    .select('patente, marca, modelo, anio, descripcion, checklist_token, empresa:empresas(nombre)')
    .eq('id', id)
    .maybeSingle()
  if (!v) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })

  const qr = await QRCode.toDataURL(`${urlApp()}/v/${v.checklist_token}`, { margin: 1, width: 640, errorCorrectionLevel: 'M' })
  const empresa = (v.empresa as { nombre: string } | null)?.nombre ?? ''
  const detalle = [v.marca, v.modelo, v.anio].filter(Boolean).join(' ') || v.descripcion || ''

  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#fff', color: '#111', border: '4px solid #d1d5db', padding: 48 }}>
        <div style={{ fontSize: 28, fontWeight: 600, letterSpacing: 6, textTransform: 'uppercase', color: '#6b7280' }}>{empresa}</div>
        <div style={{ marginTop: 16, fontSize: 104, fontWeight: 700, letterSpacing: 8 }}>{v.patente}</div>
        {detalle && <div style={{ fontSize: 34, color: '#6b7280' }}>{detalle}</div>}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={qr} width={560} height={560} alt="" style={{ marginTop: 32, marginBottom: 32 }} />
        <div style={{ fontSize: 44, fontWeight: 700 }}>Checklist obligatorio</div>
        <div style={{ marginTop: 12, maxWidth: 680, fontSize: 30, lineHeight: 1.35, color: '#4b5563', textAlign: 'center' }}>
          Apuntá la cámara del celular al código. También sirve para avisar un golpe, una falla o una pinchadura.
        </div>
      </div>
    ),
    {
      width: 900,
      height: 1200,
      headers: {
        'Content-Disposition': `attachment; filename="QR-${v.patente.replace(/[^A-Za-z0-9]/g, '')}.png"`,
        'Cache-Control': 'private, no-store',
      },
    }
  )
}
