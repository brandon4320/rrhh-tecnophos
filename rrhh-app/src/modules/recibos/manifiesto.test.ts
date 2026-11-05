import { describe, it, expect } from 'vitest'
import { LIMITES, leerManifiesto, validarManifiesto, type Manifiesto } from './manifiesto'

const persona = (p: Record<string, unknown> = {}) => ({
  legajo: 83, recibo: '4821', cuil: '20111111117', nombre: 'PEREZ JUAN',
  concepto: 'OCTUBRE 2026', huella: 'h', ...p,
})

const archivo = (p: Record<string, unknown> = {}) => ({
  corrida: '20261001', archivo: 'uno.pdf', sha256: 'a'.repeat(64),
  origen_at: '2026-11-04T12:00:00-03:00', hojas: 1, personas: [persona()], ...p,
})

const cuerpo = (p: Record<string, unknown> = {}) => ({
  base: '1', mes: '202610', archivos: [archivo()], ...p,
})

const valido = (p: Record<string, unknown> = {}): Manifiesto => {
  const r = validarManifiesto(cuerpo(p))
  if (!r.ok) throw new Error(r.error)
  return r.manifiesto
}

describe('validarManifiesto', () => {
  it('acepta un manifiesto bien armado', () => {
    const r = validarManifiesto(cuerpo())
    expect(r.ok).toBe(true)
  })

  it('acepta la carpeta del NAS en vez de la base', () => {
    const r = validarManifiesto(cuerpo({ base: 'ADC_SRL' }))
    expect(r).toMatchObject({ ok: true, manifiesto: { base: '3-ADC' } })
  })

  it('★ una empresa que no conocemos no se adivina', () => {
    expect(validarManifiesto(cuerpo({ base: 'SERVIWHITE' }))).toMatchObject({ ok: false })
    expect(validarManifiesto(cuerpo({ base: '' }))).toMatchObject({ ok: false })
  })

  it('el mes tiene que ser un mes', () => {
    expect(validarManifiesto(cuerpo({ mes: '2026-10' }))).toMatchObject({ ok: false })
    expect(validarManifiesto(cuerpo({ mes: '202613' }))).toMatchObject({ ok: false })
  })

  it('★ una corrida de otro mes se rechaza', () => {
    // Si no, el período que se guardaría no sería el de la carpeta y el recibo
    // de octubre quedaría cargado como de septiembre.
    const r = validarManifiesto(cuerpo({ archivos: [archivo({ corrida: '20260901' })] }))
    expect(r).toMatchObject({ ok: false })
    if (!r.ok) expect(r.error).toContain('202610')
  })

  it('un cuerpo que no es un manifiesto no revienta', () => {
    for (const malo of [null, 'texto', 42, [], {}, { base: '1' }]) {
      expect(validarManifiesto(malo)).toMatchObject({ ok: false })
    }
  })

  it('★ no acepta una lista de archivos sin fin', () => {
    const muchos = Array.from({ length: LIMITES.archivos + 1 }, () => archivo())
    expect(validarManifiesto(cuerpo({ archivos: muchos }))).toMatchObject({ ok: false })
  })

  it('no acepta un archivo con una lista de personas sin fin', () => {
    const muchas = Array.from({ length: LIMITES.personasPorArchivo + 1 }, () => persona())
    expect(validarManifiesto(cuerpo({ archivos: [archivo({ personas: muchas })] }))).toMatchObject({ ok: false })
  })

  it('limpia lo que entra: el CUIL queda en dígitos y el sha en minúscula', () => {
    const m = valido({ archivos: [archivo({ sha256: 'A'.repeat(64), personas: [persona({ cuil: '20-11111111-7' })] })] })
    expect(m.archivos[0].personas[0].cuil).toBe('20111111117')
    expect(m.archivos[0].sha256).toBe('a'.repeat(64))
  })

  it('un sha que no es un sha queda en null, no se inventa', () => {
    const m = valido({ archivos: [archivo({ sha256: 'cualquier cosa' })] })
    expect(m.archivos[0].sha256).toBeNull()
  })

  it('un legajo que no es un número entero positivo queda en null', () => {
    const m = valido({ archivos: [archivo({ personas: [persona({ legajo: 0 })] })] })
    expect(m.archivos[0].personas[0].legajo).toBeNull()
  })

  it('corta los textos largos en vez de guardarlos enteros', () => {
    const m = valido({ archivos: [archivo({ personas: [persona({ nombre: 'A'.repeat(5000) })] })] })
    expect(m.archivos[0].personas[0].nombre!.length).toBe(LIMITES.texto)
  })
})

