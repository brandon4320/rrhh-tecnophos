import { requireModulo } from '@/lib/auth/session'
import { tieneRol, COMERCIAL_GESTION } from '@/lib/auth/roles'
import { WorkspaceTabs } from '@/components/comercial/workspace/WorkspaceTabs'
import { VistaHoy } from '@/components/comercial/workspace/VistaHoy'
import { VistaPorProyecto } from '@/components/comercial/workspace/VistaPorProyecto'
import { VistaPorComercial } from '@/components/comercial/workspace/VistaPorComercial'
import { VistaTablero } from '@/components/comercial/workspace/VistaTablero'

export default async function ComercialHome({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sesion = await requireModulo('comercial')
  const sp = await searchParams
  const esGestion = tieneRol(sesion.rol, COMERCIAL_GESTION)
  let vista = sp.vista ?? 'hoy'
  if (vista === 'comercial' && !esGestion) vista = 'hoy' // solo gestión ve "Por comercial"

  return (
    <div className="space-y-5">
      <WorkspaceTabs vista={vista} esGestion={esGestion} />

      {vista === 'hoy' && <VistaHoy sesion={sesion} />}
      {vista === 'proyectos' && <VistaPorProyecto sesion={sesion} />}
      {vista === 'comercial' && <VistaPorComercial sesion={sesion} />}
      {vista === 'tablero' && <VistaTablero sesion={sesion} tablero={sp.tablero ?? 'proyectos'} />}
    </div>
  )
}
