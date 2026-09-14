import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { getSesion } from '@/lib/auth/session'
import { tieneRol, LEGAJO_ESCRITURA } from '@/lib/auth/roles'
import LegajoClient from './LegajoClient'

export default async function LegajoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  // Todo en UN solo batch: ninguna query depende del fetch del empleado
  // (certificados filtra por empleado_id directo). notFound() se decide después.
  const [{ data: empleado }, { data: certificados }, { data: tiposCert }, { data: empresas }, sesion, { data: recibos }] = await Promise.all([
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
  ])

  if (!empleado) notFound()

  return (
    <LegajoClient
      empleado={empleado}
      certificados={certificados ?? []}
      tiposCertificado={tiposCert ?? []}
      empresas={empresas ?? []}
      recibos={recibos ?? []}
      isAdmin={sesion?.rol === 'admin'}
      canEdit={tieneRol(sesion?.rol ?? null, LEGAJO_ESCRITURA)}
    />
  )
}
