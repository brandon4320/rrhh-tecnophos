import { describe, expect, it } from 'vitest'
import { buscarDuplicado, claveNombre } from './empleados'

describe('claveNombre', () => {
  it('ignora mayúsculas, acentos, espacios y el orden', () => {
    expect(claveNombre('PÉREZ  JUAN')).toBe(claveNombre('Juan', 'Perez'))
    expect(claveNombre('  juan ', ' pérez')).toBe('juan perez')
  })
  it('vacío da clave vacía', () => {
    expect(claveNombre('', null)).toBe('')
  })
})

describe('buscarDuplicado', () => {
  const existentes = [
    { id: '1', nombre: 'PEREZ JUAN', apellido: null, activo: false },
    { id: '2', nombre: 'María', apellido: 'Gómez', activo: true },
  ]

  it('encuentra al mismo aunque el apellido esté pegado al nombre', () => {
    expect(buscarDuplicado(existentes, 'Juan', 'Pérez')?.id).toBe('1')
    expect(buscarDuplicado(existentes, 'gomez maria')?.id).toBe('2')
  })

  it('incluye a los dados de baja', () => {
    expect(buscarDuplicado(existentes, 'Juan Perez')?.activo).toBe(false)
  })

  it('no confunde nombres que solo comparten palabras', () => {
    expect(buscarDuplicado(existentes, 'Juan Carlos', 'Pérez')).toBeUndefined()
    expect(buscarDuplicado(existentes, 'María')).toBeUndefined()
  })
})
