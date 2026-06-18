import { requireModulo } from '@/lib/auth/session'
import { crearTarea } from '@/modules/comercial/actions'
import { listarClientes, listarProyectos, listarVendedores } from '@/modules/comercial/queries'
import { tieneRol, COMERCIAL_GESTION } from '@/lib/auth/roles'
import { redirect } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import Link from 'next/link'
import { TIPOS_TAREA, TIPO_TAREA_LABEL, PRIORIDADES, PRIORIDAD_LABEL } from '@/modules/comercial/tipos'

export default async function NuevaTareaPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sesion = await requireModulo('comercial')
  const sp = await searchParams
  const esGestion = tieneRol(sesion.rol, COMERCIAL_GESTION)

  const [clientes, proyectos, vendedores] = await Promise.all([
    listarClientes(sesion),
    listarProyectos(sesion, { estado: 'abierto' }),
    esGestion ? listarVendedores() : [],
  ])

  async function action(form: FormData) {
    'use server'
    const res = await crearTarea(form)
    if ('proyectoId' in res && res.proyectoId) redirect(`/comercial/proyectos/${res.proyectoId}`)
    else redirect('/comercial/tareas')
  }

  return (
    <div className="max-w-xl space-y-6">
      <div>
        <Link href="/comercial/tareas" className="text-xs text-muted-foreground hover:text-foreground">← Volver a tareas</Link>
        <h1 className="mt-2 text-xl font-semibold">Nueva tarea</h1>
      </div>

      <form action={action} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="titulo">Título *</Label>
            <Input id="titulo" name="titulo" required placeholder="¿Qué hay que hacer?" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="tipo">Tipo</Label>
            <select id="tipo" name="tipo" className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
              {TIPOS_TAREA.map((t) => <option key={t} value={t}>{TIPO_TAREA_LABEL[t]}</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="prioridad">Prioridad</Label>
            <select id="prioridad" name="prioridad" className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
              {PRIORIDADES.map((p) => <option key={p} value={p}>{PRIORIDAD_LABEL[p]}</option>)}
            </select>
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
            <select id="cliente_id" name="cliente_id" defaultValue={sp.cliente_id ?? ''} className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
              <option value="">Sin cliente</option>
              {clientes.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>
          </div>
          {esGestion && (
            <div className="space-y-1.5">
              <Label htmlFor="responsable_id">Responsable</Label>
              <select id="responsable_id" name="responsable_id" className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
                <option value={sesion.userId}>{sesion.nombre ?? 'Yo'}</option>
                {vendedores.filter((v) => v.id !== sesion.userId).map((v) => <option key={v.id} value={v.id}>{v.nombre}</option>)}
              </select>
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="fecha_vencimiento">Fecha vencimiento</Label>
            <Input id="fecha_vencimiento" name="fecha_vencimiento" type="datetime-local" />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="descripcion">Descripción</Label>
            <textarea id="descripcion" name="descripcion" rows={2} className="flex min-h-[52px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none" />
          </div>
        </div>
        <div className="flex gap-3 pt-2">
          <Button type="submit">Crear tarea</Button>
          <Link href="/comercial/tareas"><Button variant="outline" type="button">Cancelar</Button></Link>
        </div>
      </form>
    </div>
  )
}
