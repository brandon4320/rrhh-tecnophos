import { cn } from '@/lib/utils'
import { Monograma } from '@/components/ui/monograma'

// Íconos de las marcas, los mismos del CRM (public/icono-*.png). Las 3 sedes de Tecnophos comparten el suyo.
export function iconoDe(slug: string): string | null {
  if (slug.startsWith('tecnophos') || slug === 'arcor') return '/icono-tecnophos.png'
  if (slug === 'adc') return '/icono-adc.png'
  if (slug === 'serviwhite') return '/icono-serviwhite.png'
  return null
}

/**
 * Color fijo de cada empresa (skill §1b: color por entidad, nunca a mano en la pantalla).
 * Cinco empresas a la vista → cinco tonos que no se repiten. Una empresa nueva toma uno
 * por su slug, siempre el mismo.
 */
const COLOR_EMPRESA: Record<string, string> = {
  'tecnophos-bahia-blanca': 'var(--e1)',
  'tecnophos-rosario': 'var(--e2)',
  'tecnophos-necochea': 'var(--e3)',
  adc: 'var(--e4)',
  serviwhite: 'var(--e5)',
}
export function colorEmpresa(slug: string | null | undefined): string {
  if (!slug) return 'var(--decorativo)'
  if (COLOR_EMPRESA[slug]) return COLOR_EMPRESA[slug]
  let h = 0
  for (const c of slug) h = (h * 31 + c.charCodeAt(0)) | 0
  return `var(--e${(Math.abs(h) % 5) + 1})`
}

/** "Tecnophos Bahía Blanca" → "Bahía Blanca"; el resto queda igual. */
export function nombreCorto(nombre: string): string {
  return nombre.replace(/^Tecnophos\s+/i, '')
}

/** El ícono de la empresa en un cuadradito blanco (IconoEmpresa del CRM). */
export function IconoEmpresa({ slug, nombre, tamano = 24, className }: { slug: string; nombre: string; tamano?: number; className?: string }) {
  const src = iconoDe(slug)
  if (!src) return <Monograma nombre={nombre} size="sm" className="rounded-[7px]" />
  return (
    <span
      className={cn('grid shrink-0 place-items-center overflow-hidden border border-border bg-white', className)}
      style={{ width: tamano, height: tamano, borderRadius: tamano >= 36 ? 12 : tamano >= 28 ? 8 : 7 }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- ícono chico, sin optimizar */}
      <img src={src} alt="" draggable={false} width={tamano} height={tamano} className="size-[82%] select-none object-contain" />
    </span>
  )
}

/** Los íconos de las elegidas encimados, como los avatares de un equipo (IconosEmpresas del CRM). */
export function IconosEmpresas({ lista, tamano = 28, maximo }: { lista: { slug: string; nombre: string }[]; tamano?: number; maximo?: number }) {
  // Un ícono por marca: las tres sedes de Tecnophos se ven como una.
  const unicos = lista
    .filter((e, i) => lista.findIndex((x) => (iconoDe(x.slug) ?? x.slug) === (iconoDe(e.slug) ?? e.slug)) === i)
    .slice(0, maximo)
  return (
    <span className="flex shrink-0 items-center" aria-hidden>
      {unicos.map((e, i) => (
        <span key={e.slug} className="relative rounded-[9px] shadow-[0_0_0_2px_var(--card)]" style={{ marginLeft: i ? -8 : 0, zIndex: unicos.length - i }}>
          <IconoEmpresa slug={e.slug} nombre={e.nombre} tamano={tamano} />
        </span>
      ))}
    </span>
  )
}

/** Avatar de persona con el color de su empresa al 14 % (mono-av de la demo). */
export function AvatarPersona({ nombre, slug, tamano = 36, className }: { nombre: string; slug: string | null | undefined; tamano?: number; className?: string }) {
  const iniciales = nombre.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]).join('').toUpperCase() || '?'
  const f = colorEmpresa(slug)
  return (
    <span
      aria-hidden
      className={cn('grid shrink-0 place-items-center rounded-full font-medium tracking-[0.01em] [--mezcla-av:14%] [--mezcla-tx:62%] [--base-tx:var(--foreground)] dark:[--mezcla-av:24%] dark:[--mezcla-tx:55%] dark:[--base-tx:white]', className)}
      style={{
        width: tamano,
        height: tamano,
        fontSize: tamano >= 48 ? 16 : tamano >= 36 ? 13 : 12,
        background: `color-mix(in oklch, ${f} var(--mezcla-av), var(--card))`,
        color: `color-mix(in oklch, ${f} var(--mezcla-tx), var(--base-tx))`,
      }}
    >
      {iniciales}
    </span>
  )
}

/** Cuadro de tipo (36 px): fondo al 12 % del color de su familia y el ícono en ese color. */
export function Cuadro({ color, tamano = 36, entidad = false, children, className }: { color: string; tamano?: number; entidad?: boolean; children: React.ReactNode; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn('grid shrink-0 place-items-center', className)}
      style={{
        width: tamano,
        height: tamano,
        borderRadius: tamano <= 24 ? 8 : tamano <= 32 ? 10 : 12,
        background: entidad ? color : `color-mix(in oklch, ${color} var(--cuadro-pct), var(--card))`,
        color: entidad ? '#fff' : color,
        boxShadow: entidad ? 'inset 0 1px 0 rgb(255 255 255 / 0.2)' : undefined,
      }}
    >
      {children}
    </span>
  )
}
