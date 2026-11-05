import { describe, it, expect } from 'vitest'
import {
  agruparPorEmpleado, armarDocumentos, baseDeCarpeta, faltantes, mismaPersona, nombreCompleto,
  periodoDeCarpeta, resolverDestino, revisarLote, tipoDeConcepto, topeNombresDistintos,
  type DocumentoLeido, type EmpleadoPadron, type Hoja,
} from './lote'

// Datos inventados a propósito: estos tests no llevan gente real.
const emp = (p: Partial<EmpleadoPadron> & { id: string }): EmpleadoPadron => ({
  nombre: 'JUAN', apellido: 'PEREZ', cuil: '20111111117', email: 'juan@example.com',
  base_sueldos: '1', legajo: 10, ...p,
})

const hoja = (p: Partial<Hoja> = {}): Hoja => ({
  archivo: 'liquidacion.pdf', pagina: 1, base: '1', periodo: '2026-10-01',
  legajo: 10, recibo: '5001', huella: 'aaa', ...p,
})

const doc = (p: Partial<DocumentoLeido> = {}): DocumentoLeido => ({
  hojas: [hoja()], base: '1', periodo: '2026-10-01', legajo: 10, ...p,
})

describe('baseDeCarpeta', () => {
  it('reconoce las dos carpetas del NAS', () => {
    expect(baseDeCarpeta('TECNOPHOS_SERVICES_SA')).toBe('1')
    expect(baseDeCarpeta('ADC_SRL')).toBe('3-ADC')
  })

  it('una carpeta que no conocemos NO se adivina', () => {
    expect(baseDeCarpeta('SERVIWHITE_SA')).toBeNull()
    expect(baseDeCarpeta('')).toBeNull()
    expect(baseDeCarpeta(null)).toBeNull()
  })
})

describe('periodoDeCarpeta', () => {
  it('lee el mes de la carpeta de liquidación', () => {
    expect(periodoDeCarpeta('20261001')).toBe('2026-10-01')
    expect(periodoDeCarpeta('20260801')).toBe('2026-08-01')
  })

  it('★ el número del final es el orden de la corrida, no el día', () => {
    // En agosto hubo 20260801, 20260802 y 20260803: tres corridas del MISMO mes.
    // La general no siempre es la 01 (en agosto la 01 tuvo 3 personas y la 02, 51).
    expect(periodoDeCarpeta('20260802')).toBe('2026-08-01')
    expect(periodoDeCarpeta('20260803')).toBe('2026-08-01')
  })

  it('una carpeta con otra forma no se interpreta', () => {
    expect(periodoDeCarpeta('2026-10')).toBeNull()
    expect(periodoDeCarpeta('20261301')).toBeNull()   // mes 13
    expect(periodoDeCarpeta('')).toBeNull()
  })
})

describe('tipoDeConcepto', () => {
  it('reconoce los textos que trae el recibo de verdad', () => {
    expect(tipoDeConcepto('OCTUBRE 2026')).toBe('mensual')
    expect(tipoDeConcepto('LIQ FINAL AGOSTO 2026')).toBe('liquidacion_final')
    expect(tipoDeConcepto('AJUSTE AGOSTO')).toBe('otro')
  })

  it('el aguinaldo no se confunde con el mes', () => {
    expect(tipoDeConcepto('SAC JUNIO 2026')).toBe('sac')
    expect(tipoDeConcepto('AGUINALDO 2026')).toBe('sac')
  })

  it('una liquidación final de un mes no cae en mensual', () => {
    // El orden importa: "LIQ FINAL AGOSTO" también contiene un nombre de mes.
    expect(tipoDeConcepto('LIQUIDACION FINAL DICIEMBRE 2026')).toBe('liquidacion_final')
    expect(tipoDeConcepto('LIQ FINAL SEPTIEMBRE')).toBe('liquidacion_final')
  })

  it('★ un mes mal escrito o abreviado sigue siendo un sueldo mensual', () => {
    // Textos REALES de los recibos del NAS: el concepto lo escribe una persona.
    expect(tipoDeConcepto('SEPTIMEBRE 2026')).toBe('mensual')
    expect(tipoDeConcepto('nov')).toBe('mensual')
  })

  it('aguanta acentos y minúsculas', () => {
    expect(tipoDeConcepto('ajuste setiembre')).toBe('otro')
  })

  it('lo que no se entiende cae en "otro", nunca se descarta', () => {
    expect(tipoDeConcepto('ALGO QUE NO VIMOS NUNCA')).toBe('otro')
    expect(tipoDeConcepto(null)).toBe('otro')
  })
})

