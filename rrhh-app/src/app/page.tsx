import Link from 'next/link'
import { redirect } from 'next/navigation'
import { LayoutGrid, LogOut, Users, ClipboardList, Wrench, ArrowRight } from 'lucide-react'
import { requireSesion } from '@/lib/auth/session'
import { modulosPara, type ModuloKey } from '@/config/modules'
import { createClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

const ICONOS: Record<ModuloKey, React.ReactNode> = {
  rrhh: <Users className="size-5" />,
  limpieza: <ClipboardList className="size-5" />,
  mantenimiento: <Wrench className="size-5" />,
}

const DESCRIPCIONES: Record<ModuloKey, string> = {
  rrhh: 'Legajos, certificados y vencimientos del personal.',
  limpieza: 'Servicio en planta UNIPAR: dotación, tareas y reportes diarios.',
  mantenimiento: 'Planes y vencimientos de mantenimiento de equipos.',
}

export default async function HubPage() {
  const sesion = await requireSesion()
  const modulos = modulosPara(sesion.rol)

  async function logout() {
    'use server'
    const supabase = await createClient()
    await supabase.auth.signOut()
    redirect('/login')
  }

  const nombre = sesion.nombre ?? sesion.email ?? 'Usuario'

  return (
    <div className="min-h-[100dvh] bg-background">
      <header className="border-b bg-card">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-2.5">
            <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <LayoutGrid className="size-4" />
            </div>
            <span className="font-semibold">Gestión</span>
            <span className="hidden text-sm text-muted-foreground sm:inline">· Tecnophos · ADC</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="hidden text-sm text-muted-foreground sm:inline">{nombre}</span>
            <form action={logout}>
              <Button variant="ghost" size="sm" type="submit">
                <LogOut className="size-4" />
                Salir
              </Button>
            </form>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
        <h1 className="text-xl font-semibold tracking-tight">Hola, {nombre.split(' ')[0]}</h1>
        <p className="mb-8 mt-1 text-sm text-muted-foreground">Elegí un módulo para entrar.</p>

        {modulos.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              No tenés módulos asignados. Contactá al administrador.
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {modulos.map((m) => (
              <Link key={m.key} href={m.href} className="group">
                <Card className="h-full transition-colors hover:border-primary/40">
                  <CardHeader>
                    <div className="flex size-11 items-center justify-center rounded-lg bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                      {ICONOS[m.key]}
                    </div>
                    <CardTitle className="mt-3">{m.label}</CardTitle>
                    <CardDescription>{DESCRIPCIONES[m.key]}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <span className="inline-flex items-center gap-1 text-sm font-medium text-primary">
                      Entrar
                      <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
                    </span>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
