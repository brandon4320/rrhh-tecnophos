import { createClient } from '@/lib/supabase/server'

const PRIORIDAD_BADGE: Record<string, string> = {
  critica: 'bg-red-100 text-red-700 border-red-200',
  alta: 'bg-amber-100 text-amber-700 border-amber-200',
  media: 'bg-sky-100 text-sky-700 border-sky-200',
  baja: 'bg-gray-100 text-gray-600 border-gray-200',
}

const PRIORIDAD_ORDEN: Record<string, number> = { critica: 0, alta: 1, media: 2, baja: 3 }

// Próximos features del módulo (Etapa 1). Se activan en las siguientes tareas.
const PROXIMOS = [
  { titulo: 'Asistencia diaria', desc: 'Dotación, reemplazos y cierre del supervisor.' },
  { titulo: 'Asignación de tareas', desc: 'Distribución de operarios por área.' },
  { titulo: 'Reporte diario', desc: 'Reporte al supervisor UNIPAR + PDF.' },
]

export default async function OperacionesHome() {
  const supabase = await createClient()

  const [{ data: areas }, { count: dotacion }] = await Promise.all([
    supabase.from('limpieza_areas').select('*').eq('activo', true),
    supabase
      .from('limpieza_personal')
      .select('*', { count: 'exact', head: true })
      .eq('activo', true),
  ])

  const areasOrdenadas = (areas ?? []).sort(
    (a, b) => (PRIORIDAD_ORDEN[a.prioridad] ?? 9) - (PRIORIDAD_ORDEN[b.prioridad] ?? 9)
  )

  return (
    <div className="space-y-8">
      {/* Resumen */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Dotación</p>
          <p className="text-2xl font-semibold text-gray-900 mt-1">{dotacion ?? 0}</p>
          <p className="text-xs text-gray-400 mt-0.5">personas activas</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Áreas</p>
          <p className="text-2xl font-semibold text-gray-900 mt-1">{areasOrdenadas.length}</p>
          <p className="text-xs text-gray-400 mt-0.5">del pliego</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Mínimo contractual</p>
          <p className="text-2xl font-semibold text-gray-900 mt-1">13</p>
          <p className="text-xs text-gray-400 mt-0.5">operarios + 1 supervisor</p>
        </div>
      </div>

      {/* Áreas del servicio */}
      <section>
        <h2 className="text-sm font-semibold text-gray-800 mb-3">Áreas del servicio</h2>
        <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
          {areasOrdenadas.map((a) => (
            <div key={a.id} className="flex items-center justify-between px-5 py-3.5">
              <div className="min-w-0">
                <p className="font-medium text-gray-900 truncate">{a.nombre}</p>
                {a.frecuencia && <p className="text-xs text-gray-500 mt-0.5">{a.frecuencia}</p>}
              </div>
              <span
                className={`shrink-0 ml-3 text-xs font-medium px-2 py-0.5 rounded-full border capitalize ${
                  PRIORIDAD_BADGE[a.prioridad] ?? PRIORIDAD_BADGE.baja
                }`}
              >
                {a.prioridad}
              </span>
            </div>
          ))}
          {areasOrdenadas.length === 0 && (
            <div className="px-5 py-8 text-center text-sm text-gray-500">Sin áreas cargadas.</div>
          )}
        </div>
      </section>

      {/* Próximos features */}
      <section>
        <h2 className="text-sm font-semibold text-gray-800 mb-3">Gestión diaria</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          {PROXIMOS.map((p) => (
            <div
              key={p.titulo}
              className="bg-white rounded-xl border border-dashed border-gray-300 p-5"
            >
              <div className="flex items-center justify-between">
                <p className="font-medium text-gray-900">{p.titulo}</p>
                <span className="text-[10px] font-semibold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded">
                  PRÓXIMO
                </span>
              </div>
              <p className="text-xs text-gray-500 mt-1.5 leading-relaxed">{p.desc}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
