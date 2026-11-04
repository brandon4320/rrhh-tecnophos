import { describe, it, expect } from 'vitest'
import { decidirCarga, tipoDeMail, type ReciboExistente } from './carga'

const rec = (p: Partial<ReciboExistente> & { id: string }): ReciboExistente => ({
  origen_hash: 'hash-viejo', recibo_numero: '4821', estado: 'pendiente', ...p,
})

describe('decidirCarga', () => {
  it('un PDF que no está se carga', () => {
    expect(decidirCarga({ hash: 'h1', reciboNumero: '4821' }, [])).toEqual({ accion: 'nueva' })
  })

  it('★ el MISMO PDF no se carga dos veces ni molesta a nadie', () => {
    // Es lo que hace que volver a correr el proceso sea inofensivo.
    const r = decidirCarga({ hash: 'h1', reciboNumero: '4821' }, [rec({ id: 'a', origen_hash: 'h1' })])
    expect(r).toEqual({ accion: 'ya_estaba', id: 'a' })
  })

  it('el hash manda aunque el número de recibo no coincida', () => {
    const r = decidirCarga({ hash: 'h1', reciboNumero: '9999' }, [rec({ id: 'a', origen_hash: 'h1' })])
    expect(r).toMatchObject({ accion: 'ya_estaba' })
  })

  it('★ mismo número de recibo y contenido distinto es una CORRECCIÓN', () => {
    const r = decidirCarga({ hash: 'h2', reciboNumero: '4821' }, [rec({ id: 'a' })])
    expect(r).toEqual({ accion: 'correccion', anula: ['a'], habiaFirma: false })
  })

  it('★ si la vieja ya estaba firmada, queda avisado', () => {
    // El mail no puede decir "firmá esto": tiene que decir que lo que ya
    // firmó cambió.
    const r = decidirCarga({ hash: 'h2', reciboNumero: '4821' },
      [rec({ id: 'a', estado: 'firmado' })])
    expect(r).toMatchObject({ accion: 'correccion', habiaFirma: true })
  })

  it('una corrección de una corrección no revive la anulada', () => {
    const r = decidirCarga({ hash: 'h3', reciboNumero: '4821' }, [
      rec({ id: 'vieja', estado: 'anulado' }),
      rec({ id: 'actual', origen_hash: 'h2' }),
    ])
    expect(r).toEqual({ accion: 'correccion', anula: ['actual'], habiaFirma: false })
  })

  it('otro número de recibo es otra liquidación, no una corrección', () => {
    // Dos liquidaciones del mismo mes: la persona firma las dos.
    const r = decidirCarga({ hash: 'h2', reciboNumero: '4822' }, [rec({ id: 'a' })])
    expect(r).toEqual({ accion: 'nueva' })
  })

  it('★ no pisa un comprobante cargado a mano desde el legajo', () => {
    // Los que sube la oficina no tienen número de recibo: anularlos sería
    // dar de baja algo que nadie dijo que estuviera mal.
    const r = decidirCarga({ hash: 'h2', reciboNumero: '4821' },
      [rec({ id: 'manual', recibo_numero: null, origen_hash: null })])
    expect(r).toEqual({ accion: 'nueva' })
  })

  it('sin número de recibo del lado que entra tampoco se anula nada', () => {
    expect(decidirCarga({ hash: 'h2', reciboNumero: null }, [rec({ id: 'a' })]))
      .toEqual({ accion: 'nueva' })
    expect(decidirCarga({ hash: 'h2', reciboNumero: '   ' }, [rec({ id: 'a' })]))
      .toEqual({ accion: 'nueva' })
  })

  it('si por error hubiera dos vigentes con el mismo número, se anulan las dos', () => {
    const r = decidirCarga({ hash: 'h3', reciboNumero: '4821' },
      [rec({ id: 'a' }), rec({ id: 'b', origen_hash: 'h2' })])
    expect(r).toMatchObject({ accion: 'correccion', anula: ['a', 'b'] })
  })

  it('sin hash no se puede reconocer que ya estaba', () => {
    // Pasa a tratarse por número de recibo, que es lo correcto.
    expect(decidirCarga({ hash: null, reciboNumero: '4821' }, [rec({ id: 'a' })]))
      .toMatchObject({ accion: 'correccion' })
  })
})

describe('tipoDeMail', () => {
  it('dentro de la ventana del 2 al 5 es el aviso normal', () => {
    expect(tipoDeMail(false, true)).toBe('aviso')
  })

  it('fuera de la ventana es un aviso aparte, no el del mes', () => {
    expect(tipoDeMail(false, false)).toBe('adicional')
  })

  it('★ una corrección se avisa como corrección, esté donde esté el calendario', () => {
    expect(tipoDeMail(true, true)).toBe('correccion')
    expect(tipoDeMail(true, false)).toBe('correccion')
  })
})
