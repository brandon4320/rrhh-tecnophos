import { requireModulo } from '@/lib/auth/session'
import { crearCliente } from '@/modules/comercial/actions'
import { redirect } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import Link from 'next/link'

export default async function NuevoClientePage() {
  await requireModulo('comercial')

  async function action(form: FormData) {
    'use server'
    const res = await crearCliente(form)
    if ('clienteId' in res && res.clienteId) redirect(`/comercial/clientes/${res.clienteId}`)
    else redirect('/comercial/clientes')
  }

  return (
    <div className="max-w-xl space-y-6">
      <div>
        <Link href="/comercial/clientes" className="text-xs text-muted-foreground hover:text-foreground">← Volver a clientes</Link>
        <h1 className="mt-2 text-xl font-semibold">Nuevo cliente</h1>
      </div>

      <form action={action} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="nombre">Nombre *</Label>
            <Input id="nombre" name="nombre" required placeholder="Nombre del cliente o empresa" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="razon_social">Razón social</Label>
            <Input id="razon_social" name="razon_social" placeholder="Nombre legal" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cuit_tax_id">CUIT / Tax ID</Label>
            <Input id="cuit_tax_id" name="cuit_tax_id" placeholder="XX-XXXXXXXX-X" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="rubro">Rubro / Industria</Label>
            <Input id="rubro" name="rubro" placeholder="Ej: Minería, Petroquímica…" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="tipo_cliente">Tipo de cliente</Label>
            <select id="tipo_cliente" name="tipo_cliente" className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
              <option value="">Seleccionar…</option>
              <option value="empresa">Empresa</option>
              <option value="distribuidor">Distribuidor</option>
              <option value="gobierno">Gobierno</option>
              <option value="otro">Otro</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pais">País</Label>
            <Input id="pais" name="pais" placeholder="Ej: Argentina, Brasil…" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="provincia_estado">Provincia / Estado</Label>
            <Input id="provincia_estado" name="provincia_estado" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ciudad">Ciudad</Label>
            <Input id="ciudad" name="ciudad" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="origen">Origen del lead</Label>
            <select id="origen" name="origen" className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
              <option value="">Seleccionar…</option>
              <option value="referido">Referido</option>
              <option value="web">Web / Digital</option>
              <option value="evento">Evento / Feria</option>
              <option value="outbound">Outbound</option>
              <option value="otro">Otro</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="estado">Estado</Label>
            <select id="estado" name="estado" className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
              <option value="prospecto">Prospecto</option>
              <option value="activo">Activo</option>
              <option value="inactivo">Inactivo</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="prioridad">Prioridad</Label>
            <select id="prioridad" name="prioridad" className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
              <option value="alta">Alta</option>
              <option value="media">Media</option>
              <option value="baja">Baja</option>
            </select>
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="notas">Notas</Label>
            <textarea id="notas" name="notas" rows={3} placeholder="Información adicional…" className="flex min-h-[72px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none" />
          </div>
        </div>

        <div className="flex gap-3 pt-2">
          <Button type="submit">Crear cliente</Button>
          <Link href="/comercial/clientes"><Button variant="outline" type="button">Cancelar</Button></Link>
        </div>
      </form>
    </div>
  )
}
