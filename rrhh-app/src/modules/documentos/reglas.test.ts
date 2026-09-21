import { describe, it, expect } from 'vitest'
import {
  CARPETAS_FIJAS, agruparPorCarpeta, anioMesAR, carpetasDelMes, carpetasExtra, completitudMes, empleadosConReciboPorPeriodo,
  arbolCarpetas, carpetasFijasDe, esCarpetaFija, estadoMes, excedeNiveles, normalizarCarpeta, periodoActual, periodoAnterior, periodoDe, raizCarpeta,
  rutasConArchivos, sanitizarNombreArchivo,
  slugCarpeta, validarArchivoDocumento,
} from './reglas'
import { labelPeriodo } from '@/lib/recibos'

// 11/09/2026 a mediodía AR (15:00Z): mismo día en cualquier TZ del runner.
const HOY = new Date('2026-09-11T15:00:00Z')

describe('normalizarCarpeta / esCarpetaFija', () => {
  it('canoniza las fijas sin importar mayúsculas ni espacios', () => {
    expect(normalizarCarpeta('f931')).toBe('F931')
    expect(normalizarCarpeta('  recibos   de sueldos ')).toBe('Recibos de sueldos')
    expect(normalizarCarpeta('ART')).toBe('ART')
    expect(esCarpetaFija('SVO')).toBe(true)
    expect(esCarpetaFija('svo')).toBe(false) // esCarpetaFija espera el nombre ya normalizado
    expect(esCarpetaFija('Seguros')).toBe(false)
  })
  it('vacío o basura = raíz; extras se conservan limpias', () => {
    expect(normalizarCarpeta('')).toBe('')
    expect(normalizarCarpeta('   ')).toBe('')
    expect(normalizarCarpeta(null)).toBe('')
    expect(normalizarCarpeta(' Seguros  varios ')).toBe('Seguros varios')
  })
})

describe('carpetas y completitud', () => {
  const docs = [
    { periodo: '2026-07-01', carpeta: 'F931' },
    { periodo: '2026-07-01', carpeta: 'art' },
    { periodo: '2026-07-01', carpeta: 'Seguros' },
    { periodo: '2026-07-01', carpeta: 'Banco' },
    { periodo: '2026-07-01', carpeta: '' },
  ]
  it('las fijas siempre, más las extra ordenadas, nunca la raíz', () => {
    expect(carpetasExtra(docs)).toEqual(['Banco', 'Seguros'])
    expect(carpetasDelMes(docs)).toEqual([...CARPETAS_FIJAS, 'Banco', 'Seguros'])
    expect(carpetasDelMes([])).toEqual([...CARPETAS_FIJAS])
  })
  it('agrupa por carpeta canónica', () => {
    const g = agruparPorCarpeta(docs)
    expect(g.get('ART')!.length).toBe(1)
    expect(g.get('')!.length).toBe(1)
    expect(g.get('Seguros')!.length).toBe(1)
  })
  it('completitud cuenta solo las fijas; sueltos y extras no cubren nada', () => {
    const c = completitudMes(docs)
    expect(c.completas).toEqual(['ART', 'F931'])
    expect(c.faltantes).toEqual(['Aportes sindicales', 'Pagos', 'Recibos de sueldos', 'SVO'])
    expect(c.total).toBe(6)
  })
  it('una carpeta puede quedar cubierta por otra fuente (recibos del legajo)', () => {
    const c = completitudMes(docs, ['Recibos de sueldos'])
    expect(c.completas).toContain('Recibos de sueldos')
    expect(c.faltantes).not.toContain('Recibos de sueldos')
  })
})

describe('estadoMes', () => {
  const vacio = completitudMes([])
  const todo = completitudMes(CARPETAS_FIJAS.map((c) => ({ periodo: '2026-07-01', carpeta: c })))
  const parcial = completitudMes([{ periodo: '2026-07-01', carpeta: 'F931' }])
  it('completo / incompleto', () => {
    expect(estadoMes('2026-07-01', todo, 6, HOY)).toBe('vigente')
    expect(estadoMes('2026-07-01', parcial, 1, HOY)).toBe('proximo')
    // solo sueltos: hay archivos pero ninguna fija → incompleto, no "sin cargar"
    expect(estadoMes('2026-07-01', vacio, 2, HOY)).toBe('proximo')
  })
  it('vacío: pasado = sin cargar; en curso o futuro = sin archivos', () => {
    expect(estadoMes('2026-07-01', vacio, 0, HOY)).toBe('vencido')
    expect(estadoMes('2026-08-01', vacio, 0, HOY)).toBe('vencido')
    expect(estadoMes('2026-09-01', vacio, 0, HOY)).toBe('sin_fecha')
    expect(estadoMes('2026-12-01', vacio, 0, HOY)).toBe('sin_fecha')
  })
})

