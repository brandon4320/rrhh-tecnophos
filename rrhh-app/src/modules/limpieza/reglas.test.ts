import { describe, it, expect } from 'vitest'
import {
  contarPresentes,
  dotacionInsuficiente,
  faltanRepasosTallerAnodos,
  stockEnAlerta,
  DOTACION_MINIMA,
} from './reglas'

describe('dotación mínima', () => {
  it('cuenta presentes/tarde/reemplazo como dotación presente', () => {
    expect(
      contarPresentes(['presente', 'tarde', 'reemplazo', 'ausente', 'no_trabaja'])
    ).toBe(3)
  })

  it('alerta cuando hay menos de 13 presentes', () => {
    expect(dotacionInsuficiente(12)).toBe(true)
    expect(dotacionInsuficiente(DOTACION_MINIMA)).toBe(false)
    expect(dotacionInsuficiente(14)).toBe(false)
  })
})

describe('Taller de Ánodos (2 repasos/día)', () => {
  it('alerta si falta algún repaso', () => {
    expect(faltanRepasosTallerAnodos(0)).toBe(true)
    expect(faltanRepasosTallerAnodos(1)).toBe(true)
    expect(faltanRepasosTallerAnodos(2)).toBe(false)
  })
})

describe('stock de consumibles', () => {
  it('alerta cuando el stock cae por debajo del mínimo', () => {
    expect(stockEnAlerta(40, 35)).toBe(false)
    expect(stockEnAlerta(30, 35)).toBe(true)
  })
})
