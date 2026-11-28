import { describe, expect, it } from 'vitest'
import { DIAS_VIGENCIA } from './reglas'
import { escaparHtml, linkDeFirma, mailCopiaFirmada, mailOnboarding } from './mail'

describe('escaparHtml', () => {
  it('escapa lo que rompe el HTML', () => {
    expect(escaparHtml('<b>&"\'')).toBe('&lt;b&gt;&amp;&quot;&#39;')
  })
  it('deja los acentos como están', () => {
    expect(escaparHtml('Adrián Ñandú')).toBe('Adrián Ñandú')
  })
})

describe('linkDeFirma', () => {
  it('arma la dirección', () => {
    expect(linkDeFirma('https://gestion.app', 'abc123')).toBe('https://gestion.app/firma/abc123')
  })
  it('no duplica la barra', () => {
    expect(linkDeFirma('https://gestion.app///', 'abc')).toBe('https://gestion.app/firma/abc')
  })
  it('escapa el token en la URL', () => {
    // base64url no trae caracteres raros, pero el día que cambie el generador
    // un token sin escapar cortaría el link en silencio.
    expect(linkDeFirma('https://g.app', 'a/b?c')).toBe('https://g.app/firma/a%2Fb%3Fc')
  })
})

describe('mailOnboarding', () => {
  const link = 'https://gestion.app/firma/tok'

  it('saluda con el nombre de pila, no con el nombre entero en mayúsculas', () => {
    const m = mailOnboarding({ nombre: 'LUCIANA MARILIN', link })
    expect(m.texto).toContain('Hola Luciana,')
    expect(m.texto).not.toContain('MARILIN')
  })

  it('sin nombre saluda igual', () => {
    const m = mailOnboarding({ nombre: null, link })
    expect(m.texto).toContain('Hola,')
    expect(m.html).toContain('Hola,')
  })

  it('el link va en el texto y dos veces en el HTML (botón y copiable)', () => {
    const m = mailOnboarding({ nombre: 'ANA', link })
    expect(m.texto).toContain(link)
    expect(m.html.split(link).length - 1).toBeGreaterThanOrEqual(2)
  })

  it('dice que le va a pedir los últimos 4 del CUIL', () => {
    const m = mailOnboarding({ nombre: 'ANA', link })
    expect(m.texto).toContain('últimos 4')
    expect(m.html).toContain('últimos 4')
  })

  it('promete el mail de confirmación y la copia para la empresa', () => {
    // ⚠ Si esto se cae, el mail promete algo que el sistema no hace.
    const m = mailOnboarding({ nombre: 'ANA', link })
    expect(m.texto).toContain('te llega un mail con la confirmación')
    expect(m.texto).toContain('copia en el sistema')
  })

  it('avisa que el link vence, con los días que de verdad dura', () => {
    const m = mailOnboarding({ nombre: 'ANA', link })
    expect(m.texto).toContain(`Vence en ${DIAS_VIGENCIA} días`)
  })

  it('un nombre con HTML adentro no se cuela en el cuerpo', () => {
    const m = mailOnboarding({ nombre: '<script>alert(1)</script>', link })
    expect(m.html).not.toContain('<script>')
    expect(m.html).toContain('&lt;script&gt;')
  })

  it('un link con comillas no rompe el href', () => {
    const m = mailOnboarding({ nombre: 'ANA', link: 'https://g.app/firma/a"b' })
    expect(m.html).not.toContain('href="https://g.app/firma/a"b"')
    expect(m.html).toContain('&quot;b')
  })

  it('trae texto plano además del HTML', () => {
    const m = mailOnboarding({ nombre: 'ANA', link })
    expect(m.texto).not.toContain('<')
    expect(m.texto.length).toBeGreaterThan(100)
  })

  it('el asunto es corto y dice de qué se trata', () => {
    const m = mailOnboarding({ nombre: 'ANA', link })
    expect(m.asunto).toBe('Tu firma para los recibos de sueldo')
    expect(m.asunto.length).toBeLessThanOrEqual(60)
  })

  it('es breve: el pedido fue que no sea un instructivo', () => {
    const m = mailOnboarding({ nombre: 'ANA', link })
    const palabras = m.texto.split(/\s+/).filter(Boolean).length
    expect(palabras).toBeLessThan(120)
  })
})

describe('mailCopiaFirmada', () => {
  // 2026-11-28T19:40:00Z = 16:40 del 28/11 en Argentina. La hora del mail sale
  // de acá y no del TZ del servidor, que en Vercel es UTC (AGENTS.md §9).
  const base = { nombre: 'ADRIAN', tipo: 'mensual', periodo: '2026-10-01', firmadoAt: '2026-11-28T19:40:00Z' }

  it('dice qué recibo se firmó, en el asunto y en el cuerpo', () => {
    const m = mailCopiaFirmada(base)
    expect(m.asunto).toBe('Firmaste tu recibo: Sueldo mensual · Octubre 2026')
    expect(m.texto).toContain('Sueldo mensual · Octubre 2026')
    expect(m.html).toContain('Sueldo mensual · Octubre 2026')
  })

  it('la fecha va en hora argentina, no en UTC', () => {
    const m = mailCopiaFirmada(base)
    expect(m.texto).toContain('el 28/11/2026 a las 16:40')
    expect(m.texto).not.toContain('19:40')
    expect(m.html).toContain('16:40')
  })

  it('traduce el tipo de recibo', () => {
    expect(mailCopiaFirmada({ ...base, tipo: 'sac' }).asunto).toContain('Aguinaldo')
    expect(mailCopiaFirmada({ ...base, tipo: 'liquidacion_final' }).asunto).toContain('Liquidación final')
  })

  it('saluda con el nombre de pila', () => {
    expect(mailCopiaFirmada({ ...base, nombre: 'LUCIANA MARILIN' }).texto).toContain('Hola Luciana,')
    expect(mailCopiaFirmada({ ...base, nombre: null }).texto).toContain('Hola,')
  })

  it('deja cómo avisar si no fue la persona', () => {
    // Es la única señal que recibe si alguien usó su link: sin esta línea el
    // mail es un acuse y no una confirmación.
    const m = mailCopiaFirmada(base)
    expect(m.texto).toContain('Si no fuiste vos')
    expect(m.html).toContain('Si no fuiste vos')
  })

  it('dice que el recibo va adjunto y que queda una copia para la empresa', () => {
    const m = mailCopiaFirmada(base)
    expect(m.texto).toContain('adjuntamos')
    expect(m.texto).toContain('copia en el sistema')
  })

  it('no lleva ningún link: no hay nada que ir a buscar', () => {
    const m = mailCopiaFirmada(base)
    expect(m.texto).not.toContain('http')
    expect(m.html).not.toContain('<a ')
  })

  it('con una fecha rota confirma igual, sin escribir "Invalid Date"', () => {
    const m = mailCopiaFirmada({ ...base, firmadoAt: 'no-es-una-fecha' })
    expect(m.texto).toContain('Firmaste tu recibo.')
    expect(m.html).toContain('Firmaste tu recibo.')
    expect(m.texto).not.toMatch(/Invalid|NaN|undefined/)
    expect(m.html).not.toMatch(/Invalid|NaN|undefined/)
  })

  it('escapa el nombre: viene de la base y entra al HTML', () => {
    const m = mailCopiaFirmada({ ...base, nombre: '<b>Ana' })
    expect(m.html).not.toContain('<b>Ana')
  })
})
