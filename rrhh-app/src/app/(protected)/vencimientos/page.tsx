import { createClient } from '@/lib/supabase/server'
import { getEstadoVencimiento, diasHastaVencimiento } from '@/types'
import { traerTodo } from '@/lib/paginar'
import {
  ALERTA_DIAS_MAX, VENTANA_ALERTA_HABITUAL, empresaDeCertificado, fechaMasDias, hrefCertificado, titularCertificado,
  unirPorId,
} from '@/lib/vencimientos'
import VencimientosClient, { type FilaVencimiento, type VistaVencimientos } from './VencimientosClient'

const VISTAS: VistaVencimientos[] = ['pendientes', 'vencido', 'proximo', 'vigente', 'todos']

// Columnas explícitas (antes select('*') + relaciones enteras). `archivos(count)`
// alcanza para marcar los certificados que no tienen el archivo cargado.
const CERT_COLUMNAS = `
  id, fecha_vencimiento, alerta_dias, tipo_nombre_custom,
  tipo:tipos_certificado(id, nombre),
  empleado:empleados(id, nombre, apellido, activo, empresa:empresas(nombre, slug)),
  vehiculo:vehiculos(id, patente, empresa:empresas(nombre, slug)),
  equipo:equipos(id, nombre, empresa:empresas(nombre, slug)),
  empresa:empresas(nombre, slug),
  archivos(count)
`

export default async function VencimientosPage({
  searchParams,
}: {
  searchParams: Promise<{ empresa?: string; tipo?: string; estado?: string }>
}) {
  const { empresa, tipo, estado } = await searchParams
  const supabase = await createClient()

  // Vista por defecto: lo PENDIENTE (vencido + por vencer). "Todos" es explícito.
  const vista: VistaVencimientos = VISTAS.includes(estado as VistaVencimientos) ? (estado as VistaVencimientos) : 'pendientes'
  // Vigentes y Todos necesitan la tabla entera; las otras tres, solo lo que vence pronto.
  const necesitaTodo = vista === 'vigente' || vista === 'todos'
  const tipoUuid = tipo && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(tipo) ? tipo : null

  const base = () => {
    const q = supabase.from('certificados').select(CERT_COLUMNAS).not('fecha_vencimiento', 'is', null)
    return tipoUuid ? q.eq('tipo_id', tipoUuid) : q
  }

  // Filtro GRUESO en la DB (fechas en hora AR, +1 día de holgura); el estado exacto
  // lo decide getEstadoVencimiento abajo. Para lo pendiente alcanza con lo que vence
  // dentro de la ventana habitual (31 días) más los pocos certificados con una alerta
  // más larga; todo paginado (PostgREST corta en 1000 filas sin avisar).
  const [certsRes, extraRes, { data: empresas }, { data: tipos }] = await Promise.all([
    necesitaTodo
      ? traerTodo((d, h) => base().order('fecha_vencimiento').order('id').range(d, h))
      : traerTodo((d, h) =>
          base()
            .lte('fecha_vencimiento', fechaMasDias(VENTANA_ALERTA_HABITUAL + 1))
            .order('fecha_vencimiento')
            .order('id')
            .range(d, h)
        ),
    necesitaTodo
      ? Promise.resolve({ data: [], error: null })
      : base()
          .gt('alerta_dias', VENTANA_ALERTA_HABITUAL)
          .lte('fecha_vencimiento', fechaMasDias(ALERTA_DIAS_MAX + 1)),
    supabase.from('empresas').select('id, nombre, slug').order('nombre'),
    supabase.from('tipos_certificado').select('id, nombre').order('orden'),
  ])

  // Nunca "Todo al día" porque la consulta falló (AGENTS.md §10).
  const errorCarga = certsRes.error ?? extraRes.error
  if (errorCarga) throw new Error(errorCarga.message)

  const certs = unirPorId(certsRes.data ?? [], extraRes.data ?? []).sort(
    (a, b) => (a.fecha_vencimiento ?? '').localeCompare(b.fecha_vencimiento ?? '')
  )

  const filas: FilaVencimiento[] = []
  for (const c of certs) {
    // Borrado lógico: certificados de empleados dados de baja no se listan
    if (c.empleado && c.empleado.activo === false) continue
    const emp = empresaDeCertificado(c)
    if (empresa && emp.slug !== empresa) continue
    if (tipo && (c.tipo?.id ?? '') !== tipo) continue
    const est = getEstadoVencimiento(c.fecha_vencimiento, c.alerta_dias)
    if (est === 'sin_fecha') continue
    filas.push({
      id: c.id,
      titular: titularCertificado(c),
      empresaNombre: emp.nombre,
      tipoNombre: c.tipo?.nombre ?? c.tipo_nombre_custom ?? '—',
      fecha: c.fecha_vencimiento!.slice(0, 10),
      dias: diasHastaVencimiento(c.fecha_vencimiento!),
      estado: est,
      href: hrefCertificado(c),
      sinArchivo: (c.archivos?.[0]?.count ?? 0) === 0,
    })
  }

  return (
    <VencimientosClient
      // Remonta al cambiar los filtros del server: la pestaña inicial vuelve a salir de la URL.
      key={`${empresa ?? ''}|${tipo ?? ''}|${vista}`}
      filas={filas}
      vista={vista}
      incluyeVigentes={necesitaTodo}
      empresa={empresa}
      tipo={tipo}
      empresas={empresas ?? []}
      tipos={tipos ?? []}
    />
  )
}
