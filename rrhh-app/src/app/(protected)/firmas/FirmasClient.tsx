'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { CheckCircle, EnvelopeSimple, Warning, WarningCircle } from '@phosphor-icons/react'
import { Monograma } from '@/components/ui/monograma'
import { coincide } from '@/lib/texto'
import { mensajeError } from '@/lib/errores'
import { nombreDePila } from '@/modules/recibos/reglas'
import { puedeRecibir, resumen, TANDA, type Candidato } from '@/modules/recibos/onboarding-servidor'
import { cn } from '@/lib/utils'

/**
 * El mail de onboarding de la firma: a quién se le mandó, quién ya dejó su
 * firma y a quién le falta.
 *
 * Dos decisiones que no son obvias:
 *
 *  · El envío va de a {@link TANDA} llamadas seguidas y no de una. Son ~94
 *    mails por SMTP y en una sola request se pasa del tiempo de la función;
 *    de a tandas, además, la pantalla puede mostrar el avance, que en algo
 *    que tarda un minuto no es decoración.
 *  · El botón pide confirmación en el lugar, no con un `confirm()` del
 *    navegador. Es lo único de todo el sistema que le escribe a 94 personas
 *    de verdad: tiene que verse a quién y cuántos antes de apretar.
 */

type Estado = 'firmo' | 'enviado' | 'error' | 'falta' | 'listo'

const ESTILO: Record<Estado, { label: string; clase: string; punto: string }> = {
  firmo:   { label: 'Firma cargada',  clase: 'bg-success-subtle text-success-text', punto: 'bg-success' },
  enviado: { label: 'Mail enviado',   clase: 'bg-accent text-accent-foreground',    punto: 'bg-primary' },
  error:   { label: 'No salió',       clase: 'bg-danger-subtle text-danger-text',   punto: 'bg-danger' },
  falta:   { label: 'Faltan datos',   clase: 'bg-warning-subtle text-warning-text', punto: 'bg-warning' },
  listo:   { label: 'Sin mandar',     clase: 'bg-muted text-texto-2',               punto: 'bg-muted-foreground/40' },
}

function estadoDe(c: Candidato): Estado {
  if (c.tieneFirma) return 'firmo'
  if (c.error) return 'error'
  if (c.enviadoAt) return 'enviado'
  if (!c.email || !c.tieneCuil) return 'falta'
  return 'listo'
}

function Pastilla({ estado }: { estado: Estado }) {
  const s = ESTILO[estado]
  return (
    <span className={cn('inline-flex h-6 items-center gap-1.5 rounded-full px-2.5 text-xs font-medium', s.clase)}>
      <span className={cn('size-1.5 shrink-0 rounded-full', s.punto)} />
      {s.label}
    </span>
  )
}

const FILTROS = [
  { key: 'todos', label: 'Todos' },
  { key: 'listo', label: 'Sin mandar' },
  { key: 'enviado', label: 'Mail enviado' },
  { key: 'firmo', label: 'Firma cargada' },
  { key: 'falta', label: 'Faltan datos' },
] as const
type Filtro = (typeof FILTROS)[number]['key']

const nombreCompleto = (c: Candidato) => `${c.apellido ?? ''} ${c.nombre}`.trim()

