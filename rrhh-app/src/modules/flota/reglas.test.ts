import { describe, it, expect } from 'vitest'
import { diaClaveAR } from '@/lib/fechas-ar'
import {
  ITEMS_CHECKLIST, calcularResultado, novedadesDelChecklist, itemsSinResponder, fotosFaltantes,
  evaluarKm, kmPorDia, estadoChecklist, proximoMantenimiento, normalizarTelefono,
  sumarDias, sumarMeses, diasEntre,
} from './reglas'

const todoBien = () => Object.fromEntries(ITEMS_CHECKLIST.map((i) => [i.id, 'ok']))

describe('resultado del checklist', () => {
  it('todo bien = en orden', () => {
    expect(calcularResultado(todoBien())).toBe('ok')
  })
  it('una observación = con observaciones', () => {
    expect(calcularResultado({ ...todoBien(), bocina: 'obs' })).toBe('observaciones')
  })
  it('"Mal" en un ítem no crítico = con observaciones, no lo deja parado', () => {
    expect(calcularResultado({ ...todoBien(), cabina_limpia: 'no_ok' })).toBe('observaciones')
  })
  it('"Mal" en un ítem crítico = no apta', () => {
    expect(calcularResultado({ ...todoBien(), luces_freno: 'no_ok' })).toBe('no_apto')
    expect(calcularResultado({ ...todoBien(), productos_fuera_cabina: 'no_ok' })).toBe('no_apto')
  })
  it('detecta lo que falta responder', () => {
    const r = todoBien()
    delete r.matafuegos
    expect(itemsSinResponder(r)).toEqual(['matafuegos'])
  })
})

describe('novedades del checklist', () => {
  it('cada "Mal" abre una novedad; las observaciones no', () => {
    const n = novedadesDelChecklist(
      { ...todoBien(), luces_freno: 'no_ok', cabina_limpia: 'no_ok', bocina: 'obs' },
      { luces_freno: '  la izquierda no enciende ' }
    )
    expect(n.map((x) => x.item)).toEqual(['luces_freno', 'cabina_limpia'])
    expect(n[0]).toMatchObject({ gravedad: 'alta', descripcion: 'la izquierda no enciende' })
    expect(n[1].gravedad).toBe('media')
  })
})

describe('fotos', () => {
  it('pide las 4 laterales, las 4 ruedas y el tablero; el auxilio y la caja son opcionales', () => {
    expect(fotosFaltantes({}).map((f) => f.slot)).toEqual([
      'tablero', 'frente', 'trasera', 'lateral_izq', 'lateral_der',
      'cubierta_di', 'cubierta_dd', 'cubierta_ti', 'cubierta_td',
    ])
  })
})

describe('kilómetros', () => {
  const hoy = diaClaveAR(new Date())
  const hace15 = sumarDias(hoy, -15) + 'T12:00:00-03:00'

  it('el primer registro siempre es válido', () => {
    expect(evaluarKm(85_000, { km: null, fecha: null }).inconsistente).toBe(false)
  })
  it('un odómetro no retrocede', () => {
    expect(evaluarKm(84_000, { km: 85_000, fecha: hace15 })).toMatchObject({ inconsistente: true })
  })
  it('un recorrido normal en 15 días pasa', () => {
    expect(evaluarKm(88_500, { km: 85_000, fecha: hace15 }).inconsistente).toBe(false)
  })
  it('un dígito de más se marca', () => {
    expect(evaluarKm(850_000, { km: 85_000, fecha: hace15 }).inconsistente).toBe(true)
  })

  it('km por día con al menos una semana de historia', () => {
    expect(kmPorDia([
      { fecha: '2026-09-01', km: 80_000 },
      { fecha: '2026-09-16', km: 83_000 },
      { fecha: '2026-10-01', km: 86_000 },
    ], '2026-10-02')).toBe(200)
  })
  it('sin historia suficiente no proyecta', () => {
    expect(kmPorDia([{ fecha: '2026-09-29', km: 80_000 }, { fecha: '2026-10-01', km: 80_400 }], '2026-10-02')).toBeNull()
    expect(kmPorDia([{ fecha: '2026-10-01', km: 80_000 }], '2026-10-02')).toBeNull()
  })
})

