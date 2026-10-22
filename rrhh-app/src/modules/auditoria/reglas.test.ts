import { describe, expect, it } from 'vitest'
import { diaAnterior, hrefDe, lineasCambio, nombreCampo, tituloDia, valorLegible, verboYQue } from './reglas'

const ctx = { nombres: { 'b1c2d3e4-0000-4000-8000-000000000001': 'ADC S.R.L.' } }

describe('verboYQue', () => {
  it('alta, cambio y baja', () => {
    expect(verboYQue({ tabla: 'certificados', accion: 'alta', cambios: null })).toBe('cargó el certificado')
    expect(verboYQue({ tabla: 'vehiculos', accion: 'cambio', cambios: { km_actual: [1, 2] } })).toBe('editó el vehículo')
    expect(verboYQue({ tabla: 'archivos', accion: 'baja', cambios: null })).toBe('borró el adjunto')
  })
  it('dar de baja y reactivar a un empleado', () => {
    expect(verboYQue({ tabla: 'empleados', accion: 'cambio', cambios: { activo: [true, false] } })).toBe('dio de baja al empleado')
    expect(verboYQue({ tabla: 'empleados', accion: 'cambio', cambios: { activo: [false, true] } })).toBe('reactivó al empleado')
  })
  it('cargar un empleado usa "el"', () => expect(verboYQue({ tabla: 'empleados', accion: 'alta', cambios: null })).toBe('cargó el empleado'))
  it('resolver una novedad', () =>
    expect(verboYQue({ tabla: 'vehiculo_novedades', accion: 'cambio', cambios: { estado: ['abierta', 'resuelta'] } })).toBe('resolvió la novedad'))
})

describe('valorLegible', () => {
  it('fechas, booleanos, vacíos y números', () => {
    expect(valorLegible('2026-08-21', ctx)).toBe('21/08/2026')
    expect(valorLegible('2026-10-22T15:30:00+00:00', ctx)).toBe('22/10/2026')
    expect(valorLegible(true, ctx)).toBe('Sí')
    expect(valorLegible(null, ctx)).toBe('—')
    expect(valorLegible(223939, ctx)).toBe('223.939')
  })
  it('un id se muestra por su nombre, o como "otro registro"', () => {
    expect(valorLegible('b1c2d3e4-0000-4000-8000-000000000001', ctx)).toBe('ADC S.R.L.')
    expect(valorLegible('b1c2d3e4-0000-4000-8000-000000000009', ctx)).toBe('otro registro')
  })
})

describe('lineasCambio', () => {
  it('nombra los campos y esconde los técnicos', () => {
    expect(lineasCambio({ fecha_vencimiento: ['2026-08-21', '2027-08-21'], id: ['a', 'b'] }, ctx)).toEqual([
      { campo: 'Vencimiento', antes: '21/08/2026', despues: '21/08/2027' },
    ])
  })
  it('un campo sin nombre propio se arma solo', () => expect(nombreCampo('reportado_por_nombre')).toBe('Reportado por nombre'))
})

describe('hrefDe', () => {
  const slugs = { 'e1': 'adc' }
  it('lleva a la ficha o a la de quien lo contiene', () => {
    expect(hrefDe({ tabla: 'empleados', accion: 'cambio', registro_id: 'x', ref: null, empresa_id: null }, slugs)).toBe('/legajo/x')
    expect(hrefDe({ tabla: 'certificados', accion: 'baja', registro_id: 'c', ref: { vehiculo_id: 'v' }, empresa_id: null }, slugs)).toBe('/flota/v')
    expect(hrefDe({ tabla: 'stock_movimientos', accion: 'alta', registro_id: 'm', ref: null, empresa_id: 'e1' }, slugs)).toBe('/stock?empresa=adc')
  })
  it('lo borrado ya no tiene ficha', () => expect(hrefDe({ tabla: 'vehiculos', accion: 'baja', registro_id: 'v', ref: null, empresa_id: null }, slugs)).toBeNull())
})

describe('diaAnterior', () => {
  it('cruza el mes', () => expect(diaAnterior('2026-11-01')).toBe('2026-10-31'))
})

describe('tituloDia', () => {
  it('hoy, ayer y el resto con el día de la semana', () => {
    expect(tituloDia('2026-10-22', '2026-10-22', '2026-10-21')).toBe('Hoy')
    expect(tituloDia('2026-10-21', '2026-10-22', '2026-10-21')).toBe('Ayer')
    expect(tituloDia('2026-10-19', '2026-10-22', '2026-10-21')).toBe('Lunes 19 de octubre')
  })
})
