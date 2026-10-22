import { describe, expect, it } from 'vitest'
import { alternarOrden, comparar, escribirOrden, leerOrden } from './orden'

const CAMPOS = ['nombre', 'empresa'] as const
const DEF = { campo: 'nombre', dir: 'asc' } as const

describe('leerOrden / escribirOrden', () => {
  it('lee asc y desc', () => {
    expect(leerOrden('empresa', CAMPOS, DEF)).toEqual({ campo: 'empresa', dir: 'asc' })
    expect(leerOrden('-empresa', CAMPOS, DEF)).toEqual({ campo: 'empresa', dir: 'desc' })
  })
  it('un campo desconocido vuelve al de por defecto', () => expect(leerOrden('-otro', CAMPOS, DEF)).toEqual(DEF))
  it('ida y vuelta', () => expect(escribirOrden({ campo: 'empresa', dir: 'desc' })).toBe('-empresa'))
})

describe('alternarOrden', () => {
  it('la misma columna invierte', () => expect(alternarOrden(DEF, 'nombre')).toEqual({ campo: 'nombre', dir: 'desc' }))
  it('otra columna arranca en su dirección', () => expect(alternarOrden(DEF, 'empresa', 'desc')).toEqual({ campo: 'empresa', dir: 'desc' }))
})

describe('comparar', () => {
  it('sin acentos ni mayúsculas', () => expect(comparar('ÁLVAREZ', 'alvarez')).toBe(0))
  it('números', () => expect(comparar(2, 10)).toBeLessThan(0))
  it('lo vacío al final en las dos direcciones', () => {
    expect(comparar(null, 'a')).toBeGreaterThan(0)
    expect(comparar(null, 'a', 'desc')).toBeGreaterThan(0)
  })
  it('descendente', () => expect(comparar('a', 'b', 'desc')).toBeGreaterThan(0))
})
