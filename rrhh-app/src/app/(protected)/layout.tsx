import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getSesion } from '@/lib/auth/session'
import { tieneRol, RRHH_ROLES } from '@/lib/auth/roles'
import AppShell, { type EmpresaNav } from '@/components/layout/AppShell'

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const sesion = await getSesion()
  if (!sesion) redirect('/login')

  // Acceso a RRHH solo para roles RRHH (admin/usuario). El resto (Operaciones/UNIPAR)
  // va a su módulo — no puede entrar a las pantallas de RRHH.
  if (!tieneRol(sesion.rol, RRHH_ROLES)) redirect('/')

  const supabase = await createClient()

  // Si el perfil tiene empresa_acceso, solo muestra esa empresa
  const empresasQuery = supabase.from('empresas').select('id, nombre, slug').order('nombre')
  if (sesion.empresaAcceso) empresasQuery.eq('id', sesion.empresaAcceso)

  const [{ data: empresas }, { data: empleados }] = await Promise.all([
    empresasQuery,
    supabase.from('empleados').select('empresa_id, sector').eq('activo', true),
  ])

  // Conteos por empresa y por sector para el panel lateral
  const nav: EmpresaNav[] = (empresas ?? []).map((e) => {
    const propios = (empleados ?? []).filter((emp) => emp.empresa_id === e.id)
    const porSector = new Map<string, number>()
    for (const emp of propios) {
      const s = emp.sector?.trim() || 'General'
      porSector.set(s, (porSector.get(s) ?? 0) + 1)
    }
    return {
      id: e.id,
      nombre: e.nombre,
      slug: e.slug,
      total: propios.length,
      sectores: [...porSector.entries()]
        .map(([nombre, count]) => ({ nombre, count }))
        .sort((a, b) => b.count - a.count),
    }
  })

  return (
    <AppShell
      empresas={nav}
      sesion={{ nombre: sesion.nombre, email: sesion.email, rol: sesion.rol }}
    >
      {children}
    </AppShell>
  )
}
