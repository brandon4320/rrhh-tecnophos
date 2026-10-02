import { describe, it, expect } from 'vitest'
import {
  normalizarLugar,
  parseFechaFlexible,
  mesDeFecha,
  mesAnterior,
  claveMes,
  esMesValido,
  evaluarSilencio,
  resumenPorLugar,
  nivelCredito,
  tituloContenedor,
  tituloEvento,
  fusionarContenedor,
  resumirAbiertos,
  diasDesde,
  etiquetaDias,
  totalHastaDia,
  resumirMes,
  mesesEntre,
  diasDelMes,
  parseCursor,
  cursorDe,
  patronBusqueda,
  labelEstadoPublicacion,
  type ContenedorPrevio,
} from './reglas'

describe('normalizarLugar', () => {
  it('reconoce las 4 provincias con variantes', () => {
    expect(normalizarLugar('BUENOS AIRES')).toBe('BUENOS AIRES')
    expect(normalizarLugar('Buenos Aires')).toBe('BUENOS AIRES')
    expect(normalizarLugar('bs as')).toBe('BUENOS AIRES')
    expect(normalizarLugar('B. Aires')).toBe('BUENOS AIRES')
    expect(normalizarLugar('CABA')).toBe('BUENOS AIRES')
    expect(normalizarLugar('Córdoba')).toBe('CORDOBA')
    expect(normalizarLugar('CORDOBA')).toBe('CORDOBA')
    expect(normalizarLugar('Mendoza')).toBe('MENDOZA')
    expect(normalizarLugar('TPR Rosario')).toBe('ROSARIO')
  })
  it('localidades y terminales → provincia (espejo de core.ALIAS_LUGAR)', () => {
    expect(normalizarLugar('Rodríguez Peña')).toBe('MENDOZA')
    expect(normalizarLugar('Zárate')).toBe('BUENOS AIRES')
    expect(normalizarLugar('Terminal 4')).toBe('BUENOS AIRES')
    expect(normalizarLugar('San Lorenzo')).toBe('ROSARIO')
    expect(normalizarLugar('Villa María')).toBe('CORDOBA')
  })
  it('devuelve null si no reconoce nada (no inventa)', () => {
    expect(normalizarLugar('Marte')).toBeNull()
    expect(normalizarLugar('')).toBeNull()
    expect(normalizarLugar(null)).toBeNull()
    expect(normalizarLugar(42)).toBeNull()
  })
})

describe('parseFechaFlexible', () => {
  it('acepta ISO, DD/MM/YYYY y D/M/YYYY', () => {
    expect(parseFechaFlexible('2026-08-28')).toBe('2026-08-28')
    expect(parseFechaFlexible('28/08/2026')).toBe('2026-08-28')
    expect(parseFechaFlexible('3/9/2026')).toBe('2026-09-03')
    expect(parseFechaFlexible('2026-09-03T14:00:00Z')).toBe('2026-09-03')
  })
  it('rechaza basura y fechas imposibles', () => {
    expect(parseFechaFlexible('31/02/2026')).toBeNull()
    expect(parseFechaFlexible('2019-01-01')).toBeNull()
    expect(parseFechaFlexible('hoy')).toBeNull()
    expect(parseFechaFlexible(undefined)).toBeNull()
  })
})

describe('meses', () => {
  it('mesDeFecha espeja excel_store.nombre_tab', () => {
    expect(mesDeFecha('2026-08-28')).toBe('AGOSTO 2026')
    expect(mesDeFecha('2026-01-05')).toBe('ENERO 2026')
  })
  it('mesAnterior cruza el año', () => {
    expect(mesAnterior('SEPTIEMBRE 2026')).toBe('AGOSTO 2026')
    expect(mesAnterior('ENERO 2027')).toBe('DICIEMBRE 2026')
  })
  it('claveMes ordena cronológicamente', () => {
    expect(claveMes('SEPTIEMBRE 2026')).toBeGreaterThan(claveMes('AGOSTO 2026'))
    expect(claveMes('ENERO 2027')).toBeGreaterThan(claveMes('DICIEMBRE 2026'))
  })
  it('esMesValido', () => {
    expect(esMesValido('AGOSTO 2026')).toBe(true)
    expect(esMesValido('agosto 2026')).toBe(false)
    expect(esMesValido('AGOSTO')).toBe(false)
  })
})

