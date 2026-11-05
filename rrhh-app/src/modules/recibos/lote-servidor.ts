// ============================================================
// Lado servidor de la carga por lote. Corre con SERVICE ROLE después de
// validar el token de la integración, igual que /api/externo/comercial/*.
//
// Acá vive la parte que necesita la base: la nómina contra la que se decide de
// quién es cada liquidación, qué recibos ya están cargados y el registro de la
// corrida. La DECISIÓN en sí es pura y vive en lote.ts y carga.ts.
//
// El lector del NAS no sabe de quién es nada: manda lo que leyó y Gestión
// resuelve. Es a propósito — la nómina está acá y no en la PC de la oficina.
// ============================================================
import 'server-only'
import type { createAdminClient } from '@/lib/supabase/admin'
import { traerTodo } from '@/lib/paginar'
import type { Json } from '@/types/database'
import type { ReciboExistente } from './carga'
import type { EmpleadoPadron } from './lote'

export type Admin = ReturnType<typeof createAdminClient>

export interface EmpleadoDeLaBase extends EmpleadoPadron {
  activo: boolean
}

/** La fila tal como viene: `activo` es nullable en la tabla. */
type FilaEmpleado = Omit<EmpleadoDeLaBase, 'activo'> & { activo: boolean | null }

/**
 * Todos los que liquidan en esa base, con legajo cargado.
 *
 * NO se filtra por activo: la liquidación final es justo la de alguien que ya
 * no trabaja y también la tiene que firmar. El `activo` viene al lado para
 * poder contar aparte a quién se ESPERA todos los meses.
 */
export async function padronDeBase(admin: Admin, base: string): Promise<EmpleadoDeLaBase[]> {
  const { data, error } = await traerTodo<FilaEmpleado>((desde, hasta) =>
    admin
      .from('empleados')
      .select('id, nombre, apellido, cuil, email, base_sueldos, legajo, activo')
      .eq('base_sueldos', base)
      .not('legajo', 'is', null)
      .order('legajo', { ascending: true })
      .range(desde, hasta)
  )
  if (error) throw new Error(`no se pudo leer la nómina: ${error.message}`)
  return (data ?? []).map((e) => ({ ...e, activo: e.activo !== false }))
}

/**
 * Los recibos que ya tiene cada una de esas personas, para saber si lo que
 * entra es nuevo, ya estaba o es una corrección.
 *
 * Se piden los del período Y los de cualquier otro: una corrección puede
 * llegar meses después y el número de recibo es lo que la identifica.
 */
export async function recibosPorEmpleado(
  admin: Admin,
  empleadoIds: readonly string[]
): Promise<Map<string, ReciboExistente[]>> {
  const mapa = new Map<string, ReciboExistente[]>()
  if (!empleadoIds.length) return mapa

  // `in` con muchos ids arma una URL enorme: se va de a tandas.
  const TANDA = 200
  for (let i = 0; i < empleadoIds.length; i += TANDA) {
    const tanda = empleadoIds.slice(i, i + TANDA)
    const { data, error } = await traerTodo<ReciboExistente & { empleado_id: string }>((desde, hasta) =>
      admin
        .from('recibos_sueldo')
        .select('id, empleado_id, origen_hash, recibo_numero, estado, origen_at')
        .in('empleado_id', tanda)
        .order('id', { ascending: true })
        .range(desde, hasta)
    )
    if (error) throw new Error(`no se pudieron leer los recibos: ${error.message}`)
    for (const r of data ?? []) {
      const lista = mapa.get(r.empleado_id)
      if (lista) lista.push(r)
      else mapa.set(r.empleado_id, [r])
    }
  }
  return mapa
}

export interface DatosCarga {
  base: string
  carpeta: string
  pdfEncontrados: number
  recibosNuevos: number
  yaEstaban: number
  errores: number
  esperados: number
  detalle: Json
}

/**
 * Deja constancia de la corrida, haya pasado algo o no.
 *
 * ★ Se registra SIEMPRE, incluso cuando no hubo nada nuevo. Eso es lo que
 * convierte el silencio en alarma: si la última corrida es de hace tres días,
 * la PC de la oficina está apagada o el proceso se rompió, y hay que avisar.
 * Sin esta fila, "no llegó nada" y "no pasó nada" se ven igual.
 */
export async function registrarCarga(admin: Admin, d: DatosCarga): Promise<string | null> {
  const { data, error } = await admin
    .from('recibo_cargas')
    .insert({
      origen: 'automatico',
      base: d.base,
      carpeta: d.carpeta,
      fin_at: new Date().toISOString(),
      pdf_encontrados: d.pdfEncontrados,
      recibos_nuevos: d.recibosNuevos,
      ya_estaban: d.yaEstaban,
      errores: d.errores,
      esperados: d.esperados,
      detalle: d.detalle,
    })
    .select('id')
    .single()
  // Que no se pueda registrar la corrida NO invalida lo que se decidió: se
  // avisa y se sigue, igual que la auditoría de la migración 28.
  if (error) {
    console.error('[recibos/lote] no se pudo registrar la carga:', error.message)
    return null
  }
  return data?.id ?? null
}

