import { describe, expect, it } from 'vitest'
import {
  ALTO_LEYENDA, MAX_FIRMA_BYTES, cajaPorDefecto, encajarFirma, esPng, leerFirmaPng,
  leyendaFirma, medidasPng, nombreFirmado, rutaFirmado,
} from './estampa'
import type { CajaFirma } from './archivo'

const PNG = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13])
const DATA_PNG = `data:image/png;base64,${Buffer.from(PNG).toString('base64')}`

describe('esPng', () => {
  it('reconoce un PNG', () => {
    expect(esPng(PNG)).toBe(true)
  })

  it('rechaza un JPEG disfrazado', () => {
    expect(esPng(Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0]))).toBe(false)
  })

  it('rechaza algo más corto que la firma del formato', () => {
    expect(esPng(Uint8Array.from([0x89, 0x50]))).toBe(false)
  })
})

describe('leerFirmaPng', () => {
  it('saca los bytes del data URL del canvas', () => {
    const r = leerFirmaPng(DATA_PNG)
    expect('bytes' in r && [...r.bytes]).toEqual([...PNG])
  })

  it('pide la firma cuando no viene nada', () => {
    expect(leerFirmaPng(undefined)).toEqual({ error: 'Falta la firma.' })
    expect(leerFirmaPng('')).toEqual({ error: 'Falta la firma.' })
    expect(leerFirmaPng(123)).toEqual({ error: 'Falta la firma.' })
  })

  it('rechaza otro formato aunque el data URL diga PNG', () => {
    const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0]).toString('base64')
    expect(leerFirmaPng(`data:image/png;base64,${jpeg}`)).toHaveProperty('error')
  })

  it('rechaza un data URL que no es PNG', () => {
    expect(leerFirmaPng(`data:image/jpeg;base64,${Buffer.from(PNG).toString('base64')}`))
      .toHaveProperty('error')
  })

  it('rechaza lo que no es un data URL', () => {
    expect(leerFirmaPng('https://ejemplo.com/firma.png')).toHaveProperty('error')
    // Sin el ancla del final, un base64 con basura pegada entraría igual.
    expect(leerFirmaPng(`data:image/png;base64,${Buffer.from(PNG).toString('base64')} <script>`))
      .toHaveProperty('error')
  })

  it('corta por tamaño sin llegar a decodificar', () => {
    const r = leerFirmaPng(`data:image/png;base64,${'A'.repeat(MAX_FIRMA_BYTES * 2)}`)
    expect(r).toEqual({ error: 'La firma es demasiado grande.' })
  })
})

describe('encajarFirma', () => {
  const caja: CajaFirma = { pagina: 1, x: 100, y: 200, ancho: 120, alto: 50 }

  it('no deforma: escala por el lado que primero toca el borde', () => {
    // 600×200 en un hueco de 120×43,5 → manda el ancho (0,2) y no el alto.
    const e = encajarFirma(caja, 600, 200)
    expect(e.ancho).toBeCloseTo(120)
    expect(e.alto).toBeCloseTo(40)
    expect(e.ancho / e.alto).toBeCloseTo(600 / 200)
  })

  it('cuando manda el alto, la firma queda angosta y centrada', () => {
    const e = encajarFirma(caja, 200, 400)
    expect(e.alto).toBeCloseTo(caja.alto - ALTO_LEYENDA)
    expect(e.ancho).toBeLessThan(caja.ancho)
    // Centrada: lo que sobra se reparte en partes iguales.
    expect(e.x - caja.x).toBeCloseTo(caja.x + caja.ancho - (e.x + e.ancho))
  })

  it('se apoya abajo, que es donde está el renglón impreso', () => {
    expect(encajarFirma(caja, 600, 200).y).toBe(caja.y)
  })

  it('nunca se sale del recuadro', () => {
    for (const [w, h] of [[600, 200], [200, 400], [1, 1], [4000, 10]]) {
      const e = encajarFirma(caja, w, h)
      expect(e.x).toBeGreaterThanOrEqual(caja.x - 0.01)
      expect(e.x + e.ancho).toBeLessThanOrEqual(caja.x + caja.ancho + 0.01)
      expect(e.y + e.alto).toBeLessThanOrEqual(caja.y + caja.alto + 0.01)
    }
  })

  it('la leyenda va arriba del todo, no entre la firma y el renglón', () => {
    const e = encajarFirma(caja, 600, 200)
    expect(e.leyenda).not.toBeNull()
    expect(e.leyenda!.y).toBeGreaterThanOrEqual(e.y + e.alto - 0.01)
    expect(e.leyenda!.x).toBe(caja.x)
  })

  it('en un recuadro bajo se deja la leyenda y entra solo la firma', () => {
    const chica: CajaFirma = { pagina: 1, x: 0, y: 0, ancho: 120, alto: 20 }
    const e = encajarFirma(chica, 600, 200)
    expect(e.leyenda).toBeNull()
    expect(e.alto).toBeCloseTo(20)
  })

  it('una imagen sin medidas no deja NaN en las coordenadas', () => {
    const e = encajarFirma(caja, 0, 0)
    for (const v of [e.x, e.y, e.ancho, e.alto]) expect(Number.isFinite(v)).toBe(true)
    expect(e.ancho).toBeGreaterThan(0)
  })
})

