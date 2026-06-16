import { requireModulo } from '@/lib/auth/session'
import { OpsShell } from '@/components/operaciones/OpsShell'

export default async function OperacionesLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const sesion = await requireModulo('limpieza')
  return <OpsShell rol={sesion.rol}>{children}</OpsShell>
}
