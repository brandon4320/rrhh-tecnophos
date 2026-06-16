import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Sidebar from '@/components/layout/Sidebar'

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: perfil } = await supabase
    .from('perfiles')
    .select('*')
    .eq('id', user.id)
    .single()

  // Acceso a RRHH solo para roles RRHH (admin/usuario). El resto (Operaciones/UNIPAR)
  // va a su módulo — no puede entrar a las pantallas de RRHH.
  if (!['admin', 'usuario'].includes(perfil?.rol ?? '')) {
    redirect('/')
  }

  // Si el perfil tiene empresa_acceso, solo muestra esa empresa
  const empresasQuery = supabase.from('empresas').select('*').order('nombre')
  if (perfil?.empresa_acceso) {
    empresasQuery.eq('id', perfil.empresa_acceso)
  }
  const { data: empresas } = await empresasQuery

  return (
    <div className="flex h-dvh overflow-hidden bg-background">
      <Sidebar empresas={empresas ?? []} perfil={perfil} user={user} />
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  )
}