describe('estado del checklist', () => {
  it('nunca hecho', () => {
    expect(estadoChecklist(null, 15, '2026-10-02').estado).toBe('nunca')
  })
  it('al día, por vencer y vencido', () => {
    expect(estadoChecklist('2026-09-25T10:00:00-03:00', 15, '2026-10-02')).toMatchObject({ estado: 'al_dia', venceEn: 8 })
    expect(estadoChecklist('2026-09-18T10:00:00-03:00', 15, '2026-10-02')).toMatchObject({ estado: 'vence_pronto', venceEn: 1 })
    expect(estadoChecklist('2026-09-10T10:00:00-03:00', 15, '2026-10-02')).toMatchObject({ estado: 'vencido', venceEn: -7 })
  })
  it('a las 22:00 de Argentina el día del checklist no se corre al siguiente', () => {
    // 22:00 AR del 17/09 = 01:00 UTC del 18/09
    expect(estadoChecklist('2026-09-18T01:00:00Z', 15, '2026-10-02').diasDesde).toBe(15)
  })
})

describe('próximo service', () => {
  const plan = { cada_km: 10_000, cada_meses: 12 }

  it('sin un service cargado no inventa una fecha', () => {
    expect(proximoMantenimiento(plan, null, 90_000, 200, '2026-10-02').estado).toBe('sin_dato')
  })
  it('lejos: ok, con fecha proyectada al ritmo actual', () => {
    const p = proximoMantenimiento(plan, { fecha: '2026-08-01', km: 82_000 }, 86_000, 200, '2026-10-02')
    expect(p).toMatchObject({ estado: 'ok', kmObjetivo: 92_000, kmRestantes: 6_000 })
    expect(p.fechaEstimada).toBe(sumarDias('2026-10-02', 30))
  })
  it('a menos de 1.000 km avisa', () => {
    expect(proximoMantenimiento(plan, { fecha: '2026-08-01', km: 82_000 }, 91_400, 50, '2026-10-02').estado).toBe('proximo')
  })
  it('a menos de 3 semanas por ritmo de uso avisa aunque falten más de 1.000 km', () => {
    expect(proximoMantenimiento(plan, { fecha: '2026-08-01', km: 82_000 }, 89_000, 200, '2026-10-02').estado).toBe('proximo')
  })
  it('pasado de km: vencido', () => {
    expect(proximoMantenimiento(plan, { fecha: '2026-08-01', km: 82_000 }, 92_300, 200, '2026-10-02')).toMatchObject({ estado: 'vencido', kmRestantes: -300 })
  })
  it('vencido por tiempo aunque casi no se use', () => {
    expect(proximoMantenimiento(plan, { fecha: '2025-09-15', km: 80_000 }, 81_000, 5, '2026-10-02').estado).toBe('vencido')
  })
})

describe('teléfonos', () => {
  it('normaliza lo que la gente escribe a 549 + número', () => {
    expect(normalizarTelefono('0291 15 412-3456')).toBe('5492914123456')
    expect(normalizarTelefono('+54 9 291 4123456')).toBe('5492914123456')
    expect(normalizarTelefono('2914123456')).toBe('5492914123456')
    expect(normalizarTelefono('011 15 5555-1234')).toBe('5491155551234')
  })
  it('rechaza lo que no es un celular', () => {
    expect(normalizarTelefono('123')).toBeNull()
    expect(normalizarTelefono('')).toBeNull()
  })
})

describe('fechas', () => {
  it('suma meses respetando el fin de mes', () => {
    expect(sumarMeses('2026-01-31', 1)).toBe('2026-02-28')
    expect(sumarMeses('2026-08-15', 12)).toBe('2027-08-15')
  })
  it('días entre fechas', () => {
    expect(diasEntre('2026-09-30', '2026-10-02')).toBe(2)
  })
})
