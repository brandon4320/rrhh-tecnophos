import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getSesion } from '@/lib/auth/session'
import { tieneRol, RRHH_ROLES } from '@/lib/auth/roles'
import { filtroEmpresas } from '@/lib/empresas-vistas'
import { hayCanalMail, urlApp } from '@/lib/mail'
import { candidatosOnboarding } from '@/modules/recibos/onboarding-servidor'
import FirmasClient from './FirmasClient'

export const dynamic = 'force-dynamic'

/**
 * Firmas de recibos: quién dejó la firma cargada, a quién ya se le mandó el
 * mail de onboarding y a quién le falta.
 *
 * El permiso es `perfiles.ve_recibos` (migración 23) y lo aplica la RLS: sin
 * él, `firmas_empleado` y `recibo_mails` no devuelven una sola fila. El guard
 * de acá solo evita que la pantalla aparezca vacía y sin explicación —espeja
 * la policy, no la reemplaza (AGENTS.md §5).
 */
export default async function FirmasPage({ searchParams }: { searchParams: Promise<{ empresa?: string }> }) {
  const { empresa } = await searchParams
  const sesion = await getSesion()
  if (!sesion || !tieneRol(sesion.rol, RRHH_ROLES) || !sesion.veRecibos) redirect('/')

  const supabase = await createClient()
  const { data: empresas } = await supabase.from('empresas').select('slug').order('nombre')
  const slugs = (empresas ?? []).map((e) => e.slug)
  const filtro = filtroEmpresas(empresa, slugs)

  const lista = await candidatosOnboarding(supabase)
  if (lista.error) throw new Error(lista.error.message)

  const candidatos = filtro ? lista.data.filter((c) => filtro.includes(c.empresaSlug)) : lista.data

  return (
    <FirmasClient
      candidatos={candidatos}
      // Si falta la casilla o la dirección pública, la pantalla lo dice ANTES
      // de que alguien apriete Enviar y se coma un 503 por cada tanda.
      canal={hayCanalMail() && Boolean(urlApp())}
    />
  )
}
