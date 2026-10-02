import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getSesion } from '@/lib/auth/session'
import { tieneRol, RRHH_ROLES } from '@/lib/auth/roles'
import AppShell, { type EmpresaNav } from '@/components/layout/AppShell'
import { puedeVerArcor } from '@/modules/arcor/acceso'

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()

  // Sesión y empresas en paralelo (1 solo round-trip serial). El scope por
  // empresa_acceso lo aplica la RLS, así que la query no depende de la sesión:
  // sin sesión o rol no-RRHH devuelve vacío y se redirige igual. El conteo de
  // empleados activos viene embebido (también filtrado por la RLS de empleados)
  // en vez de traer todas las filas para contarlas acá.
  const [sesion, { data: empresas }] = await Promise.all([
    getSesion(),
    supabase.from('empresas').select('id, nombre, slug, empleados(count)').eq('empleados.activo', true).order('nombre'),
  ])

  if (!sesion) redirect('/login')

  // Acceso a RRHH solo para roles RRHH (admin/usuario). El resto
  // va a su módulo — no puede entrar a las pantallas de RRHH.
  if (!tieneRol(sesion.rol, RRHH_ROLES)) redirect('/')

  // Empleados activos por empresa, para el selector del panel lateral.
  const nav: EmpresaNav[] = (empresas ?? []).map((e) => ({
    id: e.id,
    nombre: e.nombre,
    slug: e.slug,
    total: (e.empleados as { count: number }[] | null)?.[0]?.count ?? 0,
  }))

  return (
    <AppShell
      empresas={nav}
      arcor={puedeVerArcor(sesion)}
      sesion={{ nombre: sesion.nombre, email: sesion.email, rol: sesion.rol }}
    >
      {children}
    </AppShell>
  )
}
