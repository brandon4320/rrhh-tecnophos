import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getSesion } from '@/lib/auth/session'
import { tieneRol, LEGAJO_ESCRITURA } from '@/lib/auth/roles'
import { CATEGORIA_PALAS } from '@/modules/palas/reglas'
import EquiposClient from '../empresa/[slug]/EquiposClient'

export const dynamic = 'force-dynamic'

const CERT_DOC =
  'id, tipo_id, tipo_nombre_custom, fecha_vencimiento, notas, alerta_dias, created_at, tipo:tipos_certificado(nombre), archivos(id, nombre, path)'

/**
 * Recursos → Palas cargadoras. Una pala es un `equipos` con
 * `categoria = CATEGORIA_PALAS` (ver migración 26 y modules/palas/reglas.ts),
 * así que la pantalla reusa `EquiposClient` acotado a esa categoría: de ahí
 * salen gratis los certificados con vencimiento, los adjuntos en R2 y la RLS.
 *
 * Hoy las palas son de ADC, pero la pantalla NO lo da por sentado: funciona
 * para cualquier empresa que tenga alguna cargada, y si el usuario ve una sola
 * empresa cae directo en la suya (igual que /flota y /stock).
 */
export default async function PalasPage({ searchParams }: { searchParams: Promise<{ empresa?: string; pala?: string }> }) {
  const { empresa, pala } = await searchParams
  const supabase = await createClient()

  const [{ data: empresas }, sesion] = await Promise.all([
    supabase.from('empresas').select('id, nombre, slug').order('nombre'),
    getSesion(),
  ])
  const lista = empresas ?? []
  const empresaSel = (empresa ? lista.find((e) => e.slug === empresa) : undefined) ?? (lista.length === 1 ? lista[0] : undefined)
  if (!empresaSel) notFound()

  const canEdit = tieneRol(sesion?.rol ?? null, LEGAJO_ESCRITURA)

  const [{ data: palas, error }, { data: tiposEquipo }] = await Promise.all([
    supabase
      .from('equipos')
      .select(`*, certificados(${CERT_DOC})`)
      .eq('empresa_id', empresaSel.id)
      .eq('categoria', CATEGORIA_PALAS)
      .eq('activo', true)
      .order('nombre'),
    supabase.from('tipos_certificado').select('*').eq('aplica_equipo', true).order('orden'),
  ])

  // Una lectura que falla NO puede verse igual que "todavía no hay ninguna":
  // sin esto, un error de permisos diría "sin palas cargadas" y nadie se entera.
  if (error) {
    return (
      <div className="mx-auto max-w-5xl p-4 sm:p-6 lg:p-8">
        <h1 className="text-[28px] leading-tight font-semibold tracking-[-0.02em]">Palas cargadoras</h1>
        <div className="mt-6 rounded-2xl border border-danger/30 bg-danger-subtle px-5 py-4 text-sm text-danger">
          No se pudieron cargar las palas. Detalle técnico: {error.message}
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-5xl p-4 sm:p-6 lg:p-8">
      <div className="mb-6">
        <h1 className="text-[28px] leading-tight font-semibold tracking-[-0.02em]">Palas cargadoras</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          {empresaSel.nombre} · {palas?.length ?? 0}{' '}
          {(palas?.length ?? 0) === 1 ? 'unidad cargada' : 'unidades cargadas'}. Cada una con sus datos y su
          documentación; lo que vence aparece solo en Vencimientos.
        </p>
      </div>

      <EquiposClient
        key={`pala-${pala ?? ''}`}
        equipos={palas ?? []}
        secciones={[]}
        tiposCertificado={tiposEquipo ?? []}
        canEdit={canEdit}
        empresaSlug={empresaSel.slug}
        empresaId={empresaSel.id}
        abiertoInicial={pala ?? null}
        soloCategoria={CATEGORIA_PALAS}
      />
    </div>
  )
}
