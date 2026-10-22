'use client'

// Filtros del Historial: quién, qué y qué acción, más la búsqueda por nombre del registro. Todo en
// la URL (lo lee el server); la búsqueda espera a que se deje de tipear.
import { useEffect, useRef, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Search } from 'lucide-react'

const campo =
  'min-h-10 rounded-[10px] border border-input bg-card px-3 py-2 text-sm focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/15'

export function FiltrosHistorial({
  personas,
  grupos,
}: {
  personas: { id: string; nombre: string }[]
  grupos: { clave: string; etiqueta: string }[]
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [texto, setTexto] = useState(() => searchParams.get('q') ?? '')
  const espera = useRef<number | undefined>(undefined)
  useEffect(() => () => window.clearTimeout(espera.current), [])

  function poner(clave: string, valor: string) {
    const p = new URLSearchParams(searchParams.toString())
    p.delete('antes') // otro filtro: vuelve a la primera página
    if (valor) p.set(clave, valor)
    else p.delete(clave)
    const qs = p.toString()
    router.push(qs ? `${pathname}?${qs}` : pathname)
  }

  function buscar(v: string) {
    setTexto(v)
    window.clearTimeout(espera.current)
    espera.current = window.setTimeout(() => poner('q', v.trim()), 350)
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative min-w-[220px] flex-1 sm:max-w-xs">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" strokeWidth={1.75} aria-hidden />
        <input
          type="search"
          value={texto}
          onChange={(e) => buscar(e.target.value)}
          placeholder="Buscar empleado, patente, certificado…"
          aria-label="Buscar en el historial"
          className={`${campo} w-full pl-9`}
        />
      </div>
      <select value={searchParams.get('quien') ?? ''} onChange={(e) => poner('quien', e.target.value)} aria-label="Quién" className={campo}>
        <option value="">Todas las personas</option>
        {personas.map((p) => (
          <option key={p.id} value={p.id}>
            {p.nombre}
          </option>
        ))}
        <option value="sistema">Sistema</option>
      </select>
      <select value={searchParams.get('que') ?? ''} onChange={(e) => poner('que', e.target.value)} aria-label="Qué" className={campo}>
        <option value="">Todo</option>
        {grupos.map((g) => (
          <option key={g.clave} value={g.clave}>
            {g.etiqueta}
          </option>
        ))}
      </select>
      <select value={searchParams.get('accion') ?? ''} onChange={(e) => poner('accion', e.target.value)} aria-label="Acción" className={campo}>
        <option value="">Altas, cambios y bajas</option>
        <option value="alta">Altas</option>
        <option value="cambio">Cambios</option>
        <option value="baja">Bajas</option>
      </select>
    </div>
  )
}
