import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Bot, ChevronRight } from 'lucide-react'
import { requireSesion } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { leer } from '@/lib/errores'
import { TZ_AR, diaClaveAR } from '@/lib/fechas-ar'
import { Monograma } from '@/components/ui/monograma'
import { GRUPOS, diaAnterior, hrefDe, lineasCambio, tituloDia, verboYQue, type FilaAuditoria } from '@/modules/auditoria/reglas'
import { FiltrosHistorial } from './FiltrosHistorial'

const POR_PAGINA = 100
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const hora = new Intl.DateTimeFormat('es-AR', { timeZone: TZ_AR, hour: '2-digit', minute: '2-digit', hour12: false })

/**
 * Historial de cambios: quién cargó, editó o borró cada cosa (tabla `auditoria`, migración 28).
 * Solo el administrador general (rol admin sin empresa asignada, como pide la RLS). Filtros en la
 * URL: ?quien=<usuario|sistema>&que=<grupo>&accion=<alta|cambio|baja>&q=<texto>; "Ver más" pagina
 * con ?antes=<id>.
 */
export default async function HistorialPage({
  searchParams,
}: {
  searchParams: Promise<{ quien?: string; que?: string; accion?: string; q?: string; antes?: string }>
}) {
  const sesion = await requireSesion()
  if (sesion.rol !== 'admin' || sesion.empresaAcceso) redirect('/dashboard')
  const sp = await searchParams
  const supabase = await createClient()

  let consulta = supabase.from('auditoria').select('*').order('id', { ascending: false }).limit(POR_PAGINA + 1)
  if (sp.antes && /^\d+$/.test(sp.antes)) consulta = consulta.lt('id', Number(sp.antes))
  if (sp.quien === 'sistema') consulta = consulta.is('usuario_id', null)
  else if (sp.quien && UUID.test(sp.quien)) consulta = consulta.eq('usuario_id', sp.quien)
  const grupo = sp.que && GRUPOS[sp.que] ? sp.que : null
  if (grupo) consulta = consulta.in('tabla', GRUPOS[grupo].tablas)
  if (sp.accion === 'alta' || sp.accion === 'cambio' || sp.accion === 'baja') consulta = consulta.eq('accion', sp.accion)
  const texto = sp.q?.trim()
  if (texto) consulta = consulta.ilike('etiqueta', `%${texto.replace(/[%_\\]/g, (c) => `\\${c}`)}%`)

  const [filasRes, { data: empresas }, { data: tipos }, { data: perfiles }] = await Promise.all([
    consulta,
    supabase.from('empresas').select('id, nombre, slug'),
    supabase.from('tipos_certificado').select('id, nombre'),
    // Los nombres de todos los usuarios (perfiles solo deja ver el propio): ya se comprobó arriba que es el admin general.
    createAdminClient().from('perfiles').select('id, nombre').order('nombre'),
  ])
  const todas = (leer(filasRes) ?? []) as unknown as FilaAuditoria[]
  const hayMas = todas.length > POR_PAGINA
  const filas = todas.slice(0, POR_PAGINA)

  const nombres: Record<string, string> = {}
  for (const e of empresas ?? []) nombres[e.id] = e.nombre
  for (const t of tipos ?? []) nombres[t.id] = t.nombre
  for (const p of perfiles ?? []) if (p.nombre) nombres[p.id] = p.nombre
  const slugs = Object.fromEntries((empresas ?? []).map((e) => [e.id, e.slug]))

  const hoy = diaClaveAR(new Date())
  const ayer = diaAnterior(hoy)
  const dias: { dia: string; filas: FilaAuditoria[] }[] = []
  for (const f of filas) {
    const dia = diaClaveAR(f.ocurrido_en)
    if (dias.at(-1)?.dia !== dia) dias.push({ dia, filas: [] })
    dias.at(-1)!.filas.push(f)
  }

  const filtrando = Boolean(sp.quien || grupo || sp.accion || texto)
  const masHref = (() => {
    const p = new URLSearchParams()
    for (const [k, v] of Object.entries(sp)) if (v && k !== 'antes') p.set(k, v)
    p.set('antes', String(filas.at(-1)?.id ?? ''))
    return `/admin/historial?${p}`
  })()

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 sm:p-6 lg:p-8">
      <h1 className="text-[28px] leading-tight font-semibold tracking-[-0.02em]">Historial</h1>

      <FiltrosHistorial
        personas={(perfiles ?? []).filter((p) => p.nombre).map((p) => ({ id: p.id, nombre: p.nombre! }))}
        grupos={Object.entries(GRUPOS).map(([clave, g]) => ({ clave, etiqueta: g.etiqueta }))}
      />

      {dias.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card px-6 py-12 text-center text-sm text-muted-foreground shadow-tarjeta">
          {filtrando ? 'Nada con esos filtros.' : 'Todavía no hay cambios registrados.'}
        </div>
      ) : (
        dias.map(({ dia, filas: delDia }) => (
          <section key={dia} className="space-y-2">
            <h2 className="px-1 text-sm font-semibold text-texto-2">{tituloDia(dia, hoy, ayer)}</h2>
            <ol className="divide-y divide-divisor overflow-hidden rounded-2xl border border-border bg-card shadow-tarjeta">
              {delDia.map((f) => {
                const href = hrefDe(f, slugs)
                const lineas = lineasCambio(f.cambios, { nombres })
                const quien = f.usuario_nombre ?? (f.usuario_id ? nombres[f.usuario_id] ?? 'Alguien' : 'Sistema')
                return (
                  <li key={f.id} className={`relative flex gap-3 px-5 py-3.5 ${href ? 'transition-colors hover:bg-hover' : ''}`}>
                    {f.usuario_id ? (
                      <Monograma nombre={quien} size="sm" redondo variant="accent" className="mt-0.5" />
                    ) : (
                      // Sin usuario: lo hizo el sistema (formulario QR de las camionetas, sincronizaciones, altas desde el admin).
                      <span className="mt-0.5 inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground" title="Sistema">
                        <Bot className="size-4" strokeWidth={1.75} aria-hidden />
                      </span>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-sm">
                        <span className="font-semibold">{quien}</span> <span className="text-texto-2">{verboYQue(f)}</span>{' '}
                        {href ? (
                          <Link href={href} className="font-medium after:absolute after:inset-0">
                            {f.etiqueta ?? 'sin nombre'}
                          </Link>
                        ) : (
                          <span className="font-medium">{f.etiqueta ?? 'sin nombre'}</span>
                        )}
                      </p>
                      {lineas.length > 0 && (
                        <ul className="mt-1 space-y-0.5 text-[13px] text-texto-2">
                          {lineas.slice(0, 6).map((l) => (
                            <li key={l.campo} className="break-words">
                              <span className="text-muted-foreground">{l.campo}:</span> <span className="line-through decoration-muted-foreground/60">{l.antes}</span>
                              {' → '}
                              <span className="font-medium text-foreground">{l.despues}</span>
                            </li>
                          ))}
                          {lineas.length > 6 && <li className="text-muted-foreground">y {lineas.length - 6} campos más</li>}
                        </ul>
                      )}
                    </div>
                    <div className="flex shrink-0 items-start gap-1 pt-0.5">
                      <time dateTime={f.ocurrido_en} className="text-xs tabular-nums text-muted-foreground">
                        {hora.format(new Date(f.ocurrido_en))}
                      </time>
                      {href && <ChevronRight className="size-4 text-muted-foreground" strokeWidth={1.75} aria-hidden />}
                    </div>
                  </li>
                )
              })}
            </ol>
          </section>
        ))
      )}

      {hayMas && (
        <div className="flex justify-center">
          <Link
            href={masHref}
            className="inline-flex h-10 items-center rounded-[10px] border border-border-strong bg-card px-4 text-sm font-medium transition-[background-color,transform] hover:bg-muted active:scale-[0.97]"
          >
            Ver más
          </Link>
        </div>
      )}
    </div>
  )
}
