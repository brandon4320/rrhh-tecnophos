import { requireModulo } from '@/lib/auth/session'
import { ComercialShell } from '@/components/comercial/ComercialShell'

export default async function ComercialLayout({ children }: { children: React.ReactNode }) {
  const sesion = await requireModulo('comercial')
  return <ComercialShell rol={sesion.rol}>{children}</ComercialShell>
}
