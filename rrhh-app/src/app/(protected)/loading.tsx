import { Skeleton } from '@/components/ui/skeleton'

// Fallback genérico del módulo RRHH: cubre toda ruta sin loading.tsx propio
// (/empleados, /legajo/[id], /vencimientos, /documentos, /stock, /admin/*).
// Sin esto, cada navegación espera el payload completo con la pantalla congelada.
export default function Loading() {
  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6 lg:p-8">
      <div className="space-y-2">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-4 w-72" />
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="rounded-2xl border border-border bg-card p-5">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="mt-4 h-8 w-16" />
          </div>
        ))}
      </div>
      <div className="rounded-2xl border border-border bg-card p-5 sm:p-6">
        <Skeleton className="h-5 w-40" />
        <div className="mt-4 space-y-2">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-14 w-full rounded-xl" />
          ))}
        </div>
      </div>
    </div>
  )
}
