import Link from 'next/link'
import { redirect } from 'next/navigation'
import { LogOut, IdCard, ClipboardList, BriefcaseBusiness, ChevronRight, LayoutDashboard, Bug, ExternalLink, Container } from 'lucide-react'
import { requireSesion } from '@/lib/auth/session'
import { modulosPara } from '@/config/modules'
import { puedeVerArcor } from '@/modules/arcor/acceso'
import { createClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'
import { ThemeToggle } from '@/components/theme-toggle'

interface EmpresaRow {
  id: string
  nombre: string
  slug: string
}

// Marcas del grupo: agrupan las empresas (sedes) por prefijo de slug
const MARCAS = [
  { key: 'tecnophos', nombre: 'Tecnophos', logo: '/logo-tecnophos-iso.png', match: (s: string) => s.startsWith('tecnophos') },
  { key: 'adc', nombre: 'ADC S.R.L.', logo: '/logo-adc.png', match: (s: string) => s === 'adc' },
  { key: 'serviwhite', nombre: 'Serviwhite', logo: '/logo-serviwhite-iso.png', match: (s: string) => s === 'serviwhite' },
] as const

// Sistema del servicio de limpieza para UNIPAR (deploy propio, fuera de este repo).
const UNIPAR_APP_URL = 'https://unipar-app.vercel.app/'

function nombreSede(nombreEmpresa: string) {
  return nombreEmpresa.replace(/^Tecnophos\s+/i, '')
}

export default async function HubPage() {
  const sesion = await requireSesion()
  const modulos = modulosPara(sesion.rol)

  // Si solo tiene un módulo, entra directo (ej. UNIPAR → Operaciones).
  if (modulos.length === 1) redirect(modulos[0].href)

  const puedeRrhh = modulos.some((m) => m.key === 'rrhh')
  const puedeComercial = modulos.some((m) => m.key === 'comercial')
  const puedeArcor = puedeVerArcor(sesion)

  const supabase = await createClient()
  const empresasQuery = supabase.from('empresas').select('id, nombre, slug').order('nombre')
  if (sesion.empresaAcceso) empresasQuery.eq('id', sesion.empresaAcceso)
  const { data: empresas } = await empresasQuery

  const marcas = MARCAS.map((m) => ({
    ...m,
    sedes: ((empresas ?? []) as EmpresaRow[]).filter((e) => m.match(e.slug)),
  })).filter((m) => m.sedes.length > 0)

  async function logout() {
    'use server'
    const supabase = await createClient()
    await supabase.auth.signOut()
    redirect('/login')
  }

  const nombre = sesion.nombre ?? sesion.email ?? 'Usuario'

  const filaCls =
    'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted'

  return (
    <div className="min-h-[100dvh] bg-background">
      <header className="border-b bg-card">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo-tecnophos.svg" alt="Tecnophos" className="h-7 w-auto" />
            <span className="h-8 w-px bg-border" />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo-adc.png" alt="ADC S.R.L. Fumigation" className="h-9 w-auto" />
            <span className="h-8 w-px bg-border" />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo-serviwhite.png" alt="Serviwhite" className="hidden h-5 w-auto sm:inline-block" />
            <span className="ml-1 hidden h-6 w-px bg-border sm:inline-block" />
            <span className="hidden text-sm font-medium text-muted-foreground sm:inline">Gestión</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="mr-2 hidden text-sm text-muted-foreground sm:inline">{nombre}</span>
            <ThemeToggle />
            <form action={logout}>
              <Button variant="ghost" size="sm" type="submit">
                <LogOut className="size-4" strokeWidth={1.75} />
                Salir
              </Button>
            </form>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Hola, {nombre.split(' ')[0]}</h1>
            <p className="mt-1 text-sm text-muted-foreground">Entrá al portal de cada empresa.</p>
          </div>
          {puedeRrhh && (
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <LayoutDashboard className="size-4" strokeWidth={1.75} />
              Dashboard general
            </Link>
          )}
        </div>

        {marcas.length === 0 ? (
          <div className="rounded-2xl border border-border bg-card py-10 text-center text-sm text-muted-foreground">
            No tenés portales asignados. Contactá al administrador.
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {marcas.map((marca) => (
              <div key={marca.key} className="flex flex-col rounded-2xl border border-border bg-card p-5">
                <div className="mb-4 flex items-center gap-3">
                  <span className="inline-flex size-11 shrink-0 items-center justify-center rounded-xl border border-border bg-white p-1.5">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={marca.logo} alt={marca.nombre} className="max-h-full max-w-full object-contain" />
                  </span>
                  <div>
                    <p className="font-semibold tracking-tight">{marca.nombre}</p>
                    <p className="text-xs text-muted-foreground">
                      {marca.sedes.length > 1 ? `${marca.sedes.length} sedes` : 'Portal de empresa'}
                    </p>
                  </div>
                </div>

                <div className="flex-1 space-y-0.5">
                  {puedeRrhh &&
                    marca.sedes.map((sede) => (
                      <Link key={sede.id} href={`/empresa/${sede.slug}`} className={filaCls}>
                        <IdCard className="size-4 shrink-0 text-muted-foreground" strokeWidth={1.75} />
                        <span className="min-w-0 flex-1 truncate">
                          {marca.sedes.length > 1 ? `RRHH · ${nombreSede(sede.nombre)}` : 'RRHH'}
                        </span>
                        <ChevronRight className="size-4 shrink-0 text-muted-foreground/50" strokeWidth={1.75} />
                      </Link>
                    ))}

                  {marca.key === 'adc' && (
                    <a href={UNIPAR_APP_URL} target="_blank" rel="noopener noreferrer" className={filaCls}>
                      <ClipboardList className="size-4 shrink-0 text-muted-foreground" strokeWidth={1.75} />
                      <span className="min-w-0 flex-1 truncate">Sistema limpieza - UNIPAR</span>
                      <ExternalLink className="size-4 shrink-0 text-muted-foreground/50" strokeWidth={1.75} />
                    </a>
                  )}

                  {/* App de control de plagas: página estática autocontenida en public/
                      (los datos viven en el dispositivo del operario, no usa Supabase). */}
                  {marca.key === 'adc' && (
                    <a href="/control-plagas.html" target="_blank" rel="noopener noreferrer" className={filaCls}>
                      <Bug className="size-4 shrink-0 text-muted-foreground" strokeWidth={1.75} />
                      <span className="min-w-0 flex-1 truncate">Control de Plagas</span>
                      <ExternalLink className="size-4 shrink-0 text-muted-foreground/50" strokeWidth={1.75} />
                    </a>
                  )}

                  {marca.key === 'tecnophos' && puedeArcor && (
                    <Link href="/arcor" className={filaCls}>
                      <Container className="size-4 shrink-0 text-muted-foreground" strokeWidth={1.75} />
                      <span className="min-w-0 flex-1 truncate">Contenedores - ARCOR</span>
                      <ChevronRight className="size-4 shrink-0 text-muted-foreground/50" strokeWidth={1.75} />
                    </Link>
                  )}

                  {puedeComercial && (
                    <Link href="/comercial" className={filaCls}>
                      <BriefcaseBusiness className="size-4 shrink-0 text-muted-foreground" strokeWidth={1.75} />
                      <span className="min-w-0 flex-1 truncate">Gestión Comercial</span>
                      <ChevronRight className="size-4 shrink-0 text-muted-foreground/50" strokeWidth={1.75} />
                    </Link>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
