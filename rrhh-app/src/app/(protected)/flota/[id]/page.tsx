import { notFound } from 'next/navigation'
import QRCode from 'qrcode'
import { createClient } from '@/lib/supabase/server'
import { getSesion } from '@/lib/auth/session'
import { tieneRol, LEGAJO_ESCRITURA } from '@/lib/auth/roles'
import { urlApp } from '@/modules/flota/servidor'
import { resumirVehiculo } from '@/modules/flota/resumen'
import VehiculoClient from './VehiculoClient'

export const dynamic = 'force-dynamic'

export default async function VehiculoFlotaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound()
  const supabase = await createClient()

  const [{ data: vehiculo }, sesion] = await Promise.all([
    supabase
      .from('vehiculos')
      .select('id, patente, descripcion, marca, modelo, anio, empresa_id, km_actual, km_actualizado_at, conductor_id, checklist_token, checklist_activo, checklist_cada_dias, activo, empresa:empresas(nombre, slug)')
      .eq('id', id)
      .maybeSingle(),
    getSesion(),
  ])
  // La RLS decide: un vehículo de otra empresa se ve igual que uno inexistente.
  if (!vehiculo || !vehiculo.empresa_id) notFound()

  const [chk, nov, plan, serv, cert, emp] = await Promise.all([
    supabase.from('vehiculo_checklists')
      .select('id, created_at, realizado_por_nombre, km, km_inconsistente, resultado, respuestas, notas_items, fotos, observaciones, origen')
      .eq('vehiculo_id', id).order('created_at', { ascending: false }).limit(60),
    supabase.from('vehiculo_novedades')
      .select('id, created_at, origen, item, titulo, descripcion, gravedad, fotos, reportado_por_nombre, km, estado, resolucion, costo, resuelta_at, checklist_id')
      .eq('vehiculo_id', id).order('created_at', { ascending: false }).limit(150),
    supabase.from('vehiculo_mantenimiento_plan').select('id, tipo, cada_km, cada_meses').eq('vehiculo_id', id).order('created_at'),
    supabase.from('vehiculo_services').select('id, tipo, fecha, km, taller, costo, notas').eq('vehiculo_id', id).order('fecha', { ascending: false }),
    supabase.from('certificados')
      .select('fecha_vencimiento, alerta_dias, tipo_nombre_custom, tipo:tipos_certificado(nombre)')
      .eq('vehiculo_id', id).not('fecha_vencimiento', 'is', null),
    supabase.from('empleados').select('id, nombre, apellido').eq('empresa_id', vehiculo.empresa_id).eq('activo', true).order('nombre'),
  ])
  const error = [chk, nov, plan, serv, cert, emp].find((r) => r.error)?.error
  if (error) {
    return (
      <div className="mx-auto max-w-6xl p-4 sm:p-6 lg:p-8">
        <h1 className="font-mono text-2xl font-semibold">{vehiculo.patente}</h1>
        <div className="mt-6 rounded-2xl border border-danger/30 bg-danger-subtle px-5 py-4 text-sm text-danger">
          No se pudo cargar la ficha. Detalle técnico: {error.message}
        </div>
      </div>
    )
  }

  const checklists = chk.data ?? []
  const novedades = nov.data ?? []
  const resumen = resumirVehiculo({
    id: vehiculo.id,
    patente: vehiculo.patente,
    km_actual: vehiculo.km_actual,
    checklist_cada_dias: vehiculo.checklist_cada_dias,
    checklist_activo: vehiculo.checklist_activo,
    checklists,
    plan: plan.data ?? [],
    services: serv.data ?? [],
    novedades: novedades.filter((n) => n.estado === 'abierta'),
    certificados: (cert.data ?? []).map((c) => ({
      nombre: c.tipo?.nombre ?? c.tipo_nombre_custom ?? 'Documento',
      fecha_vencimiento: c.fecha_vencimiento as string,
      alerta_dias: c.alerta_dias,
    })),
  })

  const urlQR = `${urlApp()}/v/${vehiculo.checklist_token}`
  const qrSvg = await QRCode.toString(urlQR, { type: 'svg', margin: 1, errorCorrectionLevel: 'M' })

  return (
    <VehiculoClient
      vehiculo={{
        id: vehiculo.id,
        patente: vehiculo.patente,
        descripcion: vehiculo.descripcion,
        marca: vehiculo.marca,
        modelo: vehiculo.modelo,
        anio: vehiculo.anio,
        empresaId: vehiculo.empresa_id,
        empresa: vehiculo.empresa as { nombre: string; slug: string },
        kmActual: vehiculo.km_actual,
        kmActualizadoAt: vehiculo.km_actualizado_at,
        conductorId: vehiculo.conductor_id,
        checklistActivo: vehiculo.checklist_activo,
        checklistCadaDias: vehiculo.checklist_cada_dias,
      }}
      resumen={resumen}
      checklists={checklists}
      novedades={novedades}
      plan={plan.data ?? []}
      services={serv.data ?? []}
      empleados={(emp.data ?? []).map((e) => ({ id: e.id, nombre: [e.nombre, e.apellido].filter(Boolean).join(' ') }))}
      qr={{ url: urlQR, svg: qrSvg }}
      canEdit={tieneRol(sesion?.rol ?? null, LEGAJO_ESCRITURA)}
    />
  )
}
