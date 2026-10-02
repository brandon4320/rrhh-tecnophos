import { describe, expect, it } from 'vitest'
import { alertaComoTexto, validarAlertaDias } from './formularios'

describe('validarAlertaDias', () => {
  it('acepta enteros entre 1 y 365', () => {
    expect(validarAlertaDias('7')).toEqual({ ok: true, valor: 7 })
    expect(validarAlertaDias(' 30 ')).toEqual({ ok: true, valor: 30 })
    expect(validarAlertaDias('365')).toEqual({ ok: true, valor: 365 })
  })
  it('vacío no se convierte en 30: pide el dato', () => {
    expect(validarAlertaDias('').ok).toBe(false)
    expect(validarAlertaDias('   ').ok).toBe(false)
  })
  it('rechaza fuera de rango (el 307 de tipear sobre un 30)', () => {
    expect(validarAlertaDias('0').ok).toBe(false)
    expect(validarAlertaDias('366').ok).toBe(false)
    expect(validarAlertaDias('3070').ok).toBe(false)
  })
  it('rechaza lo que no es un entero', () => {
    expect(validarAlertaDias('7.5').ok).toBe(false)
    expect(validarAlertaDias('-3').ok).toBe(false)
    expect(validarAlertaDias('treinta').ok).toBe(false)
  })
})

describe('alertaComoTexto', () => {
  it('usa 30 cuando no hay dato', () => {
    expect(alertaComoTexto(null)).toBe('30')
    expect(alertaComoTexto(undefined)).toBe('30')
    expect(alertaComoTexto(15)).toBe('15')
  })
})
