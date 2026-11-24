// ============================================================
// El envío del mail de onboarding: a quién le toca y cómo se registra.
//
// Dos clientes distintos, a propósito:
//
//   · LEER la lista va con el cliente de SESIÓN. Las policies de la migración
//     31 ya exigen `ve_recibos` y recortan por `empresa_acceso`, así que la
//     pantalla no necesita un guard propio que pueda quedar desfasado: si la
//     RLS no deja ver a alguien, no aparece y punto.
//   · ESCRIBIR va con el cliente ADMIN, porque `recibo_mails` y
//     `recibo_tokens` no tienen policies de escritura para nadie. Por eso la
//     ruta chequea `sesion.veRecibos` a mano ANTES de tocar el admin.
// ============================================================
import type { SupabaseClient } from '@supabase/supabase-js'
import { traerTodo } from '@/lib/paginar'
import type { Admin } from './servidor'

/** De a cuántos mails por request. Ver el comentario de la ruta. */
export const TANDA = 10

export const TIPO_ONBOARDING = 'onboarding'

export interface Candidato {
  id: string
  nombre: string
  apellido: string | null
  empresa: string
  empresaSlug: string
  email: string | null
  tieneCuil: boolean
  tieneFirma: boolean
  /** Cuándo salió el onboarding (null = todavía no). */
  enviadoAt: string | null
  /** Último intento que falló y por qué, si nunca llegó a salir. */
  error: string | null
}

interface Empresa {
  slug: string
  nombre: string
}

interface FilaEmpleado {
  id: string
  nombre: string
  apellido: string | null
  email: string | null
  cuil: string | null
  // supabase-js tipa una relación embebida como ARRAY aunque `!inner` sobre una
  // FK devuelva un objeto. Se aceptan las dos formas y se normaliza, que es más
  // barato que castear a `any` y perder el chequeo de los nombres de columna.
  empresas: Empresa | Empresa[] | null
}

function empresaDe(v: FilaEmpleado['empresas']): Empresa | null {
  if (Array.isArray(v)) return v[0] ?? null
  return v ?? null
}

interface FilaMail {
  empleado_id: string
  estado: string
  error: string | null
  created_at: string
}

/**
 * Todos los empleados activos que la persona puede ver, con el estado de su
 * onboarding.
 *
 * No esconde a nadie: que se vea quién no tiene mail o no tiene CUIL es mejor
 * que dejarlo afuera de la lista, porque esos son justamente los que hay que
 * ir a completar. Quién está en condiciones de recibirlo lo decide
 * `puedeRecibir`.
 */
export async function candidatosOnboarding(
  supabase: SupabaseClient
): Promise<{ data: Candidato[]; error: null } | { data: null; error: { message: string } }> {
  const [empleados, firmas, mails] = await Promise.all([
    traerTodo<FilaEmpleado>((desde, hasta) =>
      supabase
        .from('empleados')
        .select('id, nombre, apellido, email, cuil, empresas!inner(slug, nombre)')
        .eq('activo', true)
        .order('apellido', { ascending: true })
        .order('nombre', { ascending: true })
        .order('id', { ascending: true })
        .range(desde, hasta)
    ),
    traerTodo<{ empleado_id: string }>((desde, hasta) =>
      supabase.from('firmas_empleado').select('empleado_id').order('empleado_id').range(desde, hasta)
    ),
    traerTodo<FilaMail>((desde, hasta) =>
      supabase
        .from('recibo_mails')
        .select('empleado_id, estado, error, created_at')
        .eq('tipo', TIPO_ONBOARDING)
        .order('created_at', { ascending: false })
        .order('empleado_id', { ascending: true })
        .range(desde, hasta)
    ),
  ])

  if (empleados.error) return { data: null, error: empleados.error }
  if (firmas.error) return { data: null, error: firmas.error }
  if (mails.error) return { data: null, error: mails.error }

  const conFirma = new Set(firmas.data.map((f) => f.empleado_id))
  // El PRIMERO de cada empleado es el más reciente (vienen ordenados desc).
  const enviado = new Map<string, string>()
  const fallo = new Map<string, string>()
  for (const m of mails.data) {
    if (m.estado === 'enviado') {
      if (!enviado.has(m.empleado_id)) enviado.set(m.empleado_id, m.created_at)
    } else if (!fallo.has(m.empleado_id)) {
      fallo.set(m.empleado_id, m.error ?? 'Falló sin detalle')
    }
  }

  return {
    data: empleados.data.map((e) => ({
      id: e.id,
      nombre: e.nombre,
      apellido: e.apellido,
      empresa: empresaDe(e.empresas)?.nombre ?? '',
      empresaSlug: empresaDe(e.empresas)?.slug ?? '',
      email: (e.email ?? '').trim() || null,
      tieneCuil: Boolean((e.cuil ?? '').trim()),
      tieneFirma: conFirma.has(e.id),
      enviadoAt: enviado.get(e.id) ?? null,
      // Un error viejo no se muestra si después salió bien.
      error: enviado.has(e.id) ? null : (fallo.get(e.id) ?? null),
    })),
    error: null,
  }
}

