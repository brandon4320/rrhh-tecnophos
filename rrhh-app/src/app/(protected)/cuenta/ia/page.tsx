import { requireSesion } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'
import { fmtFechaHoraAR } from '@/lib/fechas-ar'
import { ClavesIa } from './ClavesIa'

/**
 * Conectar una IA (Grok, Claude, ChatGPT…) al MCP de Gestión de Recursos: la dirección y las claves
 * propias. La IA trabaja como quien creó la clave (solo lectura, solo sus empresas).
 */
export default async function ConectarIaPage() {
  await requireSesion()
  const supabase = await createClient()
  const { data } = await supabase
    .from('claves_ia')
    .select('id, nombre, prefijo, created_at, ultimo_uso_at')
    .is('revocada_at', null)
    .order('created_at', { ascending: false })

  return (
    <div className="max-w-3xl space-y-4 px-4 pt-2 pb-8 md:px-7 md:pt-5 md:pb-8">
      <h1 className="text-2xl leading-tight font-medium tracking-[-0.025em]">Conectar una IA</h1>
      <ClavesIa
        claves={(data ?? []).map((c) => ({
          id: c.id,
          nombre: c.nombre,
          prefijo: c.prefijo,
          creada: fmtFechaHoraAR(c.created_at),
          ultimoUso: c.ultimo_uso_at ? fmtFechaHoraAR(c.ultimo_uso_at) : null,
        }))}
      />
    </div>
  )
}
