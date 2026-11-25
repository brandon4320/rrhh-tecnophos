import { describe, it, expect } from 'vitest'
import {
  armarLibro, cajasEnteras, textoDeuda, saldosActuales, ultimoMovimiento, enCajas, parseCantidad, validarAdjunto, pathAdjunto, prefijoAdjuntos,
  llevaPestcontrol, type PestInsumo, type PestMovimiento,
} from './reglas'

const fos: PestInsumo = { id: 'fos', codigo: 'fos', nombre: 'Fosfuro', unidad: 'tarros', por_caja: 14, orden: 1 }
const man: PestInsumo = { id: 'man', codigo: 'man', nombre: 'Mangas', unidad: null, por_caja: null, orden: 2 }

function mov(id: string, fecha: string, orden: number, lineas: PestMovimiento['lineas']): PestMovimiento {
  return { id, fecha, orden, lineas, barco: null, detalle: null, comprobante: null, lugar: null, notas: null, adjuntos: 0 }
}

describe('armarLibro', () => {
  it('suma en orden de fecha y, dentro del día, en el orden de carga', () => {
    const libro = armarLibro([fos, man], [
      mov('c', '2026-01-02', 3, [{ insumo_id: 'fos', entrada: 0, salida: 14 }]),
      mov('a', '2026-01-01', 1, [{ insumo_id: 'fos', entrada: 140, salida: 0 }, { insumo_id: 'man', entrada: 5, salida: 0 }]),
      mov('b', '2026-01-02', 2, [{ insumo_id: 'man', entrada: 0, salida: 7 }]),
    ])
    expect(libro.map((r) => r.id)).toEqual(['a', 'b', 'c'])
    expect(libro[1].saldos).toEqual({ fos: 140, man: -2 })
    expect(saldosActuales([fos, man], libro)).toEqual({ fos: 126, man: -2 })
    expect(ultimoMovimiento(libro)).toEqual({ fos: '2026-01-02', man: '2026-01-02' })
  })

  it('sin movimientos, todo en cero', () => {
    expect(saldosActuales([fos], armarLibro([fos], []))).toEqual({ fos: 0 })
  })

  it('no arrastra error de coma flotante', () => {
    const libro = armarLibro([man], [
      mov('a', '2026-01-01', 1, [{ insumo_id: 'man', entrada: 0.1, salida: 0 }]),
      mov('b', '2026-01-01', 2, [{ insumo_id: 'man', entrada: 0.2, salida: 0 }]),
    ])
    expect(libro[1].saldos.man).toBe(0.3)
  })
})

describe('enCajas', () => {
  it('cajas exactas o aproximadas, solo si el insumo se cuenta en cajas', () => {
    expect(enCajas(fos, 28)).toBe('2 cajas')
    expect(enCajas(fos, 14)).toBe('1 caja')
    expect(enCajas(fos, 1426)).toBe('≈ 101,9 cajas')
    expect(enCajas(man, 10)).toBeNull()
  })
})

describe('cajasEnteras', () => {
  it('redondea como la columna Cajas del Excel', () => {
    expect(cajasEnteras(fos, 1426)).toBe(102)
    expect(cajasEnteras(fos, 1323)).toBe(95) // 94,5
    expect(cajasEnteras(fos, -77)).toBe(-6) // -5,5: Excel se aleja del cero
    expect(cajasEnteras(fos, 3)).toBe(0)
    expect(cajasEnteras(fos, -3)).toBe(0)
    expect(cajasEnteras(man, 10)).toBeNull()
  })
})

describe('textoDeuda', () => {
  const eq = { nombre: 'Equipos seg. chicos', unidad: 'equipos' }
  const tub = { nombre: 'Tubos', unidad: 'tubos' }
  it('junta el insumo y lo que va dentro de su tarjeta', () => {
    expect(textoDeuda([{ saldo: -4, insumo: eq }, { saldo: -2, insumo: tub }])).toBe('4 equipos y 2 tubos')
    expect(textoDeuda([{ saldo: -1, insumo: eq }, { saldo: 3, insumo: tub }])).toBe('1 equipo')
    expect(textoDeuda([{ saldo: -110, insumo: { nombre: 'Mangas', unidad: null } }])).toBe('110 mangas')
    expect(textoDeuda([{ saldo: 0, insumo: eq }])).toBeNull()
  })
})

describe('parseCantidad', () => {
  it('acepta coma o punto decimal y miles con punto', () => {
    expect(parseCantidad('12,5')).toBe(12.5)
    expect(parseCantidad('12.5')).toBe(12.5)
    expect(parseCantidad('1.200,5')).toBe(1200.5)
    expect(parseCantidad('')).toBe(0)
    expect(parseCantidad('-3')).toBe(0)
    expect(parseCantidad('abc')).toBe(0)
  })
})

describe('adjuntos', () => {
  it('fotos o PDF hasta 15 MB', () => {
    expect(validarAdjunto({ name: 'remito.pdf', type: 'application/pdf', size: 1000 })).toBeNull()
    expect(validarAdjunto({ name: 'foto.HEIC', type: '', size: 1000 })).toBeNull()
    expect(validarAdjunto({ name: 'planilla.xlsx', type: 'application/vnd.ms-excel', size: 1000 })).toMatch(/fotos o PDF/)
    expect(validarAdjunto({ name: 'grande.pdf', type: 'application/pdf', size: 16 * 1024 * 1024 })).toMatch(/15 MB/)
    expect(validarAdjunto({ name: 'vacio.pdf', type: 'application/pdf', size: 0 })).toMatch(/vacío/)
  })

  it('la clave cuelga del movimiento y no lleva caracteres raros', () => {
    const p = pathAdjunto('m1', 'Remito Nº 7036 (1).jpg', 123)
    expect(p.startsWith(prefijoAdjuntos('m1'))).toBe(true)
    expect(p).toBe('pestcontrol/m1/123-Remito_N_7036_1_.jpg')
  })
})

describe('llevaPestcontrol', () => {
  it('solo Bahía Blanca, por nombre (con o sin acento)', () => {
    expect(llevaPestcontrol({ nombre: 'Tecnophos Bahía Blanca' })).toBe(true)
    expect(llevaPestcontrol({ nombre: 'TECNOPHOS  BAHIA BLANCA' })).toBe(true)
    expect(llevaPestcontrol({ nombre: 'ADC S.R.L.' })).toBe(false)
    expect(llevaPestcontrol(null)).toBe(false)
  })
})
