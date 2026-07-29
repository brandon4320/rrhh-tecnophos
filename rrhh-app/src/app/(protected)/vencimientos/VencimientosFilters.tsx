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
    <div className="mb-6 flex flex-wrap items-center gap-2">
      <div className="inline-flex items-center gap-1 rounded-xl bg-muted p-1">
        {[
          { value: '', label: 'Todos' },
          { value: 'vencido', label: 'Vencidos' },
          { value: 'proximo', label: 'Por vencer' },
          { value: 'vigente', label: 'Vigentes' },
        ].map((opt) => (
          <Link
            key={opt.value}
            href={buildUrl({ estado: opt.value || undefined })}
            className={`rounded-lg px-3.5 py-1.5 text-sm font-medium transition-colors ${
              (estado ?? '') === opt.value
                ? 'bg-card text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {opt.label}
          </Link>
        ))}
      </div>

      <select
        value={empresa ?? ''}
        onChange={(e) => handleEmpresaChange(e.target.value)}
        className="rounded-xl border border-border bg-card px-3.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
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
        className="max-w-[240px] rounded-xl border border-border bg-card px-3.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
      >
        <option value="">Todos los certificados</option>
        {tipos.map((tipoItem) => (
          <option key={tipoItem.id} value={tipoItem.id}>
            {tipoItem.nombre}
          </option>
        ))}
      </select>

      {(empresa || tipo || estado) && (
        <Link href={pathname} className="px-2 text-sm text-muted-foreground transition-colors hover:text-foreground">
          Limpiar
        </Link>
      )}
    </div>
  )
}
