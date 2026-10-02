import { Skeleton } from '@/components/ui/skeleton'

// Comercial es mobile-first: sin un loading por segmento, cada toque en la
// barra inferior o en un detalle dejaba la pantalla quieta hasta tener todo.
export default function Loading() {
  return (
    <div className="space-y-5">
      <div className="flex gap-2">
        {[0, 1, 2].map((i) => <Skeleton key={i} className="h-9 w-24 rounded-full" />)}
      </div>
      <Skeleton className="h-7 w-48" />
      <div className="space-y-2">
        {[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}
      </div>
    </div>
  )
}
