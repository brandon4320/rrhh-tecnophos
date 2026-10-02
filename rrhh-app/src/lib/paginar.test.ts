import { describe, expect, it } from 'vitest'
import { traerTodo } from './paginar'

function fuente(total: number) {
  const filas = Array.from({ length: total }, (_, i) => i)
  const pedidos: [number, number][] = []
  const pagina = async (desde: number, hasta: number) => {
    pedidos.push([desde, hasta])
    return { data: filas.slice(desde, hasta + 1), error: null }
  }
  return { pagina, pedidos }
}

describe('traerTodo', () => {
  it('junta todas las páginas hasta que una vuelve corta', async () => {
    const { pagina, pedidos } = fuente(25)
    const res = await traerTodo(pagina, 10)
    expect(res.data).toHaveLength(25)
    expect(res.data?.[24]).toBe(24)
    expect(pedidos).toEqual([[0, 9], [10, 19], [20, 29]])
  })

  it('con un múltiplo exacto pide una página más (vacía) y corta', async () => {
    const { pagina, pedidos } = fuente(20)
    const res = await traerTodo(pagina, 10)
    expect(res.data).toHaveLength(20)
    expect(pedidos).toHaveLength(3)
  })

  it('un error en cualquier página devuelve el error, no datos a medias', async () => {
    let n = 0
    const res = await traerTodo(async () => {
      n++
      return n === 2 ? { data: null, error: { message: 'boom' } } : { data: [1, 2], error: null }
    }, 2)
    expect(res).toEqual({ data: null, error: { message: 'boom' } })
  })
})
