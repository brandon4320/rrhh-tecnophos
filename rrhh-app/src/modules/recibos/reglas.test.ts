import { describe, it, expect } from 'vitest'
import {
  BLOQUEO_MINUTOS, DIAS_VIGENCIA, INTENTOS_MAX, MENSAJE_BLOQUEADO, MENSAJE_CUIL_INCORRECTO,
  coincideUltimos4, enVentanaDeEnvio, estadoToken, evaluarIntento, rotuloPeriodo, rotuloTipo,
  soloDigitos, vencimientoDesde,
} from './reglas'

const AHORA = new Date('2026-11-03T15:00:00-03:00')
const token = (p: Partial<Parameters<typeof estadoToken>[0]> = {}) => ({
  vence_at: '2026-12-03T15:00:00-03:00',
  revocado: false,
  bloqueado_hasta: null,
  intentos: 0,
  ...p,
})

describe('estadoToken', () => {
  it('un link recién mandado está vigente', () => {
    expect(estadoToken(token(), AHORA)).toBe('vigente')
  })

  it('vencido y revocado dan LO MISMO hacia afuera', () => {
    // Si se distinguieran, se podría averiguar qué tokens existen de verdad.
    expect(estadoToken(token({ vence_at: '2026-11-01T00:00:00-03:00' }), AHORA)).toBe('invalido')
    expect(estadoToken(token({ revocado: true }), AHORA)).toBe('invalido')
  })

  it('el vencimiento es al instante, no al día siguiente', () => {
    expect(estadoToken(token({ vence_at: AHORA.toISOString() }), AHORA)).toBe('invalido')
    expect(estadoToken(token({ vence_at: new Date(AHORA.getTime() + 1000).toISOString() }), AHORA)).toBe('vigente')
  })

  it('un bloqueo que ya pasó no bloquea más', () => {
    expect(estadoToken(token({ bloqueado_hasta: '2026-11-03T14:00:00-03:00' }), AHORA)).toBe('vigente')
    expect(estadoToken(token({ bloqueado_hasta: '2026-11-03T16:00:00-03:00' }), AHORA)).toBe('bloqueado')
  })

  it('un link revocado sigue inválido aunque además esté bloqueado', () => {
    expect(estadoToken(token({ revocado: true, bloqueado_hasta: '2026-11-03T16:00:00-03:00' }), AHORA)).toBe('invalido')
  })
})

describe('coincideUltimos4', () => {
  const CUIL = '20370741736'

  it('acepta los últimos cuatro, con o sin guiones en el medio', () => {
    expect(coincideUltimos4(CUIL, '1736')).toBe(true)
    expect(coincideUltimos4('20-37074173-6', '1736')).toBe(true)
    expect(coincideUltimos4(CUIL, '17 36')).toBe(true)
  })

  it('rechaza lo que no coincide', () => {
    expect(coincideUltimos4(CUIL, '1737')).toBe(false)
    expect(coincideUltimos4(CUIL, '0741')).toBe(false)   // del medio, no del final
  })

  it('rechaza si falta el CUIL o no está completo', () => {
    expect(coincideUltimos4(null, '1736')).toBe(false)
    expect(coincideUltimos4('', '1736')).toBe(false)
    expect(coincideUltimos4('2037074173', '1736')).toBe(false)  // 10 dígitos
  })

  it('exige exactamente cuatro números: ni tres ni el CUIL entero', () => {
    expect(coincideUltimos4(CUIL, '736')).toBe(false)
    expect(coincideUltimos4(CUIL, CUIL)).toBe(false)
    expect(coincideUltimos4(CUIL, '')).toBe(false)
  })
})

describe('soloDigitos', () => {
  it('saca todo lo que no sea número', () => {
    expect(soloDigitos('20-37074173-6')).toBe('20370741736')
    expect(soloDigitos(null)).toBe('')
  })
})

describe('evaluarIntento', () => {
  it('un acierto REINICIA el contador', () => {
    // Si no, quien se equivoca cuatro veces en el mes queda a un error de
    // perder el acceso a su propio recibo.
    expect(evaluarIntento(true, 4, AHORA)).toEqual({ ok: true, intentos: 0, bloqueadoHasta: null, mensaje: null })
  })

  it('cada error suma, sin bloquear todavía', () => {
    const r = evaluarIntento(false, 0, AHORA)
    expect(r.ok).toBe(false)
    expect(r.intentos).toBe(1)
    expect(r.bloqueadoHasta).toBeNull()
    expect(r.mensaje).toBe(MENSAJE_CUIL_INCORRECTO)
  })

  it('al llegar al tope bloquea por una hora', () => {
    const r = evaluarIntento(false, INTENTOS_MAX - 1, AHORA)
    expect(r.intentos).toBe(INTENTOS_MAX)
    expect(r.mensaje).toBe(MENSAJE_BLOQUEADO)
    expect(r.bloqueadoHasta?.getTime()).toBe(AHORA.getTime() + BLOQUEO_MINUTOS * 60_000)
  })

  it('pasado el tope sigue bloqueando (no se escapa por contar de más)', () => {
    expect(evaluarIntento(false, INTENTOS_MAX + 3, AHORA).bloqueadoHasta).not.toBeNull()
  })
})

describe('vencimientoDesde', () => {
  it('son 30 días desde el envío', () => {
    expect(vencimientoDesde(AHORA).getTime() - AHORA.getTime()).toBe(DIAS_VIGENCIA * 24 * 3600 * 1000)
  })
})

describe('enVentanaDeEnvio', () => {
  it('el aviso mensual sale del 2 al 5 inclusive', () => {
    expect([1, 2, 3, 4, 5, 6].map(enVentanaDeEnvio)).toEqual([false, true, true, true, true, false])
  })
  it('ni el último día del mes ni el primero', () => {
    expect(enVentanaDeEnvio(31)).toBe(false)
    expect(enVentanaDeEnvio(1)).toBe(false)
  })
})

describe('rótulos', () => {
  it('traduce el tipo de recibo', () => {
    expect(rotuloTipo('sac')).toBe('Aguinaldo')
    expect(rotuloTipo('mensual')).toBe('Sueldo mensual')
  })
  it('un tipo que todavía no conocemos se muestra tal cual, no vacío', () => {
    // Cuando Ger confirme cómo liquida vacaciones, el rótulo se agrega; mientras
    // tanto la pantalla tiene que mostrar algo.
    expect(rotuloTipo('vacaciones')).toBe('vacaciones')
  })
  it('el período se lee como mes y año, en hora argentina', () => {
    // '2026-10-01' a medianoche UTC es 30/09 a las 21:00 acá: sin el mediodía
    // de por medio, el recibo de octubre diría "Septiembre" (AGENTS.md §9).
    expect(rotuloPeriodo('2026-10-01')).toBe('Octubre 2026')
    expect(rotuloPeriodo('2026-01-01')).toBe('Enero 2026')
  })
})
