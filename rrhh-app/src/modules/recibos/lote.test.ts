import { describe, it, expect } from 'vitest'
import {
  agruparPorEmpleado, mismaPersona, nombreCompleto, resolverDestino, revisarLote,
  topeNombresDistintos, type EmpleadoPadron, type PdfLeido,
} from './lote'

// Datos inventados a propósito: estos tests no llevan gente real.
const emp = (p: Partial<EmpleadoPadron> & { id: string }): EmpleadoPadron => ({
  nombre: 'JUAN', apellido: 'PEREZ', cuil: '20111111117', email: 'juan@example.com',
  base_sueldos: '1', legajo: 10, ...p,
})

const pdf = (p: Partial<PdfLeido> = {}): PdfLeido => ({
  archivo: 'recibo.pdf', base: '1', legajo: 10, ...p,
})

describe('resolverDestino', () => {
  it('encuentra a la persona por base + legajo', () => {
    const r = resolverDestino(pdf(), [emp({ id: 'a' })])
    expect(r).toEqual({ ok: true, empleado: expect.objectContaining({ id: 'a' }) })
  })

  it('★ el MISMO legajo en otra base es OTRA persona', () => {
    // Es el error que arruina todo: en Jaque el legajo 1 de ADC y el legajo 1
    // de Tecnophos no tienen nada que ver.
    const padron = [
      emp({ id: 'tecno', base_sueldos: '1', legajo: 1, apellido: 'GOMEZ', nombre: 'ANA' }),
      emp({ id: 'adc', base_sueldos: '3-ADC', legajo: 1, apellido: 'LOPEZ', nombre: 'RAUL' }),
    ]
    expect(resolverDestino(pdf({ base: '1', legajo: 1 }), padron)).toMatchObject({ empleado: { id: 'tecno' } })
    expect(resolverDestino(pdf({ base: '3-ADC', legajo: 1 }), padron)).toMatchObject({ empleado: { id: 'adc' } })
  })

  it('una misma persona puede tener dos legajos distintos, uno por base', () => {
    const padron = [
      emp({ id: 'en-tecno', base_sueldos: '1', legajo: 2 }),
      emp({ id: 'en-adc', base_sueldos: '3-ADC', legajo: 1 }),
    ]
    expect(resolverDestino(pdf({ base: '3-ADC', legajo: 1 }), padron)).toMatchObject({ empleado: { id: 'en-adc' } })
  })

  it('una carpeta que no conocemos no se adivina', () => {
    expect(resolverDestino(pdf({ base: '9' }), [emp({ id: 'a' })])).toMatchObject({ motivo: 'base_desconocida' })
  })

  it('sin legajo leído no se asigna a nadie', () => {
    expect(resolverDestino(pdf({ legajo: null }), [emp({ id: 'a' })])).toMatchObject({ motivo: 'sin_legajo' })
  })

  it('un legajo que no existe no cae en el más parecido', () => {
    expect(resolverDestino(pdf({ legajo: 99 }), [emp({ id: 'a' })])).toMatchObject({ motivo: 'legajo_desconocido' })
  })

  it('si hubiera dos con el mismo legajo, corta en vez de elegir', () => {
    const r = resolverDestino(pdf(), [emp({ id: 'a' }), emp({ id: 'b' })])
    expect(r).toMatchObject({ motivo: 'ambiguo' })
  })

  it('★ el CUIL del PDF manda sobre el legajo', () => {
    const r = resolverDestino(pdf({ cuil: '27222222224' }), [emp({ id: 'a', cuil: '20111111117' })])
    expect(r).toMatchObject({ motivo: 'cuil_no_coincide', empleado: { id: 'a' } })
  })

  it('el CUIL coincide aunque venga con guiones', () => {
    expect(resolverDestino(pdf({ cuil: '20-11111111-7' }), [emp({ id: 'a' })])).toMatchObject({ ok: true })
  })

  it('un CUIL incompleto en el PDF no se usa para rechazar', () => {
    // Si el lector solo pudo sacar un pedazo, no es prueba de nada.
    expect(resolverDestino(pdf({ cuil: '2011' }), [emp({ id: 'a' })])).toMatchObject({ ok: true })
  })

  it('★ dos hermanos del mismo apellido no se confunden', () => {
    const r = resolverDestino(
      pdf({ nombre: 'GARCIA JONATAN ANDRES' }),
      [emp({ id: 'a', apellido: 'GARCIA', nombre: 'JOSE ORLANDO' })]
    )
    expect(r).toMatchObject({ motivo: 'nombre_no_coincide' })
  })

  it('el nombre coincide aunque esté en otro orden o con acentos', () => {
    const padron = [emp({ id: 'a', apellido: 'PÉREZ', nombre: 'JUAN CARLOS' })]
    expect(resolverDestino(pdf({ nombre: 'JUAN CARLOS PEREZ' }), padron)).toMatchObject({ ok: true })
    expect(resolverDestino(pdf({ nombre: 'PEREZ, JUAN' }), padron)).toMatchObject({ ok: true })
  })

  it('★ alguien dado de baja SÍ recibe su liquidación final', () => {
    // El caso más delicado: se fue de la empresa y igual tiene que firmar.
    expect(resolverDestino(pdf(), [emp({ id: 'a' })])).toMatchObject({ ok: true })
  })

  it('sin CUIL cargado no se le puede pedir que confirme quién es', () => {
    expect(resolverDestino(pdf(), [emp({ id: 'a', cuil: null })])).toMatchObject({ motivo: 'empleado_sin_cuil' })
  })

  it('sin mail no hay a dónde mandarlo', () => {
    expect(resolverDestino(pdf(), [emp({ id: 'a', email: null })])).toMatchObject({ motivo: 'empleado_sin_mail' })
  })
})

