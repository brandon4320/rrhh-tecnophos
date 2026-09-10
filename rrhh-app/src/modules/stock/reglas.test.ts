import { describe, it, expect } from 'vitest'
import { parseCantidad, deltaDe, calcularStock, estadoStock, comprasDelMes, categoriasDe, normalizarNombre } from './reglas'

describe('parseCantidad', () => {
  it('acepta formatos AR y punto decimal', () => {
    expect(parseCantidad('7')).toBe(7)
    expect(parseCantidad('12,5')).toBe(12.5)
    expect(parseCantidad('12.5')).toBe(12.5)
    expect(parseCantidad('1.234,5')).toBe(1234.5)
    expect(parseCantidad('-3')).toBe(-3)
    expect(parseCantidad(4.129)).toBe(4.13)
  })
  it('rechaza basura', () => {
    expect(parseCantidad('')).toBeNull()
    expect(parseCantidad('doce')).toBeNull()
    expect(parseCantidad('1.2.3')).toBeNull()
    expect(parseCantidad(null)).toBeNull()
  })
})

describe('calcularStock', () => {
  const items = [
    { id: 'a', nombre: 'Lavandina', stock_minimo: 5, activo: true },
    { id: 'b', nombre: 'Guantes', stock_minimo: 0, activo: true },
  ]
  const movs = [
    { item_id: 'a', tipo: 'compra', cantidad: 20, fecha: '2026-08-10', precio_unitario: 1500, proveedor: 'Distribuidora X' },
    { item_id: 'a', tipo: 'consumo', cantidad: 12, fecha: '2026-08-20' },
    { item_id: 'a', tipo: 'compra', cantidad: 6, fecha: '2026-09-02', precio_unitario: 1800, proveedor: 'Y' },
    { item_id: 'a', tipo: 'ajuste', cantidad: -2, fecha: '2026-09-05' },
    { item_id: 'b', tipo: 'compra', cantidad: 3, fecha: '2026-09-01' },
    { item_id: 'zzz', tipo: 'compra', cantidad: 99, fecha: '2026-09-01' }, // ítem inexistente: se ignora
  ]
  it('suma compras, resta consumos, aplica ajustes con signo', () => {
    const s = calcularStock(items, movs)
    expect(s.get('a')!.stock).toBe(12)
    expect(s.get('a')!.movimientos).toBe(4)
    expect(s.get('b')!.stock).toBe(3)
  })
  it('última compra por fecha y valorizado con su precio', () => {
    const a = calcularStock(items, movs).get('a')!
    expect(a.ultimaCompra).toEqual({ fecha: '2026-09-02', precio_unitario: 1800, proveedor: 'Y' })
    expect(a.valorizado).toBe(12 * 1800)
    expect(calcularStock(items, movs).get('b')!.valorizado).toBeNull()
  })
  it('deltaDe', () => {
    expect(deltaDe({ tipo: 'compra', cantidad: 5 })).toBe(5)
    expect(deltaDe({ tipo: 'consumo', cantidad: 5 })).toBe(-5)
    expect(deltaDe({ tipo: 'ajuste', cantidad: -1.5 })).toBe(-1.5)
  })
})

describe('estadoStock', () => {
  it('sin stock / bajo mínimo / ok', () => {
    expect(estadoStock(0, 5)).toBe('vencido')
    expect(estadoStock(-1, 1)).toBe('vencido')
    expect(estadoStock(3, 5)).toBe('proximo')
    expect(estadoStock(5, 5)).toBe('proximo')
    expect(estadoStock(6, 5)).toBe('vigente')
    expect(estadoStock(1, 0)).toBe('vigente')
    expect(estadoStock(1, null)).toBe('vigente')
  })
  it('mínimo 0 = sin alerta: en cero no se pone rojo', () => {
    expect(estadoStock(0, 0)).toBe('sin_fecha')
    expect(estadoStock(0, null)).toBe('sin_fecha')
    expect(estadoStock(-1, 0)).toBe('sin_fecha')
  })
})

describe('comprasDelMes', () => {
  it('cuenta y valoriza solo las compras del mes con precio', () => {
    const r = comprasDelMes([
      { item_id: 'a', tipo: 'compra', cantidad: 2, fecha: '2026-09-01', precio_unitario: 100 },
      { item_id: 'a', tipo: 'compra', cantidad: 1, fecha: '2026-09-15' },
      { item_id: 'a', tipo: 'consumo', cantidad: 1, fecha: '2026-09-15' },
      { item_id: 'a', tipo: 'compra', cantidad: 9, fecha: '2026-08-30', precio_unitario: 1 },
    ], '2026-09')
    expect(r).toEqual({ compras: 2, total: 200, sinPrecio: 1 })
  })
})

describe('helpers', () => {
  it('categoriasDe y normalizarNombre', () => {
    expect(categoriasDe([{ categoria: 'Limpieza' }, { categoria: ' ' }, { categoria: 'Fumigación' }, { categoria: 'Limpieza' }])).toEqual(['Fumigación', 'Limpieza'])
    expect(normalizarNombre('  Lavandina   5L ')).toBe('Lavandina 5L')
  })
})
