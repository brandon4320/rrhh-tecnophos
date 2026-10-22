import { describe, expect, it } from 'vitest'
import { filtroEmpresas, paramEmpresas, slugsDe } from './empresas-vistas'

const TODAS = ['adc', 'serviwhite', 'tecnophos-bb']

describe('slugsDe', () => {
  it('vacío sin parámetro', () => expect(slugsDe(null)).toEqual([]))
  it('una o varias, sin repetidos ni espacios', () => expect(slugsDe('adc, serviwhite,adc')).toEqual(['adc', 'serviwhite']))
  it('descarta las que no existen', () => expect(slugsDe('adc,otra', TODAS)).toEqual(['adc']))
})

describe('paramEmpresas', () => {
  it('todas o ninguna = sin parámetro', () => {
    expect(paramEmpresas(TODAS, TODAS)).toBeNull()
    expect(paramEmpresas([], TODAS)).toBeNull()
  })
  it('sigue el orden de la lista completa', () => expect(paramEmpresas(['tecnophos-bb', 'adc'], TODAS)).toBe('adc,tecnophos-bb'))
})

describe('filtroEmpresas', () => {
  it('null cuando son todas', () => {
    expect(filtroEmpresas(undefined, TODAS)).toBeNull()
    expect(filtroEmpresas('serviwhite,adc,tecnophos-bb', TODAS)).toBeNull()
  })
  it('la lista cuando son algunas', () => expect(filtroEmpresas('adc,serviwhite', TODAS)).toEqual(['adc', 'serviwhite']))
})
