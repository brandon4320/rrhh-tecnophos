import Link from 'next/link'
import { redirect } from 'next/navigation'
import { LogOut, IdCard, ClipboardList, BriefcaseBusiness, ChevronRight, LayoutDashboard, Bug, ExternalLink, Container, Boxes, ListChecks, SprayCan } from 'lucide-react'
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
// Checklist de maquinaria pesada (fotos, chequeo interior y horómetro por turno):
// otro proyecto con deploy propio, carpeta `C:\Dev\Detalle maquinaria`. Apunta al
// panel de administración, que es lo que usa la oficina; los operarios entran por
// su propio enlace.
const CHECKLIST_MAQUINARIA_URL = 'https://checklist.serviwhite.com/admin'
// ERP de Serviwhite (alquiler y venta de módulos): otro repo, con su propio login.
// La raíz redirige sola al login si no hay sesión.
const SERVIWHITE_ERP_URL = 'https://gestion.serviwhite.com/'
// El Sistema de Gestión Comercial nuevo (otro proyecto, en Cloudflare; repo comercial-tecnophos), con
// su propio login. `?empresa=` abre esa empresa (la suma a las que se miran). El módulo /comercial
// de acá es el CRM viejo: queda en el código pero el inicio ya no lo ofrece.
const CRM_URL = 'https://crm.tecnophos.com.ar/'
// Recorrido de limpieza de baños: vive en el ERP de Serviwhite (arma el recorrido
// y el link del encargado). Se pide con el mismo login del ERP.
const SERVIWHITE_LIMPIEZA_URL = 'https://gestion.serviwhite.com/limpieza'

function nombreSede(nombreEmpresa: string) {
  return nombreEmpresa.replace(/^Tecnophos\s+/i, '')
}

