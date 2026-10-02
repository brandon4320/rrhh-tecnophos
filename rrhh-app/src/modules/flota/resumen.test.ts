import { describe, it, expect } from 'vitest'
import { resumirVehiculo, mensajeResumenDiario, type DatosVehiculo } from './resumen'

const HOY = '2026-10-05' // lunes: quincena del 1 al 14, ya pasada la gracia (1 al 3)

const base = (extra: Partial<DatosVehiculo> = {}): DatosVehiculo => ({
  id: 'v1',
  patente: 'AD113UY',
  km_actual: 86_000,
  checklist_cada_dias: 15,
  checklist_activo: true,
  checklists: [
    { created_at: '2026-10-01T10:00:00-03:00', km: 86_000, km_inconsistente: false, resultado: 'ok' },
    { created_at: '2026-09-16T10:00:00-03:00', km: 83_000, km_inconsistente: false, resultado: 'ok' },
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

  it('una novedad grave abierta la deja no apta y en rojo', () => {
    const r = resumirVehiculo(base({
      novedades: [{ gravedad: 'alta', titulo: 'Luces de freno', created_at: '2026-10-01T10:00:00-03:00' }],
    }), HOY)
    expect(r.noApta).toBe(true)
    expect(r.semaforo).toBe('rojo')
    expect(r.motivos[0]).toBe('No apta para circular: 1 novedad grave abierta')
  })

  it('no apta sale de las novedades abiertas, no del último checklist: se limpia al resolverlas', () => {
    const r = resumirVehiculo(base({
      checklists: [
        { created_at: '2026-10-03T10:00:00-03:00', km: 86_100, km_inconsistente: false, resultado: 'no_apto' },
        { created_at: '2026-09-16T10:00:00-03:00', km: 83_000, km_inconsistente: false, resultado: 'ok' },
      ],
      novedades: [], // la oficina ya resolvió las graves
    }), HOY)
    expect(r.noApta).toBe(false)
    expect(r.semaforo).toBe('verde')
  })

  it('una novedad no grave no la deja no apta', () => {
    const r = resumirVehiculo(base({
      novedades: [{ gravedad: 'media', titulo: 'Bocina', created_at: '2026-10-01T10:00:00-03:00' }],
    }), HOY)
    expect(r.noApta).toBe(false)
    expect(r.semaforo).toBe('amarillo')
  })

  it('checklist: al empezar la quincena toca hacerlo (amarillo); pasada la gracia, vencido (rojo)', () => {
    const anterior = base({
      checklists: [{ created_at: '2026-09-16T10:00:00-03:00', km: 83_000, km_inconsistente: false, resultado: 'ok' }],
    })
    const enGracia = resumirVehiculo(anterior, '2026-10-02')
    expect(enGracia.checklist.estado).toBe('vence_pronto')
    expect(enGracia.semaforo).toBe('amarillo')
    expect(enGracia.motivos).toContain('Toca hacer el checklist (hasta mañana)')
    const vencido = resumirVehiculo(anterior, HOY)
    expect(vencido.semaforo).toBe('rojo')
    expect(vencido.motivos).toContain('Checklist vencido hace 2 días')
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
    expect(msg).toContain('• Vencido: AD113UY (hace 2 días)')
    expect(msg).toContain('• Sin hacer todavía: AE169KB')
    expect(msg).toContain('https://gestion.test/flota?empresa=tecnophos-bb')
  })

  it('en los días de gracia avisa que toca hacerlo, con hasta cuándo', () => {
    const hoy = '2026-10-01'
    const r = resumirVehiculo(base({
      checklists: [{ created_at: '2026-09-16T10:00:00-03:00', km: 83_000, km_inconsistente: false, resultado: 'ok' }],
    }), hoy)
    const msg = mensajeResumenDiario(empresa, [{ patente: 'AD113UY', checklistActivo: true, r }], hoy, 'https://x')!
    expect(msg).toContain('• Toca hacerlo: AD113UY (hasta el 03/10)')
  })

  it('las no aptas salen de las novedades graves abiertas, en un solo bloque', () => {
    const r = resumirVehiculo(base({
      novedades: [
        { gravedad: 'alta', titulo: 'Luces de freno', created_at: '2026-10-01T10:00:00-03:00' },
        { gravedad: 'alta', titulo: 'Frenos', created_at: '2026-10-01T10:00:00-03:00' },
      ],
    }), HOY)
    const msg = mensajeResumenDiario(empresa, [{ patente: 'AD113UY', checklistActivo: true, r }], HOY, 'https://x')!
    expect(msg).toContain('*No aptas para circular*\n• AD113UY (2 novedades graves sin resolver)')
    expect(msg).not.toContain('Novedades graves sin resolver')
  })

  it('un vehículo con el checklist desactivado no aparece por el checklist', () => {
    const r = resumirVehiculo(base({ checklists: [], checklist_activo: false }), HOY)
    expect(mensajeResumenDiario(empresa, [{ patente: 'AD113UY', checklistActivo: false, r }], HOY, 'https://x')).toBeNull()
  })
})
