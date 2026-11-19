import { createClient } from '@/lib/supabase/server'
import { getSesion } from '@/lib/auth/session'
import { getEstadoVencimiento, diasHastaVencimiento, type EstadoVencimiento } from '@/types'
import { tieneRol, LEGAJO_ESCRITURA } from '@/lib/auth/roles'
import { leer } from '@/lib/errores'
import { slugsDe } from '@/lib/empresas-vistas'
import EmpleadosClient, { type FilaEmpleado } from './EmpleadosClient'
import { cargarLegajo } from '../legajo/[id]/datos'
import type { MovimientoEpp } from '../legajo/[id]/EppEntregado'

function peorEstado(certs: { fecha_vencimiento?: string | null; alerta_dias?: number | null }[]): EstadoVencimiento {
  const estados = certs.map((c) => getEstadoVencimiento(c.fecha_vencimiento, c.alerta_dias))
  if (estados.includes('vencido')) return 'vencido'
  if (estados.includes('proximo')) return 'proximo'
  if (estados.includes('vigente')) return 'vigente'
  return 'sin_fecha'
}

/**
 * Lista de empleados. El filtro por empresa es del server (?empresa=slug o varias separadas
 * por coma, lo que se tilda en el selector del menú); la búsqueda, el "Dados de baja" y el teclado viven en el
 * client: buscar es instantáneo y por palabras en cualquier orden ("PEREZ JUAN"
 * encuentra a "Juan Pérez", que antes no aparecía porque se buscaba la frase
 * entera en nombre O apellido, y 59 empleados tienen todo en `nombre`).
 */