describe('mismaPersona', () => {
  it('pide dos palabras en común, no una', () => {
    expect(mismaPersona('GARCIA JOSE', 'GARCIA JONATAN')).toBe(false)
    expect(mismaPersona('GARCIA JOSE', 'JOSE GARCIA')).toBe(true)
  })

  it('ignora "de" y "la", que no distinguen a nadie', () => {
    expect(mismaPersona('DE LA CRUZ MARIA', 'CRUZ MARIA')).toBe(true)
  })

  it('con un solo nombre alcanza una coincidencia', () => {
    expect(mismaPersona('MADONNA', 'MADONNA')).toBe(true)
    expect(mismaPersona('MADONNA', 'CHER')).toBe(false)
  })

  it('vacío nunca es "la misma persona"', () => {
    expect(mismaPersona('', 'GARCIA JOSE')).toBe(false)
    expect(mismaPersona(null, null)).toBe(false)
  })

  it('no se deja engañar por la misma palabra repetida', () => {
    // "LOPEZ LOPEZ" contra "LOPEZ ANA" comparte una sola palabra distinta.
    expect(mismaPersona('LOPEZ LOPEZ', 'LOPEZ ANA')).toBe(false)
  })
})

describe('nombreCompleto', () => {
  it('arma apellido + nombre como lo imprime la liquidación', () => {
    expect(nombreCompleto({ apellido: 'PEREZ', nombre: 'JUAN' })).toBe('PEREZ JUAN')
    expect(nombreCompleto({ apellido: null, nombre: 'JUAN' })).toBe('JUAN')
  })
})

describe('revisarLote', () => {
  const padron = [
    emp({ id: 'a', legajo: 1, apellido: 'UNO', nombre: 'ANA' }),
    emp({ id: 'b', legajo: 2, apellido: 'DOS', nombre: 'BETO' }),
    emp({ id: 'c', legajo: 3, apellido: 'TRES', nombre: 'CARLA' }),
  ]

  it('lote limpio: todos asignados y se puede mandar', () => {
    const r = revisarLote([pdf({ legajo: 1 }), pdf({ legajo: 2 })], padron)
    expect(r.asignados).toHaveLength(2)
    expect(r.problemas).toHaveLength(0)
    expect(r.puedeEnviar).toBe(true)
  })

  it('★ un archivo ilegible NO deja sin recibo a los demás', () => {
    const r = revisarLote([pdf({ legajo: 1 }), pdf({ legajo: null }), pdf({ legajo: 2 })], padron)
    expect(r.asignados).toHaveLength(2)
    expect(r.problemas).toHaveLength(1)
    expect(r.puedeEnviar).toBe(true)
  })

  it('★ un CUIL que no coincide frena el lote ENTERO', () => {
    // No es "este archivo está raro": es señal de que la asignación está mal y
    // los que sí resolvieron también son sospechosos.
    const r = revisarLote([pdf({ legajo: 1 }), pdf({ legajo: 2, cuil: '27999999994' })], padron)
    expect(r.puedeEnviar).toBe(false)
    expect(r.motivoCorte).toContain('CUIL')
  })

  it('muchos nombres distintos frenan el lote (carpetas mezcladas)', () => {
    const malos = [1, 2, 3].map((l) => pdf({ legajo: l, nombre: 'OTRO APELLIDO' }))
    const r = revisarLote(malos, padron)
    expect(r.puedeEnviar).toBe(false)
    expect(r.motivoCorte).toContain('mezclado')
  })

  it('un nombre distinto suelto no frena el lote, pero ese PDF no se manda', () => {
    const r = revisarLote([pdf({ legajo: 1 }), pdf({ legajo: 2, nombre: 'OTRO APELLIDO' })], padron)
    expect(r.puedeEnviar).toBe(true)
    expect(r.asignados).toHaveLength(1)
    expect(r.problemas[0]).toMatchObject({ motivo: 'nombre_no_coincide' })
  })

  it('un lote vacío no es un error, simplemente no hay nada que mandar', () => {
    const r = revisarLote([], padron)
    expect(r.puedeEnviar).toBe(true)
    expect(r.asignados).toHaveLength(0)
  })
})

describe('topeNombresDistintos', () => {
  it('en lotes chicos tolera 3; en grandes, el 10%', () => {
    expect(topeNombresDistintos(0)).toBe(3)
    expect(topeNombresDistintos(10)).toBe(3)
    expect(topeNombresDistintos(93)).toBe(10)
  })
})

describe('agruparPorEmpleado', () => {
  it('★ tres liquidaciones de un legajo son UN mail con tres documentos', () => {
    const e = emp({ id: 'a', legajo: 1 })
    const grupos = agruparPorEmpleado([
      { pdf: pdf({ archivo: 'sueldo.pdf' }), empleado: e },
      { pdf: pdf({ archivo: 'premio.pdf' }), empleado: e },
      { pdf: pdf({ archivo: 'final.pdf' }), empleado: e },
    ])
    expect(grupos).toHaveLength(1)
    expect(grupos[0].pdfs.map((p) => p.archivo)).toEqual(['sueldo.pdf', 'premio.pdf', 'final.pdf'])
  })

  it('cada persona en su grupo', () => {
    const grupos = agruparPorEmpleado([
      { pdf: pdf(), empleado: emp({ id: 'a' }) },
      { pdf: pdf(), empleado: emp({ id: 'b' }) },
    ])
    expect(grupos.map((g) => g.empleado.id)).toEqual(['a', 'b'])
  })
})
