import { describe, it, expect } from 'vitest'
import type { EstadoVencimiento } from '@/types'
import {
  parseCantidad, deltaDe, calcularStock, estadoStock, comprasDelMes, categoriasDe, normalizarNombre, sumarStock, mesClave,
  hoyClave, partirVariante, compararItems, SIN_CATEGORIA, categoriaDe, claveBase, partirTalleSinMarcador, agruparPrendas,
  matricesDePrendas, compararTalle, ordenarPorUrgencia, textoMinimo, ultimoMovimientoPorItem, describirMovimiento,
  contraparteDe, compararMovimientosDesc, destinatariosFrecuentes, filtrarMovimientos, rangoMesActual, rangoMesAnterior,
  prepararLineas, excedenStock,
} from './reglas'

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

describe('claveBase y partirTalleSinMarcador', () => {
  it('compara bases sin acentos, mayúsculas ni "de"', () => {
    expect(claveBase('BOTINES DE SEGURIDAD')).toBe(claveBase('Botines seguridad'))
    expect(claveBase('Pantalón ADC')).toBe(claveBase('pantalon adc'))
    expect(claveBase('Buzo Tecno + ADC')).not.toBe(claveBase('Buzo ADC'))
  })
  it('dos cifras al final sin marcador es candidato', () => {
    expect(partirTalleSinMarcador('BOTINES SEGURIDAD 39')).toEqual({ base: 'BOTINES SEGURIDAD', variante: '39' })
    expect(partirTalleSinMarcador('Bidón 5')).toBeNull() // una sola cifra
    expect(partirTalleSinMarcador('Filtro F600')).toBeNull() // pegado, no es talle
    expect(partirTalleSinMarcador('Casco')).toBeNull()
  })
})

describe('agruparPrendas', () => {
  const nombres = (xs: { nombre: string }[]) => xs.map((x) => x.nombre)

  it('arma la prenda con sus talles en orden real (S, M, L / números)', () => {
    const { prendas, sueltos } = agruparPrendas([
      { nombre: 'Buzo ADC T XL' }, { nombre: 'Buzo ADC T M' }, { nombre: 'Buzo ADC Talle XXL' },
      { nombre: 'Camisa ADC T 44' }, { nombre: 'Camisa ADC T 36' }, { nombre: 'Camisa ADC Talle 50' },
      { nombre: 'Antiparras' },
    ])
    expect(prendas.map((p) => p.base)).toEqual(['Buzo ADC', 'Camisa ADC'])
    expect(prendas[0]).toMatchObject({ sistema: 'letras' })
    expect(prendas[0].talles.map((t) => t.talle)).toEqual(['M', 'XL', 'XXL'])
    expect(prendas[1]).toMatchObject({ sistema: 'numeros' })
    expect(prendas[1].talles.map((t) => t.talle)).toEqual(['36', '44', '50'])
    expect(nombres(sueltos)).toEqual(['Antiparras'])
  })

  it('cada celda es el ítem real (mismo objeto, con su id): se rotula, no se fusiona', () => {
    const a = { id: 'a', nombre: 'Camisa T 40' }, b = { id: 'b', nombre: 'Camisa T 42' }
    const { prendas } = agruparPrendas([a, b])
    expect(prendas[0].talles.map((t) => t.item)).toEqual([a, b])
    expect(prendas[0].talles[0].item).toBe(a)
  })

  it('agrupa los botines de Rosario: sin "T" y con y sin "DE"', () => {
    const items = [
      'BOTINES DE SEGURIDAD 40', 'BOTINES DE SEGURIDAD 41', 'BOTINES DE SEGURIDAD 42', 'BOTINES DE SEGURIDAD 43',
      'BOTINES DE SEGURIDAD 44', 'BOTINES DE SEGURIDAD 45', 'BOTINES SEGURIDAD 39', 'CASCO SEGURIDAD AMARILLOS',
    ].map((nombre) => ({ nombre }))
    const { prendas, sueltos } = agruparPrendas(items)
    expect(prendas).toHaveLength(1)
    expect(prendas[0].base).toBe('BOTINES DE SEGURIDAD') // la escritura más usada
    expect(prendas[0].talles.map((t) => t.talle)).toEqual(['39', '40', '41', '42', '43', '44', '45'])
    expect(nombres(prendas[0].talles.map((t) => t.item))).toContain('BOTINES SEGURIDAD 39')
    expect(nombres(sueltos)).toEqual(['CASCO SEGURIDAD AMARILLOS'])
  })

  it('sin marcador, dos no alcanzan: "Bidón 10" y "Bidón 20" no son talles', () => {
    const { prendas, sueltos } = agruparPrendas([{ nombre: 'Bidón 10' }, { nombre: 'Bidón 20' }])
    expect(prendas).toHaveLength(0)
    expect(nombres(sueltos).sort()).toEqual(['Bidón 10', 'Bidón 20'])
  })

  it('con marcador alcanza con dos; una prenda de un solo talle va a la tabla plana', () => {
    const { prendas, sueltos } = agruparPrendas([
      { nombre: 'Campera ADC T L' }, { nombre: 'Campera ADC T M' }, { nombre: 'Chaleco T XL' },
    ])
    expect(prendas.map((p) => p.base)).toEqual(['Campera ADC'])
    expect(nombres(sueltos)).toEqual(['Chaleco T XL'])
  })

  it('dos ítems con el mismo talle: el segundo va a la tabla plana (no se pisan ni se suman)', () => {
    const { prendas, sueltos } = agruparPrendas([
      { nombre: 'Camisa ADC T 44' }, { nombre: 'camisa adc talle 44' }, { nombre: 'Camisa ADC T 46' },
    ])
    expect(prendas).toHaveLength(1)
    expect(prendas[0].talles.map((t) => t.talle)).toEqual(['44', '46'])
    expect(sueltos).toHaveLength(1)
  })

  it('no confunde unidades de medida con talles', () => {
    const { prendas } = agruparPrendas([{ nombre: 'Bidón 20 L' }, { nombre: 'Lavandina 5 L' }, { nombre: 'Cable T USB' }])
    expect(prendas).toHaveLength(0)
  })

  it('todo ítem aparece exactamente una vez', () => {
    const items = [
      'Camisa ADC T 36', 'Camisa ADC T 38', 'camisa adc talle 38', 'Buzo T M', 'Buzo T L', 'Guantes', 'Bidón 10', 'Bidón 20',
      'BOTINES 40', 'BOTINES DE 41', 'Botines 42', 'Chaleco T XL',
    ].map((nombre) => ({ nombre }))
    const { prendas, sueltos } = agruparPrendas(items)
    const vistos = [...prendas.flatMap((p) => p.talles.map((t) => t.item.nombre)), ...nombres(sueltos)]
    expect(vistos.sort()).toEqual(items.map((i) => i.nombre).sort())
  })
})

