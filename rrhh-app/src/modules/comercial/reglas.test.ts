import { describe, it, expect } from 'vitest'
import {
  validarProyectoAbierto,
  validarCierreGanado,
  validarCierrePerdido,
  puedeCerrarProyectoGanado,
  puedeCerrarProyectoPerdido,
  requiereProximaAccion,
  estaTareaVencida,
  estaProyectoSinMovimiento,
  calcularProbabilidadPorEtapa,
  etapaEsConsistente,
} from './reglas'

const HOY = new Date('2026-06-18T12:00:00Z')

// ── Validar proyecto abierto ──

describe('validarProyectoAbierto', () => {
  it('rechaza proyecto sin responsable', () => {
    const errores = validarProyectoAbierto({ estado: 'abierto', responsable_id: '', proxima_accion: 'llamar', proxima_accion_fecha: '2026-06-20' })
    expect(errores.length).toBeGreaterThan(0)
  })

  it('rechaza proyecto abierto sin próxima acción', () => {
    const errores = validarProyectoAbierto({ estado: 'abierto', responsable_id: 'uuid-123', proxima_accion: null, proxima_accion_fecha: null })
    expect(errores.some((e) => e.includes('próxima acción'))).toBe(true)
  })

  it('rechaza proyecto abierto sin fecha de próxima acción', () => {
    const errores = validarProyectoAbierto({ estado: 'abierto', responsable_id: 'uuid-123', proxima_accion: 'llamar', proxima_accion_fecha: null })
    expect(errores.some((e) => e.includes('fecha'))).toBe(true)
  })

  it('acepta proyecto abierto completo', () => {
    const errores = validarProyectoAbierto({ estado: 'abierto', responsable_id: 'uuid-123', proxima_accion: 'llamar', proxima_accion_fecha: '2026-06-20' })
    expect(errores).toHaveLength(0)
  })

  it('no exige próxima acción para proyectos cerrados', () => {
    const errores = validarProyectoAbierto({ estado: 'ganado', responsable_id: 'uuid-123', proxima_accion: null, proxima_accion_fecha: null })
    expect(errores).toHaveLength(0)
  })
})

// ── Cierre ganado ──

describe('validarCierreGanado', () => {
  it('rechaza si no tiene valor estimado', () => {
    const errores = validarCierreGanado({ estado: 'abierto', valor_estimado: null, moneda: 'USD' })
    expect(errores.length).toBeGreaterThan(0)
  })

  it('rechaza si no tiene moneda', () => {
    const errores = validarCierreGanado({ estado: 'abierto', valor_estimado: 50000, moneda: null })
    expect(errores.length).toBeGreaterThan(0)
  })

  it('rechaza si ya está cerrado', () => {
    const errores = validarCierreGanado({ estado: 'ganado', valor_estimado: 50000, moneda: 'USD' })
    expect(errores.length).toBeGreaterThan(0)
  })

  it('acepta proyecto válido para cerrar', () => {
    const errores = validarCierreGanado({ estado: 'abierto', valor_estimado: 50000, moneda: 'USD' })
    expect(errores).toHaveLength(0)
  })
})

describe('puedeCerrarProyectoGanado', () => {
  it('devuelve true con valor y moneda', () => {
    expect(puedeCerrarProyectoGanado({ estado: 'abierto', valor_estimado: 50000, moneda: 'USD' })).toBe(true)
  })

  it('devuelve false sin valor', () => {
    expect(puedeCerrarProyectoGanado({ estado: 'abierto', valor_estimado: null, moneda: 'USD' })).toBe(false)
  })
})

// ── Cierre perdido ──

describe('validarCierrePerdido', () => {
  it('rechaza si no tiene motivo', () => {
    const errores = validarCierrePerdido({ estado: 'abierto', motivo_perdida_id: null })
    expect(errores.length).toBeGreaterThan(0)
  })

  it('rechaza si ya está cerrado', () => {
    const errores = validarCierrePerdido({ estado: 'perdido', motivo_perdida_id: 'uuid-motivo' })
    expect(errores.length).toBeGreaterThan(0)
  })

  it('acepta con motivo y estado abierto', () => {
    const errores = validarCierrePerdido({ estado: 'abierto', motivo_perdida_id: 'uuid-motivo' })
    expect(errores).toHaveLength(0)
  })
})

