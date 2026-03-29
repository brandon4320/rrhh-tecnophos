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

  const { data: perfil } = await supabase
    .from('perfiles')
    .select('rol')
    .eq('id', user?.id ?? '')
    .single()

  const certs = await Promise.all(
    (certificados ?? []).map(async (cert) => {
      const archivosConUrl = await Promise.all(
        (cert.archivos ?? []).map(async (archivo: any) => {
          const { data } = await supabase.storage
            .from('certificados')
            .createSignedUrl(archivo.path, 3600)
          return { ...archivo, url: data?.signedUrl ?? null }
        })
      )
      return { ...cert, archivos: archivosConUrl }
    })
  )

  return (
    <LegajoClient
      empleado={empleado}
      certificados={certs}
      tiposCertificado={tiposCert ?? []}
      empresas={empresas ?? []}
      canManageEmployees={!!user}
      canManageCertificates={perfil?.rol === 'admin'}
    />
  )
}