describe('matricesDePrendas', () => {
  it('una matriz por sistema, con la unión de talles en orden', () => {
    const { prendas } = agruparPrendas([
      { nombre: 'Camisa T 36' }, { nombre: 'Camisa T 44' }, { nombre: 'Pantalon T 40' }, { nombre: 'Pantalon T 56' },
      { nombre: 'Buzo T XL' }, { nombre: 'Buzo T S' },
    ])
    const m = matricesDePrendas(prendas)
    expect(m.map((x) => x.sistema)).toEqual(['letras', 'numeros'])
    expect(m[0].talles).toEqual(['S', 'XL'])
    expect(m[1].talles).toEqual(['36', '40', '44', '56'])
    expect(m[1].prendas.map((p) => p.base)).toEqual(['Camisa', 'Pantalon'])
  })
  it('sin prendas no hay matrices', () => {
    expect(matricesDePrendas([])).toEqual([])
  })
})

describe('compararTalle', () => {
  it('letras en orden real, números como números, letras antes que números', () => {
    expect(['XL', 'S', 'XXXL', 'M'].sort(compararTalle)).toEqual(['S', 'M', 'XL', 'XXXL'])
    expect(['8', '46', '36'].sort(compararTalle)).toEqual(['8', '36', '46'])
    expect(['40', 'M'].sort(compararTalle)).toEqual(['M', '40'])
  })
})

describe('ordenarPorUrgencia y textoMinimo', () => {
  it('rojo, después naranja, después alfabético', () => {
    const estados: Record<string, EstadoVencimiento> = { Casco: 'vigente', Antiparras: 'vigente', Lentes: 'vencido', Botas: 'proximo', Filtro: 'sin_fecha' }
    const items = Object.keys(estados).map((nombre) => ({ nombre }))
    expect(ordenarPorUrgencia(items, (i) => estados[i.nombre]).map((i) => i.nombre)).toEqual(['Lentes', 'Botas', 'Antiparras', 'Casco', 'Filtro'])
  })
  it('el mínimo 1 (criterio general) no se muestra', () => {
    expect(textoMinimo(1)).toBeNull()
    expect(textoMinimo(0)).toBe('sin mínimo')
    expect(textoMinimo(null)).toBe('sin mínimo')
    expect(textoMinimo(5, 'par')).toBe('mín. 5 par')
  })
})