describe('evaluarSilencio', () => {
  // 15:00 AR = 18:00Z → umbral diurno (3 h)
  const dia = new Date('2026-09-08T18:00:00Z')
  // 03:00 AR = 06:00Z → umbral nocturno (11 h)
  const noche = new Date('2026-09-08T06:00:00Z')

  it('a las 08:00 AR todavía no alarma por el silencio de la noche (la guardia de las 08 puede demorar)', () => {
    const ultimaGuardia = '2026-09-08T01:00:10Z' // 22:00:10 AR del día anterior
    const ochoYMedio = new Date('2026-09-08T11:00:30Z') // 08:00:30 AR
    expect(evaluarSilencio(ultimaGuardia, ochoYMedio)).toMatchObject({ silencio: false, umbralMin: 660 })
    const ochoTreintaYUno = new Date('2026-09-08T11:31:00Z') // 08:31 AR: ya rige el umbral diurno
    expect(evaluarSilencio(ultimaGuardia, ochoTreintaYUno)).toMatchObject({ silencio: true, umbralMin: 180 })
  })

  it('sin heartbeat es silencio', () => {
    expect(evaluarSilencio(null, dia).silencio).toBe(true)
  })
  it('de día tolera 3 h', () => {
    expect(evaluarSilencio('2026-09-08T16:30:00Z', dia)).toMatchObject({ silencio: false, minutos: 90, umbralMin: 180 })
    expect(evaluarSilencio('2026-09-08T14:00:00Z', dia)).toMatchObject({ silencio: true, minutos: 240 })
  })
  it('de noche tolera 11 h', () => {
    expect(evaluarSilencio('2026-09-07T23:00:00Z', noche)).toMatchObject({ silencio: false, umbralMin: 660 })
    expect(evaluarSilencio('2026-09-07T18:00:00Z', noche).silencio).toBe(true)
  })
})

describe('resumenPorLugar', () => {
  it('cuenta por provincia y excluye descartados', () => {
    const r = resumenPorLugar([
      { lugar: 'BUENOS AIRES', estado: 'encontrado' },
      { lugar: 'BUENOS AIRES', estado: 'pendiente_arcor' },
      { lugar: 'CORDOBA', estado: 'revisar_foto' },
      { lugar: 'CORDOBA', estado: 'descartado' },
    ])
    expect(r.find((x) => x.lugar === 'BUENOS AIRES')).toMatchObject({ total: 2, pendientes: 1, revisar: 0 })
    expect(r.find((x) => x.lugar === 'CORDOBA')).toMatchObject({ total: 1, revisar: 1 })
    expect(r.find((x) => x.lugar === 'MENDOZA')).toMatchObject({ total: 0 })
  })
})

describe('nivelCredito', () => {
  it('umbrales del WF10', () => {
    expect(nivelCredito(10)).toBe('info')
    expect(nivelCredito(70)).toBe('warning')
    expect(nivelCredito(95)).toBe('critical')
    expect(nivelCredito(null)).toBe('info')
  })
})

describe('títulos de contenedor', () => {
  it('usa el nombre legible del lugar (Buenos Aires, Córdoba)', () => {
    expect(tituloContenedor({ contenedor: 'MRSU1', lugar: 'BUENOS AIRES', estado: 'pendiente_arcor', publicado: false }))
      .toBe('MRSU1 · Buenos Aires · pendiente ARCOR')
    expect(tituloContenedor({ contenedor: 'MRSU1', lugar: 'CORDOBA', estado: 'encontrado', publicado: true }))
      .toBe('MRSU1 · Córdoba · cargado y publicado')
    expect(tituloContenedor({ contenedor: 'X1', lugar: 'ROSARIO', estado: 'revisar_foto', publicado: false }))
      .toBe('Lectura dudosa · Rosario · X1')
  })
  it('tituloEvento rearma los eventos viejos del ingest y deja el resto como vino', () => {
    const viejo = {
      tipo: 'contenedor_pendiente',
      titulo: 'MRSU1 · Buenos aires · pendiente ARCOR',
      detalle: { contenedor: 'MRSU1', lugar: 'BUENOS AIRES', accion: 'creado', publicado: false },
    }
    expect(tituloEvento(viejo)).toBe('MRSU1 · Buenos Aires · pendiente ARCOR')
    // Sin `accion` no lo generó el ingest de contenedores: no se toca.
    expect(tituloEvento({ tipo: 'lectura_dudosa', titulo: 'Otra cosa', detalle: { contenedor: 'X', lugar: 'CORDOBA' } })).toBe('Otra cosa')
    expect(tituloEvento({ tipo: 'conciliacion', titulo: 'Conciliación', detalle: null })).toBe('Conciliación')
  })
})

