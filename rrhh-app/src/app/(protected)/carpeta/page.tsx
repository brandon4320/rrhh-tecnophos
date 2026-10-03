import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { leer } from '@/lib/errores'
import { traerTodo } from '@/lib/paginar'
import { getEstadoVencimiento } from '@/types'
import { anioMesAR } from '@/modules/documentos/reglas'
import CarpetaClient, { type CertCarpeta, type DuenoCarpeta, type MesCarpeta } from './CarpetaClient'

export const dynamic = 'force-dynamic'

const CERT = 'id, tipo_nombre_custom, fecha_vencimiento, alerta_dias, tipo:tipos_certificado(nombre), archivos(id, nombre, size_bytes)'
const MESES_ATRAS = 6

type CertFila = {
  id: string
  tipo_nombre_custom: string | null
  fecha_vencimiento: string | null
  alerta_dias: number | null
  tipo: { nombre: string } | null
  archivos: { id: string; nombre: string | null; size_bytes: number | null }[] | null
}

function aCert(c: CertFila): CertCarpeta {
  return {
    id: c.id,
    titulo: c.tipo?.nombre ?? c.tipo_nombre_custom ?? 'Documento',
    vence: c.fecha_vencimiento,
    estado: getEstadoVencimiento(c.fecha_vencimiento, c.alerta_dias),
    archivos: (c.archivos ?? []).map((a) => ({ id: a.id, nombre: a.nombre ?? 'archivo', bytes: a.size_bytes ?? 0 })),
  }
}

/** Primero lo que tiene archivos, después por nombre del documento. */
const ordenCerts = (a: CertCarpeta, b: CertCarpeta) =>
  Number(b.archivos.length > 0) - Number(a.archivos.length > 0) || a.titulo.localeCompare(b.titulo)

/**
 * Armar carpeta para planta (?empresa=slug): elegir personas, vehículos, documentos de la
 * empresa y documentación mensual, y bajar todo en un ZIP con nombres claros. Todo lo que
 * se lista sale con la RLS del usuario (los recibos de sueldo solo con permiso).
 */
export default async function CarpetaPage({ searchParams }: { searchParams: Promise<{ empresa?: string }> }) {
  const { empresa } = await searchParams
  const supabase = await createClient()
  const lista = leer(await supabase.from('empresas').select('id, nombre, slug').order('nombre')) ?? []
  const empresaSel = (empresa ? lista.find((e) => e.slug === empresa) : undefined) ?? (lista.length === 1 ? lista[0] : undefined)

  if (!empresaSel) {
    return (
      <div className="mx-auto max-w-6xl p-4 sm:p-6 lg:p-8">
        <h1 className="text-2xl font-semibold tracking-tight">Armar carpeta para planta</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">Elegí la empresa cuya documentación vas a mandar.</p>
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {lista.map((e) => (
            <Link key={e.id} href={`/carpeta?empresa=${e.slug}`} className="rounded-2xl border border-border bg-card px-5 py-4 text-sm font-medium transition-colors hover:bg-muted">
              {e.nombre}
            </Link>
          ))}
        </div>
      </div>
    )
  }

  const { anio, mes } = anioMesAR()
  const desde = new Date(Date.UTC(anio, mes - 1 - MESES_ATRAS, 1)).toISOString().slice(0, 10)

  const [empRes, vehRes, empCertsRes, docsRes] = await Promise.all([
    supabase.from('empleados').select(`id, nombre, apellido, sector, certificados(${CERT})`).eq('empresa_id', empresaSel.id).eq('activo', true),
    supabase.from('vehiculos').select(`id, patente, marca, modelo, descripcion, certificados(${CERT})`).eq('empresa_id', empresaSel.id).eq('activo', true).order('patente'),
    supabase.from('certificados').select(CERT).eq('empresa_id', empresaSel.id).is('empleado_id', null).is('vehiculo_id', null).is('equipo_id', null),
    traerTodo((d, h) =>
      supabase.from('documentos_mensuales').select('id, periodo, carpeta, nombre_archivo, size_bytes')
        .eq('empresa_id', empresaSel.id).gte('periodo', desde)
        .order('periodo', { ascending: false }).order('carpeta').order('nombre_archivo').order('id')
        .range(d, h)
    ),
  ])

  const empleados: DuenoCarpeta[] = (leer(empRes) ?? [])
    .map((e) => ({
      id: e.id,
      nombre: [e.apellido, e.nombre].filter(Boolean).join(' ') || 'Sin nombre',
      detalle: e.sector ?? null,
      certificados: ((e.certificados ?? []) as unknown as CertFila[]).map(aCert).sort(ordenCerts),
    }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre))

  const vehiculos: DuenoCarpeta[] = (leer(vehRes) ?? []).map((v) => ({
    id: v.id,
    nombre: v.patente,
    detalle: [v.marca, v.modelo].filter(Boolean).join(' ') || v.descripcion || null,
    certificados: ((v.certificados ?? []) as unknown as CertFila[]).map(aCert).sort(ordenCerts),
  }))

  const deEmpresa = ((leer(empCertsRes) ?? []) as unknown as CertFila[]).map(aCert).sort(ordenCerts)

  if (docsRes.error) throw new Error(docsRes.error.message)
  const porMes = new Map<string, MesCarpeta>()
  for (const d of docsRes.data ?? []) {
    const m = porMes.get(d.periodo) ?? { periodo: d.periodo, docs: [] }
    m.docs.push({ id: d.id, carpeta: d.carpeta, nombre: d.nombre_archivo, bytes: d.size_bytes ?? 0 })
    porMes.set(d.periodo, m)
  }

  return (
    <CarpetaClient
      key={empresaSel.id}
      empresa={empresaSel}
      empleados={empleados}
      vehiculos={vehiculos}
      deEmpresa={deEmpresa}
      meses={[...porMes.values()]}
    />
  )
}
