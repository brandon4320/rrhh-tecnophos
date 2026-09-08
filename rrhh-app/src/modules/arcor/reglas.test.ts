import { describe, it, expect } from 'vitest'
import {
  normalizarLugar,
  parseFechaFlexible,
  mesDeFecha,
  mesAnterior,
  claveMes,
  esMesValido,
  evaluarSilencio,
  resumenPorLugar,
  nivelCredito,
} from './reglas'

describe('normalizarLugar', () => {
  it('reconoce las 4 provincias con variantes', () => {
    expect(normalizarLugar('BUENOS AIRES')).toBe('BUENOS AIRES')
    expect(normalizarLugar('Buenos Aires')).toBe('BUENOS AIRES')
    expect(normalizarLugar('bs as')).toBe('BUENOS AIRES')
    expect(normalizarLugar('B. Aires')).toBe('BUENOS AIRES')
    expect(normalizarLugar('CABA')).toBe('BUENOS AIRES')
    expect(normalizarLugar('Córdoba')).toBe('CORDOBA')
    expect(normalizarLugar('CORDOBA')).toBe('CORDOBA')
    expect(normalizarLugar('Mendoza')).toBe('MENDOZA')
    expect(normalizarLugar('TPR Rosario')).toBe('ROSARIO')
  })
  it('devuelve null si no reconoce nada (no inventa)', () => {
    expect(normalizarLugar('Rodríguez Peña')).toBeNull()
    expect(normalizarLugar('')).toBeNull()
    expect(normalizarLugar(null)).toBeNull()
    expect(normalizarLugar(42)).toBeNull()
  })
})

describe('parseFechaFlexible', () => {
  it('acepta ISO, DD/MM/YYYY y D/M/YYYY', () => {
    expect(parseFechaFlexible('2026-08-28')).toBe('2026-08-28')
    expect(parseFechaFlexible('28/08/2026')).toBe('2026-08-28')
    expect(parseFechaFlexible('3/9/2026')).toBe('2026-09-03')
    expect(parseFechaFlexible('2026-09-03T14:00:00Z')).toBe('2026-09-03')
  })
  it('rechaza basura y fechas imposibles', () => {
    expect(parseFechaFlexible('31/02/2026')).toBeNull()
    expect(parseFechaFlexible('2019-01-01')).toBeNull()
    expect(parseFechaFlexible('hoy')).toBeNull()
    expect(parseFechaFlexible(undefined)).toBeNull()
  })
})

describe('meses', () => {
  it('mesDeFecha espeja excel_store.nombre_tab', () => {
    expect(mesDeFecha('2026-08-28')).toBe('AGOSTO 2026')
    expect(mesDeFecha('2026-01-05')).toBe('ENERO 2026')
  })
  it('mesAnterior cruza el año', () => {
    expect(mesAnterior('SEPTIEMBRE 2026')).toBe('AGOSTO 2026')
    expect(mesAnterior('ENERO 2027')).toBe('DICIEMBRE 2026')
  })
  it('claveMes ordena cronológicamente', () => {
    expect(claveMes('SEPTIEMBRE 2026')).toBeGreaterThan(claveMes('AGOSTO 2026'))
    expect(claveMes('ENERO 2027')).toBeGreaterThan(claveMes('DICIEMBRE 2026'))
  })
  it('esMesValido', () => {
    expect(esMesValido('AGOSTO 2026')).toBe(true)
    expect(esMesValido('agosto 2026')).toBe(false)
    expect(esMesValido('AGOSTO')).toBe(false)
  })
})

describe('evaluarSilencio', () => {
  // 15:00 AR = 18:00Z → umbral diurno (3 h)
  const dia = new Date('2026-09-08T18:00:00Z')
  // 03:00 AR = 06:00Z → umbral nocturno (11 h)
  const noche = new Date('2026-09-08T06:00:00Z')

  it('sin heartbeat es silencio', () => {
    expect(evaluarSilencio(null, dia).silencio).toBe(true)
  })
  it('de día tolera 3 h', () => {
    expect(evaluarSilencio('2026-09-08T16:30:00Z', dia)).toMatchObject({ silencio: false, minutos: 90, umbralMin: 180 })
    expect(evaluarSilencio('2026-09-08T14:00:00Z', dia)).toMatchObject({ silencio: true, minutos: 240 })
  })
  it('de noche tolera 11 h', () => {
    expect(evaluarSilencio('2026-09-07T23:00:00Z', noche)).toMatchObject({ silencio: false, umbralMin: 660 })
    expect(evaluarSilencio('2026-09-07T18:00:00Z', noche).silencio).toBe(true)
  })
})

describe('resumenPorLugar', () => {
  it('cuenta por provincia y excluye descartados', () => {
    const r = resumenPorLugar([
      { lugar: 'BUENOS AIRES', estado: 'encontrado' },
      { lugar: 'BUENOS AIRES', estado: 'pendiente_arcor' },
      { lugar: 'CORDOBA', estado: 'revisar_foto' },
      { lugar: 'CORDOBA', estado: 'descartado' },
    ])
    expect(r.find((x) => x.lugar === 'BUENOS AIRES')).toMatchObject({ total: 2, pendientes: 1, revisar: 0 })
    expect(r.find((x) => x.lugar === 'CORDOBA')).toMatchObject({ total: 1, revisar: 1 })
    expect(r.find((x) => x.lugar === 'MENDOZA')).toMatchObject({ total: 0 })
  })
})

describe('nivelCredito', () => {
  it('umbrales del WF10', () => {
    expect(nivelCredito(10)).toBe('info')
    expect(nivelCredito(70)).toBe('warning')
    expect(nivelCredito(95)).toBe('critical')
    expect(nivelCredito(null)).toBe('info')
  })
})
