import { requireModulo } from '@/lib/auth/session'
import { crearProyecto } from '@/modules/comercial/actions'
import { listarClientes, listarVendedores } from '@/modules/comercial/queries'
import { tieneRol, COMERCIAL_GESTION } from '@/lib/auth/roles'
import { redirect } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import Link from 'next/link'
import { ETAPA_LABEL, ETAPAS_PROYECTO, PRIORIDADES, PRIORIDAD_LABEL } from '@/modules/comercial/tipos'

export default async function NuevoProyectoPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sesion = await requireModulo('comercial')
  const sp = await searchParams
  const esGestion = tieneRol(sesion.rol, COMERCIAL_GESTION)

  const [clientes, vendedores] = await Promise.all([
    listarClientes(sesion),
    esGestion ? listarVendedores() : [],
  ])

  async function action(form: FormData) {
    'use server'
    const res = await crearProyecto(form)
    if ('proyectoId' in res && res.proyectoId) redirect(`/comercial/proyectos/${res.proyectoId}`)
    else redirect('/comercial/proyectos')
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <Link href="/comercial/proyectos" className="text-xs text-muted-foreground hover:text-foreground">← Volver a proyectos</Link>
        <h1 className="mt-2 text-xl font-semibold">Nuevo proyecto</h1>
      </div>

      <form action={action} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="titulo">Título *</Label>
            <Input id="titulo" name="titulo" required placeholder="Ej: Proyecto de expansión UNIPAR 2026" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cliente_id">Cliente</Label>
            <select id="cliente_id" name="cliente_id" defaultValue={sp.cliente_id ?? ''} className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
              <option value="">Sin cliente asociado</option>
              {clientes.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="etapa">Etapa inicial</Label>
            <select id="etapa" name="etapa" className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
              {ETAPAS_PROYECTO.filter((e) => !['ganado','perdido'].includes(e)).map((e) => <option key={e} value={e}>{ETAPA_LABEL[e]}</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="prioridad">Prioridad</Label>
            <select id="prioridad" name="prioridad" className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
              {PRIORIDADES.map((p) => <option key={p} value={p}>{PRIORIDAD_LABEL[p]}</option>)}
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
            <Label htmlFor="tipo_proyecto">Tipo</Label>
            <select id="tipo_proyecto" name="tipo_proyecto" className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
              <option value="">Seleccionar…</option>
              <option value="servicio">Servicio</option>
              <option value="producto">Producto</option>
              <option value="consultoria">Consultoría</option>
              <option value="licitacion">Licitación</option>
              <option value="otro">Otro</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="valor_estimado">Valor estimado</Label>
            <div className="flex gap-2">
              <select name="moneda" defaultValue="ARS" className="h-9 rounded-md border border-input bg-transparent px-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring w-20">
                <option value="ARS">ARS</option>
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
                <option value="BRL">BRL</option>
              </select>
              <Input id="valor_estimado" name="valor_estimado" type="number" min="0" step="0.01" placeholder="0.00" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="fecha_estimada_cierre">Cierre estimado</Label>
            <Input id="fecha_estimada_cierre" name="fecha_estimada_cierre" type="date" />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="proxima_accion">Próxima acción</Label>
            <div className="flex gap-2">
              <Input id="proxima_accion" name="proxima_accion" placeholder="Qué hay que hacer…" className="flex-1" />
              <Input name="proxima_accion_fecha" type="date" className="w-40" />
            </div>
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="descripcion">Descripción</Label>
            <textarea id="descripcion" name="descripcion" rows={3} placeholder="Contexto del proyecto…" className="flex min-h-[72px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none" />
          </div>
        </div>

        <div className="flex gap-3 pt-2">
          <Button type="submit">Crear proyecto</Button>
          <Link href="/comercial/proyectos"><Button variant="outline" type="button">Cancelar</Button></Link>
        </div>
      </form>
    </div>
  )
}
