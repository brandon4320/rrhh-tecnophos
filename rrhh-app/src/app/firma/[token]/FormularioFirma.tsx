'use client'

import { useRef, useState } from 'react'
import { Check, FileText, Loader2, PenLine, ShieldCheck, X } from 'lucide-react'
import PadFirma, { type PadFirmaHandle } from './PadFirma'

interface ReciboVisible {
  id: string
  estado: string
  tipo: string
  periodo: string
  nombre: string
  url: string | null
}

interface Datos {
  nombre: string
  firmaUrl: string | null
  recibos: ReciboVisible[]
}

/**
 * Confirmación de identidad, lista de recibos y firma.
 *
 * Se firma de a UNO. Cada liquidación es un documento aparte y "firmar todo"
 * dejaría una sola fecha para varias cosas distintas. Lo que sí se reusa es el
 * dibujo: se hace con el dedo una vez y después cada recibo es un toque.
 *
 * Los 4 números del CUIL quedan en memoria mientras dura la pantalla porque
 * cada pedido al servidor los vuelve a pedir: no hay sesión ni cookie, el link
 * no deja nada abierto.
 */
export default function FormularioFirma({ token }: { token: string }) {
  const [cuil4, setCuil4] = useState('')
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [datos, setDatos] = useState<Datos | null>(null)

  // Qué recibo se está firmando y cómo.
  const [firmando, setFirmando] = useState<ReciboVisible | null>(null)
  const [dibujando, setDibujando] = useState(false)
  const [hayTrazo, setHayTrazo] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [errorFirma, setErrorFirma] = useState<string | null>(null)
  const pad = useRef<PadFirmaHandle>(null)

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

  function abrirFirma(r: ReciboVisible) {
    setFirmando(r)
    setErrorFirma(null)
    setHayTrazo(false)
    // Sin firma guardada no hay nada que reusar: se abre directo en el lienzo.
    setDibujando(!datos?.firmaUrl)
  }

  function cerrarFirma() {
    if (guardando) return
    setFirmando(null)
    setErrorFirma(null)
  }

  async function firmar(conDibujo: boolean) {
    if (!firmando || guardando) return
    let firma: string | null = null
    if (conDibujo) {
      firma = pad.current?.exportar() ?? null
      if (!firma) {
        setErrorFirma('Hacé tu firma un poco más grande para que se vea en el recibo.')
        return
      }
    }
    setGuardando(true)
    setErrorFirma(null)
    try {
      const res = await fetch(`/api/firma/${encodeURIComponent(token)}/firmar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cuil4, reciboId: firmando.id, ...(firma ? { firma } : {}) }),
      })
      const payload = await res.json().catch(() => null)
      if (!res.ok) {
        // La firma guardada se perdió (o nunca estuvo): se le pide el dibujo.
        if (payload?.sinFirma) {
          setDibujando(true)
          setErrorFirma('Dibujá tu firma para seguir.')
          return
        }
        setErrorFirma(payload?.error ?? 'No se pudo firmar. Probá de nuevo.')
        return
      }
      const firmado = payload.recibo as ReciboVisible
      setDatos((d) =>
        d
          ? {
              ...d,
              // Si acaba de dibujar, la de arriba es la nueva: la próxima vez
              // se le ofrece esta.
              firmaUrl: firma ? firma : d.firmaUrl,
              recibos: d.recibos.map((r) => (r.id === firmado.id ? { ...r, ...firmado } : r)),
            }
          : d
      )
      setFirmando(null)
    } catch {
      setErrorFirma('No hay conexión. Fijate la señal y probá de nuevo.')
    } finally {
      setGuardando(false)
    }
  }

  // ------------------------------------------------------------
  // Pedir los 4 números
  // ------------------------------------------------------------
  if (!datos) {
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

  // ------------------------------------------------------------
  // Los recibos
  // ------------------------------------------------------------
  const pendientes = datos.recibos.filter((r) => r.estado !== 'firmado')
  const firmados = datos.recibos.filter((r) => r.estado === 'firmado')

  return (
    <div className="space-y-5">
      <div>
        <p className="text-sm text-muted-foreground">Hola</p>
        <h2 className="text-[22px] font-semibold leading-tight tracking-[-0.02em]">{datos.nombre}</h2>
      </div>

      {datos.recibos.length === 0 && (
        <div className="rounded-2xl border border-border bg-card p-5 text-center shadow-tarjeta">
          <p className="text-sm font-medium">No tenés recibos para firmar</p>
          <p className="mt-1 text-sm text-muted-foreground">Cuando haya uno nuevo te llega un mail.</p>
        </div>
      )}

      {pendientes.length > 0 && (
        <>
          <p className="text-sm text-muted-foreground">
            {pendientes.length === 1
              ? 'Tenés 1 recibo para revisar y firmar.'
              : `Tenés ${pendientes.length} recibos para revisar y firmar.`}
          </p>
          <ul className="space-y-3">
            {pendientes.map((r) => (
              <li key={r.id} className="rounded-2xl border border-border bg-card p-4 shadow-tarjeta">
                <div className="flex items-center gap-3">
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
                </div>
                <button
                  type="button"
                  onClick={() => abrirFirma(r)}
                  className="mt-3 inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-[10px] bg-primary px-4 text-sm font-semibold text-primary-foreground transition-[background-color,transform] hover:bg-primary-hover active:scale-[0.97]"
                >
                  <PenLine className="size-4" strokeWidth={1.75} />
                  Firmar
                </button>
              </li>
            ))}
          </ul>
        </>
      )}

      {firmados.length > 0 && (
        <div className="space-y-3">
          <p className="text-sm font-medium">Ya firmaste</p>
          <ul className="space-y-3">
            {firmados.map((r) => (
              <li
                key={r.id}
                className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4 shadow-tarjeta"
              >
                <Check className="size-5 shrink-0 text-success" strokeWidth={2} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{r.periodo}</p>
                  <p className="truncate text-xs text-muted-foreground">{r.tipo}</p>
                </div>
                {r.url && (
                  <a
                    href={r.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="shrink-0 rounded-[10px] border border-border-strong bg-card px-3 py-2 text-xs font-medium hover:bg-muted"
                  >
                    Ver firmado
                  </a>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* ---------------------------------------------------------- */}
      {/* La hoja de firma */}
      {/* ---------------------------------------------------------- */}
      {firmando && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Firmar ${firmando.periodo}`}
          className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/40 p-0 sm:items-center sm:p-4"
        >
          <div className="max-h-dvh w-full max-w-md overflow-y-auto rounded-t-2xl border border-border bg-card p-5 shadow-flotante sm:rounded-2xl">
            <div className="mb-4 flex items-start gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">Firmar {firmando.periodo}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{firmando.tipo}</p>
              </div>
              <button
                type="button"
                onClick={cerrarFirma}
                aria-label="Cerrar"
                className="-m-1 rounded-[10px] p-1 text-muted-foreground hover:bg-muted"
              >
                <X className="size-5" strokeWidth={1.75} />
              </button>
            </div>

            {dibujando ? (
              <PadFirma ref={pad} onCambio={setHayTrazo} />
            ) : (
              <div className="rounded-[10px] border border-input bg-white p-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={datos.firmaUrl ?? ''} alt="Tu firma" className="mx-auto h-24 object-contain" />
              </div>
            )}

            {errorFirma && <p className="mt-3 text-sm text-danger-text">{errorFirma}</p>}

            <button
              type="button"
              onClick={() => firmar(dibujando)}
              disabled={guardando || (dibujando && !hayTrazo)}
              className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-[10px] bg-primary px-4 font-semibold text-primary-foreground transition-[background-color,transform] hover:bg-primary-hover active:scale-[0.97] disabled:opacity-50"
            >
              {guardando && <Loader2 className="size-4 animate-spin" />}
              {guardando ? 'Firmando...' : `Firmar ${firmando.periodo}`}
            </button>

            {!dibujando && (
              <button
                type="button"
                onClick={() => {
                  setDibujando(true)
                  setHayTrazo(false)
                  setErrorFirma(null)
                }}
                disabled={guardando}
                className="mt-2 inline-flex min-h-10 w-full items-center justify-center rounded-[10px] border border-border-strong bg-card px-4 text-sm font-medium hover:bg-muted disabled:opacity-50"
              >
                Hacer otra firma
              </button>
            )}

            <p className="mt-3 text-center text-xs text-muted-foreground">
              Tu firma queda estampada en el PDF del recibo.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