describe('períodos en hora Argentina', () => {
  it('periodoDe / labelPeriodo (compartida con recibos) / periodoAnterior', () => {
    expect(periodoDe(2026, 7)).toBe('2026-07-01')
    expect(labelPeriodo('2026-07-01')).toBe('Julio 2026')
    expect(periodoActual(HOY)).toBe('2026-09-01')
    expect(periodoAnterior(HOY)).toBe('2026-08-01')
    expect(periodoAnterior(new Date('2026-01-15T15:00:00Z'))).toBe('2025-12-01')
  })
  it('el último día del mes a las 22:00 AR sigue siendo ese mes aunque en UTC ya sea el siguiente', () => {
    const finDeMes = new Date('2026-10-01T01:00:00Z') // 30/09 22:00 AR
    expect(anioMesAR(finDeMes)).toEqual({ anio: 2026, mes: 9 })
    expect(periodoActual(finDeMes)).toBe('2026-09-01')
    expect(periodoAnterior(finDeMes)).toBe('2026-08-01')
    const finDeAnio = new Date('2027-01-01T02:30:00Z') // 31/12/2026 23:30 AR
    expect(anioMesAR(finDeAnio)).toEqual({ anio: 2026, mes: 12 })
  })
})

describe('claves R2', () => {
  it('slugCarpeta y sanitizarNombreArchivo', () => {
    expect(slugCarpeta('Recibos de sueldos')).toBe('recibos-de-sueldos')
    expect(slugCarpeta('')).toBe('_raiz')
    expect(slugCarpeta('Aportes sindicales')).toBe('aportes-sindicales')
    expect(sanitizarNombreArchivo('ARCA - Agencia de Recaudación y Control Aduanero.pdf')).toBe('ARCA_-_Agencia_de_Recaudacion_y_Control_Aduanero.pdf')
    expect(sanitizarNombreArchivo('C:\\Users\\x\\F931 julio.pdf')).toBe('F931_julio.pdf')
    expect(sanitizarNombreArchivo('///')).toBe('archivo')
  })
})

describe('validarArchivoDocumento', () => {
  it('acepta lo que baja de las plataformas', () => {
    expect(validarArchivoDocumento({ name: 'F931.pdf', type: 'application/pdf', size: 100 })).toBeNull()
    expect(validarArchivoDocumento({ name: 'nomina.xlsx', type: '', size: 100 })).toBeNull()
    expect(validarArchivoDocumento({ name: 'F931.txt', type: 'text/plain', size: 100 })).toBeNull()
  })
  it('rechaza vacío, muy grande o ejecutables', () => {
    expect(validarArchivoDocumento({ name: 'x.pdf', type: 'application/pdf', size: 0 })).toMatch(/vacío/)
    expect(validarArchivoDocumento({ name: 'x.pdf', type: 'application/pdf', size: 26 * 1024 * 1024 })).toMatch(/25 MB/)
    expect(validarArchivoDocumento({ name: 'virus.exe', type: 'application/octet-stream', size: 10 })).toMatch(/solo se aceptan/)
    // un mime "correcto" no salva una extensión prohibida
    expect(validarArchivoDocumento({ name: 'payload.exe', type: 'application/pdf', size: 10 })).toMatch(/solo se aceptan/)
    expect(validarArchivoDocumento({ name: 'foto.jpg', type: 'application/octet-stream', size: 10 })).toBeNull()
  })
})

describe('empleadosConReciboPorPeriodo', () => {
  it('cuenta empleados distintos con recibo mensual por período', () => {
    const m = empleadosConReciboPorPeriodo([
      { periodo: '2026-07-01', empleado_id: 'a', tipo: 'mensual' },
      { periodo: '2026-07-01', empleado_id: 'a', tipo: 'sac' },
      { periodo: '2026-07-01', empleado_id: 'b', tipo: 'mensual' },
      { periodo: '2026-06-01', empleado_id: 'b' },
    ])
    expect(m.get('2026-07-01')).toBe(2)
    expect(m.get('2026-06-01')).toBe(1)
    expect(m.get('2026-05-01')).toBeUndefined()
  })
})

// ── Subcarpetas (2026-09-15) ────────────────────────────────────────────────
// `carpeta` guarda la RUTA: la oficinista divide Recibos de sueldos por sector
// (Limpieza, Sal, Bahía Blanca…) y adentro por concepto (Aguinaldo, Premio anual).