describe('movimientos: último, descripción y contraparte', () => {
  const movs = [
    { item_id: 'a', tipo: 'compra', fecha: '2026-09-16', proveedor: 'Soluciones Integrales', notas: null, created_at: '2026-09-16T10:00:00Z' },
    { item_id: 'a', tipo: 'consumo', fecha: '2026-09-24', proveedor: null, notas: 'Nicolas Fernandez', created_at: '2026-09-24T10:00:00Z' },
    { item_id: 'a', tipo: 'consumo', fecha: '2026-09-24', proveedor: null, notas: 'Matias Alonso', created_at: '2026-09-24T09:00:00Z' },
    { item_id: 'b', tipo: 'ajuste', fecha: '2026-09-22', proveedor: null, notas: 'Libus · Conteo: 2 unidad (había 0 unidad)', created_at: null },
  ]
  it('el último por ítem desempata por created_at', () => {
    const u = ultimoMovimientoPorItem(movs)
    expect(u.get('a')!.notas).toBe('Nicolas Fernandez')
    expect(u.get('b')!.tipo).toBe('ajuste')
    expect(ultimoMovimientoPorItem([...movs].reverse()).get('a')!.notas).toBe('Nicolas Fernandez')
  })
  it('describe cada tipo en palabras', () => {
    expect(describirMovimiento(movs[1])).toBe('entregado a Nicolas Fernandez')
    expect(describirMovimiento({ tipo: 'consumo', notas: null })).toBe('entregado')
    expect(describirMovimiento(movs[0])).toBe('Soluciones Integrales')
    expect(describirMovimiento({ tipo: 'compra', notas: 'Devolucion Tobias', proveedor: null })).toBe('ingreso · Devolucion Tobias')
    expect(describirMovimiento({ tipo: 'ajuste', notas: 'Stock inicial' })).toBe('stock inicial')
    expect(describirMovimiento(movs[3])).toBe('ajuste · Libus')
    expect(describirMovimiento({ tipo: 'ajuste', notas: 'Conteo: 3 unidad (había -1 unidad)' })).toBe('ajuste por conteo')
  })
  it('contraparte: proveedor en ingresos, destinatario en entregas', () => {
    expect(contraparteDe(movs[0])).toEqual({ principal: 'Soluciones Integrales', detalle: null })
    expect(contraparteDe({ tipo: 'compra', proveedor: 'LTM', notas: 'parcial' })).toEqual({ principal: 'LTM', detalle: 'parcial' })
    expect(contraparteDe(movs[1])).toEqual({ principal: 'Nicolas Fernandez', detalle: null })
    expect(contraparteDe(movs[3]).principal).toBe('Libus')
  })
  it('compararMovimientosDesc: más reciente primero', () => {
    expect([...movs].sort(compararMovimientosDesc).map((m) => m.notas ?? m.proveedor)).toEqual([
      'Nicolas Fernandez', 'Matias Alonso', 'Libus · Conteo: 2 unidad (había 0 unidad)', 'Soluciones Integrales',
    ])
  })
  it('destinatarios: el más reciente primero, sin duplicados por mayúsculas/acentos', () => {
    const r = destinatariosFrecuentes([
      ...movs,
      { item_id: 'c', tipo: 'consumo', fecha: '2026-09-01', notas: 'nicolás fernández ', created_at: null },
      { item_id: 'c', tipo: 'consumo', fecha: '2026-09-02', notas: '  ', created_at: null },
    ])
    expect(r).toEqual(['Nicolas Fernandez', 'Matias Alonso'])
  })
})

describe('filtrarMovimientos', () => {
  const items: Record<string, string> = { a: 'Camisa ADC T 44', b: 'Antiparras' }
  const movs = [
    { id: '1', item_id: 'a', tipo: 'consumo', fecha: '2026-10-01', notas: 'Nicolás Fernández' },
    { id: '2', item_id: 'b', tipo: 'consumo', fecha: '2026-09-24', notas: 'Nicolas Fernandez' },
    { id: '3', item_id: 'b', tipo: 'compra', fecha: '2026-10-02', notas: null },
  ]
  const campos = (m: (typeof movs)[number]) => [items[m.item_id], m.notas]
  const mes = rangoMesActual('2026-10-02')

  it('busca en las notas por palabras y sin acentos, y avisa lo que quedó fuera del rango', () => {
    const r = filtrarMovimientos(movs, { tipo: null, ...mes, busqueda: 'fernandez nicolas' }, campos)
    expect(r.visibles.map((m) => m.id)).toEqual(['1'])
    expect(r.fueraDeRango).toBe(1)
  })
  it('sin rango ve todo; por tipo filtra', () => {
    expect(filtrarMovimientos(movs, { tipo: null, desde: '', hasta: '', busqueda: 'nicolas' }, campos).visibles).toHaveLength(2)
    expect(filtrarMovimientos(movs, { tipo: 'compra', desde: '', hasta: '', busqueda: '' }, campos).visibles.map((m) => m.id)).toEqual(['3'])
  })
  it('también busca por el ítem', () => {
    expect(filtrarMovimientos(movs, { tipo: null, desde: '', hasta: '', busqueda: 'camisa 44' }, campos).visibles.map((m) => m.id)).toEqual(['1'])
  })
  it('rangos de mes', () => {
    expect(rangoMesActual('2026-10-02')).toEqual({ desde: '2026-10-01', hasta: '2026-10-02' })
    expect(rangoMesAnterior('2026-10-02')).toEqual({ desde: '2026-09-01', hasta: '2026-09-30' })
    expect(rangoMesAnterior('2026-01-15')).toEqual({ desde: '2025-12-01', hasta: '2025-12-31' })
    expect(rangoMesAnterior('2028-03-10')).toEqual({ desde: '2028-02-01', hasta: '2028-02-29' })
  })
})

