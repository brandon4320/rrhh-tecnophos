// Servidor MCP mínimo (Model Context Protocol), sin dependencias: lo que hace falta para que una IA
// (Grok, Claude, ChatGPT…) vea y use las herramientas del sistema por "Streamable HTTP" sin estado.
// Un POST con JSON-RPC 2.0 → una respuesta JSON. Sin sesiones ni SSE (el estándar los deja opcionales).
//
// El MISMO archivo vive en los dos sistemas (CRM: worker/mcp/servidor.ts; Gestión de Recursos:
// src/lib/mcp/servidor.ts). Si lo cambiás en uno, copialo al otro.
//
// Métodos: initialize, ping, tools/list, tools/call (y se ignoran las notificaciones).
// Un error de una herramienta vuelve como resultado con isError (así la IA lo lee y se corrige);
// los errores de protocolo, como error JSON-RPC.

export type EsquemaJson = {
  type: 'object' | 'string' | 'number' | 'integer' | 'boolean' | 'array'
  description?: string
  enum?: readonly (string | number)[]
  properties?: Record<string, EsquemaJson>
  required?: readonly string[]
  items?: EsquemaJson
  minimum?: number
  maximum?: number
  maxLength?: number
}

export interface Herramienta<C> {
  nombre: string
  titulo: string
  /** Para la IA: qué hace, cuándo usarla y qué devuelve. */
  descripcion: string
  entrada: EsquemaJson & { type: 'object' }
  /** true: solo lee. false: carga o cambia algo (la IA lo ve en `annotations`). */
  soloLectura: boolean
  ejecutar: (args: Record<string, unknown>, ctx: C) => Promise<unknown>
}

/** Un error para la IA (se devuelve como resultado con isError, con este mensaje). */
export class ErrorHerramienta extends Error {}

export const VERSIONES = ['2025-06-18', '2025-03-26', '2024-11-05'] as const

interface Pedido {
  jsonrpc?: string
  id?: string | number | null
  method?: string
  params?: Record<string, unknown>
}

/** Valida los argumentos contra el esquema (lo justo: requeridos, tipos, enum, rangos). Devuelve el error o null. */
export function validar(esquema: EsquemaJson, valor: unknown, ruta = 'argumentos'): string | null {
  if (esquema.type === 'object') {
    if (typeof valor !== 'object' || valor === null || Array.isArray(valor)) return `${ruta} tiene que ser un objeto`
    const obj = valor as Record<string, unknown>
    for (const r of esquema.required ?? []) if (obj[r] === undefined || obj[r] === null || obj[r] === '') return `falta "${r}"`
    for (const [k, sub] of Object.entries(esquema.properties ?? {})) {
      if (obj[k] === undefined || obj[k] === null) continue
      const e = validar(sub, obj[k], k)
      if (e) return e
    }
    return null
  }
  if (esquema.type === 'array') {
    if (!Array.isArray(valor)) return `"${ruta}" tiene que ser una lista`
    for (const [i, v] of valor.entries()) {
      const e = esquema.items ? validar(esquema.items, v, `${ruta}[${i}]`) : null
      if (e) return e
    }
    return null
  }
  if (esquema.type === 'string') {
    if (typeof valor !== 'string') return `"${ruta}" tiene que ser texto`
    if (esquema.maxLength && valor.length > esquema.maxLength) return `"${ruta}" es demasiado largo (máximo ${esquema.maxLength})`
  }
  if (esquema.type === 'number' || esquema.type === 'integer') {
    if (typeof valor !== 'number' || Number.isNaN(valor)) return `"${ruta}" tiene que ser un número`
    if (esquema.type === 'integer' && !Number.isInteger(valor)) return `"${ruta}" tiene que ser un número entero`
    if (esquema.minimum !== undefined && valor < esquema.minimum) return `"${ruta}" tiene que ser al menos ${esquema.minimum}`
    if (esquema.maximum !== undefined && valor > esquema.maximum) return `"${ruta}" tiene que ser como mucho ${esquema.maximum}`
  }
  if (esquema.type === 'boolean' && typeof valor !== 'boolean') return `"${ruta}" tiene que ser verdadero o falso`
  if (esquema.enum && !esquema.enum.includes(valor as string | number)) return `"${ruta}" tiene que ser uno de: ${esquema.enum.join(', ')}`
  return null
}

const respuesta = (id: Pedido['id'], result: unknown) => ({ jsonrpc: '2.0', id: id ?? null, result })
const error = (id: Pedido['id'], code: number, message: string) => ({ jsonrpc: '2.0', id: id ?? null, error: { code, message } })

