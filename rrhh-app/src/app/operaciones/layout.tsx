import { requireModulo } from '@/lib/auth/session'
import { OpsShell } from '@/components/operaciones/OpsShell'

export default async function OperacionesLayout({
  children,
}: {
  children: React.ReactNode
}) {
  await requireModulo('limpieza')
  return <OpsShell>{children}</OpsShell>
}
