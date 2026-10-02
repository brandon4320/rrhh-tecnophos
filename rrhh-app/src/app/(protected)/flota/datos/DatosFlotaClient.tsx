'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { ArrowLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

interface Vehiculo {
  id: string; patente: string; descripcion: string | null
  marca: string | null; modelo: string | null; anio: number | null; empresa: string
}
type Fila = { marca: string; modelo: string; anio: string }

const MARCAS = ['Toyota', 'Ford', 'Volkswagen', 'Chevrolet', 'Fiat', 'Renault', 'Peugeot', 'Citroën', 'Nissan', 'Mercedes-Benz', 'Iveco', 'RAM']
const input = 'w-full rounded-lg border border-input bg-card px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-60'

/** Lo cargado en la descripción ("CITROEN - JUMPER") sirve de punto de partida si no hay marca ni modelo. */
function inicial(v: Vehiculo): Fila {
  const [m, ...resto] = !v.marca && !v.modelo && v.descripcion?.includes(' - ') ? v.descripcion.split(' - ') : []
  return {
    marca: v.marca ?? (m?.trim() || ''),
    modelo: v.modelo ?? (resto.join(' - ').trim() || ''),
    anio: v.anio?.toString() ?? '',
  }
}

export default function DatosFlotaClient({ vehiculos, volver, variasEmpresas }: { vehiculos: Vehiculo[]; volver: string; variasEmpresas: boolean }) {
  const router = useRouter()
  const supabase = createClient()
  const [filas, setFilas] = useState<Record<string, Fila>>(() => Object.fromEntries(vehiculos.map((v) => [v.id, inicial(v)])))
  const [saving, setSaving] = useState(false)

  const cambiadas = vehiculos.filter((v) => {
    const f = filas[v.id]
    return f.marca.trim() !== (v.marca ?? '') || f.modelo.trim() !== (v.modelo ?? '') || f.anio.trim() !== (v.anio?.toString() ?? '')
  })
  const set = (id: string, campo: keyof Fila, valor: string) => setFilas((p) => ({ ...p, [id]: { ...p[id], [campo]: valor } }))

  async function guardar(e: React.FormEvent) {
    e.preventDefault()
    const tope = new Date().getFullYear() + 1
    for (const v of cambiadas) {
      const a = filas[v.id].anio.trim()
      if (a && (!/^\d{4}$/.test(a) || Number(a) < 1980 || Number(a) > tope)) return toast.error(`El año de ${v.patente} no es válido.`)
    }
    setSaving(true)
    const resultados = await Promise.all(cambiadas.map((v) => {
      const f = filas[v.id]
      return supabase.from('vehiculos').update({
        marca: f.marca.trim() || null, modelo: f.modelo.trim() || null, anio: f.anio.trim() ? Number(f.anio) : null,
      }).eq('id', v.id).then(({ error }) => ({ patente: v.patente, error }))
    }))
    setSaving(false)
    const fallidas = resultados.filter((r) => r.error)
    if (fallidas.length) {
      toast.error(`No se pudieron guardar: ${fallidas.map((r) => r.patente).join(', ')}. ${fallidas[0].error?.message ?? ''}`)
    } else {
      toast.success(cambiadas.length === 1 ? 'Se guardó 1 camioneta.' : `Se guardaron ${cambiadas.length} camionetas.`)
    }
    router.refresh()
  }

  return (
    <form onSubmit={guardar} className="mx-auto max-w-4xl space-y-6 p-4 sm:p-6 lg:p-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Link href={volver} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="size-4" /> Volver a Flota
          </Link>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">Marca, modelo y año</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">Completá lo que falte y guardá todo junto. Salen en la tabla de Flota y en la etiqueta del QR.</p>
        </div>
        <button type="submit" disabled={saving || cambiadas.length === 0} className="rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50">
          {saving ? 'Guardando…' : cambiadas.length === 0 ? 'Sin cambios' : `Guardar ${cambiadas.length === 1 ? '1 cambio' : `${cambiadas.length} cambios`}`}
        </button>
      </div>

      <datalist id="marcas">{MARCAS.map((m) => <option key={m} value={m} />)}</datalist>

      <div className="overflow-x-auto rounded-2xl border border-border bg-card">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b border-border text-left text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              <th className="px-5 py-3">Patente</th>
              {variasEmpresas && <th className="px-3 py-3">Empresa</th>}
              <th className="px-3 py-3">Marca</th>
              <th className="px-3 py-3">Modelo</th>
              <th className="w-28 px-3 py-3">Año</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {vehiculos.map((v) => (
              <tr key={v.id}>
                <td className="whitespace-nowrap px-5 py-2.5 font-mono font-semibold tracking-wide">{v.patente}</td>
                {variasEmpresas && <td className="px-3 py-2.5 text-muted-foreground">{v.empresa}</td>}
                <td className="px-3 py-2.5">
                  <input aria-label={`Marca de ${v.patente}`} list="marcas" value={filas[v.id].marca} onChange={(e) => set(v.id, 'marca', e.target.value)} placeholder="Toyota" disabled={saving} className={input} />
                </td>
                <td className="px-3 py-2.5">
                  <input aria-label={`Modelo de ${v.patente}`} value={filas[v.id].modelo} onChange={(e) => set(v.id, 'modelo', e.target.value)} placeholder="Hilux" disabled={saving} className={input} />
                </td>
                <td className="px-3 py-2.5">
                  <input aria-label={`Año de ${v.patente}`} value={filas[v.id].anio} onChange={(e) => set(v.id, 'anio', e.target.value.replace(/\D/g, '').slice(0, 4))} placeholder="2020" inputMode="numeric" disabled={saving} className={`${input} tabular-nums`} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </form>
  )
}
