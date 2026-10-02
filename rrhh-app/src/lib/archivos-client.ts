// ============================================================
// Acciones sobre adjuntos de certificados desde el navegador, con el
// feedback incluido (toast). Las usan el legajo, las habilitaciones, los
// vehículos y los activos: antes cada pantalla tenía su copia y varias
// fallaban en silencio ("ver" y "borrar" no decían nada si salía mal).
// ============================================================
import { toast } from 'sonner'
import { mensajeError } from './errores'
import { subirArchivo, type ArchivoSubido } from './upload-client'

/** Pide la URL firmada (valida RLS) y abre el archivo en otra pestaña. */
export async function abrirArchivo(path: string): Promise<void> {
  try {
    const res = await fetch(`/api/archivo?path=${encodeURIComponent(path)}`)
    if (!res.ok) {
      toast.error(
        res.status === 403
          ? 'No se pudo abrir: el archivo ya no existe o no tenés permiso para verlo.'
          : 'No se pudo abrir el archivo.'
      )
      return
    }
    const { url } = await res.json()
    if (!url) {
      toast.error('No se pudo abrir el archivo.')
      return
    }
    const ventana = window.open(url, '_blank')
    if (!ventana) {
      toast.error('El navegador bloqueó la pestaña nueva. Permití las ventanas emergentes para este sitio.')
      return
    }
    ventana.opener = null
  } catch (e) {
    toast.error(mensajeError(e, 'abrir el archivo'))
  }
}

/** Borra un adjunto (fila primero, R2 después: lo decide /api/archivo). true si se borró. */
export async function borrarArchivo(id: string): Promise<boolean> {
  try {
    const res = await fetch(`/api/archivo?id=${encodeURIComponent(id)}`, { method: 'DELETE' })
    if (!res.ok) {
      toast.error(
        res.status === 404
          ? 'No se pudo eliminar: el archivo ya no existe o no tenés permiso.'
          : 'No se pudo eliminar el archivo.'
      )
      return false
    }
    toast.success('Archivo eliminado')
    return true
  } catch (e) {
    toast.error(mensajeError(e, 'eliminar el archivo'))
    return false
  }
}

/**
 * Sube uno o varios archivos a un certificado, de a uno. Cada archivo que
 * entra se informa con `alSubir` (para el estado local); los que fallan,
 * con un toast propio. Devuelve cuántos se subieron.
 */
export async function subirArchivosACertificado(
  archivos: File[],
  certId: string,
  opts: { empleadoId?: string; empresaSlug?: string },
  alSubir: (archivo: ArchivoSubido) => void
): Promise<number> {
  let ok = 0
  for (const file of archivos) {
    try {
      alSubir(await subirArchivo(file, certId, opts))
      ok++
    } catch (e) {
      // Los Error propios traen un texto ya pensado para la gente (los arma upload-client
      // o la API); un TypeError es la red ("Failed to fetch") y se traduce.
      toast.error(
        e instanceof Error && !(e instanceof TypeError) && e.message
          ? e.message
          : mensajeError(e, `subir "${file.name}"`)
      )
    }
  }
  if (ok > 0) toast.success(ok === 1 ? 'Archivo subido' : `${ok} archivos subidos`)
  return ok
}
