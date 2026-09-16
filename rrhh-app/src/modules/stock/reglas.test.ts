import { describe, it, expect } from 'vitest'
import { parseCantidad, deltaDe, calcularStock, estadoStock, comprasDelMes, categoriasDe, normalizarNombre, sumarStock, mesClave, hoyClave, partirVariante, compararItems, agruparCatalogo, SIN_CATEGORIA } from './reglas'

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
    expect(a.ultimaCompra).toMatchObject({ fecha: '2026-09-02', precio_unitario: 1800, proveedor: 'Y' })
    expect(a.valorizado).toBe(12 * 1800)
    expect(calcularStock(items, movs).get('b')!.valorizado).toBeNull()
  })
  it('dos compras el mismo día: manda la más reciente (created_at), no el orden de entrada', () => {
    const its = [{ id: 'a', nombre: 'X', stock_minimo: 0, activo: true }]
    const hoy = [
      { item_id: 'a', tipo: 'compra', cantidad: 1, fecha: '2026-09-10', precio_unitario: 2000, proveedor: 'Nuevo', created_at: '2026-09-10T18:00:00Z' },
      { item_id: 'a', tipo: 'compra', cantidad: 1, fecha: '2026-09-10', precio_unitario: 1500, proveedor: 'Viejo', created_at: '2026-09-10T12:00:00Z' },
    ]
    expect(calcularStock(its, hoy).get('a')!.ultimaCompra).toMatchObject({ precio_unitario: 2000, proveedor: 'Nuevo' })
    expect(calcularStock(its, [...hoy].reverse()).get('a')!.ultimaCompra).toMatchObject({ precio_unitario: 2000, proveedor: 'Nuevo' })
    expect(sumarStock(hoy)).toBe(2)
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

describe('fechas en hora Argentina', () => {
  it('a las 22:00 AR del 30/09 todavía es septiembre aunque en UTC ya sea octubre', () => {
    const finDeMes = new Date('2026-10-01T01:00:00Z')
    expect(hoyClave(finDeMes)).toBe('2026-09-30')
    expect(mesClave(finDeMes)).toBe('2026-09')
  })
})

describe('helpers', () => {
  it('categoriasDe y normalizarNombre', () => {
    expect(categoriasDe([{ categoria: 'Limpieza' }, { categoria: ' ' }, { categoria: 'Fumigación' }, { categoria: 'Limpieza' }])).toEqual(['Fumigación', 'Limpieza'])
    expect(normalizarNombre('  Lavandina   5L ')).toBe('Lavandina 5L')
  })
})

describe('partirVariante', () => {
  it('parte los talles reales del catálogo', () => {
    expect(partirVariante('Buzo Tecno + ADC T M')).toEqual({ base: 'Buzo Tecno + ADC', variante: 'M' })
    expect(partirVariante('Camisa ADC T 42')).toEqual({ base: 'Camisa ADC', variante: '42' })
    expect(partirVariante('Guantes Talle XL')).toEqual({ base: 'Guantes', variante: 'XL' })
  })
  it('no confunde unidades de medida con talles', () => {
    expect(partirVariante('Bidón 20 L')).toBeNull()
    expect(partirVariante('Lavandina 5 L')).toBeNull()
    expect(partirVariante('Cable T USB')).toBeNull() // USB no es un talle
    expect(partirVariante('Antiparras')).toBeNull()
    expect(partirVariante('Buzo M')).toBeNull() // sin el marcador T no se infiere
  })
})

describe('compararItems', () => {
  it('ordena los talles como serie, no alfabéticamente', () => {
    const nombres = ['Buzo T XL', 'Buzo T S', 'Buzo T XXL', 'Buzo T M']
    expect(nombres.map((nombre) => ({ nombre })).sort(compararItems).map((i) => i.nombre))
      .toEqual(['Buzo T S', 'Buzo T M', 'Buzo T XL', 'Buzo T XXL'])
  })
  it('los talles numéricos van como números', () => {
    const nombres = ['Camisa T 46', 'Camisa T 8', 'Camisa T 36']
    expect(nombres.map((nombre) => ({ nombre })).sort(compararItems).map((i) => i.nombre))
      .toEqual(['Camisa T 8', 'Camisa T 36', 'Camisa T 46'])
  })
  it('familias distintas se ordenan por su nombre base', () => {
    const nombres = ['Pantalon T 40', 'Antiparras', 'Camisa T 50']
    expect(nombres.map((nombre) => ({ nombre })).sort(compararItems).map((i) => i.nombre))
      .toEqual(['Antiparras', 'Camisa T 50', 'Pantalon T 40'])
  })
})

describe('agruparCatalogo', () => {
  const items = [
    { nombre: 'Camisa ADC T 42', categoria: 'Ropa ADC' },
    { nombre: 'Camisa ADC T 36', categoria: 'Ropa ADC' },
    { nombre: 'Campera ADC T L', categoria: 'Ropa ADC' }, // familia de UNO
    { nombre: 'Antiparras', categoria: 'EPP' },
    { nombre: 'Botas', categoria: 'EPP' },
    { nombre: 'Trapo', categoria: '  ' }, // sin categoría
  ]
  const todoOk = () => 'vigente' as const

  it('agrupa por categoría, alfabético y con "Sin categoría" al final', () => {
    expect(agruparCatalogo(items, todoOk).map((g) => g.categoria)).toEqual(['EPP', 'Ropa ADC', SIN_CATEGORIA])
  })

  it('una familia con varias variantes se agrupa y se ordena por talle', () => {
    const ropa = agruparCatalogo(items, todoOk).find((g) => g.categoria === 'Ropa ADC')!
    expect(ropa.total).toBe(3)
    const familia = ropa.entradas.find((e) => e.tipo === 'familia')
    expect(familia).toMatchObject({ tipo: 'familia', base: 'Camisa ADC' })
    expect(familia!.tipo === 'familia' && familia!.variantes.map((v) => v.variante)).toEqual(['36', '42'])
  })

  it('una familia de un solo miembro NO genera rótulo: va como ítem suelto', () => {
    const ropa = agruparCatalogo(items, todoOk).find((g) => g.categoria === 'Ropa ADC')!
    const campera = ropa.entradas.find((e) => e.tipo === 'item' && e.item.nombre === 'Campera ADC T L')
    expect(campera).toBeDefined()
  })

  it('los subtotales por categoría cuentan cada estado', () => {
    const estadoDe = (i: { nombre: string }) =>
      i.nombre === 'Antiparras' ? ('vencido' as const) : i.nombre === 'Botas' ? ('proximo' as const) : ('vigente' as const)
    const epp = agruparCatalogo(items, estadoDe).find((g) => g.categoria === 'EPP')!
    expect(epp).toMatchObject({ total: 2, sinStock: 1, bajoMinimo: 1 })
  })

  it('todo ítem aparece exactamente una vez', () => {
    const vistos = agruparCatalogo(items, todoOk).flatMap((g) =>
      g.entradas.flatMap((e) => (e.tipo === 'familia' ? e.variantes.map((v) => v.item.nombre) : [e.item.nombre]))
    )
    expect(vistos.sort()).toEqual(items.map((i) => i.nombre).sort())
  })
})