describe('fusionarContenedor', () => {
  const prev: ContenedorPrevio = {
    estado: 'pendiente_arcor', fecha: '2026-09-30', lugar: 'CORDOBA', publicado: false,
    booking: 'B1', oe: null, hash_imagen: 'h1', observaciones: 'obs',
  }
  const igual = { estado: 'pendiente_arcor' as const, fecha: '2026-09-30', lugar: 'CORDOBA', publicado: false, booking: 'B1', oe: null, hash_imagen: 'h1', observaciones: 'obs' }

  it('un re-envío idéntico no cambia nada (sin evento)', () => {
    expect(fusionarContenedor(prev, igual)).toMatchObject({ degrada: false, cambia: false })
  })
  it('un re-envío con MENOS datos tampoco cambia y conserva lo que se sabía', () => {
    const r = fusionarContenedor(prev, { ...igual, booking: null, hash_imagen: null, observaciones: null })
    expect(r.cambia).toBe(false)
    expect(r.datos).toMatchObject({ booking: 'B1', hash_imagen: 'h1', observaciones: 'obs' })
  })
  it('cambio de estado, publicado, OE o lugar sí es un cambio', () => {
    expect(fusionarContenedor(prev, { ...igual, estado: 'encontrado' }).cambia).toBe(true)
    expect(fusionarContenedor(prev, { ...igual, publicado: true }).cambia).toBe(true)
    expect(fusionarContenedor(prev, { ...igual, oe: 'OE9' }).cambia).toBe(true)
    expect(fusionarContenedor(prev, { ...igual, lugar: 'ROSARIO' }).cambia).toBe(true)
  })
  it('publicado nunca vuelve a false', () => {
    const r = fusionarContenedor({ ...prev, publicado: true }, { ...igual, publicado: false })
    expect(r.datos.publicado).toBe(true)
    expect(r.cambia).toBe(false)
  })
  it('un encontrado no se degrada (y no cuenta como cambio)', () => {
    const r = fusionarContenedor({ ...prev, estado: 'encontrado' }, { ...igual, estado: 'descartado', oe: 'OE9' })
    expect(r).toMatchObject({ degrada: true, cambia: false })
    expect(r.datos.oe).toBe('OE9') // los datos sueltos sí se fusionan
  })
})

describe('colas abiertas', () => {
  it('cuenta pendientes y dudosas de todos los meses, el arrastre y el más viejo', () => {
    const r = resumirAbiertos([
      { estado: 'pendiente_arcor', fecha: '2026-09-05', mes: 'SEPTIEMBRE 2026' },
      { estado: 'pendiente_arcor', fecha: '2026-09-30', mes: 'SEPTIEMBRE 2026' },
      { estado: 'pendiente_arcor', fecha: '2026-10-02', mes: 'OCTUBRE 2026' },
      { estado: 'revisar_foto', fecha: '2026-10-01', mes: 'OCTUBRE 2026' },
    ], 'OCTUBRE 2026')
    expect(r.pendiente_arcor).toEqual({ total: 3, delMes: 1, anteriores: 2, masViejo: '2026-09-05' })
    expect(r.revisar_foto).toEqual({ total: 1, delMes: 1, anteriores: 0, masViejo: '2026-10-01' })
  })
  it('sin filas: todo en cero', () => {
    expect(resumirAbiertos([], 'OCTUBRE 2026').pendiente_arcor).toEqual({ total: 0, delMes: 0, anteriores: 0, masViejo: null })
  })
})

describe('días de espera', () => {
  it('diasDesde cuenta días de calendario, cruzando meses', () => {
    expect(diasDesde('2026-10-02', '2026-10-02')).toBe(0)
    expect(diasDesde('2026-09-28', '2026-10-02')).toBe(4)
    expect(diasDesde('2026-12-31', '2027-01-01')).toBe(1)
  })
  it('etiquetaDias', () => {
    expect(etiquetaDias(0)).toBe('hoy')
    expect(etiquetaDias(-1)).toBe('hoy')
    expect(etiquetaDias(1)).toBe('1 día')
    expect(etiquetaDias(5)).toBe('5 días')
  })
})

