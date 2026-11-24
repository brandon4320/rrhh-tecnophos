import { describe, expect, it } from 'vitest'
import { puedeRecibir, resumen, type Candidato } from './onboarding-servidor'

function candidato(p: Partial<Candidato> = {}): Candidato {
  return {
    id: 'e1',
    nombre: 'ANA',
    apellido: 'PEREZ',
    empresa: 'Tecnophos',
    empresaSlug: 'tecnophos-bb',
    email: 'ana@example.com',
    tieneCuil: true,
    tieneFirma: false,
    enviadoAt: null,
    error: null,
    ...p,
  }
}

describe('puedeRecibir', () => {
  it('con mail y CUIL, y sin haberle mandado, sí', () => {
    expect(puedeRecibir(candidato())).toBe(true)
  })

  it('sin mail, no: no hay a dónde mandarlo', () => {
    expect(puedeRecibir(candidato({ email: null }))).toBe(false)
  })

  it('sin CUIL, no: le llegaría un link que no puede abrir', () => {
    // La puerta de /firma/<token> pide los últimos 4 del CUIL y sin CUIL
    // cargado no hay con qué compararlos.
    expect(puedeRecibir(candidato({ tieneCuil: false }))).toBe(false)
  })

  it('si ya se le mandó, no se repite', () => {
    expect(puedeRecibir(candidato({ enviadoAt: '2026-11-24T12:00:00Z' }))).toBe(false)
  })

  it('un intento fallido no lo saca de la lista: se puede reintentar', () => {
    expect(puedeRecibir(candidato({ error: 'Invalid recipient' }))).toBe(true)
  })

  it('tener la firma cargada no lo excluye por sí solo', () => {
    // Puede haber firmado desde otro link; lo que corta es `enviadoAt`.
    expect(puedeRecibir(candidato({ tieneFirma: true }))).toBe(true)
  })
})

describe('resumen', () => {
  const lista: Candidato[] = [
    candidato({ id: '1' }),                                              // listo
    candidato({ id: '2', enviadoAt: '2026-11-24T12:00:00Z' }),           // enviado
    candidato({ id: '3', enviadoAt: '2026-11-24T12:00:00Z', tieneFirma: true }), // enviado + firmó
    candidato({ id: '4', email: null }),                                 // sin datos
    candidato({ id: '5', tieneCuil: false }),                            // sin datos
    candidato({ id: '6', error: 'rebotó' }),                             // listo, con error previo
  ]

  it('cuenta cada cosa por separado', () => {
    expect(resumen(lista)).toEqual({
      total: 6,
      listos: 2,
      enviados: 2,
      firmaron: 1,
      sinDatos: 2,
      conError: 1,
    })
  })

  it('una lista vacía da todo en cero y no rompe', () => {
    expect(resumen([])).toEqual({ total: 0, listos: 0, enviados: 0, firmaron: 0, sinDatos: 0, conError: 0 })
  })

  it('a quien ya se le mandó no se lo cuenta como "sin datos" aunque le falte algo', () => {
    // Si se le mandó cuando tenía mail y después se lo borraron, lo que
    // importa es que ya lo recibió: no es un pendiente de completar.
    const r = resumen([candidato({ email: null, enviadoAt: '2026-11-24T12:00:00Z' })])
    expect(r.sinDatos).toBe(0)
    expect(r.enviados).toBe(1)
  })
})