describe('normalizarCarpeta con rutas', () => {
  it('canoniza solo el primer tramo y conserva los demás', () => {
    expect(normalizarCarpeta('RECIBOS DE SUELDOS/Limpieza')).toBe('Recibos de sueldos/Limpieza')
    expect(normalizarCarpeta('recibos de sueldos / Sal / Aguinaldo')).toBe('Recibos de sueldos/Sal/Aguinaldo')
  })
  it('acepta barra invertida (nombre copiado del explorador de Windows)', () => {
    expect(normalizarCarpeta(String.raw`ART\Nomina`)).toBe('ART/Nomina')
  })
  it('descarta tramos vacíos y corta a MAX_NIVELES_CARPETA', () => {
    expect(normalizarCarpeta('//ART///Nomina//')).toBe('ART/Nomina')
    expect(normalizarCarpeta('a/b/c/d/e/f')).toBe('a/b/c/d')
    expect(normalizarCarpeta('///')).toBe('')
  })
})

describe('raizCarpeta', () => {
  it('devuelve el primer tramo ya canonizado', () => {
    expect(raizCarpeta('RECIBOS DE SUELDOS/Limpieza/Aguinaldo')).toBe('Recibos de sueldos')
    expect(raizCarpeta('ARCA')).toBe('ARCA')
    expect(raizCarpeta('')).toBe('')
  })
})

describe('completitudMes con subcarpetas', () => {
  it('un archivo en una subcarpeta cubre la carpeta fija', () => {
    const c = completitudMes([{ periodo: '2026-04-01', carpeta: 'Recibos de sueldos/Limpieza/Aguinaldo' }])
    expect(c.completas).toContain('Recibos de sueldos')
  })
})

describe('carpetasExtra / carpetasDelMes con subcarpetas', () => {
  it('solo cuentan las raíces, no cada subcarpeta', () => {
    const docs = [
      { periodo: '2026-04-01', carpeta: 'Recibos de sueldos/Limpieza' },
      { periodo: '2026-04-01', carpeta: 'REPSAL/2026' },
    ]
    expect(carpetasExtra(docs)).toEqual(['REPSAL'])
    expect(carpetasDelMes(docs)).toEqual([...CARPETAS_FIJAS, 'REPSAL'])
  })
})

describe('arbolCarpetas', () => {
  const docs = [
    { id: '1', periodo: '2026-04-01', carpeta: 'Recibos de sueldos/Sal/Aguinaldo' },
    { id: '2', periodo: '2026-04-01', carpeta: 'Recibos de sueldos/Sal' },
    { id: '3', periodo: '2026-04-01', carpeta: 'RECIBOS DE SUELDOS/Limpieza' },
    { id: '4', periodo: '2026-04-01', carpeta: 'F931' },
    { id: '5', periodo: '2026-04-01', carpeta: '' },
  ]
  it('arma un nodo por tramo, ordenado, sin los sueltos de la raíz', () => {
    const arbol = arbolCarpetas(docs)
    expect(arbol.map((n) => n.nombre)).toEqual(['F931', 'Recibos de sueldos'])
    const recibos = arbol[1]
    expect(recibos.ruta).toBe('Recibos de sueldos')
    expect(recibos.hijas.map((h) => h.nombre)).toEqual(['Limpieza', 'Sal'])
    expect(recibos.hijas[1].ruta).toBe('Recibos de sueldos/Sal')
    expect(recibos.hijas[1].hijas[0].ruta).toBe('Recibos de sueldos/Sal/Aguinaldo')
  })
  it('docs son los de ESE nivel y total incluye lo que cuelga', () => {
    const recibos = arbolCarpetas(docs)[1]
    expect(recibos.docs).toEqual([])          // no hay nada suelto en Recibos de sueldos
    expect(recibos.total).toBe(3)             // Sal + Sal/Aguinaldo + Limpieza
    const sal = recibos.hijas[1]
    expect(sal.docs.map((d) => d.id)).toEqual(['2'])
    expect(sal.total).toBe(2)
  })
})

describe('rutasConArchivos', () => {
  it('lista las rutas completas usadas, sin la raíz y sin repetir', () => {
    expect(rutasConArchivos([
      { periodo: '2026-04-01', carpeta: 'Recibos de sueldos/Sal' },
      { periodo: '2026-05-01', carpeta: 'RECIBOS DE SUELDOS/Sal' },
      { periodo: '2026-05-01', carpeta: 'F931' },
      { periodo: '2026-05-01', carpeta: '' },
    ])).toEqual(['F931', 'Recibos de sueldos/Sal'])
  })
})

describe('slugCarpeta con rutas', () => {
  it('aplasta la ruta en un solo segmento de la clave en R2', () => {
    expect(slugCarpeta('Recibos de sueldos/Limpieza/Aguinaldo')).toBe('recibos-de-sueldos-limpieza-aguinaldo')
  })
  it('no deja escapar del prefijo con puntos ni barras', () => {
    expect(slugCarpeta('../../etc')).toBe('etc')
    expect(slugCarpeta('..')).toBe('carpeta')
  })
})

