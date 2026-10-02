import { describe, it, expect } from 'vitest'
import { diaClaveAR } from '@/lib/fechas-ar'
import {
  FOTOS_CHECKLIST, ITEMS_CHECKLIST, calcularResultado, novedadesDelChecklist, itemsSinResponder, fotosFaltantes,
  evaluarKm, kmPorDia, estadoChecklist, periodoChecklist, proximoMantenimiento, normalizarTelefono,
  sumarDias, sumarMeses, diasEntre, novedadesNuevas, kmPideConfirmacion, ultimoDiaDelMes,
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
  it('un ítem que ya tiene una novedad abierta no abre otra', () => {
    const n = novedadesDelChecklist({ ...todoBien(), luces_freno: 'no_ok', bocina: 'no_ok' })
    expect(novedadesNuevas(n, ['luces_freno', 'km_inconsistente']).map((x) => x.item)).toEqual(['bocina'])
    expect(novedadesNuevas(n, [])).toHaveLength(2)
  })
})

describe('fotos', () => {
  it('los lados se nombran por el conductor, no por izquierda/derecha', () => {
    const labels = FOTOS_CHECKLIST.map((f) => f.label.toLowerCase()).join(' ')
    expect(labels).not.toMatch(/izquierd|derech/)
    expect(FOTOS_CHECKLIST.find((f) => f.slot === 'cubierta_di')?.label).toMatch(/lado del conductor/)
    expect(FOTOS_CHECKLIST.find((f) => f.slot === 'lateral_der')?.label).toMatch(/lado del acompañante/)
  })
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
  it('la primera lectura altísima se confirma; con historial, no hace falta', () => {
    expect(kmPideConfirmacion(850_000, null)).toBe(true)
    expect(kmPideConfirmacion(500_000, null)).toBe(false)
    expect(kmPideConfirmacion(85_000, null)).toBe(false)
    expect(kmPideConfirmacion(850_000, 845_000)).toBe(false)
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

describe('período del checklist', () => {
  it('quincenas: del 1 al 14 y del 15 a fin de mes', () => {
    expect(periodoChecklist('2026-10-01', 15)).toEqual({ desde: '2026-10-01', hasta: '2026-10-14', mensual: false })
    expect(periodoChecklist('2026-10-14', 15)).toMatchObject({ desde: '2026-10-01', hasta: '2026-10-14' })
    expect(periodoChecklist('2026-10-15', 15)).toMatchObject({ desde: '2026-10-15', hasta: '2026-10-31' })
    expect(periodoChecklist('2026-10-31', 15)).toMatchObject({ desde: '2026-10-15', hasta: '2026-10-31' })
    expect(periodoChecklist('2026-04-30', 15)).toMatchObject({ desde: '2026-04-15', hasta: '2026-04-30' })
  })
  it('febrero termina el 28, o el 29 en año bisiesto', () => {
    expect(periodoChecklist('2026-02-20', 15)).toMatchObject({ desde: '2026-02-15', hasta: '2026-02-28' })
    expect(periodoChecklist('2028-02-29', 15)).toMatchObject({ desde: '2028-02-15', hasta: '2028-02-29' })
  })
  it('con 28 días o más el período es el mes calendario', () => {
    expect(periodoChecklist('2026-02-20', 30)).toEqual({ desde: '2026-02-01', hasta: '2026-02-28', mensual: true })
    expect(periodoChecklist('2026-10-15', 28)).toMatchObject({ desde: '2026-10-01', hasta: '2026-10-31', mensual: true })
    expect(periodoChecklist('2026-10-15', 27).mensual).toBe(false)
  })
})

describe('estado del checklist (por período de calendario)', () => {
  const chk = (dia: string) => `${dia}T10:00:00-03:00`

  it('nunca hecho', () => {
    expect(estadoChecklist(null, 15, '2026-10-02')).toMatchObject({ estado: 'nunca', diasDesde: null, limite: '2026-10-03', venceEn: 1 })
  })
  it('hecho en la quincena: al día hasta que empieza la siguiente', () => {
    expect(estadoChecklist(chk('2026-10-01'), 15, '2026-10-02')).toMatchObject({ estado: 'al_dia', diasDesde: 1, proximo: '2026-10-15', venceEn: 13 })
    expect(estadoChecklist(chk('2026-10-01'), 15, '2026-10-14')).toMatchObject({ estado: 'al_dia', venceEn: 1 })
  })
  it('hecho tarde, igual cubre su quincena', () => {
    expect(estadoChecklist(chk('2026-10-12'), 15, '2026-10-14').estado).toBe('al_dia')
  })
  it('el 1 y el 15 arranca un período nuevo con 3 días para hacerlo', () => {
    expect(estadoChecklist(chk('2026-09-20'), 15, '2026-10-01')).toMatchObject({ estado: 'vence_pronto', limite: '2026-10-03', venceEn: 2 })
    expect(estadoChecklist(chk('2026-09-20'), 15, '2026-10-02')).toMatchObject({ estado: 'vence_pronto', venceEn: 1 })
    expect(estadoChecklist(chk('2026-09-20'), 15, '2026-10-03')).toMatchObject({ estado: 'vence_pronto', venceEn: 0 })
    expect(estadoChecklist(chk('2026-10-05'), 15, '2026-10-15')).toMatchObject({ estado: 'vence_pronto', limite: '2026-10-17', venceEn: 2 })
  })
  it('pasada la gracia, vencido', () => {
    expect(estadoChecklist(chk('2026-09-20'), 15, '2026-10-04')).toMatchObject({ estado: 'vencido', venceEn: -1 })
    expect(estadoChecklist(chk('2026-10-05'), 15, '2026-10-18')).toMatchObject({ estado: 'vencido', venceEn: -1 })
  })
  it('el 31 sigue al día con el checklist del 15; el 1 ya toca otro', () => {
    expect(estadoChecklist(chk('2026-10-16'), 15, '2026-10-31')).toMatchObject({ estado: 'al_dia', proximo: '2026-11-01', venceEn: 1 })
    expect(estadoChecklist(chk('2026-10-16'), 15, '2026-11-01')).toMatchObject({ estado: 'vence_pronto', limite: '2026-11-03' })
  })
  it('fin de febrero', () => {
    expect(estadoChecklist(chk('2026-02-20'), 15, '2026-02-28').estado).toBe('al_dia')
    expect(estadoChecklist(chk('2026-02-20'), 15, '2026-03-01')).toMatchObject({ estado: 'vence_pronto', venceEn: 2 })
    expect(estadoChecklist(chk('2026-02-03'), 15, '2026-03-01')).toMatchObject({ estado: 'vencido', limite: '2026-02-17', venceEn: -12 })
  })
  it('si se salteó una quincena entera, está vencido aunque la nueva esté en gracia', () => {
    expect(estadoChecklist(chk('2026-08-20'), 15, '2026-10-02')).toMatchObject({ estado: 'vencido', limite: '2026-09-03', venceEn: -29 })
  })
  it('mensual: un checklist por mes, con la misma gracia', () => {
    expect(estadoChecklist(chk('2026-10-01'), 30, '2026-10-20')).toMatchObject({ estado: 'al_dia', proximo: '2026-11-01' })
    expect(estadoChecklist(chk('2026-10-01'), 30, '2026-10-31')).toMatchObject({ estado: 'al_dia', venceEn: 1 })
    expect(estadoChecklist(chk('2026-09-25'), 30, '2026-10-02')).toMatchObject({ estado: 'vence_pronto', venceEn: 1 })
    expect(estadoChecklist(chk('2026-09-25'), 30, '2026-10-04')).toMatchObject({ estado: 'vencido', venceEn: -1 })
    expect(estadoChecklist(chk('2026-08-25'), 30, '2026-10-02')).toMatchObject({ estado: 'vencido', limite: '2026-09-03' })
  })
  it('los días se cuentan en hora de Argentina', () => {
    // 23:00 AR del 30/09 = 02:00 UTC del 01/10: es de la quincena anterior.
    expect(estadoChecklist('2026-10-01T02:00:00Z', 15, '2026-10-01').estado).toBe('vence_pronto')
    // 22:00 AR del 14/10 = 01:00 UTC del 15/10: cubre la quincena del 1 al 14.
    expect(estadoChecklist('2026-10-15T01:00:00Z', 15, '2026-10-14').estado).toBe('al_dia')
    expect(estadoChecklist('2026-10-15T01:00:00Z', 15, '2026-10-15').estado).toBe('vence_pronto')
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
  it('sin km para comparar ni intervalo por tiempo: sin dato, no "al día"', () => {
    const soloKm = { cada_km: 10_000, cada_meses: null }
    expect(proximoMantenimiento(soloKm, { fecha: '2026-08-01', km: null }, 86_000, 200, '2026-10-02')).toMatchObject({ estado: 'sin_dato', kmObjetivo: null })
    expect(proximoMantenimiento(soloKm, { fecha: '2026-08-01', km: 82_000 }, null, null, '2026-10-02')).toMatchObject({ estado: 'sin_dato', kmObjetivo: 92_000 })
  })
  it('sin km actual pero con intervalo por tiempo, calcula por fecha', () => {
    expect(proximoMantenimiento(plan, { fecha: '2026-08-01', km: 82_000 }, null, null, '2026-10-02')).toMatchObject({ estado: 'ok', fechaEstimada: '2027-08-01' })
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
  it('último día del mes', () => {
    expect(ultimoDiaDelMes('2026-02-10')).toBe(28)
    expect(ultimoDiaDelMes('2028-02-10')).toBe(29)
    expect(ultimoDiaDelMes('2026-10-01')).toBe(31)
    expect(ultimoDiaDelMes('2026-04-30')).toBe(30)
  })
})
