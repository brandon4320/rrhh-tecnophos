import { requireModulo } from '@/lib/auth/session'
import { listarClientes } from '@/modules/comercial/queries'
import { tieneRol, COMERCIAL_GESTION } from '@/lib/auth/roles'
import Link from 'next/link'
import { EstadoBadge } from '@/components/comercial/EstadoBadge'
import { PriorityBadge } from '@/components/comercial/PriorityBadge'
import { EmptyState } from '@/components/comercial/EmptyState'
import { Building2, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

export default async function ClientesPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sesion = await requireModulo('comercial')
  const sp = await searchParams
  const clientes = await listarClientes(sesion, { estado: sp.estado, prioridad: sp.prioridad })
  const esGestion = tieneRol(sesion.rol, COMERCIAL_GESTION)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Clientes</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">{clientes.length} {clientes.length === 1 ? 'cliente' : 'clientes'}</p>
        </div>
        <Link href="/comercial/clientes/nuevo">
          <Button size="sm" className="gap-1.5"><Plus className="size-4" />Nuevo cliente</Button>
        </Link>
      </div>

      {/* Filtros rápidos */}
      <div className="flex flex-wrap gap-2">
        {['prospecto', 'activo', 'inactivo', 'perdido'].map((estado) => (
          <Link key={estado} href={sp.estado === estado ? '/comercial/clientes' : `/comercial/clientes?estado=${estado}`}
            className={`rounded-md border px-3 py-1.5 text-xs font-medium transition-colors ${sp.estado === estado ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:bg-accent'}`}>
            {estado.charAt(0).toUpperCase() + estado.slice(1)}
          </Link>
        ))}
      </div>

      {clientes.length === 0 ? (
        <EmptyState icon={Building2} title="Sin clientes" description="Aún no hay clientes cargados."
          action={<Link href="/comercial/clientes/nuevo"><Button size="sm">Crear primer cliente</Button></Link>} />
      ) : (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Cliente</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">País / Ciudad</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Rubro</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Estado</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Prioridad</th>
                  {esGestion && <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Actualización</th>}
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {clientes.map((c) => (
                  <tr key={c.id} className="hover:bg-accent/50 transition-colors">
                    <td className="px-5 py-3.5">
                      <p className="font-medium text-foreground">{c.nombre}</p>
                      {c.razon_social && <p className="text-xs text-muted-foreground">{c.razon_social}</p>}
                    </td>
                    <td className="px-4 py-3.5 text-muted-foreground">
                      {[c.pais, c.ciudad].filter(Boolean).join(' · ') || '—'}
                    </td>
                    <td className="px-4 py-3.5 text-muted-foreground">{c.rubro || '—'}</td>
                    <td className="px-4 py-3.5"><EstadoBadge estado={c.estado} /></td>
                    <td className="px-4 py-3.5"><PriorityBadge prioridad={c.prioridad} /></td>
                    {esGestion && (
                      <td className="px-4 py-3.5 text-xs text-muted-foreground">
                        {c.updated_at ? format(new Date(c.updated_at), 'd MMM', { locale: es }) : '—'}
                      </td>
                    )}
                    <td className="px-4 py-3.5 text-right">
                      <Link href={`/comercial/clientes/${c.id}`} className="text-xs font-medium text-primary hover:underline">Ver →</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
