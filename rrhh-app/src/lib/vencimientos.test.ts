import { describe, expect, it } from 'vitest'
import { empresaDeCertificado, fechaMasDias, hrefCertificado, titularCertificado, unirPorId } from './vencimientos'

describe('fechaMasDias', () => {
  it('suma días al "hoy" de Argentina, no al de UTC', () => {
    // 02/10 a las 22:30 AR = 03/10 01:30 UTC: hoy sigue siendo el 2 en Argentina.
    const noche = new Date('2026-10-03T01:30:00Z')
    expect(fechaMasDias(0, noche)).toBe('2026-10-02')
    expect(fechaMasDias(31, noche)).toBe('2026-11-02')
    expect(fechaMasDias(-1, noche)).toBe('2026-10-01')
  })
  it('cruza fin de año', () => {
    expect(fechaMasDias(2, new Date('2026-12-30T15:00:00Z'))).toBe('2027-01-01')
  })
})

describe('unirPorId', () => {
  it('no repite ids y respeta el orden de la primera lista', () => {
    expect(unirPorId([{ id: 'a' }, { id: 'b' }], [{ id: 'b' }, { id: 'c' }]).map((x) => x.id)).toEqual(['a', 'b', 'c'])
  })
})

describe('hrefCertificado', () => {
  it('empleado: legajo con el certificado abierto', () => {
    expect(hrefCertificado({ id: 'c1', empleado: { id: 'e1' } })).toBe('/legajo/e1?cert=c1')
  })
  it('vehículo y equipo: documentación con el dueño desplegado', () => {
    expect(hrefCertificado({ id: 'c2', vehiculo: { id: 'v1', empresa: { slug: 'adc' } } }))
      .toBe('/empresa/adc?vista=documentacion&veh=v1')
    expect(hrefCertificado({ id: 'c3', equipo: { id: 'q1', empresa: { slug: 'adc' } } }))
      .toBe('/empresa/adc?vista=documentacion&equipo=q1')
  })
  it('habilitación de empresa', () => {
    expect(hrefCertificado({ id: 'c4', empresa: { slug: 'tecnophos-bb' } })).toBe('/empresa/tecnophos-bb?vista=documentacion')
  })
  it('sin empresa visible no hay link', () => {
    expect(hrefCertificado({ id: 'c5', vehiculo: { id: 'v1', empresa: null } })).toBeNull()
  })
})

describe('titularCertificado / empresaDeCertificado', () => {
  it('arma el nombre legible del dueño', () => {
    expect(titularCertificado({ id: '1', empleado: { id: 'e', nombre: 'PEREZ JUAN', apellido: null } })).toBe('PEREZ JUAN')
    expect(titularCertificado({ id: '2', vehiculo: { id: 'v', patente: 'AD113UY' } })).toBe('Vehículo AD113UY')
    expect(titularCertificado({ id: '3', equipo: { id: 'q', nombre: 'Matafuego 5kg' } })).toBe('Matafuego 5kg')
    expect(titularCertificado({ id: '4', empresa: { nombre: 'ADC S.R.L.', slug: 'adc' } })).toBe('ADC S.R.L.')
  })
  it('la empresa sale del dueño que haya', () => {
    expect(empresaDeCertificado({ id: '1', vehiculo: { id: 'v', empresa: { nombre: 'ADC', slug: 'adc' } } }))
      .toEqual({ nombre: 'ADC', slug: 'adc' })
    expect(empresaDeCertificado({ id: '2' })).toEqual({ nombre: null, slug: null })
  })
})