describe('puedeCerrarProyectoPerdido', () => {
  it('devuelve false sin motivo', () => {
    expect(puedeCerrarProyectoPerdido({ estado: 'abierto', motivo_perdida_id: null })).toBe(false)
  })

  it('devuelve true con motivo', () => {
    expect(puedeCerrarProyectoPerdido({ estado: 'abierto', motivo_perdida_id: 'uuid' })).toBe(true)
  })
})

// ── Tareas vencidas ──

describe('estaTareaVencida', () => {
  it('detecta tarea vencida', () => {
    expect(estaTareaVencida({ fecha_vencimiento: '2026-06-10T12:00:00Z', estado: 'pendiente' }, HOY)).toBe(true)
  })

  it('no marca como vencida una completada', () => {
    expect(estaTareaVencida({ fecha_vencimiento: '2026-06-10T12:00:00Z', estado: 'completada' }, HOY)).toBe(false)
  })

  it('no marca como vencida una futura', () => {
    expect(estaTareaVencida({ fecha_vencimiento: '2026-07-01T12:00:00Z', estado: 'pendiente' }, HOY)).toBe(false)
  })

  it('sin fecha no es vencida', () => {
    expect(estaTareaVencida({ fecha_vencimiento: null, estado: 'pendiente' }, HOY)).toBe(false)
  })
})

// ── Proyecto sin movimiento ──

describe('estaProyectoSinMovimiento', () => {
  it('detecta proyecto sin movimiento en más de 7 días', () => {
    const hace10 = new Date(HOY.getTime() - 10 * 24 * 60 * 60 * 1000).toISOString()
    expect(estaProyectoSinMovimiento({ estado: 'abierto', ultima_actividad_at: hace10 }, HOY, 7)).toBe(true)
  })

  it('no alerta con movimiento reciente', () => {
    const hace3 = new Date(HOY.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString()
    expect(estaProyectoSinMovimiento({ estado: 'abierto', ultima_actividad_at: hace3 }, HOY, 7)).toBe(false)
  })

  it('sin última actividad = sin movimiento', () => {
    expect(estaProyectoSinMovimiento({ estado: 'abierto', ultima_actividad_at: null }, HOY, 7)).toBe(true)
  })

  it('proyectos cerrados no cuentan', () => {
    expect(estaProyectoSinMovimiento({ estado: 'ganado', ultima_actividad_at: null }, HOY, 7)).toBe(false)
  })
})

// ── Probabilidad por etapa ──

describe('calcularProbabilidadPorEtapa', () => {
  it('ganado = 100%', () => expect(calcularProbabilidadPorEtapa('ganado')).toBe(100))
  it('perdido = 0%', () => expect(calcularProbabilidadPorEtapa('perdido')).toBe(0))
  it('nuevo = 5%', () => expect(calcularProbabilidadPorEtapa('nuevo')).toBe(5))
  it('negociacion > seguimiento', () => expect(calcularProbabilidadPorEtapa('negociacion')).toBeGreaterThan(calcularProbabilidadPorEtapa('seguimiento')))
})

// ── Consistencia etapa / estado ──

describe('etapaEsConsistente', () => {
  it('etapa ganado requiere estado ganado', () => {
    expect(etapaEsConsistente('ganado', 'abierto')).toBe(false)
    expect(etapaEsConsistente('ganado', 'ganado')).toBe(true)
  })

  it('etapa perdido requiere estado perdido', () => {
    expect(etapaEsConsistente('perdido', 'abierto')).toBe(false)
    expect(etapaEsConsistente('perdido', 'perdido')).toBe(true)
  })

  it('etapas de pipeline requieren estado abierto', () => {
    expect(etapaEsConsistente('negociacion', 'abierto')).toBe(true)
    expect(etapaEsConsistente('negociacion', 'ganado')).toBe(false)
  })
})

// ── requiereProximaAccion ──

describe('requiereProximaAccion', () => {
  it('retorna true si está abierto y sin próxima acción', () => {
    expect(requiereProximaAccion({ estado: 'abierto', proxima_accion: null, proxima_accion_fecha: null })).toBe(true)
  })

  it('retorna false si está cerrado', () => {
    expect(requiereProximaAccion({ estado: 'ganado', proxima_accion: null, proxima_accion_fecha: null })).toBe(false)
  })

  it('retorna false si tiene próxima acción y fecha', () => {
    expect(requiereProximaAccion({ estado: 'abierto', proxima_accion: 'llamar', proxima_accion_fecha: '2026-07-01' })).toBe(false)
  })
})
