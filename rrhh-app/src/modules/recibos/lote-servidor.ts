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
