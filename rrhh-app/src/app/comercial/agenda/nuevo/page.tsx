import { requireModulo } from '@/lib/auth/session'
import { crearEvento } from '@/modules/comercial/actions'
import { listarClientes, listarProyectos } from '@/modules/comercial/queries'
import { redirect } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import Link from 'next/link'
import { TIPOS_EVENTO, TIPO_EVENTO_LABEL } from '@/modules/comercial/tipos'

export default async function NuevoEventoPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sesion = await requireModulo('comercial')
  const sp = await searchParams

  const [clientes, proyectos] = await Promise.all([
    listarClientes(sesion),
    listarProyectos(sesion, { estado: 'abierto' }),
  ])

  async function action(form: FormData) {
    'use server'
    const res = await crearEvento(form)
    if ('proyectoId' in res && res.proyectoId) redirect(`/comercial/proyectos/${res.proyectoId}`)
    else redirect('/comercial/agenda')
  }

  return (
    <div className="max-w-xl space-y-6">
      <div>
        <Link href="/comercial/agenda" className="text-xs text-muted-foreground hover:text-foreground">← Volver a agenda</Link>
        <h1 className="mt-2 text-xl font-semibold">Nuevo evento</h1>
      </div>

      <form action={action} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="titulo">Título *</Label>
            <Input id="titulo" name="titulo" required placeholder="Ej: Reunión de presentación" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="tipo">Tipo</Label>
            <select id="tipo" name="tipo" className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
              {TIPOS_EVENTO.map((t) => <option key={t} value={t}>{TIPO_EVENTO_LABEL[t]}</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="fecha_inicio">Fecha y hora *</Label>
            <Input id="fecha_inicio" name="fecha_inicio" type="datetime-local" required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="fecha_fin">Fin</Label>
            <Input id="fecha_fin" name="fecha_fin" type="datetime-local" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="proyecto_id">Proyecto</Label>
            <select id="proyecto_id" name="proyecto_id" defaultValue={sp.proyecto_id ?? ''} className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
              <option value="">Sin proyecto</option>
              {proyectos.map((p) => <option key={p.id} value={p.id}>{p.titulo}</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cliente_id">Cliente</Label>
            <select id="cliente_id" name="cliente_id" className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
              <option value="">Sin cliente</option>
              {clientes.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ubicacion">Ubicación</Label>
            <Input id="ubicacion" name="ubicacion" placeholder="Dirección o lugar" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="link_reunion">Link de reunión</Label>
            <Input id="link_reunion" name="link_reunion" placeholder="https://meet.google.com/…" />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="objetivo">Objetivo</Label>
            <textarea id="objetivo" name="objetivo" rows={2} placeholder="¿Qué queremos lograr en esta reunión?" className="flex min-h-[52px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none" />
          </div>
        </div>
        <div className="flex gap-3 pt-2">
          <Button type="submit">Crear evento</Button>
          <Link href="/comercial/agenda"><Button variant="outline" type="button">Cancelar</Button></Link>
        </div>
      </form>
    </div>
  )
}
