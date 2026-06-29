import { requireModulo } from '@/lib/auth/session'
import { crearViaje } from '@/modules/comercial/actions'
import { redirect } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import Link from 'next/link'

export default async function NuevoViajePage() {
  const sesion = await requireModulo('comercial')

  async function action(form: FormData) {
    'use server'
    const res = await crearViaje(form)
    if (!res.error) redirect('/comercial/viajes')
  }

  return (
    <div className="max-w-xl space-y-6">
      <div>
        <Link href="/comercial/viajes" className="text-xs text-muted-foreground hover:text-foreground">← Volver a viajes</Link>
        <h1 className="mt-2 text-xl font-semibold">Nuevo viaje comercial</h1>
      </div>

      <form action={action} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="titulo">Título *</Label>
            <Input id="titulo" name="titulo" required placeholder="Ej: Visita clientes São Paulo · Junio 2026" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pais">País</Label>
            <Input id="pais" name="pais" placeholder="Brasil, Chile…" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ciudad">Ciudad</Label>
            <Input id="ciudad" name="ciudad" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="fecha_inicio">Fecha de salida</Label>
            <Input id="fecha_inicio" name="fecha_inicio" type="date" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="fecha_fin">Fecha de regreso</Label>
            <Input id="fecha_fin" name="fecha_fin" type="date" />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="motivo">Motivo / Objetivo</Label>
            <textarea id="motivo" name="motivo" rows={2} className="flex min-h-[52px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="costo_estimado">Costo estimado</Label>
            <div className="flex gap-2">
              <select name="moneda" defaultValue="ARS" className="h-9 rounded-md border border-input bg-transparent px-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring w-20">
                <option value="ARS">ARS</option>
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
              </select>
              <Input id="costo_estimado" name="costo_estimado" type="number" min="0" step="0.01" placeholder="0.00" />
            </div>
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="notas">Notas</Label>
            <textarea id="notas" name="notas" rows={2} className="flex min-h-[52px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none" />
          </div>
        </div>
        <div className="flex gap-3 pt-2">
          <Button type="submit">Registrar viaje</Button>
          <Link href="/comercial/viajes"><Button variant="outline" type="button">Cancelar</Button></Link>
        </div>
      </form>
    </div>
  )
}