describe('armarDocumentos', () => {
  it('★ el mismo recibo en dos archivos es UNA liquidación, no dos', () => {
    // Es lo que pasa de verdad: en octubre cada recibo de Tecnophos estaba en
    // su archivo individual Y adentro de un archivo por lotes.
    const docs = armarDocumentos([
      hoja({ archivo: 'individual.pdf', pagina: 1 }),
      hoja({ archivo: 'lote.pdf', pagina: 12 }),
    ])
    expect(docs).toHaveLength(1)
    expect(docs[0].hojas).toHaveLength(2)
    expect(docs[0].copiasDistintas).toBeFalsy()
  })

  it('dos recibos distintos de la misma persona son dos liquidaciones', () => {
    const docs = armarDocumentos([hoja({ recibo: '5001' }), hoja({ recibo: '5002' })])
    expect(docs).toHaveLength(2)
  })

  it('★ el mismo legajo en otra base NO se junta', () => {
    const docs = armarDocumentos([
      hoja({ base: '1', legajo: 1, recibo: '7' }),
      hoja({ base: '3-ADC', legajo: 1, recibo: '7' }),
    ])
    expect(docs).toHaveLength(2)
  })

  it('★ copias con texto distinto quedan marcadas', () => {
    const docs = armarDocumentos([hoja({ huella: 'aaa' }), hoja({ huella: 'bbb' })])
    expect(docs).toHaveLength(1)
    expect(docs[0].copiasDistintas).toBe(true)
  })

  it('una hoja sin legajo o sin recibo queda sola: sin clave no se agrupa', () => {
    // Juntarlas por "parecido" sería mezclar gente.
    const docs = armarDocumentos([
      hoja({ legajo: null }), hoja({ legajo: null }), hoja({ recibo: null }), hoja({ recibo: '  ' }),
    ])
    expect(docs).toHaveLength(4)
  })

  it('sin hojas no hay documentos', () => {
    expect(armarDocumentos([])).toEqual([])
  })
})

