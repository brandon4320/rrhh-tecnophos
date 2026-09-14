import { Skeleton } from '@/components/ui/skeleton'

// Skeleton fiel al Resumen por empresa (hero oscuro + 4 KPIs + grid 1fr/340px):
// se re-muestra al cambiar el slug, que es la navegación empresa→empresa.
export default function Loading() {
  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6 lg:p-8">
      {/* Hero */}
      <section className="rounded-2xl bg-surface-dark p-6 sm:p-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-3">
            <div className="h-9 w-64 animate-pulse rounded-lg bg-white/10" />
            <div className="h-4 w-44 animate-pulse rounded bg-white/10" />
            <div className="h-6 w-40 animate-pulse rounded-full bg-white/10" />
          </div>
          <div className="space-y-2 lg:border-l lg:border-white/10 lg:pl-8">
            <div className="h-4 w-36 animate-pulse rounded bg-white/10" />
            <div className="h-8 w-40 animate-pulse rounded-lg bg-white/10" />
          </div>
        </div>
      </section>

      {/* KPIs */}
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="rounded-2xl border border-border bg-card p-5">
            <div className="flex items-center gap-2.5">
              <Skeleton className="size-9 rounded-xl" />
              <Skeleton className="h-4 w-20" />
            </div>
            <Skeleton className="mt-3 h-8 w-14" />
          </div>
        ))}
      </section>

      {/* Atención + columna derecha */}
      <section className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="rounded-2xl border border-border bg-card p-5 sm:p-6">
          <Skeleton className="h-6 w-44" />
          <Skeleton className="mt-1 h-4 w-32" />
          <Skeleton className="mt-4 h-9 w-64 rounded-xl" />
          <div className="mt-4 space-y-2">
            {[0, 1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-[74px] w-full rounded-xl" />
            ))}
          </div>
        </div>
        <div className="space-y-6">
          <div className="rounded-2xl border border-border bg-card p-5 sm:p-6">
            <Skeleton className="h-6 w-36" />
            <div className="mt-4 flex items-center gap-5">
              <Skeleton className="size-24 rounded-full" />
              <div className="space-y-2">
                <Skeleton className="h-8 w-12" />
                <Skeleton className="h-4 w-28" />
              </div>
            </div>
          </div>
          <div className="rounded-2xl border border-border bg-card p-5 sm:p-6">
            <Skeleton className="h-6 w-40" />
            <div className="mt-4 space-y-2">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-14 w-full rounded-xl" />
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
