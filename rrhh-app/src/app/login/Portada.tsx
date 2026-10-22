'use client'

// Portada del login (como la del Sistema de Gestión Comercial): fotos reales de Tecnophos, ADC y
// Serviwhite que se turnan con un acercamiento lento, "Gestión" bien grande y los tres logos. Sin
// frase ni etiquetas de más (regla de Brandon: si una pantalla las necesita, se arregla el layout).
// Tocar un logo muestra su foto. Solo transform y opacity; con "reducir movimiento", quieta.
import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'

interface Diapositiva {
  empresa: string
  foto: string
  posicion: string
  logo: string
  alto: string
  altoChico: string
}

const DIAPOSITIVAS: Diapositiva[] = [
  { empresa: 'Tecnophos', foto: 'tecnophos', posicion: '50% 45%', logo: '/login/logo-tecnophos-blanco.svg', alto: 'h-10', altoChico: 'h-6' },
  { empresa: 'ADC', foto: 'adc', posicion: '62% 50%', logo: '/login/logo-adc-blanco.png', alto: 'h-12', altoChico: 'h-8' },
  { empresa: 'Serviwhite', foto: 'serviwhite', posicion: '70% 50%', logo: '/login/logo-serviwhite-blanco.png', alto: 'h-7', altoChico: 'h-5' },
]

const DURACION = 6500

const reduceMovimiento = () => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

function useCarrusel() {
  const [actual, setActual] = useState(0)
  const [pausado, setPausado] = useState(false)
  useEffect(() => {
    if (pausado || reduceMovimiento()) return
    const t = setTimeout(() => setActual((a) => (a + 1) % DIAPOSITIVAS.length), DURACION)
    return () => clearTimeout(t)
  }, [actual, pausado])
  return { actual, setActual, setPausado }
}

function Fotos({ actual, tamanos }: { actual: number; tamanos: string }) {
  return (
    <>
      {DIAPOSITIVAS.map((d, i) => (
        // eslint-disable-next-line @next/next/no-img-element -- fotos ya optimizadas (webp en dos tamaños), con srcset propio
        <img
          key={d.foto}
          src={`/login/${d.foto}.webp`}
          srcSet={`/login/${d.foto}-chica.webp 900w, /login/${d.foto}.webp 1600w`}
          sizes={tamanos}
          alt={i === actual ? `Equipo de ${d.empresa} trabajando` : ''}
          aria-hidden={i !== actual}
          loading={i === 0 ? 'eager' : 'lazy'}
          fetchPriority={i === 0 ? 'high' : 'auto'}
          decoding="async"
          className={cn('absolute inset-0 size-full object-cover transition-opacity duration-[1400ms] ease-out motion-reduce:transition-none', i === actual ? 'opacity-100' : 'opacity-0')}
          style={{ objectPosition: d.posicion, animation: i === actual ? `login-acercar ${DURACION + 1600}ms ease-out forwards` : undefined }}
        />
      ))}
    </>
  )
}

function Logos({ actual, setActual, chico }: { actual: number; setActual?: (i: number) => void; chico?: boolean }) {
  return (
    <div className={cn('flex items-end', chico ? 'gap-5' : 'gap-9')} role={setActual ? 'tablist' : undefined} aria-label="Empresas">
      {DIAPOSITIVAS.map((d, i) => {
        const activo = i === actual
        const contenido = (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element -- logo chico, sin optimizar */}
            <img src={d.logo} alt={d.empresa} className={cn('w-auto transition-opacity duration-500', chico ? d.altoChico : d.alto, activo ? 'opacity-100' : 'opacity-45')} />
            {!chico && (
              <span className="mt-3 block h-[2px] w-full overflow-hidden rounded-full bg-white/20" aria-hidden>
                <span className={cn('block h-full origin-left rounded-full bg-white', !activo && 'scale-x-0')} style={activo ? { animation: `login-barra ${DURACION}ms linear` } : undefined} />
              </span>
            )}
          </>
        )
        return setActual ? (
          <button key={d.empresa} type="button" role="tab" aria-selected={activo} aria-label={d.empresa} onClick={() => setActual(i)} className="flex cursor-pointer flex-col items-start">
            {contenido}
          </button>
        ) : (
          <span key={d.empresa} className="flex flex-col items-start">
            {contenido}
          </span>
        )
      })}
    </div>
  )
}

/** Velo oscuro: abajo y a la izquierda, donde va el título; la foto respira arriba. */
function Velos() {
  return (
    <>
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(8,8,16,0.35)_0%,rgba(8,8,16,0)_30%,rgba(8,8,16,0.25)_55%,rgba(8,8,16,0.9)_100%)]" aria-hidden />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,rgba(8,8,16,0.55)_0%,rgba(8,8,16,0)_60%)]" aria-hidden />
    </>
  )
}

const ANIMACIONES =
  '@keyframes login-acercar { from { transform: scale(1) } to { transform: scale(1.07) } } @keyframes login-barra { from { transform: scaleX(0) } to { transform: scaleX(1) } } @media (prefers-reduced-motion: reduce) { [style*="login-"] { animation: none !important } }'

/** Compu: portada alta a la izquierda del formulario. */
export function PortadaLogin() {
  const { actual, setActual, setPausado } = useCarrusel()
  return (
    <section
      className="relative hidden min-h-[620px] overflow-hidden rounded-[28px] bg-[#0b0b14] lg:block"
      onMouseEnter={() => setPausado(true)}
      onMouseLeave={() => setPausado(false)}
      aria-label="Gestión · Tecnophos, ADC y Serviwhite"
    >
      <style>{ANIMACIONES}</style>
      <Fotos actual={actual} tamanos="(min-width: 1024px) 56vw, 100vw" />
      <Velos />
      <div className="relative flex h-full flex-col justify-end p-10 text-white xl:p-14">
        <h1 className="text-[clamp(64px,7vw,120px)] leading-[0.9] font-semibold tracking-[-0.045em]">Gestión</h1>
        <div className="mt-12 xl:mt-14">
          <Logos actual={actual} setActual={setActual} />
        </div>
      </div>
    </section>
  )
}

/** Celular: la misma portada en chico, arriba del formulario. */
export function BandaLogin() {
  const { actual } = useCarrusel()
  return (
    <section className="relative h-[min(280px,32dvh)] min-h-[210px] overflow-hidden rounded-b-[28px] bg-[#0b0b14] lg:hidden" aria-label="Gestión · Tecnophos, ADC y Serviwhite">
      <style>{ANIMACIONES}</style>
      <Fotos actual={actual} tamanos="100vw" />
      <Velos />
      <div className="relative flex h-full flex-col justify-end p-5 text-white">
        <p className="text-[44px] leading-[0.95] font-semibold tracking-[-0.04em]">Gestión</p>
        <div className="mt-4">
          <Logos actual={actual} chico />
        </div>
      </div>
    </section>
  )
}
