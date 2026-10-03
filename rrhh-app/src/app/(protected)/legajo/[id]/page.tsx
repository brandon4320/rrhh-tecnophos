import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { getSesion } from '@/lib/auth/session'
import { tieneRol, LEGAJO_ESCRITURA } from '@/lib/auth/roles'
import LegajoClient from './LegajoClient'
import type { MovimientoEpp } from './EppEntregado'

export default async function LegajoPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ cert?: string; nuevo?: string }>
}) {
  const [{ id }, sp] = await Promise.all([params, searchParams])
  const supabase = await createClient()

  // Todo en UN solo batch: ninguna query depende del fetch del empleado
  // (certificados filtra por empleado_id directo). notFound() se decide después.
  const [{ data: empleado }, { data: certificados }, { data: tiposCert }, { data: empresas }, sesion, { data: recibos }, { data: epp }] = await Promise.all([
    supabase
      .from('empleados')
      .select('*, empresa:empresas(*)')
      .eq('id', id)
      .single(),
    supabase
      .from('certificados')
      .select('*, tipo:tipos_certificado(nombre, orden), archivos(*)')
      .eq('empleado_id', id)
      .order('fecha_vencimiento', { ascending: true }),
    supabase
      .from('tipos_certificado')
      .select('*')
      .eq('aplica_personal', true)
      .order('orden'),
    supabase
      .from('empresas')
      .select('*')
      .order('nombre'),
    getSesion(), // cacheada por request: el layout ya la resolvió
    supabase
      .from('recibos_sueldo')
      .select('*')
      .eq('empleado_id', id)
      .order('periodo', { ascending: false }),
    // EPP y ropa entregados desde Stock (migración 24: stock_movimientos.empleado_id).
    supabase
      .from('stock_movimientos')
      .select('id, fecha, tipo, cantidad, item:stock_items(nombre, unidad)')
      .eq('empleado_id', id)
      .in('tipo', ['consumo', 'devolucion'])
      .order('fecha', { ascending: false })
      .limit(200),
  ])

  if (!empleado) notFound()

  // ?cert=<id>: link profundo desde el dashboard/vencimientos (abre esa tarjeta).
  // Solo si el certificado es de este legajo; si no, se ignora.
  const certInicial = sp.cert && (certificados ?? []).some((c) => c.id === sp.cert) ? sp.cert : null

  return (
    <LegajoClient
      // Un link profundo a OTRO certificado del mismo legajo remonta el client
      // (la tarjeta abierta inicial solo se lee al montar).
      key={`${id}-${certInicial ?? ''}`}
      certInicial={certInicial}
      abrirAlta={sp.nuevo === '1'}
      empleado={empleado}
      certificados={certificados ?? []}
      tiposCertificado={tiposCert ?? []}
      empresas={empresas ?? []}
      // Recibos de sueldo: solo con permiso (la RLS ya devuelve vacío sin él; esto
      // además oculta la sección para no mostrar un "sin comprobantes" engañoso).
      recibos={recibos ?? []}
      veRecibos={sesion?.veRecibos === true}
      epp={(epp ?? []) as MovimientoEpp[]}
      isAdmin={sesion?.rol === 'admin'}
      canEdit={tieneRol(sesion?.rol ?? null, LEGAJO_ESCRITURA)}
    />
  )
}
