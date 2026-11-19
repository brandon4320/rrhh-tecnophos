import { createClient } from '@/lib/supabase/server'
import { getEstadoVencimiento, diasHastaVencimiento } from '@/types'
import { TZ_AR } from '@/lib/fechas-ar'
import { getSesion } from '@/lib/auth/session'
import { tieneRol, LEGAJO_ESCRITURA } from '@/lib/auth/roles'
import { puedeVerArcor } from '@/modules/arcor/acceso'
import {
  CHECKLIST_MAQUINARIA_URL, CONTROL_PLAGAS_URL, CRM_URL, MARCAS, SERVIWHITE_ERP_URL, SERVIWHITE_LIMPIEZA_URL, UNIPAR_APP_URL,
} from '@/config/sistemas'
import InicioVista from './InicioVista'
import { cargarRecursos, curvaVencimientos, mensualPorEmpresa } from './recursos'
import type { AlertaInicio, DatosInicio, SistemaInicio } from './tipos'
import { filtroEmpresas, slugsDe } from '@/lib/empresas-vistas'
import { traerTodo } from '@/lib/paginar'
import {
  ALERTA_DIAS_MAX, VENTANA_ALERTA_HABITUAL, empresaDeCertificado, fechaMasDias, hrefCertificado, titularCertificado,
  unirPorId,
} from '@/lib/vencimientos'


const CERT_COLUMNAS = `
  id, fecha_vencimiento, alerta_dias, tipo_nombre_custom,
  tipo:tipos_certificado(nombre),
  empleado:empleados(id, nombre, apellido, activo, empresa_id, empresa:empresas(id, nombre, slug)),
  vehiculo:vehiculos(id, patente, empresa_id, empresa:empresas(id, nombre, slug)),
  equipo:equipos(id, nombre, categoria, empresa_id, empresa:empresas(id, nombre, slug)),
  empresa:empresas(id, nombre, slug)
`

/**
 * Inicio de Gestión de Recursos (overhaul 18/11/2026): junta el hub (/) y el dashboard. Esta
 * página LEE y arma los números; la vista (InicioVista) solo dibuja. Las consultas de antes
 * quedan iguales; se suman las de lo nuevo de la demo aprobada (bajas, curva de 9 semanas,
 * documentación mensual y recursos), todas en el mismo batch.
 */