/**
 * ¿Se le puede mandar el onboarding?
 *
 * El CUIL hace falta aunque lo único que se mande sea un mail: sin CUIL
 * cargado la puerta de `/firma/<token>` no se puede abrir (pide sus últimos 4
 * y no hay con qué compararlos). Mandarle el link sería mandarle una puerta
 * trabada.
 */
export function puedeRecibir(c: Candidato): boolean {
  return Boolean(c.email) && c.tieneCuil && !c.enviadoAt
}

/** Los números de la pantalla. */
export function resumen(cs: Candidato[]) {
  return {
    total: cs.length,
    listos: cs.filter(puedeRecibir).length,
    enviados: cs.filter((c) => c.enviadoAt).length,
    firmaron: cs.filter((c) => c.tieneFirma).length,
    sinDatos: cs.filter((c) => !c.enviadoAt && (!c.email || !c.tieneCuil)).length,
    conError: cs.filter((c) => c.error).length,
  }
}

export type Reserva = { id: string } | { duplicado: true }

/**
 * Aparta el lugar del mail ANTES de mandarlo, aprovechando el índice único
 * `recibo_mails_uno_por_dia_onboarding`: si entran dos pedidos a la vez (o
 * alguien aprieta Enviar dos veces), el segundo choca contra el índice y no
 * manda nada.
 *
 * ⚠ El orden tiene una consecuencia que conviene dejar escrita: si el proceso
 * se muere JUSTO entre la reserva y el envío, queda una fila que dice
 * "enviado" sin que haya salido nada. Se eligió igual porque el daño está del
 * lado correcto —un mail de más es molesto, uno de menos es una persona que
 * nunca se entera— y porque el número que de verdad importa en la pantalla no
 * es "mails enviados" sino "firmas cargadas", que no se puede falsear: si
 * alguien figura con el mail mandado y sigue sin firma a los días, se le
 * manda de nuevo.
 */
export async function reservarMail(
  admin: Admin,
  datos: { empleadoId: string; destinatario: string; asunto: string; tokenId: string }
): Promise<Reserva> {
  const { data, error } = await admin
    .from('recibo_mails')
    .insert({
      empleado_id: datos.empleadoId,
      tipo: TIPO_ONBOARDING,
      destinatario: datos.destinatario,
      asunto: datos.asunto,
      token_id: datos.tokenId,
      estado: 'enviado',
    })
    .select('id')
    .single()

  // 23505 = chocó con el índice único: ya se le mandó hoy.
  if (error?.code === '23505') return { duplicado: true }
  if (error || !data) throw new Error(`no se pudo registrar el mail: ${error?.message ?? 'sin datos'}`)
  return { id: data.id }
}

/**
 * El envío falló: la fila pasa a 'error'. Como el índice único solo mira las
 * filas en 'enviado', esto además LIBERA el lugar y se puede reintentar hoy
 * mismo.
 */
export async function marcarMailError(admin: Admin, mailId: string, error: string): Promise<void> {
  const { error: e } = await admin
    .from('recibo_mails')
    .update({ estado: 'error', error: error.slice(0, 500) })
    .eq('id', mailId)
  if (e) console.error('[onboarding] no se pudo marcar el error del mail:', e.message)
}

/** Si el mail no salió, el link no queda vivo dando vueltas. */
export async function revocarToken(admin: Admin, tokenId: string): Promise<void> {
  const { error } = await admin.from('recibo_tokens').update({ revocado: true }).eq('id', tokenId)
  if (error) console.error('[onboarding] no se pudo revocar el token:', error.message)
}
