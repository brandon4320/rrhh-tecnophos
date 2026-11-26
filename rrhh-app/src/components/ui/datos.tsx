'use client'

// Piezas chicas de la skill para dar vida a las cifras (demo aprobada, gestion.js):
// cifras que cuentan, repartos, bloques "3 de 10", rayitas hasta el %, curvas que se
// dibujan, pastillas de estado y vacíos con ilustración. Solo dibujan lo que reciben.

import { useEffect, useId, useRef } from 'react'
import { CheckCircle, CircleDashed } from '@phosphor-icons/react'
import { cn } from '@/lib/utils'

const quieto = () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

/** Cifra que cuenta desde 0 (la primera vez) o desde el valor anterior, 700 ms. El server ya
 *  la manda escrita; la cuenta solo pinta el texto (sin re-render). */
export function Contar({ valor, className }: { valor: number; className?: string }) {
  const el = useRef<HTMLSpanElement>(null)
  const desde = useRef<number | null>(null)
  useEffect(() => {
    const inicio = desde.current ?? 0
    desde.current = valor
    const nodo = el.current
    if (!nodo) return
    const fmt = (x: number) => Math.round(x).toLocaleString('es-AR')
    if (quieto() || inicio === valor) { nodo.textContent = fmt(valor); return }
    const t0 = performance.now()
    let raf = 0
    const paso = (t: number) => {
      const p = Math.min(1, (t - t0) / 700)
      nodo.textContent = fmt(inicio + (valor - inicio) * (1 - Math.pow(1 - p, 3)))
      if (p < 1) raf = requestAnimationFrame(paso)
    }
    raf = requestAnimationFrame(paso)
    return () => { cancelAnimationFrame(raf); nodo.textContent = fmt(valor) }
  }, [valor])
  return <span ref={el} className={cn('tabular-nums', className)}>{valor.toLocaleString('es-AR')}</span>
}

/** Barra repartida en partes (crece desde la izquierda al cargar). */
export function Reparto({ partes, className }: { partes: { n: number; color: string; t: string }[]; className?: string }) {
  return (
    <div className={cn('mt-3 flex h-2 gap-[3px]', className)} role="img" aria-label={partes.map((p) => `${p.t}: ${p.n}`).join(', ')}>
      {partes.filter((p) => p.n > 0).map((p, i) => (
        <i key={p.t} title={`${p.t}: ${p.n}`} className="origin-left animate-[crece_0.8s_var(--ease-out)_both] rounded-[3px]" style={{ flex: p.n, background: p.color, animationDelay: `${120 + i * 80}ms` }} />
      ))}
    </div>
  )
}

/** Bloques "N de total" (segs de la demo), alto 6 px. */
export function Bloques({ colores, alto = 6, className, etiqueta }: { colores: (string | null)[]; alto?: number; className?: string; etiqueta?: string }) {
  return (
    <span className={cn('flex gap-[3px]', className)} role={etiqueta ? 'img' : undefined} aria-label={etiqueta} aria-hidden={etiqueta ? undefined : true}>
      {colores.map((c, i) => (
        <i key={i} className="flex-1 rounded-[3px] bg-muted transition-[background] duration-300" style={{ height: alto, ...(c ? { background: c } : {}) }} />
      ))}
    </span>
  )
}

/** Rayitas hasta el % (07): 34 palitos, los primeros pintados. */
export function Rayitas({ pct, color, n = 34 }: { pct: number; color: string; n?: number }) {
  const on = Math.round((n * pct) / 100)
  return (
    <span className="mt-3 flex h-4 items-stretch gap-[2px]" aria-hidden>
      {Array.from({ length: n }, (_, i) => (
        <i key={i} className="flex-1 rounded-[2px] bg-muted" style={i < on ? { background: color, animation: `aparece 0.4s ${i * 14}ms both` } : undefined} />
      ))}
    </span>
  )
}

/** Puntos de una curva suave (Catmull-Rom → Bézier), como `curva()` de la demo. */
export function curva(pts: [number, number][]): string {
  if (!pts.length) return ''
  let d = `M${pts[0][0]},${pts[0][1]}`
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] ?? p2
    d += ` C${p1[0] + (p2[0] - p0[0]) / 6},${p1[1] + (p2[1] - p0[1]) / 6} ${p2[0] - (p3[0] - p1[0]) / 6},${p2[1] - (p3[1] - p1[1]) / 6} ${p2[0]},${p2[1]}`
  }
  return d
}