// ============================================================
// Lado base de la SUBIDA del PDF aprobado (fase 2).
//
// El orden de las operaciones está pensado: ver el comentario de la ruta
// /api/externo/recibos/archivo.
// ============================================================

/** El recibo ya cargado, con lo que hace falta para decidir Y para numerarlo. */
export interface ReciboDelEmpleado extends ReciboExistente {
  periodo: string
  tipo: string
  secuencia: number
}

/** Todos los recibos de una persona. Son pocos: no hace falta paginar por período. */
export async function recibosDeEmpleado(
  admin: Admin,
  empleadoId: string
): Promise<ReciboDelEmpleado[]> {
  const { data, error } = await traerTodo<ReciboDelEmpleado>((desde, hasta) =>
    admin
      .from('recibos_sueldo')
      .select('id, origen_hash, recibo_numero, estado, origen_at, periodo, tipo, secuencia')
      .eq('empleado_id', empleadoId)
      .order('id', { ascending: true })
      .range(desde, hasta)
  )
  if (error) throw new Error(`no se pudieron leer los recibos: ${error.message}`)
  return data ?? []
}

/**
 * La empresa del empleado, para saber en qué carpeta de R2 va el archivo.
 *
 * Devuelve null si el empleado no existe: el vale puede ser de una corrida
 * vieja y la persona pudo haberse borrado desde entonces.
 */
export async function empresaDeEmpleado(admin: Admin, empleadoId: string): Promise<string | null> {
  const { data, error } = await admin
    .from('empleados')
    .select('id, empresa:empresas(slug)')
    .eq('id', empleadoId)
    .maybeSingle()
  if (error) throw new Error(`no se pudo leer el empleado: ${error.message}`)
  if (!data) return null
  const emp = Array.isArray(data.empresa) ? data.empresa[0] : data.empresa
  return (emp as { slug?: string } | null)?.slug ?? null
}

/** El detalle de una corrida, que es donde vive el vale. */
export async function detalleDeCarga(admin: Admin, cargaId: string): Promise<Json | null> {
  const { data, error } = await admin
    .from('recibo_cargas')
    .select('detalle')
    .eq('id', cargaId)
    .maybeSingle()
  if (error) throw new Error(`no se pudo leer la corrida: ${error.message}`)
  return (data?.detalle ?? null) as Json | null
}

export interface FilaRecibo {
  empleadoId: string
  periodo: string
  tipo: string
  secuencia: number
  nombreArchivo: string
  path: string
  sizeBytes: number
  reciboNumero: string | null
  origenArchivo: string | null
  origenHash: string | null
  origenAt: string | null
  notas: string | null
}

/** Código de unique_violation de Postgres. */
export const CHOQUE_UNICO = '23505'

export interface ResultadoInsert {
  id: string | null
  /** Qué índice chocó, si chocó: 'secuencia' | 'hash' | null. */
  choque: 'secuencia' | 'hash' | null
  error: string | null
}

/**
 * Inserta el recibo. Distingue los dos choques posibles porque significan
 * cosas distintas:
 *
 *  · secuencia → otro proceso numeró primero. Se reintenta con el número que
 *    sigue y listo.
 *  · hash → ese mismo PDF ya está cargado. No es un error: alguien lo subió
 *    entre que se decidió y se subió. Se trata como "ya estaba".
 */
export async function insertarRecibo(admin: Admin, f: FilaRecibo): Promise<ResultadoInsert> {
  const { data, error } = await admin
    .from('recibos_sueldo')
    .insert({
      empleado_id: f.empleadoId,
      periodo: f.periodo,
      tipo: f.tipo,
      secuencia: f.secuencia,
      nombre_archivo: f.nombreArchivo,
      path: f.path,
      mime_type: 'application/pdf',
      size_bytes: f.sizeBytes,
      recibo_numero: f.reciboNumero,
      origen: 'automatico',
      origen_archivo: f.origenArchivo,
      origen_hash: f.origenHash,
      origen_at: f.origenAt,
      notas: f.notas,
      estado: 'pendiente',
    })
    .select('id')
    .single()

  if (!error) return { id: data?.id ?? null, choque: null, error: null }
  if (error.code === CHOQUE_UNICO) {
    if (/recibos_origen_hash_idx/.test(error.message)) return { id: null, choque: 'hash', error: error.message }
    return { id: null, choque: 'secuencia', error: error.message }
  }
  return { id: null, choque: null, error: error.message }
}

/** El recibo que quedó sin efecto. El PDF y la firma que tuviera NO se borran. */
export async function anularRecibos(admin: Admin, ids: readonly string[]): Promise<void> {
  if (!ids.length) return
  const { error } = await admin
    .from('recibos_sueldo')
    .update({ estado: 'anulado' })
    .in('id', [...ids])
  if (error) throw new Error(`no se pudieron anular los recibos reemplazados: ${error.message}`)
}
