import { describe, expect, it } from 'vitest'
import { esCarpetaMensual, esDeEmpresa, leerMarca, marcaDe, slugsDe, ultimosPeriodos } from './reglas'

describe('integración comercial: qué se muestra', () => {
  it('solo las empresas de Tecnophos y ADC; Serviwhite no', () => {
    expect(marcaDe('tecnophos-rosario')).toBe('tecnophos')
    expect(marcaDe('adc')).toBe('adc')
    expect(marcaDe('serviwhite')).toBeNull()
    expect(marcaDe(null)).toBeNull()
    expect(slugsDe('tecnophos').sort()).toEqual(['tecnophos-bb', 'tecnophos-necochea', 'tecnophos-rosario'])
    expect(slugsDe(null)).toHaveLength(4)
    expect(leerMarca('adc')).toBe('adc')
    expect(leerMarca('serviwhite')).toBe('invalida')
    expect(leerMarca(null)).toBeNull()
  })

  it('certificados: solo los de la empresa, nunca los de personas, vehículos o equipos', () => {
    expect(esDeEmpresa({ empleado_id: null, vehiculo_id: null, equipo_id: null })).toBe(true)
    expect(esDeEmpresa({ empleado_id: 'e1', vehiculo_id: null, equipo_id: null })).toBe(false)
    expect(esDeEmpresa({ empleado_id: null, vehiculo_id: 'v1', equipo_id: null })).toBe(false)
    expect(esDeEmpresa({ empleado_id: null, vehiculo_id: null, equipo_id: 'q1' })).toBe(false)
  })

  it('mensuales: ART y SVO exactas; F931, recibos y subcarpetas no', () => {
    expect(esCarpetaMensual('ART')).toBe(true)
    expect(esCarpetaMensual('SVO')).toBe(true)
    expect(esCarpetaMensual('F931')).toBe(false)
    expect(esCarpetaMensual('Recibos de sueldos')).toBe(false)
    expect(esCarpetaMensual('ART/otra')).toBe(false)
    expect(esCarpetaMensual('')).toBe(false)
  })

  it('últimos períodos por empresa y carpeta, más nuevos primero', () => {
    const f = (empresa: string, carpeta: string, periodo: string, id: string) => ({ empresa, carpeta, periodo, id })
    const filas = [
      f('adc', 'ART', '2026-07-01', 'a7'), f('adc', 'ART', '2026-08-01', 'a8'), f('adc', 'ART', '2026-09-01', 'a9'),
      f('adc', 'ART', '2026-10-01', 'a10'), f('adc', 'ART', '2026-10-01', 'a10b'), f('adc', 'SVO', '2026-05-01', 's5'),
    ]
    expect(ultimosPeriodos(filas, 2).map((x) => x.id)).toEqual(['a10', 'a10b', 'a9', 's5'])
  })
})
