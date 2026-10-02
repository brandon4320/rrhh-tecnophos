// ============================================================
// PostgREST corta cada respuesta en 1000 filas SIN avisar: una consulta
// que crece pasa a devolver datos incompletos que parecen completos.
// `traerTodo` pide de a páginas con .range() hasta que una vuelve corta.
// `pagina(desde, hasta)` tiene que ARMAR una consulta nueva en cada llamada
// (los query builders de supabase-js no se reutilizan) y con un orden
// estable (si no, las páginas pueden repetir o saltear filas).
// ============================================================

export const TAMANIO_PAGINA = 1000

type Resultado<T> = { data: T[] | null; error: { message: string } | null }

export async function traerTodo<T>(
  pagina: (desde: number, hasta: number) => PromiseLike<Resultado<T>>,
  tamanio = TAMANIO_PAGINA
): Promise<{ data: T[]; error: null } | { data: null; error: { message: string } }> {
  const out: T[] = []
  for (let desde = 0; ; desde += tamanio) {
    const { data, error } = await pagina(desde, desde + tamanio - 1)
    if (error) return { data: null, error }
    out.push(...(data ?? []))
    if (!data || data.length < tamanio) return { data: out, error: null }
  }
}
