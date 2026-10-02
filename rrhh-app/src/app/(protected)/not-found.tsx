import Link from 'next/link'
import { SearchX } from 'lucide-react'

/** 404 dentro de RRHH: con la barra lateral y en castellano (legajo o vehículo borrado, link viejo). */
export default function ProtectedNotFound() {
  return (
    <div className="mx-auto max-w-6xl p-4 sm:p-6 lg:p-8">
      <div className="rounded-2xl border border-dashed border-border bg-card px-6 py-12 text-center">
        <SearchX className="mx-auto size-8 text-muted-foreground" strokeWidth={1.75} />
        <p className="mt-3 font-medium">No encontramos lo que buscabas</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Puede que se haya dado de baja, que el link sea viejo o que no tengas acceso a esa empresa.
        </p>
        <Link href="/dashboard" className="mt-5 inline-flex rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90">
          Ir al resumen
        </Link>
      </div>
    </div>
  )
}