export default async function HubPage() {
  // Sesión y empresas en paralelo: la RLS ya limita las empresas a las que cada
  // uno ve (empresa_acceso), así que la query no necesita esperar a la sesión.
  const supabase = await createClient()
  const [sesion, { data: empresas }] = await Promise.all([
    requireSesion(),
    supabase.from('empresas').select('id, nombre, slug').order('nombre'),
  ])
  const puedeArcor = puedeVerArcor(sesion)
  // ARCOR exige además ver todas las empresas (puedeVerArcor espeja la RLS): para un
  // usuario con empresa_acceso no cuenta como módulo disponible.
  const modulos = modulosPara(sesion.rol).filter((m) => m.key !== 'arcor' || puedeArcor)

  // Si solo tiene un módulo, entra directo (p. ej. Soledad, usuario de una sola sede → RRHH).
  if (modulos.length === 1) redirect(modulos[0].href)

  const puedeRrhh = modulos.some((m) => m.key === 'rrhh')

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

  // Filas como el menú del CRM: 40px, radio 10, texto-2 que pasa a tinta al pasar.
  const filaCls =
    'flex h-10 items-center gap-2.5 rounded-[10px] px-3 text-sm font-medium text-texto-2 transition-colors duration-150 hover:bg-muted hover:text-foreground'

  return (
    <div className="min-h-[100dvh] bg-background">
      {/* Barra de arriba como la del CRM: marca del grupo a la izquierda, la persona y salir a la derecha. */}
      <header className="sticky top-0 z-20 border-b border-border bg-card/90 backdrop-blur-sm">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-2.5">
            {/* eslint-disable-next-line @next/next/no-img-element -- svg chico, sin optimizar */}
            <img src="/logo-grupo.svg" alt="" width={30} height={30} className="shrink-0 select-none" draggable={false} />
            <span className="text-[15px] font-semibold tracking-[-0.015em]">Gestión</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="mr-2 hidden text-sm text-texto-2 sm:inline">{nombre}</span>
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
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <h1 className="text-[28px] leading-tight font-semibold tracking-[-0.02em]">Hola, {nombre.split(' ')[0]}</h1>
          {puedeRrhh && (
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 rounded-[10px] border border-border-strong bg-card px-4 py-2.5 text-sm font-medium text-foreground transition-[background-color,transform] hover:bg-muted active:scale-[0.97]"
            >
              <LayoutDashboard className="size-4" strokeWidth={1.75} />
              Resumen general
            </Link>
          )}
        </div>

        {marcas.length === 0 ? (
          <div className="rounded-2xl border border-border bg-card py-10 text-center text-sm text-muted-foreground shadow-tarjeta">
            No tenés portales asignados. Contactá al administrador.
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {marcas.map((marca) => (
              <div key={marca.key} className="flex flex-col rounded-2xl border border-border bg-card p-5 shadow-tarjeta">
                <div className="mb-4 flex items-center gap-3">
                  <span className="inline-flex size-11 shrink-0 items-center justify-center rounded-xl border border-border bg-white p-1.5">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={marca.logo} alt="" className="max-h-full max-w-full object-contain" />
                  </span>
                  <h2 className="text-base font-semibold tracking-tight">{marca.nombre}</h2>
                </div>

                <div className="flex-1 space-y-0.5">
                  {puedeRrhh &&
                    marca.sedes.map((sede) => (
                      <Link key={sede.id} href={`/empresa/${sede.slug}`} className={filaCls}>
                        <IdCard className="size-[18px] shrink-0" strokeWidth={1.75} aria-hidden />
                        <span className="min-w-0 flex-1 truncate">
                          {marca.sedes.length > 1 ? `RRHH · ${nombreSede(sede.nombre)}` : 'RRHH'}
                        </span>
                        <ChevronRight className="size-4 shrink-0 text-muted-foreground/50" strokeWidth={1.75} />
                      </Link>
                    ))}

                  {marca.key === 'adc' && (
                    <a href={UNIPAR_APP_URL} target="_blank" rel="noopener noreferrer" className={filaCls}>
                      <ClipboardList className="size-[18px] shrink-0" strokeWidth={1.75} aria-hidden />
                      <span className="min-w-0 flex-1 truncate">Sistema limpieza - UNIPAR</span>
                      <ExternalLink className="size-4 shrink-0 text-muted-foreground/50" strokeWidth={1.75} />
                    </a>
                  )}

                  {/* App de control de plagas: página estática autocontenida en public/
                      (los datos viven en el dispositivo del operario, no usa Supabase). */}
                  {marca.key === 'adc' && (
                    <a href="/control-plagas.html" target="_blank" rel="noopener noreferrer" className={filaCls}>
                      <Bug className="size-[18px] shrink-0" strokeWidth={1.75} aria-hidden />
                      <span className="min-w-0 flex-1 truncate">Control de Plagas</span>
                      <ExternalLink className="size-4 shrink-0 text-muted-foreground/50" strokeWidth={1.75} />
                    </a>
                  )}

                  {marca.key === 'adc' && (
                    <a href={CHECKLIST_MAQUINARIA_URL} target="_blank" rel="noopener noreferrer" className={filaCls}>
                      <ListChecks className="size-[18px] shrink-0" strokeWidth={1.75} aria-hidden />
                      <span className="min-w-0 flex-1 truncate">Checklist de maquinaria</span>
                      <ExternalLink className="size-4 shrink-0 text-muted-foreground/50" strokeWidth={1.75} />
                    </a>
                  )}

                  {marca.key === 'serviwhite' && (
                    <a href={SERVIWHITE_ERP_URL} target="_blank" rel="noopener noreferrer" className={filaCls}>
                      <Boxes className="size-[18px] shrink-0" strokeWidth={1.75} aria-hidden />
                      <span className="min-w-0 flex-1 truncate">Sistema de gestión</span>
                      <ExternalLink className="size-4 shrink-0 text-muted-foreground/50" strokeWidth={1.75} />
                    </a>
                  )}

                  {marca.key === 'serviwhite' && (
                    <a href={SERVIWHITE_LIMPIEZA_URL} target="_blank" rel="noopener noreferrer" className={filaCls}>
                      <SprayCan className="size-[18px] shrink-0" strokeWidth={1.75} aria-hidden />
                      <span className="min-w-0 flex-1 truncate">Recorrido de limpieza</span>
                      <ExternalLink className="size-4 shrink-0 text-muted-foreground/50" strokeWidth={1.75} />
                    </a>
                  )}

                  {marca.key === 'tecnophos' && puedeArcor && (
                    <Link href="/arcor" className={filaCls}>
                      <Container className="size-[18px] shrink-0" strokeWidth={1.75} aria-hidden />
                      <span className="min-w-0 flex-1 truncate">Contenedores - ARCOR</span>
                      <ChevronRight className="size-4 shrink-0 text-muted-foreground/50" strokeWidth={1.75} />
                    </Link>
                  )}

                  <a href={`${CRM_URL}?empresa=${marca.key}`} target="_blank" rel="noopener noreferrer" className={filaCls}>
                    <BriefcaseBusiness className="size-[18px] shrink-0" strokeWidth={1.75} aria-hidden />
                    <span className="min-w-0 flex-1 truncate">Gestión Comercial</span>
                    <ExternalLink className="size-4 shrink-0 text-muted-foreground/50" strokeWidth={1.75} />
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
