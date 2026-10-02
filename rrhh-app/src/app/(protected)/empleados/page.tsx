import { createClient } from '@/lib/supabase/server'
import { getSesion } from '@/lib/auth/session'
import { getEstadoVencimiento, type EstadoVencimiento } from '@/types'
import { tieneRol, LEGAJO_ESCRITURA } from '@/lib/auth/roles'
import { leer } from '@/lib/errores'
import EmpleadosClient, { type FilaEmpleado } from './EmpleadosClient'

function peorEstado(certs: { fecha_vencimiento?: string | null; alerta_dias?: number | null }[]): EstadoVencimiento {
  const estados = certs.map((c) => getEstadoVencimiento(c.fecha_vencimiento, c.alerta_dias))
  if (estados.includes('vencido')) return 'vencido'
  if (estados.includes('proximo')) return 'proximo'
  if (estados.includes('vigente')) return 'vigente'
  return 'sin_fecha'
}

/**
 * Lista de empleados. El filtro por empresa es del server (?empresa=slug, como
 * en toda la sidebar); la búsqueda, el "Dados de baja" y el teclado viven en el
 * client: buscar es instantáneo y por palabras en cualquier orden ("PEREZ JUAN"
 * encuentra a "Juan Pérez", que antes no aparecía porque se buscaba la frase
 * entera en nombre O apellido, y 59 empleados tienen todo en `nombre`).
 */
export default async function EmpleadosPage({
  searchParams,
}: {
  searchParams: Promise<{ empresa?: string }>
}) {
  const { empresa } = await searchParams
  const supabase = await createClient()

  // El filtro por empresa entra por el join (!inner sobre el slug), así la
  // query de empleados no espera a resolver el id → un solo batch paralelo.
  // Sin filtro se mantiene el left join (hay empleados con empresa_id null).
  // Se traen también los dados de baja (pocos): el client los muestra aparte.
  const query = empresa
    ? supabase
        .from('empleados')
        .select(`
          id, nombre, apellido, sector, activo,
          empresa:empresas!inner(id, nombre, slug),
          certificados(fecha_vencimiento, alerta_dias)
        `)
        .eq('empresa.slug', empresa)
        .order('nombre')
    : supabase
        .from('empleados')
        .select(`
          id, nombre, apellido, sector, activo,
          empresa:empresas(id, nombre, slug),
          certificados(fecha_vencimiento, alerta_dias)
        `)
        .order('nombre')

  const [{ data: empresas }, sesion, empleadosRes] = await Promise.all([
    supabase.from('empresas').select('id, nombre, slug').order('nombre'),
    getSesion(),
    query,
  ])

  // Una lectura fallida tiene que verse como error, no como "No se encontraron empleados".
  const empleados = leer(empleadosRes) ?? []
  const empresaSel = empresa ? (empresas ?? []).find((e) => e.slug === empresa) : undefined

  const filas: FilaEmpleado[] = empleados.map((emp) => {
    const certs = emp.certificados ?? []
    return {
      id: emp.id,
      nombre: emp.nombre,
      apellido: emp.apellido,
      nombreCompleto: [emp.nombre, emp.apellido].filter(Boolean).join(' '),
      sector: emp.sector,
      empresaNombre: emp.empresa?.nombre ?? null,
      activo: emp.activo !== false,
      certificados: certs.length,
      estado: peorEstado(certs),
    }
  })

  return (
    <EmpleadosClient
      filas={filas}
      empresas={empresas ?? []}
      empresaSel={empresaSel ?? null}
      puedeEditar={tieneRol(sesion?.rol ?? null, LEGAJO_ESCRITURA)}
    />
  )
}