export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; empresa?: string }>
}) {
  const sp = await searchParams
  const supabase = await createClient()
  // Algunas empresas tildadas en el selector del menú (?empresa=a,b): el total "Al día" ya no
  // sale de los dos counts globales, sino de una lista liviana de certificados con su empresa.
  const pedidas = slugsDe(sp.empresa)

  // Cota gruesa del fetch (el estado exacto lo decide getEstadoVencimiento):
  // vencido = fecha < hoy, por vencer = dentro de SU alerta_dias. Todas las
  // alertas hoy son de 30 días, así que alcanza con lo que vence hasta hoy + 31
  // (+1 de holgura); los certificados con una alerta más larga (si alguien la
  // carga) se traen aparte hasta el máximo que admite el formulario. Antes se
  // traía un año entero de certificados para quedarse con un mes.
  const [{ data: certsMes }, { data: certsAlertaLarga }, { data: empresas }, { data: empleados }, { count: certsSinEmpleado }, { count: certsEmpleadosActivos }, livianos, sesion, { data: bajas }] = await Promise.all([
    supabase
      .from('certificados')
      .select(CERT_COLUMNAS)
      .not('fecha_vencimiento', 'is', null)
      .lte('fecha_vencimiento', fechaMasDias(VENTANA_ALERTA_HABITUAL + 1))
      .order('fecha_vencimiento', { ascending: true }),
    supabase
      .from('certificados')
      .select(CERT_COLUMNAS)
      .not('fecha_vencimiento', 'is', null)
      .gt('alerta_dias', VENTANA_ALERTA_HABITUAL)
      .lte('fecha_vencimiento', fechaMasDias(ALERTA_DIAS_MAX + 1)),
    supabase.from('empresas').select('id, nombre, slug').order('nombre'),
    supabase.from('empleados').select('id, empresa_id').eq('activo', true),
    // Total real de certificados con fecha (sin traer filas): los que no son de
    // empleados + los de empleados activos. "Al día" sale por resta.
    supabase
      .from('certificados')
      .select('id', { count: 'exact', head: true })
      .not('fecha_vencimiento', 'is', null)
      .is('empleado_id', null),
    supabase
      .from('certificados')
      .select('id, empleados!inner(activo)', { count: 'exact', head: true })
      .not('fecha_vencimiento', 'is', null)
      .eq('empleados.activo', true),
    pedidas.length
      ? traerTodo((d, h) =>
          supabase
            .from('certificados')
            .select('id, empresa_id, empleado:empleados(activo, empresa_id), vehiculo:vehiculos(empresa_id), equipo:equipos(empresa_id)')
            .not('fecha_vencimiento', 'is', null)
            .order('id')
            .range(d, h)
        )
      : Promise.resolve({ data: null, error: null }),
    getSesion(), // cacheada por request: el layout ya la resolvió
    // Dados de baja por empresa: el pie de "Empleados activos".
    supabase.from('empleados').select('id, empresa_id').eq('activo', false),
  ])

  const filtro = filtroEmpresas(sp.empresa, (empresas ?? []).map((e) => e.slug))
  const idsFiltro = filtro ? new Set((empresas ?? []).filter((e) => filtro.includes(e.slug)).map((e) => e.id)) : null
  const enFiltro = (empresaId: string | null | undefined) => !idsFiltro || (!!empresaId && idsFiltro.has(empresaId))
  /** Un link a otra pantalla general conservando las empresas elegidas. */
  const conEmpresas = (href: string) => (filtro ? `${href}${href.includes('?') ? '&' : '?'}empresa=${filtro.join(',')}` : href)

  const certs = unirPorId(certsMes ?? [], certsAlertaLarga ?? []).sort((a, b) =>
    (a.fecha_vencimiento ?? '').localeCompare(b.fecha_vencimiento ?? '')
  )

  const conEstado = certs
    // El borrado de empleados es lógico (activo=false): sus certificados
    // quedan en la base pero no deben contar ni listarse acá.
    .filter((c) => !c.empleado || c.empleado.activo !== false)
    .filter((c) => enFiltro(c.empleado?.empresa_id ?? c.vehiculo?.empresa_id ?? c.equipo?.empresa_id ?? c.empresa?.id))
    .map((c) => ({
      ...c,
      estado: getEstadoVencimiento(c.fecha_vencimiento, c.alerta_dias),
    }))
  const vencidos = conEstado.filter((c) => c.estado === 'vencido')
  const proximos = conEstado.filter((c) => c.estado === 'proximo')
  // El fetch está acotado: el total con fecha sale de los counts.
  const totalConFecha = idsFiltro && livianos.data
    ? livianos.data.filter((c) => {
        const empleado = Array.isArray(c.empleado) ? c.empleado[0] : c.empleado
        const vehiculo = Array.isArray(c.vehiculo) ? c.vehiculo[0] : c.vehiculo
        const equipo = Array.isArray(c.equipo) ? c.equipo[0] : c.equipo
        if (empleado && empleado.activo === false) return false
        return enFiltro(empleado?.empresa_id ?? vehiculo?.empresa_id ?? equipo?.empresa_id ?? c.empresa_id)
      }).length
    : (certsSinEmpleado ?? 0) + (certsEmpleadosActivos ?? 0)
  const empleadosVistos = (empleados ?? []).filter((e) => enFiltro(e.empresa_id))
  const alDia = totalConFecha - vencidos.length - proximos.length

  const masUrgente = vencidos[0]
  const diasUrgente = masUrgente ? Math.abs(diasHastaVencimiento(masUrgente.fecha_vencimiento!)) : 0

  const tab = sp.tab === 'vencidos' ? 'vencidos' : sp.tab === 'proximos' ? 'proximos' : 'todos'

  const byEmpresa = (empresas ?? []).filter((emp) => enFiltro(emp.id)).map((emp) => {
    const propios = conEstado.filter((c) => {
      const empId = c.empleado?.empresa_id ?? c.vehiculo?.empresa_id ?? c.equipo?.empresa_id ?? c.empresa?.id ?? null
      return empId === emp.id
    })
    return {
      ...emp,
      total: (empleados ?? []).filter((e) => e.empresa_id === emp.id).length,
      vencidos: propios.filter((c) => c.estado === 'vencido').length,
      proximos: propios.filter((c) => c.estado === 'proximo').length,
    }
  })

  // Fecha del encabezado en hora AR (Vercel corre en UTC: desde las 21 ya era mañana), sin el año.
  const ahora = new Date()
  const hoyTexto = new Intl.DateTimeFormat('es-AR', {
    timeZone: TZ_AR, weekday: 'long', day: 'numeric', month: 'long',
  }).format(ahora).replace(',', '')
  // Solo la primera letra (la clase `capitalize` dejaba "Jueves 2 De Octubre").
  const hoyLargo = hoyTexto.charAt(0).toUpperCase() + hoyTexto.slice(1)
  const hora = Number(new Intl.DateTimeFormat('en-US', { timeZone: TZ_AR, hour: 'numeric', hour12: false }).format(ahora)) % 24
  const saludo = hora < 6 ? 'Buenas noches' : hora < 13 ? 'Buenos días' : hora < 20 ? 'Buenas tardes' : 'Buenas noches'
  const mesNombre = new Intl.DateTimeFormat('es-AR', { timeZone: TZ_AR, month: 'long' }).format(ahora)

  const empresasVistas = (empresas ?? []).filter((emp) => enFiltro(emp.id))
  const puedeCargar = tieneRol(sesion?.rol ?? null, LEGAJO_ESCRITURA)
  const verArcor = !!sesion && puedeVerArcor(sesion)

  // Lo nuevo de la demo, en paralelo; cada parte que falla se dice sin tirar el Inicio.
  const [mensual, curva, recursos] = await Promise.all([
    mensualPorEmpresa(supabase, empresasVistas),
    curvaVencimientos(supabase, enFiltro),
    cargarRecursos(supabase, empresasVistas, { hrefFlota: conEmpresas('/flota'), arcor: verArcor }),
  ])

  const tipoTitular = (c: (typeof conEstado)[number]): AlertaInicio['tipoTitular'] =>
    c.empleado ? 'persona' : c.vehiculo ? 'vehiculo' : c.equipo ? 'equipo' : 'empresa'
  function alerta(c: (typeof conEstado)[number]): AlertaInicio {
    // Una persona: su legajo en la hoja de Empleados con ese certificado abierto; el resto, su link de siempre.
    const href = c.empleado ? `/empleados?legajo=${c.empleado.id}&cert=${c.id}` : hrefCertificado(c) ?? conEmpresas('/vencimientos')
    const empresa = empresaDeCertificado(c)
    return {
      id: c.id,
      estado: c.estado === 'vencido' ? 'vencido' : 'proximo',
      dias: diasHastaVencimiento(c.fecha_vencimiento!),
      fecha: c.fecha_vencimiento!.slice(0, 10),
      titular: titularCertificado(c),
      tipoTitular: tipoTitular(c),
      empresaSlug: empresa.slug,
      empresaNombre: empresa.nombre,
      tipo: c.tipo?.nombre ?? c.tipo_nombre_custom ?? 'Certificado',
      href,
      // Renovar: el certificado de una persona se abre con las fechas nuevas para guardar; el resto,
      // en su pantalla de siempre. Solo para quien puede editar (espejo de la RLS).
      hrefRenovar: !puedeCargar ? null : c.empleado ? `${href}&renovar=1` : hrefCertificado(c),
    }
  }

  const sistemas: SistemaInicio[] = MARCAS
    .filter((m) => empresasVistas.some((e) => m.match(e.slug)))
    .map((m) => ({
      key: m.key,
      nombre: m.nombre,
      icono: m.icono,
      links: [
        ...(m.key === 'tecnophos' && verArcor ? [{ icono: 'contenedor' as const, label: 'Contenedores - ARCOR', href: '/arcor', externo: false }] : []),
        ...(m.key === 'adc'
          ? [
              { icono: 'escoba' as const, label: 'Sistema limpieza - UNIPAR', href: UNIPAR_APP_URL, externo: true },
              { icono: 'bicho' as const, label: 'Control de Plagas', href: CONTROL_PLAGAS_URL, externo: true },
              { icono: 'checklist' as const, label: 'Checklist de maquinaria', href: CHECKLIST_MAQUINARIA_URL, externo: true },
            ]
          : []),
        ...(m.key === 'serviwhite'
          ? [
              { icono: 'cuadros' as const, label: 'Sistema de gestión', href: SERVIWHITE_ERP_URL, externo: true },
              { icono: 'mapa' as const, label: 'Recorrido de limpieza', href: SERVIWHITE_LIMPIEZA_URL, externo: true },
            ]
          : []),
        { icono: 'apreton' as const, label: 'Gestión Comercial', href: `${CRM_URL}?empresa=${m.key}`, externo: true },
      ],
    }))

  const tipos = (['persona', 'vehiculo', 'equipo', 'empresa'] as const)
    .map((t) => ({ tipo: t, n: proximos.filter((c) => tipoTitular(c) === t).length }))
    .filter((x) => x.n > 0)
  const diasVencidos = vencidos.map((c) => -diasHastaVencimiento(c.fecha_vencimiento!))
  const bajasVistas = (bajas ?? []).filter((e) => enFiltro(e.empresa_id)).length

  const datos: DatosInicio = {
    fecha: hoyLargo,
    saludo,
    nombre: (sesion?.nombre ?? sesion?.email ?? 'Usuario').split(' ')[0],
    hrefs: {
      empleados: conEmpresas('/empleados'),
      vencimientos: conEmpresas('/vencimientos'),
      vencidos: conEmpresas('/vencimientos?estado=vencido'),
      proximos: conEmpresas('/vencimientos?estado=proximo'),
      vigentes: conEmpresas('/vencimientos?estado=vigente'),
    },
    proximos: {
      total: proximos.length,
      semana: proximos.filter((c) => diasHastaVencimiento(c.fecha_vencimiento!) <= 7).length,
      porTipo: tipos,
      curva,
    },
    vencidos: {
      total: vencidos.length,
      masAntiguo: masUrgente ? diasUrgente : 0,
      hasta7: diasVencidos.filter((x) => x <= 7).length,
      mas7: diasVencidos.filter((x) => x > 7).length,
    },
    alDia: { total: alDia, conFecha: totalConFecha },
    empleados: {
      total: empleadosVistos.length,
      bajas: bajasVistas,
      porEmpresa: byEmpresa.map((e) => ({ slug: e.slug, nombre: e.nombre, n: e.total })),
    },
    alertas: {
      todos: [...vencidos, ...proximos].map(alerta),
      vencidos: vencidos.map(alerta),
      proximos: proximos.map(alerta),
    },
    tab,
    empresas: byEmpresa.map((e) => ({ id: e.id, slug: e.slug, nombre: e.nombre, empleados: e.total, vencidos: e.vencidos, proximos: e.proximos, mensual: mensual.get(e.id) ?? null })),
    mes: mesNombre,
    recursos: recursos.tarjetas,
    fallas: recursos.fallas,
    sistemas,
    puedeCargar,
  }

  return <InicioVista d={datos} />
}
