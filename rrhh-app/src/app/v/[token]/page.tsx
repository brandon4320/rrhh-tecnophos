import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { createAdminClient } from '@/lib/supabase/admin'
import { getEstadoVencimiento } from '@/types'
import { vehiculoPorToken, type VehiculoQR } from '@/modules/flota/servidor'
import { estadoChecklist } from '@/modules/flota/reglas'
import FormularioQR, { type DocumentoQR } from './FormularioQR'

// Página PÚBLICA: la abre el QR pegado dentro de la camioneta. Sin login.
// Todo lo que se lee acá pasa por el token del vehículo (service role).

export const dynamic = 'force-dynamic'
export const metadata: Metadata = {
  title: 'Checklist de la camioneta',
  robots: { index: false, follow: false },
}

export default async function ChecklistQRPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const admin = createAdminClient()

  let vehiculo: VehiculoQR | null
  try {
    vehiculo = await vehiculoPorToken(admin, token)
  } catch {
    return (
      <main className="mx-auto max-w-md px-5 py-16 text-center">
        <p className="text-lg font-semibold">El sistema no está disponible</p>
        <p className="mt-2 text-sm text-muted-foreground">Probá de nuevo en unos minutos.</p>
      </main>
    )
  }
  if (!vehiculo) notFound()

  const [{ data: empleados }, { data: ultimo }, { data: certs }] = await Promise.all([
    admin
      .from('empleados')
      .select('id, nombre, apellido')
      .eq('empresa_id', vehiculo.empresa_id)
      .eq('activo', true)
      .order('nombre'),
    admin
      .from('vehiculo_checklists')
      .select('created_at, realizado_por_nombre, km, resultado')
      .eq('vehiculo_id', vehiculo.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    admin
      .from('certificados')
      .select('fecha_vencimiento, alerta_dias, tipo_nombre_custom, tipo:tipos_certificado(nombre)')
      .eq('vehiculo_id', vehiculo.id)
      .not('fecha_vencimiento', 'is', null),
  ])

  // El vencimiento más lejano de cada tipo: si hay una VTV vieja y una nueva,
  // manda la nueva.
  const porTipo = new Map<string, DocumentoQR>()
  for (const c of certs ?? []) {
    const nombre = c.tipo?.nombre ?? c.tipo_nombre_custom ?? 'Documento'
    const previo = porTipo.get(nombre)
    if (!previo || c.fecha_vencimiento! > previo.vence) {
      porTipo.set(nombre, {
        nombre,
        vence: c.fecha_vencimiento!.slice(0, 10),
        estado: getEstadoVencimiento(c.fecha_vencimiento, c.alerta_dias),
      })
    }
  }

  const estado = estadoChecklist(ultimo?.created_at ?? null, vehiculo.checklist_cada_dias)

  return (
    <FormularioQR
      token={token}
      vehiculo={{
        patente: vehiculo.patente,
        detalle: [vehiculo.marca, vehiculo.modelo].filter(Boolean).join(' ') || vehiculo.descripcion,
        empresa: vehiculo.empresa.nombre,
        kmActual: vehiculo.km_actual,
        kmActualizadoAt: vehiculo.km_actualizado_at,
        cadaDias: vehiculo.checklist_cada_dias,
      }}
      empleados={(empleados ?? []).map((e) => ({ id: e.id, nombre: [e.nombre, e.apellido].filter(Boolean).join(' ') }))}
      ultimo={ultimo ? { fecha: ultimo.created_at, quien: ultimo.realizado_por_nombre, km: ultimo.km } : null}
      estado={estado}
      documentos={[...porTipo.values()]}
    />
  )
}
