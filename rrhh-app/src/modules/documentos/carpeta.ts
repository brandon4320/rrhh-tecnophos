// ============================================================
// "Armar carpeta para planta": reglas puras para nombrar lo que va adentro del ZIP.
// Las plantas (Bunge, Terminal 6, Renova…) piden la documentación de cada persona
// que entra: los archivos tienen que llegar con nombres que se entiendan solos
// ("ART - vence 31-12-2026.pdf"), no con la clave de R2 ("1719….pdf").
// ============================================================

/** Saca lo que Windows/macOS no aceptan en un nombre de archivo y recorta. */
export function nombreSeguro(s: string | null | undefined, max = 100): string {
  const limpio = (s ?? '')
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^\.+/, '')
  return (limpio || 'sin nombre').slice(0, max).trim()
}

/** Extensión en minúscula ('pdf'), o '' si no tiene. */
export function extensionDe(nombre: string | null | undefined): string {
  const n = (nombre ?? '').trim()
  const i = n.lastIndexOf('.')
  if (i <= 0 || i === n.length - 1) return ''
  const ext = n.slice(i + 1).toLowerCase()
  return /^[a-z0-9]{1,8}$/.test(ext) ? ext : ''
}

/** 'YYYY-MM-DD' → 'DD-MM-YYYY' (con guiones: la barra no va en nombres de archivo). */
export function fechaParaArchivo(fecha: string | null | undefined): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(fecha ?? '')
  return m ? `${m[3]}-${m[2]}-${m[1]}` : ''
}

/**
 * Nombre de un archivo de certificado dentro de la carpeta de su dueño:
 * "ART - vence 31-12-2026.pdf"; si el certificado tiene varios archivos,
 * "DNI (1).jpg", "DNI (2).jpg".
 */
export function nombreArchivoCertificado(
  titulo: string,
  vence: string | null | undefined,
  original: string | null | undefined,
  indice: number,
  total: number
): string {
  const venc = fechaParaArchivo(vence)
  const base = nombreSeguro(`${titulo}${venc ? ` - vence ${venc}` : ''}${total > 1 ? ` (${indice})` : ''}`, 120)
  const ext = extensionDe(original)
  return ext ? `${base}.${ext}` : base
}

/**
 * Hace únicas las rutas del ZIP sin perder ninguna: la segunda "Carpeta/a.pdf"
 * pasa a "Carpeta/a (2).pdf". Respeta el orden de entrada.
 */
export function rutasUnicas(rutas: string[]): string[] {
  const usadas = new Set<string>()
  return rutas.map((r) => {
    if (!usadas.has(r.toLowerCase())) {
      usadas.add(r.toLowerCase())
      return r
    }
    const punto = r.lastIndexOf('.')
    const barra = r.lastIndexOf('/')
    const tieneExt = punto > barra + 1
    const base = tieneExt ? r.slice(0, punto) : r
    const ext = tieneExt ? r.slice(punto) : ''
    for (let n = 2; ; n++) {
      const cand = `${base} (${n})${ext}`
      if (!usadas.has(cand.toLowerCase())) {
        usadas.add(cand.toLowerCase())
        return cand
      }
    }
  })
}

/** Tamaño legible para la barra de descarga. */
export function fmtTamano(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`
  return `${(bytes / (1024 * 1024)).toFixed(bytes < 10 * 1024 * 1024 ? 1 : 0).replace('.', ',')} MB`
}
