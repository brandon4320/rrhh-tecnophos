import { describe, it, expect } from 'vitest'
import {
  CARPETAS_FIJAS, agruparPorCarpeta, carpetasDelMes, completitudMes, empleadosConReciboPorPeriodo, estadoMes,
  labelPeriodo, normalizarCarpeta, periodoAnterior, periodoDe, sanitizarNombreArchivo, slugCarpeta,
  validarArchivoDocumento,
} from './reglas'

const HOY = new Date(2026, 8, 11) // 11/09/2026

describe('normalizarCarpeta', () => {
  it('canoniza las fijas sin importar mayúsculas ni espacios', () => {
    expect(normalizarCarpeta('f931')).toBe('F931')
    expect(normalizarCarpeta('  recibos   de sueldos ')).toBe('Recibos de sueldos')
    expect(normalizarCarpeta('ART')).toBe('ART')
  })
  it('vacío o basura = raíz; extras se conservan limpias', () => {
    expect(normalizarCarpeta('')).toBe('')
    expect(normalizarCarpeta('   ')).toBe('')
    expect(normalizarCarpeta(null)).toBe('')
    expect(normalizarCarpeta(' Seguros  varios ')).toBe('Seguros varios')
  })
})

describe('carpetas y completitud', () => {
  const docs = [
    { periodo: '2026-07-01', carpeta: 'F931' },
    { periodo: '2026-07-01', carpeta: 'art' },
    { periodo: '2026-07-01', carpeta: 'Seguros' },
    { periodo: '2026-07-01', carpeta: '' },
  ]
  it('las fijas siempre, más las extra ordenadas, nunca la raíz', () => {
    expect(carpetasDelMes(docs)).toEqual([...CARPETAS_FIJAS, 'Seguros'])
    expect(carpetasDelMes([])).toEqual([...CARPETAS_FIJAS])
  })
  it('agrupa por carpeta canónica', () => {
    const g = agruparPorCarpeta(docs)
    expect(g.get('ART')!.length).toBe(1)
    expect(g.get('')!.length).toBe(1)
    expect(g.get('Seguros')!.length).toBe(1)
  })
  it('completitud cuenta solo las fijas; los sueltos no cubren nada', () => {
    const c = completitudMes(docs)
    expect(c.completas).toEqual(['ART', 'F931'])
    expect(c.faltantes).toEqual(['Aportes sindicales', 'Pagos', 'Recibos de sueldos', 'SVO'])
    expect(c.total).toBe(6)
  })
  it('una carpeta puede quedar cubierta por otra fuente (recibos del legajo)', () => {
    const c = completitudMes(docs, ['Recibos de sueldos'])
    expect(c.completas).toContain('Recibos de sueldos')
    expect(c.faltantes).not.toContain('Recibos de sueldos')
  })
})

describe('estadoMes', () => {
  const vacio = completitudMes([])
  const todo = completitudMes(CARPETAS_FIJAS.map((c) => ({ periodo: '2026-07-01', carpeta: c })))
  const parcial = completitudMes([{ periodo: '2026-07-01', carpeta: 'F931' }])
  it('completo / incompleto', () => {
    expect(estadoMes('2026-07-01', todo, 6, HOY)).toBe('vigente')
    expect(estadoMes('2026-07-01', parcial, 1, HOY)).toBe('proximo')
    // solo sueltos: hay archivos pero ninguna fija → incompleto, no "sin cargar"
    expect(estadoMes('2026-07-01', vacio, 2, HOY)).toBe('proximo')
  })
  it('vacío: pasado = sin cargar; en curso o futuro = sin archivos', () => {
    expect(estadoMes('2026-07-01', vacio, 0, HOY)).toBe('vencido')
    expect(estadoMes('2026-08-01', vacio, 0, HOY)).toBe('vencido')
    expect(estadoMes('2026-09-01', vacio, 0, HOY)).toBe('sin_fecha')
    expect(estadoMes('2026-12-01', vacio, 0, HOY)).toBe('sin_fecha')
  })
})

describe('períodos', () => {
  it('periodoDe / labelPeriodo / periodoAnterior', () => {
    expect(periodoDe(2026, 7)).toBe('2026-07-01')
    expect(labelPeriodo('2026-07-01')).toBe('Julio 2026')
    expect(labelPeriodo('2026-13-01')).toBe('2026-13-01')
    expect(periodoAnterior(HOY)).toBe('2026-08-01')
    expect(periodoAnterior(new Date(2026, 0, 15))).toBe('2025-12-01')
  })
})

describe('claves R2', () => {
  it('slugCarpeta y sanitizarNombreArchivo', () => {
    expect(slugCarpeta('Recibos de sueldos')).toBe('recibos-de-sueldos')
    expect(slugCarpeta('')).toBe('_raiz')
    expect(slugCarpeta('Aportes sindicales')).toBe('aportes-sindicales')
    expect(sanitizarNombreArchivo('ARCA - Agencia de Recaudación y Control Aduanero.pdf')).toBe('ARCA_-_Agencia_de_Recaudacion_y_Control_Aduanero.pdf')
    expect(sanitizarNombreArchivo('C:\\Users\\x\\F931 julio.pdf')).toBe('F931_julio.pdf')
    expect(sanitizarNombreArchivo('///')).toBe('archivo')
  })
})

describe('validarArchivoDocumento', () => {
  it('acepta lo que baja de las plataformas', () => {
    expect(validarArchivoDocumento({ name: 'F931.pdf', type: 'application/pdf', size: 100 })).toBeNull()
    expect(validarArchivoDocumento({ name: 'nomina.xlsx', type: '', size: 100 })).toBeNull()
    expect(validarArchivoDocumento({ name: 'F931.txt', type: 'text/plain', size: 100 })).toBeNull()
  })
  it('rechaza vacío, muy grande o ejecutables', () => {
    expect(validarArchivoDocumento({ name: 'x.pdf', type: 'application/pdf', size: 0 })).toMatch(/vacío/)
    expect(validarArchivoDocumento({ name: 'x.pdf', type: 'application/pdf', size: 26 * 1024 * 1024 })).toMatch(/25 MB/)
    expect(validarArchivoDocumento({ name: 'virus.exe', type: 'application/octet-stream', size: 10 })).toMatch(/solo se aceptan/)
  })
})

describe('empleadosConReciboPorPeriodo', () => {
  it('cuenta empleados distintos con recibo mensual por período', () => {
    const m = empleadosConReciboPorPeriodo([
      { periodo: '2026-07-01', empleado_id: 'a', tipo: 'mensual' },
      { periodo: '2026-07-01', empleado_id: 'a', tipo: 'sac' },
      { periodo: '2026-07-01', empleado_id: 'b', tipo: 'mensual' },
      { periodo: '2026-06-01', empleado_id: 'b' },
    ])
    expect(m.get('2026-07-01')).toBe(2)
    expect(m.get('2026-06-01')).toBe(1)
    expect(m.get('2026-05-01')).toBeUndefined()
  })
})
