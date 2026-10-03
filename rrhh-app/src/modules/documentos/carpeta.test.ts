import { describe, expect, it } from 'vitest'
import { extensionDe, fechaParaArchivo, fmtTamano, nombreArchivoCertificado, nombreSeguro, rutasUnicas } from './carpeta'

describe('nombres para el ZIP', () => {
  it('limpia caracteres prohibidos', () => {
    expect(nombreSeguro('ART: póliza 1/2 "final"')).toBe('ART póliza 1 2 final')
    expect(nombreSeguro('   ')).toBe('sin nombre')
  })
  it('extensión y fecha', () => {
    expect(extensionDe('Escaneo.PDF')).toBe('pdf')
    expect(extensionDe('sin-extension')).toBe('')
    expect(fechaParaArchivo('2026-12-31')).toBe('31-12-2026')
    expect(fechaParaArchivo(null)).toBe('')
  })
  it('nombre de certificado con vencimiento y varios archivos', () => {
    expect(nombreArchivoCertificado('ART', '2026-12-31', 'x.pdf', 1, 1)).toBe('ART - vence 31-12-2026.pdf')
    expect(nombreArchivoCertificado('DNI', null, 'frente.JPG', 2, 2)).toBe('DNI (2).jpg')
  })
  it('rutas únicas sin perder ninguna', () => {
    expect(rutasUnicas(['A/x.pdf', 'A/x.pdf', 'a/X.pdf', 'B/x.pdf'])).toEqual(['A/x.pdf', 'A/x (2).pdf', 'a/X (3).pdf', 'B/x.pdf'])
  })
  it('tamaño legible', () => {
    expect(fmtTamano(200 * 1024)).toBe('200 KB')
    expect(fmtTamano(3.5 * 1024 * 1024)).toBe('3,5 MB')
  })
})
