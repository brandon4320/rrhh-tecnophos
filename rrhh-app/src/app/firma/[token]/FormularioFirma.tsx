'use client'

import { useState } from 'react'
import { FileText, Loader2, ShieldCheck } from 'lucide-react'

interface ReciboVisible {
  id: string
  tipo: string
  periodo: string
  nombre: string
  url: string | null
}

interface Datos {
  nombre: string
  recibos: ReciboVisible[]
}

/**
 * Confirmación de identidad y lista de recibos. Hasta que los 4 números no
 * coinciden, el server no manda NADA del empleado: ni el nombre ni cuántos
 * recibos tiene.
 */
export default function FormularioFirma({ token }: { token: string }) {
  const [cuil4, setCuil4] = useState('')
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [datos, setDatos] = useState<Datos | null>(null)

  async function confirmar(e: React.FormEvent) {
    e.preventDefault()
    if (cuil4.length !== 4 || cargando) return
    setCargando(true)
    setError(null)
    try {
      const res = await fetch(`/api/firma/${encodeURIComponent(token)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cuil4 }),
      })
      const payload = await res.json().catch(() => null)
      if (!res.ok) {
        setError(payload?.error ?? 'No se pudo verificar. Probá de nuevo.')
        setCuil4('')
        return
      }
      setDatos(payload as Datos)
    } catch {
      setError('No hay conexión. Fijate la señal y probá de nuevo.')
    } finally {
      setCargando(false)
    }
  }

  if (datos) {
    return (
      <div className="space-y-5">
        <div>
          <p className="text-sm text-muted-foreground">Hola</p>
          <h2 className="text-[22px] font-semibold leading-tight tracking-[-0.02em]">{datos.nombre}</h2>
        </div>

        {datos.recibos.length === 0 ? (
          <div className="rounded-2xl border border-border bg-card p-5 text-center shadow-tarjeta">
            <p className="text-sm font-medium">No tenés recibos para firmar</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Cuando haya uno nuevo te llega un mail.
            </p>
          </div>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              {datos.recibos.length === 1
                ? 'Tenés 1 recibo para revisar y firmar.'
                : `Tenés ${datos.recibos.length} recibos para revisar y firmar.`}
            </p>
            <ul className="space-y-3">
              {datos.recibos.map((r) => (
                <li
                  key={r.id}
                  className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4 shadow-tarjeta"
                >
                  <FileText className="size-5 shrink-0 text-muted-foreground" strokeWidth={1.75} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{r.periodo}</p>
                    <p className="truncate text-xs text-muted-foreground">{r.tipo}</p>
                  </div>
                  {r.url ? (
                    <a
                      href={r.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="shrink-0 rounded-[10px] border border-border-strong bg-card px-3 py-2 text-xs font-medium hover:bg-muted"
                    >
                      Ver
                    </a>
                  ) : (
                    // El recibo existe pero el archivo no se pudo abrir. Se
                    // muestra igual: desaparecer de la lista sería peor.
                    <span className="shrink-0 text-xs text-warning-text">No se pudo abrir</span>
                  )}
                </li>
              ))}
            </ul>
            <div className="rounded-2xl border border-border bg-muted/60 p-4">
              <p className="text-sm text-muted-foreground">
                La firma se habilita en los próximos días. Por ahora podés revisar tus recibos.
              </p>
            </div>
          </>
        )}
      </div>
    )
  }

  return (
    <form onSubmit={confirmar} className="rounded-2xl border border-border bg-card p-5 shadow-tarjeta">
      <div className="mb-4 flex items-start gap-3">
        <ShieldCheck className="mt-0.5 size-5 shrink-0 text-primary" strokeWidth={1.75} />
        <div>
          <p className="text-sm font-medium">Confirmá que sos vos</p>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Escribí los <strong>últimos 4 números de tu CUIL</strong>.
          </p>
        </div>
      </div>

      <input
        type="text"
        inputMode="numeric"
        autoComplete="off"
        maxLength={4}
        value={cuil4}
        onChange={(e) => setCuil4(e.target.value.replace(/\D/g, '').slice(0, 4))}
        placeholder="0000"
        aria-label="Últimos 4 números de tu CUIL"
        className="min-h-12 w-full rounded-[10px] border border-input bg-card px-3 py-2 text-center text-2xl tracking-[0.5em] tabular-nums focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/15"
      />

      {error && <p className="mt-3 text-sm text-danger-text">{error}</p>}

      <button
        type="submit"
        disabled={cuil4.length !== 4 || cargando}
        className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-[10px] bg-primary px-4 font-semibold text-primary-foreground transition-[background-color,transform] hover:bg-primary-hover active:scale-[0.97] disabled:opacity-50"
      >
        {cargando && <Loader2 className="size-4 animate-spin" />}
        {cargando ? 'Verificando...' : 'Continuar'}
      </button>
    </form>
  )
}
