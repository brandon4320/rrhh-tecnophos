import { describe, expect, it } from 'vitest'
import { curvaSemanal, kmPorSemana, porSemana } from './curvas'

describe('curvaSemanal', () => {
  it('reparte por semana desde hoy y descarta lo vencido o lo lejano', () => {
    expect(curvaSemanal([0, 6, 7, 13, 62, 63, -1], 9)).toEqual([2, 2, 0, 0, 0, 0, 0, 0, 1])
  })
})

describe('porSemana', () => {
  it('cuenta en la semana que corresponde, la última es la que corre', () => {
    expect(porSemana(['2026-11-18', '2026-11-12', '2026-11-11', '2026-01-01'], '2026-11-18', 2)).toEqual([1, 2])
  })
})

describe('kmPorSemana', () => {
  it('reparte los km entre lecturas parejo por día e ignora las inconsistentes', () => {
    const v = { checklists: [
      { created_at: '2026-11-04T15:00:00Z', km: 1000, km_inconsistente: false },
      { created_at: '2026-11-18T15:00:00Z', km: 2400, km_inconsistente: false },
      { created_at: '2026-11-10T15:00:00Z', km: 99999, km_inconsistente: true },
    ] }
    expect(kmPorSemana([v], '2026-11-18', 2)).toEqual([700, 700])
  })
})
