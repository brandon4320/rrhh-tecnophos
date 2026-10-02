import Link from 'next/link'
import { notFound } from 'next/navigation'
import QRCode from 'qrcode'
import { ArrowLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { urlApp } from '@/modules/flota/servidor'
import BotonImprimir from './BotonImprimir'
import ImprimirAlAbrir from './ImprimirAlAbrir'

export const dynamic = 'force-dynamic'

/**
 * Hoja para imprimir y pegar adentro de cada camioneta (cuatro por A4).
 * La barra lateral no sale en la impresión (AppShell usa print:hidden).
 */
export default async function QRFlotaPage({ searchParams }: { searchParams: Promise<{ empresa?: string; vehiculo?: string; imprimir?: string }> }) {
  const { empresa, vehiculo, imprimir } = await searchParams
  const desdeLista = imprimir === '1'
  if (!empresa) notFound()
  const supabase = await createClient()
  const { data: emp } = await supabase.from('empresas').select('id, nombre, slug').eq('slug', empresa).maybeSingle()
  if (!emp) notFound()

  let q = supabase
    .from('vehiculos')
    .select('id, patente, marca, modelo, anio, descripcion, checklist_token')
    .eq('empresa_id', emp.id)
    .eq('activo', true)
    .eq('checklist_activo', true)
    .order('patente')
  if (vehiculo) q = q.eq('id', vehiculo)
  const { data: vehiculos, error } = await q
  if (error) throw error

  const etiquetas = await Promise.all(
    (vehiculos ?? []).map(async (v) => ({
      ...v,
      svg: await QRCode.toString(`${urlApp()}/v/${v.checklist_token}`, { type: 'svg', margin: 1, errorCorrectionLevel: 'M' }),
    }))
  )

  return (
    <div className="mx-auto max-w-4xl p-4 sm:p-6 lg:p-8 print:max-w-none print:p-0">
      {desdeLista && etiquetas.length > 0 && <ImprimirAlAbrir />}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div>
          <Link href={vehiculo && !desdeLista ? `/flota/${vehiculo}` : `/flota?empresa=${emp.slug}`} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="size-4" /> Volver
          </Link>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">QR para las camionetas</h1>
          <p className="text-sm text-muted-foreground">
            {etiquetas.length} {etiquetas.length === 1 ? 'etiqueta' : 'etiquetas'} · {emp.nombre}. Pegalas en la cara interna de la tapa de la guantera.
          </p>
        </div>
        <BotonImprimir />
      </div>

      {etiquetas.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border px-6 py-12 text-center text-sm text-muted-foreground print:hidden">
          No hay vehículos con el checklist activado.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 print:grid-cols-2 print:gap-0">
          {etiquetas.map((v) => (
            <article key={v.id} className="flex flex-col items-center rounded-2xl border-2 border-dashed border-border bg-white p-6 text-center text-black [break-inside:avoid] print:rounded-none print:border-gray-300 print:p-8">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">{emp.nombre}</p>
              <p className="mt-2 font-mono text-3xl font-bold tracking-wider">{v.patente}</p>
              {(v.marca || v.modelo || v.anio || v.descripcion) && (
                <p className="text-sm text-gray-500">{[v.marca, v.modelo, v.anio].filter(Boolean).join(' ') || v.descripcion}</p>
              )}
              <div className="my-4 w-48 [&_svg]:h-auto [&_svg]:w-full" dangerouslySetInnerHTML={{ __html: v.svg }} />
              <p className="text-base font-semibold">Checklist obligatorio</p>
              <p className="mt-1 max-w-[16rem] text-sm leading-snug text-gray-600">
                Apuntá la cámara del celular al código. También sirve para avisar un golpe, una falla o una pinchadura.
              </p>
            </article>
          ))}
        </div>
      )}
    </div>
  )
}
