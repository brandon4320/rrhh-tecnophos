import { describe, it, expect } from 'vitest'
import {
  carpetaEmpresa, esPdf, nombreDeRecibo, rutaDeRecibo, siguienteSecuencia,
  leerAprobacion, loteCortado,
} from './archivo'

describe('carpetaEmpresa', () => {
  it('usa el slug de la empresa', () => {
    expect(carpetaEmpresa('tecnophos-bb')).toBe('tecnophos-bb')
  })

  it('★ un slug reservado no se usa como carpeta', () => {
    // /api/archivo elige la tabla dueña por el prefijo del path: un recibo
    // bajo recibos/documentos/… se buscaría en documentos_mensuales.
    for (const s of ['recibos', 'documentos', 'docs', 'flota']) {
      expect(carpetaEmpresa(s), s).toBe('docs')
    }
  })

  it('lo que no es un slug no se mete en la ruta', () => {
    for (const s of ['', null, undefined, '../otro', 'CON MAYÚSCULAS Y ESPACIOS', '-empieza-mal']) {
      expect(carpetaEmpresa(s)).toBe('docs')
    }
  })
})

describe('rutaDeRecibo', () => {
  const hash = 'a'.repeat(64)

  it('arma la clave bajo recibos/<empresa>/<empleado>/', () => {
    expect(rutaDeRecibo('adc', 'emp-1', '2026-10-01', 'mensual', hash))
      .toBe(`recibos/adc/emp-1/2026-10-01-mensual-${'a'.repeat(16)}.pdf`)
  })

  it('★ el mismo PDF cae siempre en el mismo lugar', () => {
    // Si llevara la hora, cada reintento dejaría una copia huérfana en R2.
    const a = rutaDeRecibo('adc', 'emp-1', '2026-10-01', 'mensual', hash)
    const b = rutaDeRecibo('adc', 'emp-1', '2026-10-01', 'mensual', hash)
    expect(a).toBe(b)
  })

  it('dos liquidaciones distintas del mismo mes no se pisan', () => {
    const a = rutaDeRecibo('adc', 'emp-1', '2026-10-01', 'mensual', 'a'.repeat(64))
    const b = rutaDeRecibo('adc', 'emp-1', '2026-10-01', 'mensual', 'b'.repeat(64))
    expect(a).not.toBe(b)
  })

  it('★ nada de lo que entra puede salirse de la carpeta', () => {
    const r = rutaDeRecibo('../../otro', 'emp-1', '2026-10-01', '../etc', 'no es un hash')
    expect(r).toBe('recibos/docs/emp-1/2026-10-01-etc-sinhash.pdf')
    expect(r).not.toContain('..')
  })

  it('un período con hora adentro no ensucia la clave', () => {
    expect(rutaDeRecibo('adc', 'emp-1', '2026-10-01T00:00:00Z', 'sac', hash))
      .toContain('/2026-10-01-sac-')
  })
})

describe('nombreDeRecibo', () => {
  it('se entiende sin abrirlo', () => {
    expect(nombreDeRecibo('mensual', '2026-10-01', '4821'))
      .toBe('Sueldo mensual - Octubre 2026 - recibo 4821.pdf')
  })

  it('sin número de recibo no deja el rótulo colgado', () => {
    expect(nombreDeRecibo('liquidacion_final', '2026-10-01', null))
      .toBe('Liquidación final - Octubre 2026.pdf')
    expect(nombreDeRecibo('sac', '2026-12-01', '   ')).toBe('Aguinaldo (SAC) - Diciembre 2026.pdf')
  })

  it('★ el nombre no puede armar una ruta', () => {
    // Termina en un header de descarga y en el nombre con el que se guarda.
    const n = nombreDeRecibo('mensual', '2026-10-01', '../../etc/passwd')
    expect(n).not.toContain('/')
    expect(n).not.toContain('..')
  })

  it('un tipo que no conocemos no rompe el nombre', () => {
    expect(nombreDeRecibo('vaya-a-saber', '2026-10-01', null)).toBe('Comprobante - Octubre 2026.pdf')
  })
})