describe('resumen del mes y comparación', () => {
  it('resumirMes excluye descartados del total', () => {
    const r = resumirMes('OCTUBRE 2026', [
      { lugar: 'CORDOBA', estado: 'encontrado', publicado: true },
      { lugar: 'CORDOBA', estado: 'pendiente_arcor', publicado: false },
      { lugar: 'ROSARIO', estado: 'descartado', publicado: false },
    ])
    expect(r).toMatchObject({ total: 2, encontrados: 1, pendientes: 1, revisar: 0, publicados: 1 })
  })
  it('totalHastaDia compara el mes anterior hasta el mismo día', () => {
    const sept = [
      { estado: 'encontrado', fecha: '2026-09-01' },
      { estado: 'encontrado', fecha: '2026-09-02' },
      { estado: 'descartado', fecha: '2026-09-02' },
      { estado: 'encontrado', fecha: '2026-09-03' },
      { estado: 'encontrado', fecha: '2026-09-30' },
    ]
    expect(totalHastaDia(sept, 2)).toBe(2)
    expect(totalHastaDia(sept, 31)).toBe(4)
  })
  it('diasDelMes', () => {
    expect(diasDelMes('SEPTIEMBRE 2026')).toBe(30)
    expect(diasDelMes('FEBRERO 2028')).toBe(29)
    expect(diasDelMes('ENERO 2027')).toBe(31)
  })
})

describe('mesesEntre', () => {
  it('lista del más reciente al más viejo, cruzando el año', () => {
    expect(mesesEntre('AGOSTO 2026', 'OCTUBRE 2026')).toEqual(['OCTUBRE 2026', 'SEPTIEMBRE 2026', 'AGOSTO 2026'])
    expect(mesesEntre('DICIEMBRE 2026', 'FEBRERO 2027')).toEqual(['FEBRERO 2027', 'ENERO 2027', 'DICIEMBRE 2026'])
  })
  it('si el más viejo es posterior a hoy, devuelve al menos el mes en curso', () => {
    expect(mesesEntre('NOVIEMBRE 2026', 'OCTUBRE 2026')).toEqual(['OCTUBRE 2026'])
  })
})

describe('cursor de actividad', () => {
  const ts = '2026-10-02T18:16:52.239+00:00'
  const id = '6f1c2a34-5b6d-4e7f-8a9b-0c1d2e3f4a5b'
  it('ida y vuelta con id', () => {
    expect(parseCursor(cursorDe({ ts, id }))).toEqual({ ts, id })
  })
  it('acepta solo ts (con o sin microsegundos, Z u offset)', () => {
    expect(parseCursor(ts)).toEqual({ ts, id: null })
    expect(parseCursor('2026-10-02T18:16:52.239123Z')).toEqual({ ts: '2026-10-02T18:16:52.239123Z', id: null })
  })
  it('rechaza lo que podría colarse en el filtro or=(...)', () => {
    expect(parseCursor('2026-10-02T18:16:52 00:00')).toBeNull() // un + que llegó como espacio
    expect(parseCursor(`${ts},no-es-uuid`)).toBeNull()
    expect(parseCursor(`${ts},${id},extra`)).toBeNull()
    expect(parseCursor('2026-10-02),id.gt.(0')).toBeNull()
    expect(parseCursor(undefined)).toBeNull()
  })
})

describe('patronBusqueda', () => {
  it('arma un ilike con comodines y espacios como comodín', () => {
    expect(patronBusqueda('MRSU939')).toBe('*MRSU939*')
    expect(patronBusqueda(' mrsu 939 ')).toBe('*mrsu*939*')
    expect(patronBusqueda('AR-152304')).toBe('*AR-152304*')
  })
  it('saca lo que rompe la sintaxis de PostgREST y devuelve null si no queda nada', () => {
    expect(patronBusqueda('a,b.c(d)')).toBe('*a*b*c*d*')
    expect(patronBusqueda('*%')).toBeNull()
    expect(patronBusqueda('')).toBeNull()
    expect(patronBusqueda(undefined)).toBeNull()
  })
})

describe('labelEstadoPublicacion', () => {
  it('sin_tarea → Sin tarea', () => {
    expect(labelEstadoPublicacion('sin_tarea')).toBe('Sin tarea')
    expect(labelEstadoPublicacion(null)).toBe('—')
  })
})
