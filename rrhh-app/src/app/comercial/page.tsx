import { requireModulo } from '@/lib/auth/session'
import { WorkspaceTabs } from '@/components/comercial/workspace/WorkspaceTabs'
import { VistaHoy } from '@/components/comercial/workspace/VistaHoy'
import { VistaPorProyecto } from '@/components/comercial/workspace/VistaPorProyecto'
import { LayoutGrid } from 'lucide-react'
import Link from 'next/link'

export default async function ComercialHome({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sesion = await requireModulo('comercial')
  const sp = await searchParams
  const vista = sp.vista ?? 'hoy'

  return (
    <div className="space-y-5">
      <WorkspaceTabs vista={vista} />

      {vista === 'hoy' && <VistaHoy sesion={sesion} />}
      {vista === 'proyectos' && <VistaPorProyecto sesion={sesion} />}
      {vista === 'tablero' && (
        <div className="rounded-xl border border-dashed border-border px-6 py-12 text-center">
          <LayoutGrid className="mx-auto size-10 text-muted-foreground/40" strokeWidth={1.25} />
          <p className="mt-3 text-sm text-muted-foreground">El tablero Kanban llega en la próxima actualización.</p>
          <Link href="/comercial/proyectos" className="mt-2 inline-flex text-sm text-primary hover:underline">Ver proyectos →</Link>
        </div>
      )}
    </div>
  )
}
