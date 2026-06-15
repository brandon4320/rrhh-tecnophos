import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { requireModulo } from '@/lib/auth/session'

export default async function OperacionesLayout({
  children,
}: {
  children: React.ReactNode
}) {
  await requireModulo('limpieza')

  return (
    <div className="min-h-[100dvh] bg-background">
      <header className="border-b bg-card">
        <div className="mx-auto flex h-16 max-w-5xl items-center gap-4 px-4 sm:px-6">
          <Link
            href="/"
            className="flex shrink-0 items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="size-4" />
            Inicio
          </Link>
          <div className="h-6 w-px bg-border" />
          <div className="min-w-0">
            <p className="font-semibold leading-tight">Operaciones</p>
            <p className="truncate text-xs text-muted-foreground">Contrato UNIPAR · Bahía Blanca</p>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">{children}</main>
    </div>
  )
}
