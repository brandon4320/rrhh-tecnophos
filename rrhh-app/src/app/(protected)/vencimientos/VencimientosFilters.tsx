'use client'

import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'

type Empresa = {
  id: string
  nombre: string
  slug: string
}

type TipoCertificado = {
  id: string
  nombre: string
}

type Props = {
  empresa?: string
  tipo?: string
  estado?: string
  empresas: Empresa[]
  tipos: TipoCertificado[]
}

export function VencimientosFilters({
  empresa,
  tipo,
  estado,
  empresas,
  tipos,
}: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const currentSearchParams = useSearchParams()

  const buildUrl = (params: Record<string, string | undefined>) => {
    const p = new URLSearchParams(currentSearchParams.toString())
    const merged = {
      empresa,
      tipo,
      estado,
      ...params,
    }

    Object.entries(merged).forEach(([key, value]) => {
      if (value) {
        p.set(key, value)
      } else {
        p.delete(key)
      }
    })

    const qs = p.toString()
    return `${pathname}${qs ? `?${qs}` : ''}`
  }

  const handleEmpresaChange = (value: string) => {
    router.push(buildUrl({ empresa: value || undefined }))
  }

  const handleTipoChange = (value: string) => {
    router.push(buildUrl({ tipo: value || undefined }))
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6 flex flex-wrap gap-3 items-center">
      <span className="text-sm font-medium text-gray-600 shrink-0">Filtrar por:</span>

      <div className="flex items-center gap-1.5">
        {[
          { value: '', label: 'Todos' },
          { value: 'vencido', label: 'Vencido' },
          { value: 'proximo', label: 'Por vencer' },
          { value: 'vigente', label: 'Vigente' },
        ].map((opt) => (
          <Link
            key={opt.value}
            href={buildUrl({ estado: opt.value || undefined })}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
              (estado ?? '') === opt.value
                ? 'bg-indigo-600 text-white border-indigo-600'
                : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
            }`}
          >
            {opt.label}
          </Link>
        ))}
      </div>

      <div className="h-4 w-px bg-gray-200" />

      <select
        value={empresa ?? ''}
        onChange={(e) => handleEmpresaChange(e.target.value)}
        className="px-3 py-1.5 rounded-lg border border-gray-200 text-xs text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
      >
        <option value="">Todas las empresas</option>
        {empresas.map((empresaItem) => (
          <option key={empresaItem.id} value={empresaItem.slug}>
            {empresaItem.nombre}
          </option>
        ))}
      </select>

      <select
        value={tipo ?? ''}
        onChange={(e) => handleTipoChange(e.target.value)}
        className="px-3 py-1.5 rounded-lg border border-gray-200 text-xs text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
      >
        <option value="">Todos los certificados</option>
        {tipos.map((tipoItem) => (
          <option key={tipoItem.id} value={tipoItem.id}>
            {tipoItem.nombre}
          </option>
        ))}
      </select>

      {(empresa || tipo || estado) && (
        <Link href={pathname} className="text-xs text-red-500 hover:underline ml-auto">
          Limpiar filtros
        </Link>
      )}
    </div>
  )
}
