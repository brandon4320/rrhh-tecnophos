import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireModulo } from '@/lib/auth/session'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function cdb(): Promise<any> { return createClient() }

const PALETA = ['#ef4444', '#f59e0b', '#10b981', '#0ea5e9', '#8b5cf6', '#ec4899', '#64748b']

// Catálogo de tags
export async function GET() {
  await requireModulo('comercial')
  const supabase = await cdb()
  const { data } = await supabase.from('comercial_tags').select('nombre, color').order('nombre')
  return NextResponse.json({ tags: data ?? [] })
}

// Crear tag (create-on-type)
export async function POST(req: NextRequest) {
  await requireModulo('comercial')
  const body = await req.json().catch(() => ({}))
  const nombre = (body.nombre as string)?.trim()
  if (!nombre) return NextResponse.json({ error: 'Nombre requerido' }, { status: 400 })

  // color estable derivado del nombre si no se especifica
  let color = (body.color as string) || ''
  if (!color) {
    let h = 0
    for (let i = 0; i < nombre.length; i++) h = (h * 31 + nombre.charCodeAt(i)) >>> 0
    color = PALETA[h % PALETA.length]
  }

  const supabase = await cdb()
  await supabase.from('comercial_tags').insert({ nombre, color }).select('nombre, color')
  // si ya existía, devolvemos el existente
  const { data } = await supabase.from('comercial_tags').select('nombre, color').eq('nombre', nombre).single()
  return NextResponse.json({ tag: data ?? { nombre, color } })
}