export default async function EmpleadosPage({
  searchParams,
}: {
  searchParams: Promise<{ empresa?: string; legajo?: string; cert?: string; renovar?: string; cargar?: string; nuevo?: string }>
}) {
  const { empresa, ...sp } = await searchParams
  const supabase = await createClient()

  // El filtro por empresa entra por el join (!inner sobre el slug), así la
  // query de empleados no espera a resolver el id → un solo batch paralelo.
  // Sin filtro se mantiene el left join (hay empleados con empresa_id null).
  // Se traen también los dados de baja (pocos): el client los muestra aparte.
  const slugs = slugsDe(empresa)
  const query = slugs.length
    ? supabase
        .from('empleados')
        .select(`
          id, nombre, apellido, sector, activo,
          empresa:empresas!inner(id, nombre, slug),
          certificados(fecha_vencimiento, alerta_dias, tipo_nombre_custom, tipo:tipos_certificado(nombre))
        `)
        .in('empresa.slug', slugs)
        .order('nombre')
    : supabase
        .from('empleados')
        .select(`
          id, nombre, apellido, sector, activo,
          empresa:empresas(id, nombre, slug),
          certificados(fecha_vencimiento, alerta_dias, tipo_nombre_custom, tipo:tipos_certificado(nombre))
        `)
        .order('nombre')

  // ?legajo=<id>: el legajo se abre en la hoja lateral (las mismas consultas de /legajo/[id]).
  const [{ data: empresas }, sesion, empleadosRes, legajo] = await Promise.all([
    supabase.from('empresas').select('id, nombre, slug').order('nombre'),
    getSesion(),
    query,
    sp.legajo ? cargarLegajo(supabase, sp.legajo) : Promise.resolve(null),
  ])

  // Una lectura fallida tiene que verse como error, no como "No se encontraron empleados".
  const empleados = leer(empleadosRes) ?? []
  const elegidas = (empresas ?? []).filter((e) => slugs.includes(e.slug))
  // Con una sola empresa, "Nuevo empleado" ya la trae elegida.
  const empresaSel = elegidas.length === 1 ? elegidas[0] : undefined
  const alcance = elegidas.length && elegidas.length < (empresas ?? []).length
    ? elegidas.map((e) => e.nombre).join(', ')
    : 'todas las empresas'

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
      empresaSlug: emp.empresa?.slug ?? null,
      // Un punto por certificado (hasta 8) y el próximo vencimiento: lo nuevo de la demo aprobada.
      puntos: certs.slice(0, 8).map((c) => getEstadoVencimiento(c.fecha_vencimiento, c.alerta_dias)),
      proximo: (() => {
        const c = certs.filter((x) => x.fecha_vencimiento).sort((a, b) => (a.fecha_vencimiento! < b.fecha_vencimiento! ? -1 : 1))[0]
        if (!c) return null
        const tipo = (Array.isArray(c.tipo) ? c.tipo[0] : c.tipo)?.nombre ?? c.tipo_nombre_custom ?? 'Certificado'
        return { tipo, fecha: c.fecha_vencimiento!.slice(0, 10), dias: diasHastaVencimiento(c.fecha_vencimiento!), alerta: c.alerta_dias ?? 30 }
      })(),
    }
  })

  // Curva del protagonista: certificados de personas activas que vencen en cada una de las
  // próximas 9 semanas, y cuántas personas tienen algo que vence esta semana.
  const activosCerts = empleados.filter((e) => e.activo !== false).flatMap((e) => (e.certificados ?? []).map((c) => ({ e: e.id, c })))
  const curva = Array.from({ length: 9 }, (_, w) =>
    activosCerts.filter(({ c }) => c.fecha_vencimiento && diasHastaVencimiento(c.fecha_vencimiento) >= w * 7 && diasHastaVencimiento(c.fecha_vencimiento) < w * 7 + 7).length
  )
  const semana = new Set(activosCerts.filter(({ c }) => c.fecha_vencimiento && diasHastaVencimiento(c.fecha_vencimiento) >= 0 && diasHastaVencimiento(c.fecha_vencimiento) <= 7).map(({ e }) => e)).size
  const certsVencidos = activosCerts.filter(({ c }) => getEstadoVencimiento(c.fecha_vencimiento, c.alerta_dias) === 'vencido').length
  const sectores = [...new Map(filas.map((f) => f.sector?.trim() ?? '').filter(Boolean).map((x) => [x.toLowerCase(), x] as const)).values()].sort((a, b) => a.localeCompare(b, 'es'))
  const legajoVisible = legajo?.empleado ? legajo : null
  const certInicial = legajoVisible && sp.cert && (legajoVisible.certificados ?? []).some((c) => c.id === sp.cert) ? sp.cert : null

  return (
    <EmpleadosClient
      filas={filas}
      empresaSel={empresaSel ?? null}
      alcance={alcance}
      puedeEditar={tieneRol(sesion?.rol ?? null, LEGAJO_ESCRITURA)}
      resumen={{ curva, semana, certsVencidos }}
      empresas={empresas ?? []}
      sectores={sectores}
      nombreEmpresas={elegidas.length === 1 ? elegidas[0].nombre : `${(elegidas.length || (empresas ?? []).length)} empresas`}
      abrirAlta={sp.nuevo === '1'}
      legajo={legajoVisible ? {
        key: `${legajoVisible.empleado!.id}-${certInicial ?? ''}`,
        certInicial,
        renovar: sp.renovar === '1',
        cargar: sp.cargar === '1',
        empleado: legajoVisible.empleado!,
        certificados: legajoVisible.certificados ?? [],
        tiposCertificado: legajoVisible.tiposCert ?? [],
        empresas: legajoVisible.empresas ?? [],
        recibos: legajoVisible.recibos ?? [],
        veRecibos: legajoVisible.sesion?.veRecibos === true,
        epp: (legajoVisible.epp ?? []) as MovimientoEpp[],
        isAdmin: legajoVisible.sesion?.rol === 'admin',
        canEdit: tieneRol(legajoVisible.sesion?.rol ?? null, LEGAJO_ESCRITURA),
      } : null}
    />
  )
}
