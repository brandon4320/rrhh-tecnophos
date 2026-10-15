import { describe, it, expect } from 'vitest'
import {
  CATEGORIA_PALAS, detallePala, esPala, fmtHorometro, ordenarPalas, validarAnio, validarHorometro,
} from './reglas'

describe('esPala', () => {
  it('reconoce la categoría aunque venga con espacios o distinta caja', () => {
    expect(esPala(CATEGORIA_PALAS)).toBe(true)
    expect(esPala('  palas cargadoras ')).toBe(true)
    expect(esPala('PALAS CARGADORAS')).toBe(true)
  })
  it('no confunde con las otras categorías de equipos', () => {
    expect(esPala('Matafuegos')).toBe(false)
    expect(esPala('Equipos de medición')).toBe(false)
    expect(esPala('')).toBe(false)
    expect(esPala(null)).toBe(false)
    expect(esPala(undefined)).toBe(false)
  })
})

describe('detallePala', () => {
  it('arma marca, modelo y año en una línea', () => {
    expect(detallePala({ nombre: 'Pala 1', marca: 'Caterpillar', modelo: '950H', anio: 2015 }))
      .toBe('Caterpillar 950H 2015')
  })
  it('saltea lo que falta y devuelve vacío si no hay nada', () => {
    expect(detallePala({ nombre: 'Pala 1', marca: 'Caterpillar', modelo: null, anio: 2015 })).toBe('Caterpillar 2015')
    expect(detallePala({ nombre: 'Pala 1' })).toBe('')
  })
})

describe('fmtHorometro', () => {
  it('pone separador de miles y la unidad', () => {
    expect(fmtHorometro(1234)).toBe('1.234 h')
    expect(fmtHorometro(980)).toBe('980 h')
    expect(fmtHorometro(1234.5)).toBe('1.234,5 h')
  })
  it('sin dato devuelve vacío, NO "0 h"', () => {
    // "0 h" dice "máquina sin uso"; vacío dice "nadie lo cargó". No es lo mismo.
    expect(fmtHorometro(null)).toBe('')
    expect(fmtHorometro(undefined)).toBe('')
    expect(fmtHorometro(Number.NaN)).toBe('')
    expect(fmtHorometro(0)).toBe('0 h')
  })
})

describe('validarHorometro', () => {
  it('acepta vacío (no se toca) y un número que avanza', () => {
    expect(validarHorometro('', 1000)).toBeNull()
    expect(validarHorometro('1200', 1000)).toBeNull()
    expect(validarHorometro('1200,5', 1000)).toBeNull() // coma decimal de acá
    expect(validarHorometro('500', null)).toBeNull()
  })
  it('rechaza lo que no es número, lo negativo y el dedazo grande', () => {
    expect(validarHorometro('mil', null)).toMatch(/número/)
    expect(validarHorometro('-5', null)).toMatch(/negativo/)
    expect(validarHorometro('999999', null)).toMatch(/dedazo/)
  })
  it('no deja bajar el horómetro salvo que se pida expresamente', () => {
    expect(validarHorometro('900', 1000)).toMatch(/no puede bajar/)
    expect(validarHorometro('900', 1000)).toContain('1.000 h')
    expect(validarHorometro('900', 1000, true)).toBeNull()
  })
})

describe('validarAnio', () => {
  it('acepta vacío y años verosímiles', () => {
    expect(validarAnio('')).toBeNull()
    expect(validarAnio('2015')).toBeNull()
  })
  it('rechaza el dedazo y los decimales', () => {
    expect(validarAnio('20226')).toMatch(/entre 1950 y 2100/)
    expect(validarAnio('1900')).toMatch(/entre 1950 y 2100/)
    expect(validarAnio('2015,5')).toMatch(/entero/)
  })
})

describe('ordenarPalas', () => {
  it('ordena por nombre con los números en orden humano', () => {
    const palas = [{ nombre: 'Pala 10' }, { nombre: 'Pala 2' }, { nombre: 'Cargadora A' }]
    expect(ordenarPalas(palas).map((p) => p.nombre)).toEqual(['Cargadora A', 'Pala 2', 'Pala 10'])
  })
  it('no toca el arreglo original', () => {
    const palas = [{ nombre: 'B' }, { nombre: 'A' }]
    ordenarPalas(palas)
    expect(palas.map((p) => p.nombre)).toEqual(['B', 'A'])
  })
})