describe('resolverDestino', () => {
  it('encuentra a la persona por base + legajo', () => {
    expect(resolverDestino(doc(), [emp({ id: 'a' })])).toEqual({
      ok: true, empleado: expect.objectContaining({ id: 'a' }),
    })
  })

  it('★ el MISMO legajo en otra base es OTRA persona', () => {
    const padron = [
      emp({ id: 'tecno', base_sueldos: '1', legajo: 1, apellido: 'GOMEZ', nombre: 'ANA' }),
      emp({ id: 'adc', base_sueldos: '3-ADC', legajo: 1, apellido: 'LOPEZ', nombre: 'RAUL' }),
    ]
    expect(resolverDestino(doc({ base: '1', legajo: 1 }), padron)).toMatchObject({ empleado: { id: 'tecno' } })
    expect(resolverDestino(doc({ base: '3-ADC', legajo: 1 }), padron)).toMatchObject({ empleado: { id: 'adc' } })
  })

  it('★ un documento con hojas de dos personas NO se manda', () => {
    // La filtración que todo esto trata de evitar: en octubre ADC entera venía
    // en un solo archivo de 44 hojas.
    const r = resolverDestino(doc({ legajo: 10, legajosEnLasHojas: [10, 11] }), [emp({ id: 'a' })])
    expect(r).toMatchObject({ motivo: 'varias_personas' })
  })

  it('el mismo recibo repetido en dos archivos está bien: es una copia', () => {
    const r = resolverDestino(
      doc({ hojas: [hoja(), hoja({ archivo: 'lote.pdf', pagina: 7 })], legajosEnLasHojas: [10] }),
      [emp({ id: 'a' })]
    )
    expect(r).toMatchObject({ ok: true })
  })

  it('★ dos copias del mismo recibo que dicen cosas distintas no se mandan', () => {
    expect(resolverDestino(doc({ copiasDistintas: true }), [emp({ id: 'a' })]))
      .toMatchObject({ motivo: 'copias_distintas' })
  })

  it('un documento sin hojas no se manda', () => {
    expect(resolverDestino(doc({ hojas: [] }), [emp({ id: 'a' })])).toMatchObject({ motivo: 'sin_hojas' })
  })

  it('una carpeta que no conocemos no se adivina', () => {
    expect(resolverDestino(doc({ base: '9' }), [emp({ id: 'a' })])).toMatchObject({ motivo: 'base_desconocida' })
  })

  it('sin legajo leído no se asigna a nadie', () => {
    expect(resolverDestino(doc({ legajo: null }), [emp({ id: 'a' })])).toMatchObject({ motivo: 'sin_legajo' })
  })

  it('un legajo que no existe no cae en el más parecido', () => {
    expect(resolverDestino(doc({ legajo: 99 }), [emp({ id: 'a' })])).toMatchObject({ motivo: 'legajo_desconocido' })
  })

  it('si hubiera dos con el mismo legajo, corta en vez de elegir', () => {
    expect(resolverDestino(doc(), [emp({ id: 'a' }), emp({ id: 'b' })])).toMatchObject({ motivo: 'ambiguo' })
  })

  it('★ el CUIL del recibo manda sobre el legajo', () => {
    const r = resolverDestino(doc({ cuil: '27222222224' }), [emp({ id: 'a', cuil: '20111111117' })])
    expect(r).toMatchObject({ motivo: 'cuil_no_coincide', empleado: { id: 'a' } })
  })

  it('el CUIL coincide aunque venga con guiones', () => {
    expect(resolverDestino(doc({ cuil: '20-11111111-7' }), [emp({ id: 'a' })])).toMatchObject({ ok: true })
  })

  it('un CUIL incompleto en el recibo no se usa para rechazar', () => {
    expect(resolverDestino(doc({ cuil: '2011' }), [emp({ id: 'a' })])).toMatchObject({ ok: true })
  })

  it('★ dos hermanos del mismo apellido no se confunden', () => {
    // Sin CUIL en el recibo, el nombre es la única verificación que queda.
    const r = resolverDestino(
      doc({ nombre: 'GARCIA JONATAN ANDRES' }),
      [emp({ id: 'a', apellido: 'GARCIA', nombre: 'JOSE ORLANDO' })]
    )
    expect(r).toMatchObject({ motivo: 'nombre_no_coincide' })
  })

  it('★★ con el CUIL correcto, un nombre escrito distinto NO frena el recibo', () => {
    // Apareció corriendo octubre de verdad: el CUIL coincidía y el nombre
    // estaba escrito distinto —una letra cambiada y un segundo nombre que
    // figura en Gestión y no en el recibo— y esa persona quedaba sin su
    // recibo a cambio de nada. Se anota y sigue.
    const r = resolverDestino(
      doc({ cuil: '20111111117', nombre: 'GUTIERRES JUAN' }),
      [emp({ id: 'a', cuil: '20111111117', apellido: 'GUTIERREZ', nombre: 'JUAN FEDERICO' })]
    )
    expect(r).toEqual({ ok: true, empleado: expect.objectContaining({ id: 'a' }), nombreDistinto: true })
  })

  it('★★ pero con el CUIL de OTRO el nombre no lo salva', () => {
    const r = resolverDestino(
      doc({ cuil: '27222222224', nombre: 'PEREZ JUAN' }),
      [emp({ id: 'a', cuil: '20111111117' })]
    )
    expect(r).toMatchObject({ motivo: 'cuil_no_coincide' })
  })

  it('el nombre coincide aunque esté en otro orden o con acentos', () => {
    const padron = [emp({ id: 'a', apellido: 'PÉREZ', nombre: 'JUAN CARLOS' })]
    expect(resolverDestino(doc({ nombre: 'JUAN CARLOS PEREZ' }), padron)).toMatchObject({ ok: true })
    expect(resolverDestino(doc({ nombre: 'PEREZ, JUAN' }), padron)).toMatchObject({ ok: true })
  })

  it('★ alguien dado de baja SÍ recibe su liquidación final', () => {
    expect(resolverDestino(doc({ concepto: 'LIQ FINAL AGOSTO 2026' }), [emp({ id: 'a' })]))
      .toMatchObject({ ok: true })
  })

  it('sin CUIL cargado no se le puede pedir que confirme quién es', () => {
    expect(resolverDestino(doc(), [emp({ id: 'a', cuil: null })])).toMatchObject({ motivo: 'empleado_sin_cuil' })
  })

  it('★ sin CUIL en Gestión el motivo es "falta el dato", NO "el CUIL no coincide"', () => {
    // Comparar un CUIL leído contra uno vacío siempre da distinto, y
    // "cuil_no_coincide" frena el lote entero. Que a alguien le falte el CUIL
    // cargado no puede dejar a las otras 92 personas sin su recibo.
    expect(resolverDestino(doc({ cuil: '20111111117' }), [emp({ id: 'a', cuil: null })]))
      .toMatchObject({ motivo: 'empleado_sin_cuil' })
  })

  it('sin mail no hay a dónde mandarlo', () => {
    expect(resolverDestino(doc(), [emp({ id: 'a', email: null })])).toMatchObject({ motivo: 'empleado_sin_mail' })
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

  it('la Ñ no rompe la comparación', () => {
    // El recibo trae "MUÑOZ" y Gestión puede tenerlo escrito igual o sin tilde.
    expect(mismaPersona('MUÑOZ FRANCO', 'MUNOZ FRANCO')).toBe(true)
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
    const r = revisarLote([doc({ legajo: 1 }), doc({ legajo: 2 })], padron)
    expect(r.asignados).toHaveLength(2)
    expect(r.problemas).toHaveLength(0)
    expect(r.puedeEnviar).toBe(true)
  })

  it('★ un documento ilegible NO deja sin recibo a los demás', () => {
    const r = revisarLote([doc({ legajo: 1 }), doc({ legajo: null }), doc({ legajo: 2 })], padron)
    expect(r.asignados).toHaveLength(2)
    expect(r.problemas).toHaveLength(1)
    expect(r.puedeEnviar).toBe(true)
  })

  it('★ un CUIL que no coincide frena el lote ENTERO', () => {
    const r = revisarLote([doc({ legajo: 1 }), doc({ legajo: 2, cuil: '27999999994' })], padron)
    expect(r.puedeEnviar).toBe(false)
    expect(r.motivoCorte).toContain('CUIL')
  })

  it('★ un documento mal cortado frena el lote ENTERO', () => {
    // Si el corte por hojas falló una vez, no hay razón para confiar en el resto.
    const r = revisarLote([doc({ legajo: 1 }), doc({ legajo: 2, legajosEnLasHojas: [2, 3] })], padron)
    expect(r.puedeEnviar).toBe(false)
    expect(r.motivoCorte).toContain('más de una persona')
  })

  it('muchos nombres distintos frenan el lote (carpetas mezcladas)', () => {
    const malos = [1, 2, 3].map((l) => doc({ legajo: l, nombre: 'OTRO APELLIDO' }))
    const r = revisarLote(malos, padron)
    expect(r.puedeEnviar).toBe(false)
    expect(r.motivoCorte).toContain('mezclado')
  })

  it('un nombre distinto suelto no frena el lote, pero ese recibo no se manda', () => {
    const r = revisarLote([doc({ legajo: 1 }), doc({ legajo: 2, nombre: 'OTRO APELLIDO' })], padron)
    expect(r.puedeEnviar).toBe(true)
    expect(r.asignados).toHaveLength(1)
    expect(r.problemas[0]).toMatchObject({ motivo: 'nombre_no_coincide' })
  })

  it('★ una persona sin CUIL cargado no frena el lote', () => {
    const conHueco = [...padron, emp({ id: 'd', legajo: 4, cuil: null })]
    const r = revisarLote([doc({ legajo: 1 }), doc({ legajo: 4, cuil: '20111111117' })], conHueco)
    expect(r.puedeEnviar).toBe(true)
    expect(r.asignados).toHaveLength(1)
    expect(r.problemas[0]).toMatchObject({ motivo: 'empleado_sin_cuil' })
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
      { documento: doc({ concepto: 'OCTUBRE 2026' }), empleado: e },
      { documento: doc({ concepto: 'AJUSTE OCTUBRE' }), empleado: e },
      { documento: doc({ concepto: 'LIQ FINAL OCTUBRE 2026' }), empleado: e },
    ])
    expect(grupos).toHaveLength(1)
    expect(grupos[0].documentos.map((d) => tipoDeConcepto(d.concepto)))
      .toEqual(['mensual', 'otro', 'liquidacion_final'])
  })

  it('cada persona en su grupo', () => {
    const grupos = agruparPorEmpleado([
      { documento: doc(), empleado: emp({ id: 'a' }) },
      { documento: doc(), empleado: emp({ id: 'b' }) },
    ])
    expect(grupos.map((g) => g.empleado.id)).toEqual(['a', 'b'])
  })
})

describe('faltantes', () => {
  it('★ avisa quién se quedó sin recibo aunque no haya habido ningún error', () => {
    // Un archivo que nunca se exportó no da error: hay que contarlo contra la
    // nómina esperada o pasa en silencio.
    const padron = [emp({ id: 'a', legajo: 1 }), emp({ id: 'b', legajo: 2 }), emp({ id: 'c', legajo: 3 })]
    const sinFaltar = faltantes(padron, [{ documento: doc({ legajo: 1 }), empleado: padron[0] }])
    expect(sinFaltar.map((e) => e.id)).toEqual(['b', 'c'])
  })

  it('con todos cubiertos no falta nadie', () => {
    const padron = [emp({ id: 'a' })]
    expect(faltantes(padron, [{ documento: doc(), empleado: padron[0] }])).toEqual([])
  })
})
