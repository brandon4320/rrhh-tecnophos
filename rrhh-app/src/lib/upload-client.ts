// ============================================================
// Subida de archivos desde el navegador.
// Flujo principal: URL prefirmada → PUT directo a R2 → registrar fila.
// (Vercel corta requests > 4.5MB con 413, por eso NO se pasa el archivo
// por /api/upload salvo como fallback para archivos chicos.)
// ============================================================

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

export async function subirArchivo(
  file: File,
  certId: string,
  opts?: { empleadoId?: string; empresaSlug?: string }
): Promise<ArchivoSubido> {
  // 1) Pedir URL prefirmada
  const urlRes = await fetch('/api/upload-url', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      certId,
      nombre: file.name,
      mimeType: file.type || 'application/octet-stream',
      empleadoId: opts?.empleadoId ?? '',
      empresaSlug: opts?.empresaSlug ?? 'docs',
    }),
  })
  if (!urlRes.ok) {
    const payload = await urlRes.json().catch(() => null)
    throw new Error(payload?.error ?? 'No se pudo preparar la subida.')
  }
  const { url, path } = await urlRes.json()

  // 2) PUT directo a R2 (sin límite de tamaño de Vercel)
  let putOk = false
  try {
    const putRes = await fetch(url, {
      method: 'PUT',
      body: file,
      headers: { 'Content-Type': file.type || 'application/octet-stream' },
    })
    putOk = putRes.ok
  } catch {
    putOk = false // p.ej. CORS no configurado / red
  }

  if (!putOk) {
    // Fallback legacy (multipart vía Vercel) — solo sirve para archivos chicos
    if (file.size > LIMITE_FALLBACK) {
      throw new Error(
        `El archivo pesa ${(file.size / 1048576).toFixed(1)}MB y la subida directa falló. Reintentá; si sigue fallando, avisá al administrador.`
      )
    }
    const fd = new FormData()
    fd.append('file', file)
    fd.append('certId', certId)
    if (opts?.empleadoId) fd.append('empleadoId', opts.empleadoId)
    if (opts?.empresaSlug) fd.append('empresaSlug', opts.empresaSlug)
    const res = await fetch('/api/upload', { method: 'POST', body: fd })
    const payload = await res.json().catch(() => null)
    if (!res.ok) throw new Error(payload?.error ?? 'No se pudo subir el archivo.')
    return payload.archivo as ArchivoSubido
  }

  // 3) Registrar la fila en la base (gated por RLS)
  const regRes = await fetch('/api/upload', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      certId,
      path,
      nombre: file.name,
      mimeType: file.type || null,
      sizeBytes: file.size,
    }),
  })
  const regPayload = await regRes.json().catch(() => null)
  if (!regRes.ok) throw new Error(regPayload?.error ?? 'El archivo se subió pero no se pudo registrar.')
  return regPayload.archivo as ArchivoSubido
}