/**
 * Curva con área degradé que se dibuja al cargar. El SVG se estira al ancho (sin deformar
 * el trazo); el punto marcado es HTML para que siga redondo.
 */
export function Linea({
  valores,
  color,
  alto = 48,
  punto,
  rellenoBlanco = false,
  pad = 4,
  className,
}: {
  valores: number[]
  color: string
  alto?: number
  /** Índice del punto marcado. */
  punto?: number
  /** Línea blanca (dentro del protagonista). */
  rellenoBlanco?: boolean
  pad?: number
  className?: string
}) {
  const id = `g${useId().replace(/[^a-zA-Z0-9]/g, '')}`
  const W = 300
  if (valores.length < 2) return null
  const mx = Math.max(...valores, 1)
  const mn = rellenoBlanco ? 0 : Math.min(...valores)
  const pts = valores.map((v, i) => [pad + (i * (W - 2 * pad)) / (valores.length - 1), alto - pad - ((v - mn) / (mx - mn || 1)) * (alto - 2 * pad - (rellenoBlanco ? 16 : 0))] as [number, number])
  const d = curva(pts)
  const trazo = rellenoBlanco ? '#fff' : color
  return (
    <div className={cn('relative', className)} style={{ height: alto }}>
      <svg viewBox={`0 0 ${W} ${alto}`} preserveAspectRatio="none" className="absolute inset-0 size-full overflow-visible" aria-hidden>
        <defs>
          <linearGradient id={id} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor={trazo} stopOpacity={rellenoBlanco ? 0.28 : 0.22} />
            <stop offset="1" stopColor={trazo} stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={`${d} L${pts.at(-1)![0]},${alto} L${pts[0][0]},${alto}Z`} fill={`url(#${id})`} />
        <path d={d} fill="none" stroke={trazo} strokeWidth={rellenoBlanco ? 2 : 1.8} strokeLinecap="round" vectorEffect="non-scaling-stroke" pathLength={1} strokeDasharray={1} className="animate-[dibujar_0.9s_var(--ease-out)_both]" opacity={rellenoBlanco ? 0.95 : 1} />
        {punto != null && rellenoBlanco && (
          <line x1={pts[punto][0]} x2={pts[punto][0]} y1={pts[punto][1]} y2={alto} stroke="#fff" strokeOpacity=".35" strokeDasharray="2 3" vectorEffect="non-scaling-stroke" />
        )}
      </svg>
      {punto != null && (
        <span
          aria-hidden
          className={cn('absolute -translate-x-1/2 -translate-y-1/2 rounded-full', rellenoBlanco ? 'size-[13px] border-[3px] border-[#4338ca] bg-white' : 'size-[9px] border-[1.8px] bg-card')}
          style={{ left: `${(pts[punto][0] / W) * 100}%`, top: pts[punto][1], ...(rellenoBlanco ? {} : { borderColor: color }) }}
        />
      )}
    </div>
  )
}

/** Posición (en % y px) de un punto de la curva, para colgarle un globo. */
export function posicionPunto(valores: number[], i: number, alto: number, pad = 4, blanco = true): { left: number; top: number } {
  const W = 300
  const mx = Math.max(...valores, 1)
  const mn = blanco ? 0 : Math.min(...valores)
  const x = pad + (i * (W - 2 * pad)) / (valores.length - 1)
  const y = alto - pad - ((valores[i] - mn) / (mx - mn || 1)) * (alto - 2 * pad - (blanco ? 16 : 0))
  return { left: (x / W) * 100, top: y }
}

/** Pastilla de estado: punto + palabra (en oscuro, sin fondo). */
export function Chip({ tono, children, className }: { tono: 'ro' | 'am' | 'v' | 'az' | 'gr'; children: React.ReactNode; className?: string }) {
  const t = {
    ro: 'bg-danger-subtle text-danger',
    am: 'bg-warning-subtle text-warning',
    v: 'bg-success-subtle text-success',
    az: 'bg-azul-subtle text-azul',
    gr: 'bg-muted text-texto-2',
  }[tono]
  return (
    <span className={cn('inline-flex h-6 items-center gap-1.5 rounded-lg px-2 text-xs font-medium whitespace-nowrap dark:px-0', t, className)}>
      <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-current" />
      {children}
    </span>
  )
}

