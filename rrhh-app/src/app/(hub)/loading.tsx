import { Skeleton } from '@/components/ui/skeleton'

// Inicio (hub), en su propio grupo para no envolver /login ni el QR público: sin esto, "Inicio" desde la barra lateral congelaba la pantalla
// hasta tener la sesión y las empresas.
export default function Loading() {
  return (
    <div className="min-h-[100dvh] bg-background">
      <div className="h-16 border-b bg-card" />
      <div className="mx-auto max-w-5xl space-y-6 px-4 py-8 sm:px-6">
        <Skeleton className="h-8 w-56" />
        <div className="grid gap-4 md:grid-cols-2">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="rounded-2xl border border-border bg-card p-5">
              <Skeleton className="h-5 w-40" />
              <div className="mt-4 space-y-2">
                <Skeleton className="h-10 w-full rounded-lg" />
                <Skeleton className="h-10 w-full rounded-lg" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
