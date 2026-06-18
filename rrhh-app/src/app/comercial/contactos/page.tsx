import { requireModulo } from '@/lib/auth/session'
import { listarContactos } from '@/modules/comercial/queries'
import Link from 'next/link'
import { EstadoBadge } from '@/components/comercial/EstadoBadge'
import { EmptyState } from '@/components/comercial/EmptyState'
import { Button } from '@/components/ui/button'
import { Users, Plus } from 'lucide-react'

export default async function ContactosPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sesion = await requireModulo('comercial')
  const sp = await searchParams
  const contactos = await listarContactos(sesion, { cliente_id: sp.cliente_id, pais: sp.pais, idioma: sp.idioma })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Contactos</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">{contactos.length} contactos</p>
        </div>
        <Link href="/comercial/contactos/nuevo">
          <Button size="sm" className="gap-1.5"><Plus className="size-4" />Nuevo contacto</Button>
        </Link>
      </div>

      {contactos.length === 0 ? (
        <EmptyState icon={Users} title="Sin contactos" description="Aún no hay contactos cargados."
          action={<Link href="/comercial/contactos/nuevo"><Button size="sm">Agregar contacto</Button></Link>} />
      ) : (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Nombre</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Cargo</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Email / WhatsApp</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">País / Idioma</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Estado</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {contactos.map((c) => (
                  <tr key={c.id} className="hover:bg-accent/50 transition-colors">
                    <td className="px-5 py-3.5">
                      <p className="font-medium text-foreground">{c.nombre} {c.apellido}</p>
                      {c.es_contacto_principal && <span className="text-xs text-primary">Principal</span>}
                    </td>
                    <td className="px-4 py-3.5 text-muted-foreground">{c.cargo || '—'}{c.area ? ` · ${c.area}` : ''}</td>
                    <td className="px-4 py-3.5 text-muted-foreground">
                      {c.email && <p className="text-xs">{c.email}</p>}
                      {c.telefono && <p className="text-xs">{c.telefono}</p>}
                    </td>
                    <td className="px-4 py-3.5 text-muted-foreground">{[c.pais, c.idioma].filter(Boolean).join(' · ') || '—'}</td>
                    <td className="px-4 py-3.5"><EstadoBadge estado={c.estado} /></td>
                    <td className="px-4 py-3.5 text-right">
                      <Link href={`/comercial/clientes/${c.cliente_id}`} className="text-xs font-medium text-primary hover:underline">Ver cliente →</Link>
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
