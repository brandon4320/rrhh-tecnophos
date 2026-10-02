import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getSesion } from '@/lib/auth/session'
import { tieneRol, RRHH_ROLES } from '@/lib/auth/roles'
import AppShell, { type EmpresaNav } from '@/components/layout/AppShell'
import { puedeVerArcor } from '@/modules/arcor/acceso'

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()

  // Las 3 lecturas en paralelo (1 solo round-trip serial). El scope por
  // empresa_acceso lo aplica la RLS (empresas_rrhh_select / empleados_rrhh_all
  // usan app_ve_empresa — migración 02), así que las queries no dependen de
  // la sesión: sin sesión o rol no-RRHH devuelven vacío y se redirige igual.
  const [sesion, { data: empresas }, { data: empleados }] = await Promise.all([
    getSesion(),
    supabase.from('empresas').select('id, nombre, slug').order('nombre'),
    supabase.from('empleados').select('empresa_id').eq('activo', true),
  ])

  if (!sesion) redirect('/login')

  // Acceso a RRHH solo para roles RRHH (admin/usuario). El resto
  // va a su módulo — no puede entrar a las pantallas de RRHH.
  if (!tieneRol(sesion.rol, RRHH_ROLES)) redirect('/')

  // Empleados activos por empresa, para el selector del panel lateral.
  const porEmpresa = new Map<string, number>()
  for (const emp of empleados ?? []) {
    if (emp.empresa_id) porEmpresa.set(emp.empresa_id, (porEmpresa.get(emp.empresa_id) ?? 0) + 1)
  }
  const nav: EmpresaNav[] = (empresas ?? []).map((e) => ({
    id: e.id,
    nombre: e.nombre,
    slug: e.slug,
    total: porEmpresa.get(e.id) ?? 0,
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
