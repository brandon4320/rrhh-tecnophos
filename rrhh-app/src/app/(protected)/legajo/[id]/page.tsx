import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import LegajoClient from './LegajoClient'

export default async function LegajoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const { data: empleado } = await supabase
    .from('empleados')
    .select('*, empresa:empresas(*)')
    .eq('id', id)
    .single()

  if (!empleado) notFound()

  const { data: certificados } = await supabase
    .from('certificados')
    .select(`
      *,
      tipo:tipos_certificado(nombre, orden),
      archivos(*)
    `)
    .eq('empleado_id', id)
    .order('fecha_vencimiento', { ascending: true })

  const { data: tiposCert } = await supabase
    .from('tipos_certificado')
    .select('*')
    .eq('aplica_personal', true)
    .order('orden')

  const { data: empresas } = await supabase
    .from('empresas')
    .select('*')
    .order('nombre')

  const {
    data: { user },
  } = await supabase.auth.getUser()

  return (
    <LegajoClient
      empleado={empleado}
      certificados={certificados ?? []}
      tiposCertificado={tiposCert ?? []}
      empresas={empresas ?? []}
      canManageEmployees={!!user}
      canManageCertificates={!!user}
    />
  )
}
