import { Skeleton } from '@/components/ui/skeleton'

// El Inicio en fantasma (skill §1c.6): la misma grilla que la pantalla, sin saltos al llegar.
export default function Loading() {
  return (
    <div className="flex flex-col gap-5 px-4 pt-2 pb-20 md:gap-6 md:px-7 md:pt-5 md:pb-8" aria-busy="true" aria-label="Cargando el Inicio">
      <div className="space-y-2">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-9 w-80" />
        <Skeleton className="h-4 w-64" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 md:gap-[14px] xl:grid-cols-[1.25fr_repeat(3,minmax(0,1fr))]">
        <Skeleton className="h-[176px] rounded-2xl" />
        {[0, 1, 2].map((i) => <Skeleton key={i} className="h-[176px] rounded-2xl" />)}
      </div>
      <div className="grid items-start gap-[14px] xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="rounded-2xl border border-border bg-card p-5">
          <Skeleton className="h-6 w-40" />
          <div className="mt-4 space-y-2">{[0, 1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-12 w-full rounded-xl" />)}</div>
        </div>
        <div className="rounded-2xl border border-border bg-card p-5">
          <Skeleton className="h-6 w-32" />
          <div className="mt-4 space-y-2">{[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-12 w-full rounded-xl" />)}</div>
        </div>
      </div>
    </div>
  )
}
