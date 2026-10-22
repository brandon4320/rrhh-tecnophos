'use client'

// Las claves de IA propias: la dirección del MCP para copiar, crear una clave (se ve UNA sola vez) y
// revocar las que no se usan.
import { useState, useTransition } from 'react'
import { Check, Copy, KeyRound, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { crearClaveIa, revocarClaveIa } from './acciones'

export const URL_MCP = 'https://gestion.tecnophos.com.ar/api/mcp'

interface Clave {
  id: string
  nombre: string
  prefijo: string
  creada: string
  ultimoUso: string | null
}

function Copiar({ texto, etiqueta }: { texto: string; etiqueta: string }) {
  const [copiado, setCopiado] = useState(false)
  return (
    <button
      type="button"
      onClick={() =>
        navigator.clipboard.writeText(texto).then(
          () => {
            setCopiado(true)
            setTimeout(() => setCopiado(false), 1500)
          },
          () => toast.error('No se pudo copiar. Seleccioná el texto y copialo a mano.')
        )
      }
      aria-label={etiqueta}
      className="inline-flex h-9 shrink-0 cursor-pointer items-center gap-1.5 rounded-[10px] border border-border-strong bg-card px-3 text-sm font-medium transition-[background-color,transform] hover:bg-muted active:scale-[0.97]"
    >
      {copiado ? <Check className="size-4 text-success" strokeWidth={2} /> : <Copy className="size-4" strokeWidth={1.75} />}
      {copiado ? 'Copiado' : 'Copiar'}
    </button>
  )
}

const caja = 'flex items-center gap-2 rounded-[10px] border border-border bg-muted px-3 py-2'

export function ClavesIa({ claves }: { claves: Clave[] }) {
  const [nombre, setNombre] = useState('')
  const [nueva, setNueva] = useState<string | null>(null)
  const [pendiente, startTransition] = useTransition()

  function crear() {
    startTransition(async () => {
      const r = await crearClaveIa(nombre || 'Grok')
      if (r.error) return void toast.error(r.error)
      setNueva(r.clave ?? null)
      setNombre('')
    })
  }

  function revocar(c: Clave) {
    startTransition(async () => {
      const r = await revocarClaveIa(c.id)
      if (r.error) toast.error(r.error)
      else toast.success(`Clave "${c.nombre}" revocada`)
    })
  }

  return (
    <>
      <section className="space-y-3 rounded-2xl border border-border bg-card p-5 shadow-tarjeta sm:p-6">
        <h2 className="text-base font-semibold tracking-tight">Dirección del servidor MCP</h2>
        <div className={caja}>
          <code className="min-w-0 flex-1 truncate font-mono text-sm">{URL_MCP}</code>
          <Copiar texto={URL_MCP} etiqueta="Copiar la dirección" />
        </div>
      </section>

      <section className="space-y-4 rounded-2xl border border-border bg-card p-5 shadow-tarjeta sm:p-6">
        <h2 className="text-base font-semibold tracking-tight">Claves</h2>

        {nueva && (
          <div className="space-y-2 rounded-xl border border-success/25 bg-success-subtle p-4">
            <p className="text-sm font-medium text-success-text">Copiala ahora: no se vuelve a mostrar.</p>
            <div className={`${caja} bg-card`}>
              <code className="min-w-0 flex-1 break-all font-mono text-sm">{nueva}</code>
              <Copiar texto={nueva} etiqueta="Copiar la clave" />
            </div>
          </div>
        )}

        <form
          onSubmit={(e) => {
            e.preventDefault()
            crear()
          }}
          className="flex flex-wrap gap-2"
        >
          <input
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            maxLength={60}
            placeholder="Grok"
            aria-label="Nombre de la clave"
            className="min-h-10 min-w-[200px] flex-1 rounded-[10px] border border-input bg-card px-3 py-2 text-sm focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/15"
          />
          <button
            type="submit"
            disabled={pendiente}
            className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-[10px] bg-primary px-4 text-sm font-semibold text-primary-foreground transition-[background-color,transform] hover:bg-primary-hover active:scale-[0.97] disabled:opacity-50"
          >
            <Plus className="size-4" strokeWidth={2.5} />
            Nueva clave
          </button>
        </form>

        {claves.length > 0 && (
          <ul className="divide-y divide-divisor rounded-xl border border-border">
            {claves.map((c) => (
              <li key={c.id} className="flex items-center gap-3 px-4 py-3">
                <KeyRound className="size-4 shrink-0 text-muted-foreground" strokeWidth={1.75} aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {c.nombre} <span className="font-mono text-xs text-muted-foreground">{c.prefijo}</span>
                  </p>
                  <p className="text-xs text-muted-foreground">{c.ultimoUso ? `Usada ${c.ultimoUso}` : `Creada ${c.creada}`}</p>
                </div>
                <button
                  type="button"
                  onClick={() => revocar(c)}
                  disabled={pendiente}
                  className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-[10px] px-2.5 text-[13px] font-medium text-danger-text transition-colors hover:bg-danger-subtle disabled:opacity-50"
                >
                  <Trash2 className="size-3.5" strokeWidth={1.75} />
                  Revocar
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  )
}
