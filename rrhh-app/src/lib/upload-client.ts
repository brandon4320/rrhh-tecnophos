// ============================================================
// Subida de archivos desde el navegador.
// Flujo principal: URL prefirmada → PUT directo a R2 → registrar fila.
// (Vercel corta requests > 4.5MB con 413, por eso NO se pasa el archivo
// por la API salvo como fallback para archivos chicos.)
//
// Mientras el bucket no tenga CORS (AGENTS.md §8) el PUT directo falla
// SIEMPRE: la primera falla se recuerda para el resto de la sesión y los
// archivos que entran en el fallback van directo por ahí (sin pedir una
// firma ni esperar un PUT que se sabe roto). Los que no entran lo siguen
// intentando por el camino directo, que es el único que les puede servir.
// Las imágenes se comprimen antes (lib/imagen.ts): una foto de celular de
// 6 MB queda en ~1 MB y pasa por el fallback.
// ============================================================

import { comprimirImagen } from './imagen'

/** Fila completa de `archivos` que devuelve la API al registrar. */
export interface ArchivoSubido {
  id: string
  nombre: string
  path: string
  certificado_id: string | null
  mime_type: string | null
  size_bytes: number | null
  uploaded_at: string | null
  uploaded_by: string | null
}

const LIMITE_FALLBACK = 4 * 1024 * 1024 // 4MB: hasta acá sirve el fallback vía Vercel

/** true desde la primera vez que el PUT directo a R2 falló en esta pestaña. */
let putDirectoRoto = false

function mb(bytes: number): string {
  return (bytes / 1048576).toFixed(1).replace('.', ',')
}

/** Mensaje honesto cuando el archivo no entra por ningún camino disponible hoy. */
function errorDemasiadoGrande(file: File): Error {
  return new Error(
    `"${file.name}" pesa ${mb(file.size)} MB y hoy solo se pueden subir archivos de hasta 4 MB. ` +
      'Comprimilo (o dividí el PDF en partes) y volvé a subirlo.'
  )
}

async function putDirecto(url: string, file: File): Promise<boolean> {
  try {
    const res = await fetch(url, {
      method: 'PUT',
      body: file,
      headers: { 'Content-Type': file.type || 'application/octet-stream' },
    })
    putDirectoRoto = !res.ok
    return res.ok
  } catch {
    putDirectoRoto = true // p.ej. CORS no configurado / red
    return false
  }
}

async function errorDe(res: Response, porDefecto: string): Promise<Error> {
  const payload = await res.json().catch(() => null)
  // Un 413 de Vercel no trae JSON: llega acá sin `error`.
  if (res.status === 413) return new Error('El archivo es demasiado grande para subirlo. Comprimilo o dividilo en partes y volvé a subirlo.')
  return new Error(payload?.error ?? porDefecto)
}

/**
 * Circuito común: comprimir → (fallback directo si el PUT ya falló y entra)
 * → firmar → PUT → registrar, o fallback si el PUT falla.
 */
async function subir<T>(
  original: File,
  pasos: {
    firmar: (file: File) => Promise<{ url: string; path: string }>
    registrar: (file: File, path: string) => Promise<T>
    multipart: (file: File) => Promise<T>
  }
): Promise<T> {
  const file = await comprimirImagen(original)

  if (putDirectoRoto && file.size <= LIMITE_FALLBACK) return pasos.multipart(file)

  const { url, path } = await pasos.firmar(file)
  if (await putDirecto(url, file)) return pasos.registrar(file, path)

  if (file.size > LIMITE_FALLBACK) throw errorDemasiadoGrande(file)
  return pasos.multipart(file)
}