/** Estado normal o resuelto: gris, sin pastilla, con su ícono (skill §1c.2). */
export function EstadoTexto({ estado, children }: { estado: 'vigente' | 'sin_fecha'; children?: React.ReactNode }) {
  const Ico = estado === 'vigente' ? CheckCircle : CircleDashed
  return (
    <span className="inline-flex items-center gap-1.5 text-[13px] whitespace-nowrap text-texto-2">
      <Ico size={14} className="text-muted-foreground" aria-hidden />
      {children ?? (estado === 'vigente' ? 'Al día' : 'Sin datos')}
    </span>
  )
}

/** Ilustraciones de la skill (ilustraciones/*.svg), en línea y con los colores del tema. */
export function Ilustracion({ cual }: { cual: 'exito' | 'resultados' }) {
  const trazo = { stroke: 'var(--ilus-trazo)' }
  const acento = { stroke: 'var(--ilus-acento)' }
  const papel = { fill: 'var(--ilus-papel)' }
  if (cual === 'exito')
    return (
      <svg viewBox="0 0 200 160" fill="none" aria-hidden className="mb-1 h-auto w-[112px]">
        <circle cx="100" cy="80" r="58" style={trazo} strokeWidth="1.3" strokeDasharray="2 5" opacity=".7" />
        <line x1="40" y1="128" x2="160" y2="128" style={trazo} strokeWidth="1.3" strokeLinecap="round" />
        <rect x="66" y="40" width="68" height="84" rx="8" style={{ ...papel, ...trazo }} strokeWidth="1.3" />
        <line x1="78" y1="62" x2="122" y2="62" style={trazo} strokeWidth="1.3" strokeLinecap="round" />
        <line x1="78" y1="74" x2="112" y2="74" style={trazo} strokeWidth="1.3" strokeLinecap="round" />
        <circle cx="100" cy="100" r="13" style={{ ...papel, ...acento }} strokeWidth="1.6" />
        <path d="M94 100l4 4 8-8" style={acento} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    )
  return (
    <svg viewBox="0 0 200 160" fill="none" aria-hidden className="mb-1 h-auto w-[112px]">
      <defs>
        <pattern id="rayaV" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="6" style={trazo} strokeWidth="1" opacity=".5" />
        </pattern>
      </defs>
      <circle cx="100" cy="80" r="58" style={trazo} strokeWidth="1.3" strokeDasharray="2 5" opacity=".7" />
      <line x1="40" y1="128" x2="160" y2="128" style={trazo} strokeWidth="1.3" strokeLinecap="round" />
      <rect x="62" y="44" width="62" height="78" rx="8" style={{ ...papel, ...trazo }} strokeWidth="1.3" />
      <rect x="62" y="44" width="62" height="18" rx="8" fill="url(#rayaV)" />
      <line x1="74" y1="76" x2="110" y2="76" style={trazo} strokeWidth="1.3" strokeLinecap="round" />
      <line x1="74" y1="88" x2="102" y2="88" style={trazo} strokeWidth="1.3" strokeLinecap="round" />
      <circle cx="128" cy="96" r="16" style={{ ...papel, ...acento }} strokeWidth="1.6" />
      <line x1="140" y1="108" x2="152" y2="120" style={acento} strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  )
}

/** Vacío de la skill: ilustración, título, una línea y (si hay) la acción que lo resuelve. */
export function Vacio({ ilustracion = 'resultados', titulo, children, accion, className }: { ilustracion?: 'exito' | 'resultados'; titulo: string; children?: React.ReactNode; accion?: React.ReactNode; className?: string }) {
  return (
    <div className={cn('flex flex-col items-center gap-1 px-5 py-6 text-center', className)} style={{ background: 'radial-gradient(40% 60% at 50% 30%, color-mix(in oklch, var(--primary) 7%, transparent), transparent 70%)' }}>
      <Ilustracion cual={ilustracion} />
      <h4 className="text-base font-medium tracking-[-0.01em]">{titulo}</h4>
      {children && <p className="max-w-[44ch] text-[13px] text-texto-2">{children}</p>}
      {accion && <div className="mt-3">{accion}</div>}
    </div>
  )
}
