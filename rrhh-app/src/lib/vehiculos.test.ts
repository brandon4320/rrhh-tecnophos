import { describe, expect, it } from 'vitest'
import { avisoPatenteDuplicada, normalizarPatente } from './vehiculos'

describe('normalizarPatente', () => {
  it('saca espacios, guiones y puntos, y sube a mayúsculas', () => {
    expect(normalizarPatente('ad 113-uy')).toBe('AD113UY')
    expect(normalizarPatente('A.D.113.UY')).toBe('AD113UY')
  })
  it('la misma chapa escrita de dos formas da lo mismo', () => {
    expect(normalizarPatente(' ag493rp ')).toBe(normalizarPatente('AG-493-RP'))
  })
  it('null y vacío dan cadena vacía', () => {
    expect(normalizarPatente(null)).toBe('')
    expect(normalizarPatente('   ')).toBe('')
  })
  it('no toca el "101" de los acoplados', () => {
    // modules/flota/reglas.ts deduce "trailer" de ese prefijo.
    expect(normalizarPatente('101AG048TW')).toBe('101AG048TW')
  })
})

describe('avisoPatenteDuplicada', () => {
  it('sin duplicados no dice nada', () => {
    expect(avisoPatenteDuplicada([])).toBeNull()
  })

  it('nombra la empresa que ya la tiene', () => {
    const m = avisoPatenteDuplicada([{ empresa: 'ADC S.R.L.', activo: true }])
    expect(m).toContain('ADC S.R.L.')
  })

  it('avisa de lo que de verdad importa: el QR y el historial partido', () => {
    const m = avisoPatenteDuplicada([{ empresa: 'ADC S.R.L.', activo: true }])!
    expect(m).toContain('historial')
    expect(m).toContain('QR')
  })

  it('con dos empresas las enumera con "y"', () => {
    const m = avisoPatenteDuplicada([
      { empresa: 'ADC S.R.L.', activo: true },
      { empresa: 'Serviwhite', activo: true },
    ])!
    expect(m).toContain('ADC S.R.L. y Serviwhite')
  })

  it('con tres usa comas y una "y" al final', () => {
    const m = avisoPatenteDuplicada([
      { empresa: 'A', activo: true },
      { empresa: 'B', activo: true },
      { empresa: 'C', activo: true },
    ])!
    expect(m).toContain('A, B y C')
  })

  it('si la otra está dada de baja, el texto es más suave', () => {
    const m = avisoPatenteDuplicada([{ empresa: 'ADC S.R.L.', activo: false }])!
    expect(m).toContain('dada de baja')
    expect(m).not.toContain('QR')
  })

  it('con una activa y una de baja, manda la activa', () => {
    // La de baja no rompe nada; la activa sí parte el historial.
    const m = avisoPatenteDuplicada([
      { empresa: 'Vieja', activo: false },
      { empresa: 'ADC S.R.L.', activo: true },
    ])!
    expect(m).toContain('ADC S.R.L.')
    expect(m).not.toContain('Vieja')
  })
})
