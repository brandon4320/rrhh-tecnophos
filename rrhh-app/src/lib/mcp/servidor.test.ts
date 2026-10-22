import { describe, expect, it } from 'vitest'
import { atenderMcp, claveDelPedido, ErrorHerramienta, hashClave, nuevaClave, validar, type Herramienta } from './servidor'

const eco: Herramienta<{ quien: string }> = {
  nombre: 'eco',
  titulo: 'Eco',
  descripcion: 'Devuelve lo que recibe',
  entrada: { type: 'object', properties: { texto: { type: 'string' }, n: { type: 'integer', minimum: 1 } }, required: ['texto'] },
  soloLectura: true,
  ejecutar: async (a, ctx) => ({ texto: a.texto, quien: ctx.quien }),
}
const falla: Herramienta<{ quien: string }> = {
  nombre: 'falla',
  titulo: 'Falla',
  descripcion: 'Siempre falla',
  entrada: { type: 'object', properties: {} },
  soloLectura: false,
  ejecutar: async () => {
    throw new ErrorHerramienta('No encontré esa oportunidad.')
  },
}
const op = { nombre: 'prueba', titulo: 'Prueba', version: '1', instrucciones: 'hola', herramientas: [eco, falla], ctx: { quien: 'Juan' } }

interface J {
  result: { protocolVersion: string; capabilities: { tools: unknown }; tools: { name: string; annotations: { readOnlyHint: boolean } }[]; isError: boolean; structuredContent: unknown; content: { text: string }[] }
  error: { code: number }
}
const json = async (r: Promise<Response>) => (await (await r).json()) as J
const post = (cuerpo: unknown) => atenderMcp(new Request('https://x/mcp', { method: 'POST', body: JSON.stringify(cuerpo), headers: { 'content-type': 'application/json' } }), op)

describe('atenderMcp', () => {
  it('initialize negocia la versión', async () => {
    const r = await json(post({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-03-26' } }))
    expect(r.result.protocolVersion).toBe('2025-03-26')
    expect(r.result.capabilities.tools).toBeDefined()
    const otra = await json(post({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '1999-01-01' } }))
    expect(otra.result.protocolVersion).toBe('2025-06-18')
  })
  it('las notificaciones no llevan respuesta', async () => {
    const r = await post({ jsonrpc: '2.0', method: 'notifications/initialized' })
    expect(r.status).toBe(202)
  })
  it('tools/list con las anotaciones', async () => {
    const r = await json(post({ jsonrpc: '2.0', id: 2, method: 'tools/list' }))
    expect(r.result.tools.map((t: { name: string }) => t.name)).toEqual(['eco', 'falla'])
    expect(r.result.tools[0].annotations.readOnlyHint).toBe(true)
  })
  it('tools/call con el contexto de quien pide', async () => {
    const r = await json(post({ jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'eco', arguments: { texto: 'hola' } } }))
    expect(r.result.isError).toBe(false)
    expect(r.result.structuredContent).toEqual({ texto: 'hola', quien: 'Juan' })
  })
  it('argumentos inválidos y errores de la herramienta vuelven como resultado para la IA', async () => {
    const a = await json(post({ jsonrpc: '2.0', id: 4, method: 'tools/call', params: { name: 'eco', arguments: { n: 0 } } }))
    expect(a.result.isError).toBe(true)
    expect(a.result.content[0].text).toContain('falta "texto"')
    const b = await json(post({ jsonrpc: '2.0', id: 5, method: 'tools/call', params: { name: 'falla', arguments: {} } }))
    expect(b.result).toMatchObject({ isError: true, content: [{ text: 'No encontré esa oportunidad.' }] })
  })
  it('herramienta o método desconocido = error JSON-RPC', async () => {
    expect((await json(post({ jsonrpc: '2.0', id: 6, method: 'tools/call', params: { name: 'nada' } }))).error.code).toBe(-32602)
    expect((await json(post({ jsonrpc: '2.0', id: 7, method: 'resources/list' }))).error.code).toBe(-32601)
  })
  it('lotes y GET', async () => {
    const r = (await (await post([{ jsonrpc: '2.0', id: 1, method: 'ping' }, { jsonrpc: '2.0', method: 'notifications/x' }])).json()) as unknown[]
    expect(r).toHaveLength(1)
    expect((await atenderMcp(new Request('https://x/mcp'), op)).status).toBe(405)
  })
})

describe('validar', () => {
  it('tipos, enum y rangos', () => {
    expect(validar({ type: 'string', enum: ['a', 'b'] }, 'c')).toContain('uno de')
    expect(validar({ type: 'integer', maximum: 10 }, 11)).toContain('como mucho')
    expect(validar({ type: 'array', items: { type: 'string' } }, ['a', 1])).toContain('texto')
  })
})

describe('claves', () => {
  it('formato, hash y encabezado', async () => {
    const c = nuevaClave('crm')
    expect(c).toMatch(/^crm_[A-Za-z0-9]{40}$/)
    expect(await hashClave('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad')
    expect(claveDelPedido(new Request('https://x', { headers: { authorization: `Bearer ${c}` } }), 'crm')).toBe(c)
    expect(claveDelPedido(new Request('https://x', { headers: { authorization: 'Bearer ges_x' } }), 'crm')).toBeNull()
  })
})
