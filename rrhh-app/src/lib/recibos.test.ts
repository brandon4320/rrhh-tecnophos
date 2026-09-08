import { describe, it, expect } from 'vitest'
import {
  periodoDesdeMes,
  mesDesdePeriodo,
  labelPeriodo,
  mesAnteriorInput,
  agruparPorAnio,
  validarArchivoRecibo,
  esTipoRecibo,
} from './recibos'

describe('periodoDesdeMes', () => {
  it('convierte el input month a primer día del mes', () => {
    expect(periodoDesdeMes('2026-08')).toBe('2026-08-01')
    expect(periodoDesdeMes('2026-08-15')).toBe('2026-08-01')
  })
  it('rechaza basura', () => {
    expect(periodoDesdeMes('2026-13')).toBeNull()
    expect(periodoDesdeMes('agosto')).toBeNull()
    expect(periodoDesdeMes(null)).toBeNull()
  })
})

describe('labels', () => {
  it('mesDesdePeriodo y labelPeriodo', () => {
    expect(mesDesdePeriodo('2026-08-01')).toBe('2026-08')
    expect(labelPeriodo('2026-08-01')).toBe('Agosto 2026')
    expect(labelPeriodo('2025-12-01')).toBe('Diciembre 2025')
  })
  it('mesAnteriorInput cruza el año', () => {
    expect(mesAnteriorInput(new Date(2026, 0, 15))).toBe('2025-12')
    expect(mesAnteriorInput(new Date(2026, 8, 8))).toBe('2026-08')
  })
})

describe('agruparPorAnio', () => {
  it('agrupa desc por año y por período', () => {
    const g = agruparPorAnio([
      { periodo: '2025-11-01' }, { periodo: '2026-01-01' }, { periodo: '2026-03-01' }, { periodo: '2025-12-01' },
    ])
    expect(g.map((x) => x.anio)).toEqual(['2026', '2025'])
    expect(g[0].items.map((x) => x.periodo)).toEqual(['2026-03-01', '2026-01-01'])
    expect(g[1].items.map((x) => x.periodo)).toEqual(['2025-12-01', '2025-11-01'])
  })
})

describe('validarArchivoRecibo', () => {
  it('acepta pdf e imágenes, rechaza el resto', () => {
    expect(validarArchivoRecibo({ name: 'recibo.pdf', type: 'application/pdf', size: 1000 })).toBeNull()
    expect(validarArchivoRecibo({ name: 'foto.jpg', type: '', size: 1000 })).toBeNull()
    expect(validarArchivoRecibo({ name: 'planilla.xlsx', type: 'application/vnd.ms-excel', size: 1000 })).toMatch(/Solo se aceptan/)
    expect(validarArchivoRecibo({ name: 'a.pdf', type: 'application/pdf', size: 0 })).toMatch(/vacío/)
    expect(validarArchivoRecibo({ name: 'a.pdf', type: 'application/pdf', size: 20 * 1024 * 1024 })).toMatch(/máximo/)
  })
  it('esTipoRecibo', () => {
    expect(esTipoRecibo('sac')).toBe(true)
    expect(esTipoRecibo('bono')).toBe(false)
  })
})
