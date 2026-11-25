import { describe, expect, it } from 'vitest'
import { elegirCarnet, empresaDe, esCarnetAplicador, leerMarca, mimeMostrable, slugsDe } from './reglas'

describe('integración trazabilidad: qué se muestra', () => {
  it('solo aplicadores de Tecnophos y ADC; Serviwhite no', () => {
    expect(empresaDe('tecnophos-rosario')).toEqual({ marca: 'tecnophos', base: 'rosario' })
    expect(empresaDe('adc')?.marca).toBe('adc')
    expect(empresaDe('serviwhite')).toBeNull()
    expect(slugsDe('tecnophos').sort()).toEqual(['tecnophos-bb', 'tecnophos-necochea', 'tecnophos-rosario'])
    expect(slugsDe(null)).toHaveLength(4)
    expect(leerMarca('serviwhite')).toBe('invalida')
  })

  it('solo el carnet de aplicador: ni el de conducir, ni el portuario, ni médicos o cursos', () => {
    expect(esCarnetAplicador('Carnet de Aplicador')).toBe(true)
    expect(esCarnetAplicador(' carnet de aplicador ')).toBe(true)
    expect(esCarnetAplicador('Carnet de Conducir')).toBe(false)
    expect(esCarnetAplicador('Carnet de Personal Portuario')).toBe(false)
    expect(esCarnetAplicador('Exámenes Médicos')).toBe(false)
    expect(esCarnetAplicador(null)).toBe(false)
  })

  it('archivos: imagen o PDF', () => {
    expect(mimeMostrable('image/jpeg')).toBe(true)
    expect(mimeMostrable('application/pdf')).toBe(true)
    expect(mimeMostrable('application/zip')).toBe(false)
    expect(mimeMostrable(null)).toBe(false)
  })

  it('con dos carnets vale el que vence más tarde', () => {
    expect(elegirCarnet([{ vence: '2026-01-01' }, { vence: '2028-05-01' }, { vence: null }])).toEqual({ vence: '2028-05-01' })
    expect(elegirCarnet([])).toBeNull()
  })
})