describe('cajaPorDefecto', () => {
  it('cae abajo a la derecha de una A4 y entra entera en la hoja', () => {
    const c = cajaPorDefecto(595, 842, 2)
    expect(c.pagina).toBe(2)
    expect(c.x + c.ancho).toBeLessThanOrEqual(595)
    expect(c.y + c.alto).toBeLessThanOrEqual(842)
    expect(c.x).toBeGreaterThan(595 / 2)
  })

  it('en una hoja chiquita se achica en vez de salirse', () => {
    const c = cajaPorDefecto(200, 100, 1)
    expect(c.x).toBeGreaterThanOrEqual(0)
    expect(c.x + c.ancho).toBeLessThanOrEqual(200)
    expect(c.y + c.alto).toBeLessThanOrEqual(100)
    expect(c.ancho).toBeGreaterThan(0)
    expect(c.alto).toBeGreaterThan(0)
  })
})

describe('leyendaFirma', () => {
  it('escribe la fecha argentina, no la UTC', () => {
    // 05/11/2026 a las 23:30 UTC ya es el 5 acá y el 6 allá a la medianoche.
    expect(leyendaFirma(new Date('2026-11-05T23:30:00Z'))).toBe('Firmado el 05/11/2026')
    // 01/11 a las 02:00 UTC = 31/10 a las 23:00 en Argentina.
    expect(leyendaFirma(new Date('2026-11-01T02:00:00Z'))).toBe('Firmado el 31/10/2026')
  })
})

describe('rutaFirmado', () => {
  it('agrega -firmado antes de la extensión', () => {
    expect(rutaFirmado('recibos/tecnophos-bb/abc/2026-10-01-mensual-0f1e.pdf'))
      .toBe('recibos/tecnophos-bb/abc/2026-10-01-mensual-0f1e-firmado.pdf')
  })

  it('no pisa nunca al original', () => {
    const p = 'recibos/x/y/z.pdf'
    expect(rutaFirmado(p)).not.toBe(p)
  })

  it('aguanta un path sin extensión', () => {
    expect(rutaFirmado('recibos/x/y/z')).toBe('recibos/x/y/z-firmado.pdf')
    expect(rutaFirmado('')).toBe('')
  })
})

describe('nombreFirmado', () => {
  it('lo deja claro en el nombre que ve la gente', () => {
    expect(nombreFirmado('Sueldo mensual - Octubre 2026 - recibo 0105.pdf'))
      .toBe('Sueldo mensual - Octubre 2026 - recibo 0105 (firmado).pdf')
  })

  it('sin nombre devuelve algo usable igual', () => {
    expect(nombreFirmado('')).toBe('Recibo (firmado).pdf')
  })
})

describe('medidasPng', () => {
  /** Un PNG mínimo de verdad: firma + chunk IHDR con el ancho y el alto. */
  function png(ancho: number, alto: number): Uint8Array {
    const b = Buffer.alloc(24)
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(b, 0)
    b.writeUInt32BE(13, 8)
    b.write('IHDR', 12)
    b.writeUInt32BE(ancho, 16)
    b.writeUInt32BE(alto, 20)
    return Uint8Array.from(b)
  }

  it('lee el ancho y el alto de la cabecera', () => {
    expect(medidasPng(png(600, 200))).toEqual({ ancho: 600, alto: 200 })
  })

  it('aguanta un PNG grande sin que el ancho se vuelva negativo', () => {
    expect(medidasPng(png(3000, 4000))).toEqual({ ancho: 3000, alto: 4000 })
  })

  it('devuelve null si no es PNG, si está cortado o si no hay IHDR', () => {
    expect(medidasPng(Uint8Array.from([0xff, 0xd8, 0xff]))).toBeNull()
    expect(medidasPng(PNG)).toBeNull()
    const sinIhdr = png(10, 10)
    sinIhdr[12] = 0x49 + 1
    expect(medidasPng(sinIhdr)).toBeNull()
    expect(medidasPng(png(0, 10))).toBeNull()
  })
})