export default function FirmasClient({ candidatos, canal }: { candidatos: Candidato[]; canal: boolean }) {
  const router = useRouter()
  const [busqueda, setBusqueda] = useState('')
  const [filtro, setFiltro] = useState<Filtro>('todos')
  const [elegidos, setElegidos] = useState<Set<string>>(new Set())
  const [confirmando, setConfirmando] = useState(false)
  const [progreso, setProgreso] = useState<{ hechos: number; total: number } | null>(null)

  const nums = useMemo(() => resumen(candidatos), [candidatos])
  const enviando = progreso !== null

  const visibles = useMemo(
    () =>
      candidatos.filter(
        (c) =>
          (filtro === 'todos' || estadoDe(c) === filtro) &&
          coincide(busqueda, nombreCompleto(c), c.empresa, c.email)
      ),
    [candidatos, filtro, busqueda]
  )

  // Solo se puede elegir a quien de verdad se le puede mandar. Lo que está
  // elegido y dejó de ser elegible (otro mandó el mail desde otra pestaña) se
  // cae solo acá y no llega al servidor.
  const elegibles = useMemo(() => visibles.filter(puedeRecibir), [visibles])
  const aEnviar = useMemo(() => elegibles.filter((c) => elegidos.has(c.id)), [elegibles, elegidos])
  const todosElegidos = elegibles.length > 0 && aEnviar.length === elegibles.length

  function alternarTodos() {
    setElegidos((p) => {
      const s = new Set(p)
      if (todosElegidos) elegibles.forEach((c) => s.delete(c.id))
      else elegibles.forEach((c) => s.add(c.id))
      return s
    })
  }

  function alternar(id: string) {
    setElegidos((p) => {
      const s = new Set(p)
      if (s.has(id)) s.delete(id)
      else s.add(id)
      return s
    })
  }

  async function enviar() {
    const ids = aEnviar.map((c) => c.id)
    setConfirmando(false)
    setProgreso({ hechos: 0, total: ids.length })

    let enviados = 0
    const fallaron: string[] = []
    try {
      for (let i = 0; i < ids.length; i += TANDA) {
        const trozo = ids.slice(i, i + TANDA)
        const res = await fetch('/api/recibos/onboarding', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ids: trozo }),
        })
        const json = await res.json().catch(() => null)
        if (!res.ok) throw new Error(json?.error ?? `El servidor respondió ${res.status}`)

        enviados += json.enviados ?? 0
        for (const r of json.resultados ?? []) {
          if (r.estado !== 'enviado') {
            const quien = candidatos.find((c) => c.id === r.id)
            fallaron.push(`${quien ? nombreDePila(quien.nombre) + ' ' + (quien.apellido ?? '') : 'alguien'}: ${r.motivo}`)
          }
        }
        setProgreso({ hechos: Math.min(i + TANDA, ids.length), total: ids.length })
      }

      if (fallaron.length === 0) {
        toast.success(enviados === 1 ? 'Se mandó 1 mail.' : `Se mandaron ${enviados} mails.`)
      } else {
        toast.warning(
          `Salieron ${enviados} de ${ids.length}. No salieron: ${fallaron.slice(0, 3).join(' · ')}` +
            (fallaron.length > 3 ? ` y ${fallaron.length - 3} más.` : '.')
        )
      }
    } catch (e) {
      // Se corta la tanda: lo que ya salió, salió, y queda registrado. La
      // pantalla se refresca igual para que se vea exactamente hasta dónde
      // llegó en vez de dejar la lista vieja.
      toast.error(`Se cortó el envío después de ${enviados}. ${mensajeError(e, 'mandar los mails')}`)
    } finally {
      setProgreso(null)
      setElegidos(new Set())
      router.refresh()
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 pt-2 pb-28 md:px-7 md:pt-6">
      <h1 className="text-[28px] font-semibold leading-tight tracking-[-0.02em]">Firmas de recibos</h1>

      {!canal && (
        <div className="flex items-start gap-3 rounded-2xl border border-warning-subtle bg-warning-subtle px-4 py-3 text-sm text-warning-text">
          <Warning className="mt-0.5 size-[18px] shrink-0" weight="bold" />
          <p>
            Falta configurar el envío de mails en el servidor (la casilla y la dirección pública del
            sistema). Hasta que estén, el botón de enviar no va a funcionar.
          </p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { n: nums.firmaron, t: 'Firma cargada', c: 'text-success' },
          { n: nums.enviados, t: 'Mail enviado', c: 'text-foreground' },
          { n: nums.listos, t: 'Sin mandar', c: 'text-foreground' },
          { n: nums.sinDatos, t: 'Faltan datos', c: nums.sinDatos ? 'text-warning' : 'text-foreground' },
        ].map((k) => (
          <div key={k.t} className="rounded-2xl border border-border bg-card p-4 shadow-tarjeta">
            <p className={cn('text-2xl font-semibold tabular-nums tracking-tight', k.c)}>{k.n}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">{k.t}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-1.5 rounded-[12px] bg-muted p-1">
          {FILTROS.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setFiltro(f.key)}
              className={cn(
                'h-8 rounded-[9px] px-3 text-sm font-medium transition-colors',
                filtro === f.key ? 'bg-card text-foreground shadow-sm' : 'text-texto-2 hover:text-foreground'
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
        <input
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar por nombre o empresa"
          aria-label="Buscar"
          className="min-h-10 min-w-[220px] flex-1 rounded-[10px] border border-input bg-card px-3 py-2 text-sm focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/15"
        />
      </div>

      <div className="overflow-x-auto rounded-2xl border border-border bg-card shadow-tarjeta">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b border-border text-left text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              <th className="w-10 px-4 py-3">
                <input
                  type="checkbox"
                  checked={todosElegidos}
                  onChange={alternarTodos}
                  disabled={enviando || elegibles.length === 0}
                  aria-label="Elegir a todos los que se pueden mandar"
                  className="size-4 accent-[var(--primary)]"
                />
              </th>
              <th className="px-2 py-3">Persona</th>
              <th className="px-3 py-3">Empresa</th>
              <th className="px-3 py-3">Mail</th>
              <th className="px-3 py-3">Estado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {visibles.map((c) => {
              const estado = estadoDe(c)
              const elegible = puedeRecibir(c)
              return (
                <tr key={c.id} className={cn(elegidos.has(c.id) && 'bg-accent/40')}>
                  <td className="px-4 py-2.5">
                    <input
                      type="checkbox"
                      checked={elegidos.has(c.id)}
                      onChange={() => alternar(c.id)}
                      disabled={!elegible || enviando}
                      aria-label={`Mandarle el mail a ${nombreCompleto(c)}`}
                      className="size-4 accent-[var(--primary)] disabled:opacity-30"
                    />
                  </td>
                  <td className="px-2 py-2.5">
                    <div className="flex items-center gap-2.5">
                      <Monograma nombre={nombreCompleto(c)} size="sm" redondo />
                      <span className="font-medium">{nombreCompleto(c)}</span>
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-muted-foreground">{c.empresa}</td>
                  <td className="px-3 py-2.5 text-muted-foreground">
                    {c.email ?? <span className="text-warning-text">—</span>}
                    {!c.tieneCuil && <span className="ml-2 text-xs text-warning-text">sin CUIL</span>}
                  </td>
                  <td className="px-3 py-2.5">
                    <Pastilla estado={estado} />
                    {estado === 'error' && <p className="mt-1 text-xs text-muted-foreground">{c.error}</p>}
                  </td>
                </tr>
              )
            })}
            {visibles.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-sm text-muted-foreground">
                  No hay nadie con ese filtro.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Barra de acción: aparece sola cuando hay alguien elegido o mientras manda. */}
      {(aEnviar.length > 0 || enviando) && (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-card/95 px-4 py-3 shadow-flotante backdrop-blur md:px-7">
          <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3">
            {enviando ? (
              <>
                <p className="text-sm text-texto-2">
                  Mandando… <span className="font-semibold tabular-nums">{progreso.hechos}</span> de{' '}
                  <span className="tabular-nums">{progreso.total}</span>
                </p>
                <div className="h-1.5 w-40 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary transition-[width]"
                    style={{ width: `${Math.round((progreso.hechos / Math.max(progreso.total, 1)) * 100)}%` }}
                  />
                </div>
              </>
            ) : confirmando ? (
              <>
                <p className="flex items-center gap-2 text-sm font-medium">
                  <WarningCircle className="size-[18px] text-warning" weight="fill" />
                  Les llega el mail a {aEnviar.length} {aEnviar.length === 1 ? 'persona' : 'personas'}. ¿Va?
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setConfirmando(false)}
                    className="h-10 rounded-[10px] border border-border-strong bg-card px-4 text-sm font-semibold text-foreground hover:bg-muted"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={enviar}
                    className="h-10 rounded-[10px] bg-primary px-4 text-sm font-semibold text-primary-foreground transition-[background-color,transform] hover:bg-primary-hover active:scale-[0.97]"
                  >
                    Sí, mandar
                  </button>
                </div>
              </>
            ) : (
              <>
                <p className="flex items-center gap-2 text-sm text-texto-2">
                  <CheckCircle className="size-[18px] text-primary" weight="fill" />
                  {aEnviar.length} {aEnviar.length === 1 ? 'elegida' : 'elegidas'}
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setElegidos(new Set())}
                    className="h-10 rounded-[10px] border border-border-strong bg-card px-4 text-sm font-semibold text-foreground hover:bg-muted"
                  >
                    Deseleccionar
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmando(true)}
                    disabled={!canal}
                    className="inline-flex h-10 items-center gap-2 rounded-[10px] bg-primary px-4 text-sm font-semibold text-primary-foreground transition-[background-color,transform] hover:bg-primary-hover disabled:opacity-50 active:scale-[0.97]"
                  >
                    <EnvelopeSimple className="size-[18px]" weight="bold" />
                    Mandar el mail
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
