import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { tieneRol, LEGAJO_ESCRITURA } from '@/lib/auth/roles'
import LegajoClient from './LegajoClient'
import { cargarLegajo } from './datos'
import type { MovimientoEpp } from './EppEntregado'

export default async function LegajoPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ cert?: string; nuevo?: string; cargar?: string; renovar?: string }>
}) {
  const [{ id }, sp] = await Promise.all([params, searchParams])
  const supabase = await createClient()

  const { empleado, certificados, tiposCert, empresas, sesion, recibos, epp } = await cargarLegajo(supabase, id)

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
      abrirCarga={sp.cargar === '1'}
      renovarInicial={sp.renovar === '1'}
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
