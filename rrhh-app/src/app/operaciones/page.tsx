import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { Card, CardContent } from '@/components/ui/card'

export default async function OperacionesHome() {
  const supabase = await createClient()

  const [{ count: dotacion }, { count: areas }] = await Promise.all([
    supabase
      .from('limpieza_personal')
      .select('*', { count: 'exact', head: true })
      .eq('activo', true),
    supabase
      .from('limpieza_areas')
      .select('*', { count: 'exact', head: true })
      .eq('activo', true),
  ])

  const resumen = [
    { label: 'Dotación activa', valor: dotacion ?? 0, sub: 'personas' },
    { label: 'Sitios y áreas', valor: areas ?? 0, sub: 'del servicio' },
    { label: 'Mínimo contractual', valor: 13, sub: 'operarios + 1 supervisor' },
  ]

  const accesos = [
    { href: '/operaciones/personal', label: 'Personal', desc: 'Alta y gestión del equipo.' },
    { href: '/operaciones/areas', label: 'Sitios y áreas', desc: 'Lugares donde se hace la limpieza.' },
    { href: '/operaciones/asistencia', label: 'Asistencia', desc: 'Presentismo diario.' },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Resumen</h1>
        <p className="mt-1 text-sm text-muted-foreground">Contrato UNIPAR · Bahía Blanca</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {resumen.map((r) => (
          <Card key={r.label}>
            <CardContent className="p-5">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{r.label}</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums">{r.valor}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">{r.sub}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {accesos.map((a) => (
          <Link key={a.href} href={a.href} className="group">
            <Card className="h-full transition-colors hover:border-primary/50">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <p className="font-medium">{a.label}</p>
                  <ArrowRight
                    className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5"
                    strokeWidth={1.75}
                  />
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{a.desc}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  )
}