async function firmar(body: Record<string, unknown>): Promise<{ url: string; path: string }> {
  const res = await fetch('/api/upload-url', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw await errorDe(res, 'No se pudo preparar la subida.')
  return res.json()
}

async function postJson<T>(endpoint: string, body: Record<string, unknown>, clave: string, porDefecto: string): Promise<T> {
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw await errorDe(res, porDefecto)
  const payload = await res.json()
  return payload[clave] as T
}

async function postMultipart<T>(endpoint: string, fd: FormData, clave: string, porDefecto: string): Promise<T> {
  const res = await fetch(endpoint, { method: 'POST', body: fd })
  if (!res.ok) throw await errorDe(res, porDefecto)
  const payload = await res.json()
  return payload[clave] as T
}

export async function subirArchivo(
  file: File,
  certId: string,
  opts?: { empleadoId?: string; empresaSlug?: string }
): Promise<ArchivoSubido> {
  return subir(file, {
    firmar: (f) =>
      firmar({
        certId,
        nombre: f.name,
        mimeType: f.type || 'application/octet-stream',
        empleadoId: opts?.empleadoId ?? '',
        empresaSlug: opts?.empresaSlug ?? 'docs',
      }),
    registrar: (f, path) =>
      postJson<ArchivoSubido>(
        '/api/upload',
        { certId, path, nombre: f.name, mimeType: f.type || null, sizeBytes: f.size },
        'archivo',
        'El archivo se subió pero no se pudo registrar.'
      ),
    multipart: (f) => {
      const fd = new FormData()
      fd.append('file', f)
      fd.append('certId', certId)
      if (opts?.empleadoId) fd.append('empleadoId', opts.empleadoId)
      if (opts?.empresaSlug) fd.append('empresaSlug', opts.empresaSlug)
      return postMultipart<ArchivoSubido>('/api/upload', fd, 'archivo', 'No se pudo subir el archivo.')
    },
  })
}

// ============================================================
// Comprobantes de sueldo: mismo circuito (URL prefirmada → PUT directo →
// registrar), pero la fila va a recibos_sueldo y se cuelga del empleado.
// ============================================================
export interface ReciboSubido {
  id: string
  empleado_id: string
  periodo: string
  tipo: string
  nombre_archivo: string
  path: string
}

export async function subirRecibo(
  file: File,
  opts: { empleadoId: string; empresaSlug: string; periodo: string; tipo: string; notas?: string }
): Promise<ReciboSubido> {
  return subir(file, {
    firmar: (f) =>
      firmar({
        recurso: 'recibo',
        empleadoId: opts.empleadoId,
        empresaSlug: opts.empresaSlug,
        periodo: opts.periodo,
        tipo: opts.tipo,
        nombre: f.name,
        mimeType: f.type || 'application/octet-stream',
        sizeBytes: f.size,
      }),
    registrar: (f, path) =>
      postJson<ReciboSubido>(
        '/api/recibos',
        {
          empleadoId: opts.empleadoId,
          periodo: opts.periodo,
          tipo: opts.tipo,
          notas: opts.notas ?? '',
          path,
          nombre: f.name,
          mimeType: f.type || null,
          sizeBytes: f.size,
        },
        'recibo',
        'El archivo se subió pero no se pudo registrar.'
      ),
    multipart: (f) => {
      const fd = new FormData()
      fd.append('file', f)
      fd.append('empleadoId', opts.empleadoId)
      fd.append('empresaSlug', opts.empresaSlug)
      fd.append('periodo', opts.periodo)
      fd.append('tipo', opts.tipo)
      if (opts.notas) fd.append('notas', opts.notas)
      return postMultipart<ReciboSubido>('/api/recibos', fd, 'recibo', 'No se pudo cargar el comprobante.')
    },
  })
}

// ============================================================
// Documentación mensual por empresa: mismo circuito, fila en documentos_mensuales.
// ============================================================
export interface DocumentoSubido {
  id: string
  empresa_id: string
  periodo: string
  carpeta: string
  nombre_archivo: string
  path: string
  mime_type: string | null
  size_bytes: number | null
  notas: string | null
  origen: string
  clave_externa: string | null
  uploaded_by: string | null
  created_at: string
}

export async function subirDocumento(
  file: File,
  opts: { empresaId: string; periodo: string; carpeta: string; notas?: string }
): Promise<DocumentoSubido> {
  return subir(file, {
    firmar: (f) =>
      firmar({
        recurso: 'documento',
        empresaId: opts.empresaId,
        periodo: opts.periodo,
        carpeta: opts.carpeta,
        nombre: f.name,
        mimeType: f.type || 'application/octet-stream',
        sizeBytes: f.size,
      }),
    registrar: (f, path) =>
      postJson<DocumentoSubido>(
        '/api/documentos',
        {
          empresaId: opts.empresaId,
          periodo: opts.periodo,
          carpeta: opts.carpeta,
          notas: opts.notas ?? '',
          path,
          nombre: f.name,
          mimeType: f.type || null,
          sizeBytes: f.size,
        },
        'documento',
        `"${f.name}" se subió pero no se pudo registrar.`
      ),
    multipart: (f) => {
      const fd = new FormData()
      fd.append('file', f)
      fd.append('empresaId', opts.empresaId)
      fd.append('periodo', opts.periodo)
      fd.append('carpeta', opts.carpeta)
      if (opts.notas) fd.append('notas', opts.notas)
      return postMultipart<DocumentoSubido>('/api/documentos', fd, 'documento', `No se pudo cargar "${f.name}".`)
    },
  })
}