describe('siguienteSecuencia', () => {
  const r = (periodo: string, tipo: string, secuencia: number) => ({ periodo, tipo, secuencia })

  it('la primera del período es la 1', () => {
    expect(siguienteSecuencia([], '2026-10-01', 'mensual')).toBe(1)
    expect(siguienteSecuencia([r('2026-09-01', 'mensual', 1)], '2026-10-01', 'mensual')).toBe(1)
  })

  it('la segunda del mismo mes y tipo es la 2', () => {
    expect(siguienteSecuencia([r('2026-10-01', 'mensual', 1)], '2026-10-01', 'mensual')).toBe(2)
  })

  it('otro tipo del mismo mes arranca de nuevo', () => {
    expect(siguienteSecuencia([r('2026-10-01', 'mensual', 1)], '2026-10-01', 'sac')).toBe(1)
  })

  it('★ no reusa el número de una anulada', () => {
    // La clave única cuenta a las anuladas: la corrección no puede ocupar el
    // lugar del recibo que reemplaza, que sigue existiendo como constancia.
    const previas = [r('2026-10-01', 'mensual', 1), r('2026-10-01', 'mensual', 2)]
    expect(siguienteSecuencia(previas, '2026-10-01', 'mensual')).toBe(3)
  })

  it('no se confunde con un período que trae hora', () => {
    expect(siguienteSecuencia([r('2026-10-01T00:00:00Z', 'mensual', 1)], '2026-10-01', 'mensual')).toBe(2)
  })
})

describe('esPdf', () => {
  const bytes = (s: string) => new TextEncoder().encode(s)

  it('reconoce un PDF', () => {
    expect(esPdf(bytes('%PDF-1.7\n...'))).toBe(true)
  })

  it('★ mira el contenido, no el nombre', () => {
    expect(esPdf(bytes('<html>esto no es un recibo</html>'))).toBe(false)
    expect(esPdf(new Uint8Array(0))).toBe(false)
  })

  it('aguanta basura antes de la cabecera', () => {
    expect(esPdf(bytes(' '.repeat(40) + '%PDF-1.4'))).toBe(true)
  })

  it('una cabecera escondida más allá del primer KB no cuenta', () => {
    expect(esPdf(bytes('x'.repeat(2000) + '%PDF-1.4'))).toBe(false)
  })
})

describe('leerAprobacion', () => {
  const vale = (p: Record<string, unknown> = {}) => ({
    aprobados: {
      h1: {
        empleadoId: 'emp-1', legajo: 83, recibo: '4821', periodo: '2026-10-01',
        tipo: 'mensual', concepto: 'OCTUBRE 2026', archivo: '20261001/uno.pdf',
        origenAt: '2026-11-04T12:00:00-03:00', hash: 'h1', ...p,
      },
    },
  })

  it('encuentra la liquidación por la huella del PDF', () => {
    expect(leerAprobacion(vale(), 'h1')).toMatchObject({
      empleadoId: 'emp-1', legajo: 83, recibo: '4821', periodo: '2026-10-01', tipo: 'mensual',
    })
  })

  it('★ una huella que no se aprobó no existe', () => {
    // Es la barrera: si el lector emparejó mal un archivo con un legajo, el
    // sha de los bytes no está en el vale y el PDF no se guarda.
    expect(leerAprobacion(vale(), 'otra')).toBeNull()
  })

  it('★ la huella con la que se guarda puede ser la de otra copia', () => {
    const v = { aprobados: { copiaB: { empleadoId: 'emp-1', periodo: '2026-10-01', tipo: 'mensual', hash: 'copiaA' } } }
    expect(leerAprobacion(v, 'copiaB')?.hash).toBe('copiaA')
  })

  it('sin hash propio se queda con el del archivo', () => {
    expect(leerAprobacion(vale({ hash: null }), 'h1')?.hash).toBe('h1')
  })

  it('★ un vale a medias no arma una fila a medias', () => {
    for (const roto of [{ empleadoId: null }, { periodo: null }, { periodo: 'octubre' }, { tipo: '' }]) {
      expect(leerAprobacion(vale(roto), 'h1'), JSON.stringify(roto)).toBeNull()
    }
  })

  it('un detalle que no es el que esperamos no revienta', () => {
    for (const d of [null, undefined, 'texto', 42, {}, { aprobados: 'no' }, { aprobados: { h1: 7 } }]) {
      expect(leerAprobacion(d, 'h1')).toBeNull()
    }
  })

  it('un legajo que no es un entero queda en null, no se inventa', () => {
    expect(leerAprobacion(vale({ legajo: '83' }), 'h1')?.legajo).toBeNull()
  })
})

describe('loteCortado', () => {
  it('★ un lote cortado no deja cargar nada', () => {
    expect(loteCortado({ puedeEnviar: false })).toBe(true)
  })

  it('un lote que se puede mandar deja cargar', () => {
    expect(loteCortado({ puedeEnviar: true })).toBe(false)
  })

  it('★ ante la duda no corta', () => {
    // Un detalle de una versión vieja, sin el dato, no puede dejar sin cargar
    // un mes entero.
    for (const d of [null, undefined, {}, 'texto', 42, { puedeEnviar: 'no' }]) {
      expect(loteCortado(d), JSON.stringify(d)).toBe(false)
    }
  })
})
