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

  it('★★ el PDF VIEJO no puede pisar a la corrección por llegar después', () => {
    // Cuando se corrige una liquidación, en la carpeta quedan las dos. El
    // proceso lee las dos en la misma corrida: sin fecha ganaría la última en
    // leerse y la persona podría terminar firmando la versión vieja.
    const yaCargada = rec({ id: 'corregida', origen_hash: 'nuevo', origen_at: '2026-11-20T10:00:00Z' })
    const llegaLaVieja = { hash: 'viejo', reciboNumero: '4821', origenAt: '2026-11-05T08:00:00Z' }
    expect(decidirCarga(llegaLaVieja, [yaCargada])).toEqual({ accion: 'superada', porId: 'corregida' })
  })

  it('★★ y al revés, la corrección sí pisa a la vieja', () => {
    const yaCargada = rec({ id: 'vieja', origen_hash: 'viejo', origen_at: '2026-11-05T08:00:00Z' })
    const llegaLaNueva = { hash: 'nuevo', reciboNumero: '4821', origenAt: '2026-11-20T10:00:00Z' }
    expect(decidirCarga(llegaLaNueva, [yaCargada]))
      .toMatchObject({ accion: 'correccion', anula: ['vieja'] })
  })

  it('con la misma fecha exacta no se da por superada', () => {
    // Empate: no hay con qué decidir, así que se trata como corrección y
    // queda a la vista en el informe.
    const yaCargada = rec({ id: 'a', origen_at: '2026-11-20T10:00:00Z' })
    const entra = { hash: 'h2', reciboNumero: '4821', origenAt: '2026-11-20T10:00:00Z' }
    expect(decidirCarga(entra, [yaCargada])).toMatchObject({ accion: 'correccion' })
  })

  it('una fecha ilegible no frena nada: se trata como corrección', () => {
    const yaCargada = rec({ id: 'a', origen_at: 'cualquier cosa' })
    const entra = { hash: 'h2', reciboNumero: '4821', origenAt: '2026-11-20T10:00:00Z' }
    expect(decidirCarga(entra, [yaCargada])).toMatchObject({ accion: 'correccion' })
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