describe('excedeNiveles', () => {
  it('avisa cuando la ruta tiene mas tramos de los que se guardan', () => {
    expect(excedeNiveles('a/b/c/d')).toBe(false)
    expect(excedeNiveles('a/b/c/d/e')).toBe(true)
    // los tramos vacios no cuentan: '//a//b//' son dos, no seis
    expect(excedeNiveles('//a//b//')).toBe(false)
    expect(excedeNiveles(null)).toBe(false)
  })
})

// ── Carpetas fijas por empresa (2026-09-21) ───────────────────────────
// Necochea solo maneja ART y recibos: mostrarle las seis dejaba el mes en 2/6
// para siempre. Lo que NO puede pasar es esconder algo ya cargado.

describe('carpetasFijasDe', () => {
  it('Necochea lleva solo ART y Recibos de sueldos', () => {
    expect(carpetasFijasDe('tecnophos-necochea')).toEqual(['ART', 'Recibos de sueldos'])
  })
  it('cualquier otra empresa lleva las seis', () => {
    expect(carpetasFijasDe('adc')).toEqual(CARPETAS_FIJAS)
    expect(carpetasFijasDe('tecnophos-bb')).toEqual(CARPETAS_FIJAS)
    expect(carpetasFijasDe(undefined)).toEqual(CARPETAS_FIJAS)
    expect(carpetasFijasDe(null)).toEqual(CARPETAS_FIJAS)
    expect(carpetasFijasDe('empresa-que-no-existe')).toEqual(CARPETAS_FIJAS)
  })
})

describe('carpetasDelMes con lista de empresa', () => {
  const fijasNeco = carpetasFijasDe('tecnophos-necochea')

  it('muestra solo las de la empresa cuando el mes está vacío', () => {
    expect(carpetasDelMes([], fijasNeco)).toEqual(['ART', 'Recibos de sueldos'])
  })

  it('una carpeta fuera de la lista PERO con archivos se sigue viendo', () => {
    // Es la garantía importante: Aylen ya cargó F931 y Aportes en Necochea.
    // Sacarlas de la lista no puede hacer desaparecer esos archivos.
    const docs = [
      { periodo: '2026-09-01', carpeta: 'F931' },
      { periodo: '2026-09-01', carpeta: 'Aportes sindicales' },
    ]
    expect(carpetasDelMes(docs, fijasNeco)).toEqual(['ART', 'Recibos de sueldos', 'Aportes sindicales', 'F931'])
  })

  it('no repite una carpeta que ya está en la lista de la empresa', () => {
    const docs = [{ periodo: '2026-09-01', carpeta: 'ART' }]
    expect(carpetasDelMes(docs, fijasNeco)).toEqual(['ART', 'Recibos de sueldos'])
  })
})

describe('completitudMes con lista de empresa', () => {
  const fijasNeco = carpetasFijasDe('tecnophos-necochea')

  it('cuenta sobre 2 y no sobre 6', () => {
    const c = completitudMes([{ periodo: '2026-09-01', carpeta: 'ART' }], [], fijasNeco)
    expect(c.total).toBe(2)
    expect(c.completas).toEqual(['ART'])
    expect(c.faltantes).toEqual(['Recibos de sueldos'])
  })

  it('con ART y recibos el mes queda completo, aunque no haya F931', () => {
    const docs = [
      { periodo: '2026-09-01', carpeta: 'ART' },
      { periodo: '2026-09-01', carpeta: 'Recibos de sueldos' },
    ]
    const c = completitudMes(docs, [], fijasNeco)
    expect(c.faltantes).toEqual([])
    expect(estadoMes('2026-09-01', c, docs.length, HOY)).toBe('vigente')
  })

  it('una carpeta de fuera de la lista no suma ni resta', () => {
    const docs = [{ periodo: '2026-09-01', carpeta: 'F931' }]
    const c = completitudMes(docs, [], fijasNeco)
    expect(c.completas).toEqual([])
    expect(c.total).toBe(2)
  })
})

describe('estadoMes sin carpetas que completar', () => {
  it('lista vacía NO es un mes completo', () => {
    // Si alguien configura una empresa sin carpetas fijas, los doce meses no
    // pueden salir en verde sin que se haya subido nada.
    const c = completitudMes([], [], [])
    expect(c.total).toBe(0)
    expect(c.faltantes).toEqual([])
    expect(estadoMes('2026-08-01', c, 0, HOY)).toBe('vencido')
    expect(estadoMes('2026-12-01', c, 0, HOY)).toBe('sin_fecha')
    expect(estadoMes('2026-08-01', c, 3, HOY)).toBe('proximo')
  })
})
