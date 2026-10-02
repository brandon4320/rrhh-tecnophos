import { describe, it, expect } from 'vitest'
import { resumirVehiculo, mensajeResumenDiario, type DatosVehiculo } from './resumen'

const HOY = '2026-10-05' // lunes

const base = (extra: Partial<DatosVehiculo> = {}): DatosVehiculo => ({
  id: 'v1',
  patente: 'AD113UY',
  km_actual: 86_000,
  checklist_cada_dias: 15,
  checklist_activo: true,
  checklists: [
    { created_at: '2026-09-30T10:00:00-03:00', km: 86_000, km_inconsistente: false, resultado: 'ok' },
    { created_at: '2026-09-15T10:00:00-03:00', km: 83_000, km_inconsistente: false, resultado: 'ok' },
  ],
  plan: [{ tipo: 'service', cada_km: 10_000, cada_meses: 12 }],
  services: [{ tipo: 'service', fecha: '2026-08-01', km: 82_000 }],
  novedades: [],
  certificados: [{ nombre: 'VTV', fecha_vencimiento: '2027-03-01', alerta_dias: 30 }],
  ...extra,
})

describe('resumen del vehículo', () => {
  it('todo al día: verde y sin motivos', () => {
    const r = resumirVehiculo(base(), HOY)
    expect(r.semaforo).toBe('verde')
    expect(r.motivos).toEqual([])
    expect(r.kmDia).toBe(200)
  })

  it('el último checklist no apto la pone en rojo', () => {
    const r = resumirVehiculo(base({
      checklists: [{ created_at: '2026-10-03T10:00:00-03:00', km: 86_100, km_inconsistente: false, resultado: 'no_apto' }],
    }), HOY)
    expect(r.semaforo).toBe('rojo')
    expect(r.motivos[0]).toMatch(/No apta/)
  })

  it('un km marcado como inconsistente no entra en la proyección', () => {
    const r = resumirVehiculo(base({
      checklists: [
        { created_at: '2026-10-04T10:00:00-03:00', km: 860_000, km_inconsistente: true, resultado: 'ok' },
        { created_at: '2026-09-30T10:00:00-03:00', km: 86_000, km_inconsistente: false, resultado: 'ok' },
        { created_at: '2026-09-15T10:00:00-03:00', km: 83_000, km_inconsistente: false, resultado: 'ok' },
      ],
    }), HOY)
    expect(r.kmDia).toBe(200)
  })

  it('documento por vencer: amarillo', () => {
    const r = resumirVehiculo(base({ certificados: [{ nombre: 'VTV', fecha_vencimiento: '2026-10-12', alerta_dias: 30 }] }), HOY)
    expect(r.semaforo).toBe('amarillo')
    expect(r.motivos).toContain('VTV vence en 7 días')
  })

  it('la VTV nueva manda sobre la vieja', () => {
    const r = resumirVehiculo(base({
      certificados: [
        { nombre: 'VTV', fecha_vencimiento: '2025-10-01', alerta_dias: 30 },
        { nombre: 'VTV', fecha_vencimiento: '2026-11-30', alerta_dias: 30 },
      ],
    }), HOY)
    expect(r.documentos).toHaveLength(1)
    expect(r.documentos[0].vence).toBe('2026-11-30')
  })
})

describe('mensaje del resumen diario', () => {
  const empresa = { nombre: 'Tecnophos Bahía Blanca', slug: 'tecnophos-bb' }

  it('no manda nada si todo está en orden', () => {
    const r = resumirVehiculo(base(), HOY)
    expect(mensajeResumenDiario(empresa, [{ patente: 'AD113UY', checklistActivo: true, r }], HOY, 'https://x')).toBeNull()
  })

  it('agrupa por tema, una línea por grupo, con el link a la flota', () => {
    const vencido = resumirVehiculo(base({
      checklists: [{ created_at: '2026-09-15T10:00:00-03:00', km: 83_000, km_inconsistente: false, resultado: 'ok' }],
    }), HOY)
    const nuevo = resumirVehiculo(base({ checklists: [] }), HOY)
    const msg = mensajeResumenDiario(empresa, [
      { patente: 'AD113UY', checklistActivo: true, r: vencido },
      { patente: 'AE169KB', checklistActivo: true, r: nuevo },
    ], HOY, 'https://gestion.test')!
    expect(msg).toContain('Flota Tecnophos Bahía Blanca')
    expect(msg).toContain('• Vencido: AD113UY (hace 5 días)')
    expect(msg).toContain('• Sin hacer todavía: AE169KB')
    expect(msg).toContain('https://gestion.test/flota?empresa=tecnophos-bb')
  })

  it('un vehículo con el checklist desactivado no aparece por el checklist', () => {
    const r = resumirVehiculo(base({ checklists: [], checklist_activo: false }), HOY)
    expect(mensajeResumenDiario(empresa, [{ patente: 'AD113UY', checklistActivo: false, r }], HOY, 'https://x')).toBeNull()
  })
})
