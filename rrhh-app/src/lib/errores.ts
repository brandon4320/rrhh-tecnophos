// ============================================================
// Errores para mostrar a la gente: nunca el texto crudo de Postgres/Auth.
// `mensajeError(e)` traduce lo conocido y deja el detalle en la consola.
// `leer(res)` hace que una lectura fallida lance en vez de devolver vacío
// (una pantalla nunca debe decir "Todo al día" porque la consulta falló).
// ============================================================

type ErrorLike = { code?: string; message?: string; status?: number } | null | undefined

/** Mensaje claro en castellano para un error de Supabase, fetch o lo que venga. */
export function mensajeError(e: unknown, accion = 'hacer el cambio'): string {
  const err = (typeof e === 'object' && e !== null ? e : { message: String(e) }) as NonNullable<ErrorLike>
  const msg = err.message ?? ''
  if (typeof console !== 'undefined') console.error(e)

  if (err.code === '42501' || /row-level security|permission denied/i.test(msg)) return 'No tenés permiso para hacer esto.'
  if (err.code === '23505' || /duplicate key/i.test(msg)) return 'Eso ya existe.'
  if (err.code === '23503' || /foreign key/i.test(msg)) return 'Está vinculado a otros datos y no se puede cambiar así.'
  if (err.code === '23514' || /check constraint/i.test(msg)) return 'Algún dato no es válido.'
  if (err.code === '22P02' || /invalid input syntax/i.test(msg)) return 'Algún dato tiene un formato inválido.'
  if ((e instanceof DOMException && e.name === 'AbortError') || /aborted|timeout/i.test(msg)) return 'Tardó demasiado. Revisá la conexión y probá de nuevo.'
  if (/failed to fetch|networkerror|load failed|network request failed/i.test(msg)) return 'Sin conexión. Revisá internet y probá de nuevo.'
  if (err.status === 401 || /jwt|not authenticated|session/i.test(msg)) return 'Tu sesión venció. Volvé a entrar.'
  return `No se pudo ${accion}. Probá de nuevo y, si sigue, avisá al administrador.`
}

/** Para lecturas del server: devuelve `data` o lanza (lo atrapa el error.tsx más cercano). */
export function leer<T>(res: { data: T | null; error: ErrorLike }): T {
  if (res.error) throw new Error(res.error.message ?? 'Error al leer la base de datos')
  return res.data as T
}
