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

  const { data: empresas } = await supabase
    .from('empresas')
    .select('*')
    .order('nombre')

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      <Sidebar empresas={empresas ?? []} perfil={perfil} user={user} />
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  )
}
