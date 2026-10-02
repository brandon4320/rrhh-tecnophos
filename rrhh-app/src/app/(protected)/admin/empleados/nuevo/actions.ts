'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requireRol } from '@/lib/auth/session'
import { LEGAJO_ESCRITURA } from '@/lib/auth/roles'
import { mensajeError } from '@/lib/errores'
import { buscarDuplicado } from '@/lib/empleados'
import type { EstadoAlta } from './estado'

export async function crearEmpleado(prev: EstadoAlta, formData: FormData): Promise<EstadoAlta> {
  await requireRol(LEGAJO_ESCRITURA)

  const valores = {
    nombre: String(formData.get('nombre') ?? '').trim(),
    apellido: String(formData.get('apellido') ?? '').trim(),
    empresa_id: String(formData.get('empresa_id') ?? '').trim(),
    sector: String(formData.get('sector') ?? '').trim(),
  }
  const forzar = formData.get('forzar') === '1'
  const intento = prev.intento + 1

  if (!valores.nombre || !valores.empresa_id) {
    return { intento, valores, error: 'Completá al menos el nombre y la empresa.' }
  }

  const supabase = await createClient()

  // Duplicados: misma empresa, activos Y dados de baja, comparando el nombre sin
  // mayúsculas/acentos/orden (antes era igualdad exacta y solo activos, así que
  // "PEREZ JUAN" y "Juan Pérez" pasaban como dos personas).
  if (!forzar) {
    const { data: existentes, error: errDup } = await supabase
      .from('empleados')
      .select('id, nombre, apellido, activo')
      .eq('empresa_id', valores.empresa_id)
    if (errDup) return { intento, valores, error: mensajeError(errDup, 'verificar si el empleado ya existe') }
    const dup = buscarDuplicado(existentes ?? [], valores.nombre, valores.apellido)
    if (dup) {
      const nombreCompleto = [dup.nombre, dup.apellido].filter(Boolean).join(' ')
      return {
        intento,
        valores,
        error: dup.activo === false
          ? `${nombreCompleto} ya tiene legajo en esta empresa y está dado de baja.`
          : `Ya hay un empleado llamado ${nombreCompleto} en esta empresa.`,
        duplicado: { id: dup.id, nombreCompleto, activo: dup.activo !== false },
      }
    }
  }

  const { data, error } = await supabase
    .from('empleados')
    .insert({
      nombre: valores.nombre,
      apellido: valores.apellido || null,
      empresa_id: valores.empresa_id,
      sector: valores.sector || null,
      activo: true,
    })
    .select('id')
    .single()

  if (error || !data) {
    return { intento, valores, error: mensajeError(error, 'guardar el empleado') }
  }

  // Invalida el cache del router en el cliente: la lista de empleados ya lo muestra.
  revalidatePath('/empleados')
  // Directo al legajo nuevo con el formulario de certificado abierto.
  redirect(`/legajo/${data.id}?nuevo=1`)
}
