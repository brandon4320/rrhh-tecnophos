import { describe, expect, it } from 'vitest'
import { coincide, normalizarTexto } from './texto'

describe('normalizarTexto', () => {
  it('saca acentos y mayúsculas', () => {
    expect(normalizarTexto('  Martínez ÑANDÚ ')).toBe('martinez nandu')
  })
})

describe('coincide', () => {
  it('busca por palabras en cualquier orden y en varios campos', () => {
    expect(coincide('perez juan', 'Juan', 'Pérez')).toBe(true)
    expect(coincide('PEREZ JUAN', 'JUAN CARLOS PEREZ')).toBe(true)
    expect(coincide('camisa 44', 'Camisa ADC T 44')).toBe(true)
    expect(coincide('arnes', 'Arnés casco')).toBe(true)
  })
  it('exige todas las palabras', () => {
    expect(coincide('camisa 46', 'Camisa ADC T 44')).toBe(false)
  })
  it('búsqueda vacía coincide con todo', () => {
    expect(coincide('   ', 'lo que sea')).toBe(true)
  })
})