describe('leerManifiesto', () => {
  it('un archivo con una sola liquidación se usa', () => {
    const r = leerManifiesto(valido())
    expect(r.hojas).toHaveLength(1)
    expect(r.rechazados).toHaveLength(0)
    expect(r.hojas[0]).toMatchObject({ base: '1', periodo: '2026-10-01', legajo: 83, recibo: '4821' })
  })

  it('★ el archivo viene con su corrida adentro, no el nombre pelado', () => {
    // En un mes hay varias corridas y el nombre del archivo individual se
    // repite entre ellas: lleva el legajo y la fecha del período, que son los
    // mismos. Con el nombre solo, dos archivos distintos se pisarían.
    const r = leerManifiesto(valido())
    expect(r.hojas[0].archivo).toBe('20261001/uno.pdf')
  })

  it('★ un archivo con varias personas se RECHAZA, no se parte', () => {
    const m = valido({
      archivos: [archivo({ personas: [persona({ legajo: 83 }), persona({ legajo: 84 })] })],
    })
    const r = leerManifiesto(m)
    expect(r.hojas).toHaveLength(0)
    expect(r.rechazados[0]).toMatchObject({ motivo: 'varias_personas', personas: 2 })
  })

  it('★ y rechazarlo NO deja sin recibo a los demás', () => {
    // Durante la transición al formato nuevo el archivo viejo de lote convive
    // con los individuales: cortar ahí sería dejar sin recibo a gente que lo
    // tiene perfectamente.
    const m = valido({
      archivos: [
        archivo({ archivo: 'lote.pdf', personas: [persona({ legajo: 83 }), persona({ legajo: 84 })] }),
        archivo({ archivo: 'uno.pdf', sha256: 'b'.repeat(64) }),
      ],
    })
    const r = leerManifiesto(m)
    expect(r.hojas).toHaveLength(1)
    expect(r.rechazados).toHaveLength(1)
  })

  it('una persona con dos liquidaciones en el mismo archivo también se rechaza', () => {
    const m = valido({
      archivos: [archivo({ personas: [persona({ recibo: '1' }), persona({ recibo: '2' })] })],
    })
    expect(leerManifiesto(m).rechazados[0]).toMatchObject({ motivo: 'varias_liquidaciones' })
  })

  it('sin legajo, sin número de recibo o sin huella no se usa', () => {
    const casos: [Record<string, unknown>, string][] = [
      [{ personas: [persona({ legajo: null })] }, 'sin_legajo'],
      [{ personas: [persona({ recibo: null })] }, 'sin_numero_de_recibo'],
      [{ sha256: null }, 'sin_huella'],
      [{ personas: [] }, 'sin_datos'],
    ]
    for (const [cambio, motivo] of casos) {
      const r = leerManifiesto(valido({ archivos: [archivo(cambio)] }))
      expect(r.rechazados[0], motivo).toMatchObject({ motivo })
    }
  })

  it('★ la huella es la del TEXTO y el sha es el del ARCHIVO', () => {
    // Son dos cosas distintas a propósito: exportar dos veces el mismo recibo
    // da archivos con bytes distintos (el PDF lleva su fecha de creación
    // adentro) pero con el texto idéntico. Si se compararan los bytes, dos
    // copias del mismo papel se verían como contradictorias y cortarían el
    // lote entero.
    const r = leerManifiesto(valido())
    expect(r.hojas[0].huella).toBe('h')
    expect(r.hojas[0].sha256).toBe('a'.repeat(64))
  })

  it('dos exportaciones del mismo recibo NO se ven como contradictorias', () => {
    const m = valido({
      archivos: [
        archivo({ archivo: 'individual.pdf', sha256: 'a'.repeat(64) }),
        archivo({ archivo: 'reexportado.pdf', sha256: 'b'.repeat(64) }),
      ],
    })
    const huellas = new Set(leerManifiesto(m).hojas.map((h) => h.huella))
    expect(huellas.size).toBe(1)
  })
})
