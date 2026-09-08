import { redirect } from 'next/navigation'
import { requireSesion } from '@/lib/auth/session'
import { puedeVerArcor } from '@/modules/arcor/acceso'

/**
 * Guard de la sección Tecnophos - ARCOR. El layout de (protected) ya exige rol
 * RRHH; acá se exige además ver todas las empresas — espejo de la RLS de arcor_*.
 */
export default async function ArcorLayout({ children }: { children: React.ReactNode }) {
  const sesion = await requireSesion()
  if (!puedeVerArcor(sesion)) redirect('/dashboard')
  return <>{children}</>
}