async function atenderUno<C>(p: Pedido, op: OpcionesMcp<C>): Promise<object | null> {
  if (typeof p !== 'object' || p === null || p.jsonrpc !== '2.0' || typeof p.method !== 'string') return error(null, -32600, 'Pedido JSON-RPC inválido')
  // Notificación (sin id): no lleva respuesta.
  if (p.id === undefined) return null
  switch (p.method) {
    case 'initialize': {
      const pedida = typeof p.params?.protocolVersion === 'string' ? p.params.protocolVersion : ''
      return respuesta(p.id, {
        protocolVersion: (VERSIONES as readonly string[]).includes(pedida) ? pedida : VERSIONES[0],
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: op.nombre, title: op.titulo, version: op.version },
        instructions: op.instrucciones,
      })
    }
    case 'ping':
      return respuesta(p.id, {})
    case 'tools/list':
      return respuesta(p.id, {
        tools: op.herramientas.map((h) => ({
          name: h.nombre,
          title: h.titulo,
          description: h.descripcion,
          inputSchema: h.entrada,
          annotations: { title: h.titulo, readOnlyHint: h.soloLectura, destructiveHint: false, idempotentHint: h.soloLectura, openWorldHint: false },
        })),
      })
    case 'tools/call': {
      const nombre = p.params?.name
      const h = op.herramientas.find((x) => x.nombre === nombre)
      if (!h) return error(p.id, -32602, `No existe la herramienta "${String(nombre)}"`)
      const args = (p.params?.arguments ?? {}) as Record<string, unknown>
      const invalido = validar(h.entrada, args)
      if (invalido) return respuesta(p.id, { content: [{ type: 'text', text: `Argumentos inválidos: ${invalido}.` }], isError: true })
      try {
        const datos = await h.ejecutar(args, op.ctx)
        const texto = typeof datos === 'string' ? datos : JSON.stringify(datos)
        return respuesta(p.id, {
          content: [{ type: 'text', text: texto }],
          ...(datos && typeof datos === 'object' && !Array.isArray(datos) ? { structuredContent: datos } : {}),
          isError: false,
        })
      } catch (e) {
        const mensaje = e instanceof ErrorHerramienta ? e.message : 'Algo falló en el sistema al hacer esto. Probá de nuevo en un rato.'
        if (!(e instanceof ErrorHerramienta)) op.alFallar?.(e, h.nombre)
        return respuesta(p.id, { content: [{ type: 'text', text: mensaje }], isError: true })
      }
    }
    default:
      return error(p.id, -32601, `Método no soportado: ${p.method}`)
  }
}

export interface OpcionesMcp<C> {
  nombre: string
  titulo: string
  version: string
  instrucciones: string
  herramientas: Herramienta<C>[]
  ctx: C
  /** Para registrar un error inesperado (no se le muestra el detalle a la IA). */
  alFallar?: (e: unknown, herramienta: string) => void
}

const MAX_CUERPO = 1024 * 1024

/** Atiende un pedido HTTP al endpoint MCP (ya autenticado). */
export async function atenderMcp<C>(req: Request, op: OpcionesMcp<C>): Promise<Response> {
  if (req.method !== 'POST') return new Response('Este endpoint MCP atiende POST (Streamable HTTP, sin estado).', { status: 405, headers: { allow: 'POST' } })
  const largo = Number(req.headers.get('content-length') ?? 0)
  if (largo > MAX_CUERPO) return Response.json(error(null, -32600, 'Pedido demasiado grande'), { status: 413 })
  let cuerpo: unknown
  try {
    cuerpo = await req.json()
  } catch {
    return Response.json(error(null, -32700, 'JSON inválido'), { status: 400 })
  }
  const lote = Array.isArray(cuerpo)
  const pedidos = (lote ? cuerpo : [cuerpo]) as Pedido[]
  const salidas = (await Promise.all(pedidos.map((p) => atenderUno(p, op)))).filter((x): x is object => x !== null)
  if (!salidas.length) return new Response(null, { status: 202 })
  return Response.json(lote ? salidas : salidas[0])
}

/** Clave de IA: prefijo del sistema + 40 caracteres al azar (base62). */
export function nuevaClave(prefijo: string): string {
  const letras = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  const azar = crypto.getRandomValues(new Uint8Array(40))
  return `${prefijo}_${Array.from(azar, (b) => letras[b % 62]).join('')}`
}

/** SHA-256 en hex: en la base se guarda solo esto, nunca la clave. */
export async function hashClave(clave: string): Promise<string> {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(clave))
  return Array.from(new Uint8Array(d), (b) => b.toString(16).padStart(2, '0')).join('')
}

/** La clave del encabezado `Authorization: Bearer …` (o null). */
export function claveDelPedido(req: Request, prefijo: string): string | null {
  const m = /^Bearer\s+(\S+)$/i.exec(req.headers.get('authorization') ?? '')
  return m && m[1].startsWith(`${prefijo}_`) ? m[1] : null
}
