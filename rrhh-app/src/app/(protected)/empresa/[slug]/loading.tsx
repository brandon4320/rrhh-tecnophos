import { Skeleton } from '@/components/ui/skeleton'

// Skeleton fiel al Resumen por empresa (hero lavanda + 4 KPIs + grid 1fr/340px):
// se re-muestra al cambiar el slug, que es la navegación empresa→empresa.
export default function Loading() {
  return (
    <div className="space-y-4 px-4 pt-2 pb-8 md:px-7 md:pt-5 md:pb-8">
      {/* Hero */}
      <section className="rounded-2xl bg-zona px-5 py-4 sm:px-6 sm:py-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-3">
            <div className="h-9 w-64 animate-pulse rounded-lg bg-foreground/[0.06]" />
            <div className="h-4 w-44 animate-pulse rounded bg-foreground/[0.06]" />
            <div className="h-6 w-40 animate-pulse rounded-full bg-foreground/[0.06]" />
          </div>
          <div className="space-y-2 lg:border-l lg:border-border-strong lg:pl-8">
            <div className="h-4 w-36 animate-pulse rounded bg-foreground/[0.06]" />
            <div className="h-8 w-40 animate-pulse rounded-lg bg-foreground/[0.06]" />
          </div>
        </div>
      </section>

      {/* KPIs */}
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="flex items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3 shadow-tarjeta">
            <Skeleton className="size-9 rounded-xl" />
            <div className="space-y-1.5">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-7 w-12" />
            </div>
          </div>
        ))}
      </section>

      {/* Atención + columna derecha */}
      <section className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="rounded-2xl border border-border bg-card px-5 py-4 shadow-tarjeta">
          <Skeleton className="h-5 w-44" />
          <Skeleton className="mt-1 h-4 w-32" />
          <Skeleton className="mt-3 h-9 w-64 rounded-xl" />
          <div className="mt-3 space-y-2">
            {[0, 1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-14 w-full rounded-xl" />
            ))}
          </div>
        </div>
        <div className="space-y-4">
          <div className="rounded-2xl border border-border bg-card px-5 py-4 shadow-tarjeta">
            <Skeleton className="h-5 w-36" />
            <div className="mt-3 flex items-center gap-5">
              <Skeleton className="size-24 rounded-full" />
              <div className="space-y-2">
                <Skeleton className="h-8 w-12" />
                <Skeleton className="h-4 w-28" />
              </div>
            </div>
          </div>
          <div className="rounded-2xl border border-border bg-card px-5 py-4 shadow-tarjeta">
            <Skeleton className="h-5 w-40" />
            <div className="mt-3 space-y-2">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-11 w-full rounded-xl" />
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