describe('prepararLineas y excedenStock', () => {
  it('ignora las líneas vacías y parsea cantidades y precios', () => {
    const r = prepararLineas([
      { item_id: 'a', cantidad: '2' },
      { item_id: '', cantidad: '' },
      { item_id: 'b', cantidad: '1,5', precio: '1.500' },
    ], true)
    expect(r).toEqual({ ok: true, lineas: [
      { item_id: 'a', cantidad: 2, precio_unitario: null },
      { item_id: 'b', cantidad: 1.5, precio_unitario: 1500 },
    ] })
  })
  it('sin precio en entregas aunque venga tipeado', () => {
    const r = prepararLineas([{ item_id: 'a', cantidad: '1', precio: '99' }], false)
    expect(r.ok && r.lineas[0].precio_unitario).toBeNull()
  })
  it('errores con el número de línea', () => {
    expect(prepararLineas([{ item_id: '', cantidad: '3' }], false)).toMatchObject({ ok: false, indice: 0 })
    expect(prepararLineas([{ item_id: 'a', cantidad: '1' }, { item_id: 'b', cantidad: '0' }], false)).toMatchObject({ ok: false, indice: 1, error: expect.stringContaining('línea 2') })
    expect(prepararLineas([{ item_id: 'a', cantidad: '1', precio: 'mucho' }], true)).toMatchObject({ ok: false })
    expect(prepararLineas([{ item_id: '', cantidad: '' }], false)).toMatchObject({ ok: false, error: 'Agregá al menos un ítem.' })
  })
  it('suma las líneas del mismo ítem contra su stock', () => {
    const stock: Record<string, number> = { a: 2, b: 5 }
    expect(excedenStock([{ item_id: 'a', cantidad: 1 }, { item_id: 'a', cantidad: 2 }, { item_id: 'b', cantidad: 5 }], (id) => stock[id]))
      .toEqual([{ item_id: 'a', pedido: 3, stock: 2 }])
  })
})

describe('categoriaDe', () => {
  it('la vacía cuenta como "Sin categoría"', () => {
    expect(categoriaDe({ categoria: ' EPP ' })).toBe('EPP')
    expect(categoriaDe({ categoria: null })).toBe(SIN_CATEGORIA)
    expect(categoriaDe({ categoria: '  ' })).toBe(SIN_CATEGORIA)
  })
})

describe('devoluciones y vínculo con empleados (migración 24)', () => {
  it('una devolución suma stock y no cuenta como compra del mes', async () => {
    const r = await import('./reglas')
    expect(r.deltaDe({ tipo: 'devolucion', cantidad: 2 })).toBe(2)
    const movs = [
      { tipo: 'compra', cantidad: 5, fecha: '2026-10-02', precio_unitario: 100, item_id: 'a' },
      { tipo: 'devolucion', cantidad: 1, fecha: '2026-10-02', precio_unitario: null, item_id: 'a' },
    ]
    expect(r.comprasDelMes(movs as never, '2026-10').compras).toBe(1)
    expect(r.describirMovimiento({ tipo: 'devolucion', notas: 'Tobias' })).toBe('devuelto por Tobias')
  })
  it('vincula al empleado solo si el nombre coincide exacto con uno (sin acentos, cualquier orden)', async () => {
    const { empleadoPorNombre } = await import('./reglas')
    const emps = [
      { id: '1', nombre: 'Nicolás', apellido: 'Fernández' },
      { id: '2', nombre: 'JESUS DANIEL', apellido: 'MIÑO' },
      { id: '3', nombre: 'Juan', apellido: 'Perez' },
      { id: '4', nombre: 'Juan', apellido: 'Perez' },
    ]
    expect(empleadoPorNombre('nicolas fernandez', emps)?.id).toBe('1')
    expect(empleadoPorNombre('Miño Jesus Daniel', emps)?.id).toBe('2')
    expect(empleadoPorNombre('Nicolás', emps)).toBeNull()
    expect(empleadoPorNombre('Juan Perez', emps)).toBeNull() // ambiguo
    expect(empleadoPorNombre('Barco Port Alberni', emps)).toBeNull()
  })
})
