import { describe, expect, it } from 'vitest'
import { convieneComprimir, esImagenComprimible, medidasDestino, nombreJpg, UMBRAL_COMPRESION_BYTES } from './imagen'

describe('esImagenComprimible', () => {
  it('acepta JPG, PNG y WEBP por mime', () => {
    expect(esImagenComprimible({ type: 'image/jpeg', name: 'a.jpg' })).toBe(true)
    expect(esImagenComprimible({ type: 'image/png', name: 'a.png' })).toBe(true)
    expect(esImagenComprimible({ type: 'image/webp', name: 'a.webp' })).toBe(true)
  })
  it('no toca PDFs, HEIC ni GIF', () => {
    expect(esImagenComprimible({ type: 'application/pdf', name: 'a.pdf' })).toBe(false)
    expect(esImagenComprimible({ type: 'image/heic', name: 'a.heic' })).toBe(false)
    expect(esImagenComprimible({ type: 'image/gif', name: 'a.gif' })).toBe(false)
  })
  it('sin mime decide por la extensión', () => {
    expect(esImagenComprimible({ type: '', name: 'FOTO.JPEG' })).toBe(true)
    expect(esImagenComprimible({ type: '', name: 'escaneo.pdf' })).toBe(false)
  })
})

describe('medidasDestino', () => {
  it('achica el lado mayor a 2400 manteniendo la proporción', () => {
    expect(medidasDestino(4000, 3000)).toEqual({ ancho: 2400, alto: 1800 })
    expect(medidasDestino(3000, 4000)).toEqual({ ancho: 1800, alto: 2400 })
  })
  it('nunca agranda', () => {
    expect(medidasDestino(1200, 800)).toEqual({ ancho: 1200, alto: 800 })
  })
  it('respeta un máximo distinto', () => {
    expect(medidasDestino(3200, 1600, 1600)).toEqual({ ancho: 1600, alto: 800 })
  })
})

describe('nombreJpg', () => {
  it('cambia la extensión a .jpg', () => {
    expect(nombreJpg('foto.PNG')).toBe('foto.jpg')
    expect(nombreJpg('carnet.frente.webp')).toBe('carnet.frente.jpg')
  })
  it('agrega .jpg si no había extensión', () => {
    expect(nombreJpg('escaneo')).toBe('escaneo.jpg')
  })
})

describe('convieneComprimir', () => {
  it('comprime si pesa de más o si se pasa de lado', () => {
    expect(convieneComprimir(UMBRAL_COMPRESION_BYTES + 1, 1000, 800)).toBe(true)
    expect(convieneComprimir(200_000, 3000, 2000)).toBe(true)
  })
  it('deja tranquila una imagen liviana y chica', () => {
    expect(convieneComprimir(300_000, 1600, 1200)).toBe(false)
  })
})
