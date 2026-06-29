import { requireModulo } from '@/lib/auth/session'
import { WorkspaceTabs } from '@/components/comercial/workspace/WorkspaceTabs'
import { VistaHoy } from '@/components/comercial/workspace/VistaHoy'
import { VistaPorProyecto } from '@/components/comercial/workspace/VistaPorProyecto'
import { VistaTablero } from '@/components/comercial/workspace/VistaTablero'

export default async function ComercialHome({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sesion = await requireModulo('comercial')
  const sp = await searchParams
  const vista = sp.vista ?? 'hoy'

  return (
    <div className="space-y-5">
      <WorkspaceTabs vista={vista} />

      {vista === 'hoy' && <VistaHoy sesion={sesion} />}
      {vista === 'proyectos' && <VistaPorProyecto sesion={sesion} />}
      {vista === 'tablero' && <VistaTablero sesion={sesion} tablero={sp.tablero ?? 'proyectos'} />}
    </div>
  )
}
