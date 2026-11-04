// ============================================================
// Qué hacer con una liquidación que entra: ¿es nueva, ya estaba, o es la
// corrección de una que ya se había emitido? Puro, sin I/O, con tests.
//
// Decisión de Agustín (04/11/2026): cuando se corrige una liquidación, a la
// persona se le manda el link de nuevo avisándole que cambió y pidiéndole que
// vuelva a firmar. Para eso hay que poder DISTINGUIR una corrección de una
// segunda liquidación del mes, que es una cosa completamente distinta:
//
//   · liquidación más  → se suma, la persona tiene DOS cosas para firmar
//   · corrección       → la vieja deja de valer, hay UNA sola para firmar
//
// Lo que las separa es el número de recibo impreso: mismo número y distinto
// contenido es una corrección.
// ============================================================

/** Un recibo ya cargado de esa persona, como lo necesita esta decisión. */
export interface ReciboExistente {
  id: string
  origen_hash: string | null
  recibo_numero: string | null
  estado: string
}

export type AccionCarga =
  /** Ese mismo PDF ya está cargado: no se hace nada ni se manda nada. */
  | { accion: 'ya_estaba'; id: string }
  /** No existe: se carga y se avisa. */
  | { accion: 'nueva' }
  /** Reemplaza a una ya emitida: se anulan las viejas y se pide firmar de nuevo. */
  | { accion: 'correccion'; anula: string[]; habiaFirma: boolean }

/**
 * Qué hacer con el documento que entra.
 *
 * El hash del archivo manda sobre todo lo demás: si ese PDF exacto ya está
 * cargado, no pasó nada: ni se duplica ni se vuelve a molestar a nadie. Es lo
 * que hace que volver a correr el proceso sea inofensivo.
 */
export function decidirCarga(
  entra: { hash: string | null; reciboNumero: string | null },
  existentes: readonly ReciboExistente[]
): AccionCarga {
  const hash = (entra.hash ?? '').trim()
  if (hash) {
    const igual = existentes.find((r) => r.origen_hash === hash)
    if (igual) return { accion: 'ya_estaba', id: igual.id }
  }

  const numero = (entra.reciboNumero ?? '').trim()
  if (!numero) return { accion: 'nueva' }

  // Sin número de recibo del lado guardado no hay con qué comparar: los
  // recibos cargados a mano desde el legajo no lo tienen, y pisarlos sería
  // anular algo que nadie dijo que estuviera mal.
  const mismas = existentes.filter(
    (r) => (r.recibo_numero ?? '').trim() === numero && r.estado !== 'anulado'
  )
  if (!mismas.length) return { accion: 'nueva' }

  return {
    accion: 'correccion',
    anula: mismas.map((r) => r.id),
    // Si ya la había firmado, el mail no puede decir "firmá esto": tiene que
    // decir que lo que firmó cambió.
    habiaFirma: mismas.some((r) => r.estado === 'firmado'),
  }
}

/**
 * El tipo de mail que corresponde según lo que entró.
 *
 * Se separan a propósito: "te cargamos algo más" no es lo mismo que "lo que ya
 * firmaste cambió", y el registro tiene que poder distinguirlos después.
 */
export function tipoDeMail(
  hayCorreccion: boolean,
  dentroDeLaVentana: boolean
): 'aviso' | 'adicional' | 'correccion' {
  if (hayCorreccion) return 'correccion'
  return dentroDeLaVentana ? 'aviso' : 'adicional'
}
