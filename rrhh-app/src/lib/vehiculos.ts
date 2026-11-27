// ============================================================
// Reglas puras de vehículos (sin I/O).
//
// Existen por un caso real: el 20/11/2026 se cargó la AG493RP en Tecnophos
// Rosario sin saber que ya estaba en ADC desde marzo. El alta solo miraba las
// patentes de SU empresa —y además es lo único que la RLS deja ver a quien
// tiene una sola empresa asignada—, así que el duplicado entró sin un aviso.
// Quien maneja siguió usando el QR viejo y los checklists entraban en la fila
// equivocada durante una semana.
// ============================================================

/**
 * Patente comparable: sin espacios, guiones ni puntos, en mayúsculas.
 * "ad 113-uy" y "AD113UY" son la misma chapa.
 */
export function normalizarPatente(v: string | null | undefined): string {
  return (v ?? '').replace(/[\s.-]/g, '').toUpperCase()
}

export interface DuplicadoPatente {
  empresa: string
  activo: boolean
}

/**
 * Aviso para el alta. Devuelve null si no hay nada que decir.
 *
 * No bloquea: dos empresas del grupo PUEDEN tener chapas distintas que se
 * escriben parecido, y la persona que carga sabe más que el sistema. Lo que no
 * puede pasar es que no se entere.
 */
export function avisoPatenteDuplicada(dups: DuplicadoPatente[]): string | null {
  if (!dups.length) return null
  const activos = dups.filter((d) => d.activo)
  const lista = (ds: DuplicadoPatente[]) =>
    ds.length === 1
      ? ds[0]!.empresa
      : `${ds.slice(0, -1).map((d) => d.empresa).join(', ')} y ${ds.at(-1)!.empresa}`

  if (activos.length) {
    return `Esa patente ya está cargada en ${lista(activos)}. Si es la misma camioneta, cargarla de nuevo parte el historial en dos y el QR que está pegado adentro va a seguir apuntando a la otra.`
  }
  return `Esa patente existió en ${lista(dups)} y está dada de baja.`
}
