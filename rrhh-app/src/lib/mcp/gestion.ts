// MCP de Gestión de Recursos: las herramientas que una IA (Grok, Claude…) puede usar con la clave de
// IA de una persona (tabla `claves_ia`, migración 29). SOLO LECTURA.
//
// Seguridad: se consulta con el cliente de servicio (sin RLS), así que CADA herramienta filtra a mano
// por las empresas que esa persona ve, igual que la RLS (AGENTS.md §5): rol admin/usuario;
// `empresa_acceso` null = todas, si no, solo esa. Nunca recibos de sueldo ni documentos de recibos.
import 'server-only'
import type { createAdminClient } from '@/lib/supabase/admin'
import { getEstadoVencimiento, diasHastaVencimiento, ESTADO_LABELS, type EstadoVencimiento } from '@/types'
import { ALERTA_DIAS_MAX, VENTANA_ALERTA_HABITUAL, empresaDeCertificado, fechaMasDias, titularCertificado, unirPorId, type CertConDueno } from '@/lib/vencimientos'
import { traerTodo } from '@/lib/paginar'
import { coincide } from '@/lib/texto'
import { cargarFlota } from '@/modules/flota/queries'
import { compararPorUrgencia, resumirVehiculo, type Semaforo } from '@/modules/flota/resumen'
import { ESTADO_CHECKLIST_LABEL, RESULTADO_LABEL } from '@/modules/flota/reglas'
import { calcularStock, estadoStock, ESTADO_STOCK_LABEL } from '@/modules/stock/reglas'
import { ErrorHerramienta, type EsquemaJson, type Herramienta } from './servidor'

/** Prefijo de las claves de Gestión de Recursos (las del CRM empiezan con "crm_"). */
export const PREFIJO_CLAVE = 'ges'

type Admin = ReturnType<typeof createAdminClient>
interface EmpresaVista {
  id: string
  nombre: string
  slug: string
}

export interface CtxGestion {
  db: Admin
  quien: { userId: string; nombre: string | null; rol: string; todasLasEmpresas: boolean }
  /** Las empresas que esta persona puede ver (todas o la suya). */
  empresas: EmpresaVista[]
}

type H = Herramienta<CtxGestion>

const ESTADO_PERSONA: Record<EstadoVencimiento, string> = { vencido: 'Vencido', proximo: 'Por vencer', vigente: 'OK', sin_fecha: 'Sin datos' }
const SEMAFORO_LABEL: Record<Semaforo, string> = { rojo: 'Requiere atención', amarillo: 'A revisar', verde: 'En orden' }

/** Las empresas a consultar: la pedida (si la ve) o todas las suyas. */
function empresasDe(ctx: CtxGestion, slug: unknown): EmpresaVista[] {
  if (slug === undefined || slug === null || slug === '') return ctx.empresas
  const e = ctx.empresas.find((x) => x.slug === slug)
  if (!e) throw new ErrorHerramienta(`No existe la empresa "${String(slug)}" o no tenés acceso. Las tuyas: ${ctx.empresas.map((x) => x.slug).join(', ')}.`)
  return [e]
}

function unaEmpresa(ctx: CtxGestion, slug: unknown): EmpresaVista {
  const lista = empresasDe(ctx, slug)
  if (lista.length !== 1) throw new ErrorHerramienta(`Indicá la empresa (una de: ${ctx.empresas.map((x) => x.slug).join(', ')}).`)
  return lista[0]
}

const dia = (f: string | null | undefined) => (f ? `${f.slice(8, 10)}/${f.slice(5, 7)}/${f.slice(0, 4)}` : null)

function peorEstado(certs: { fecha_vencimiento: string | null; alerta_dias: number | null }[]): EstadoVencimiento {
  const estados = certs.map((c) => getEstadoVencimiento(c.fecha_vencimiento, c.alerta_dias))
  for (const e of ['vencido', 'proximo', 'vigente'] as const) if (estados.includes(e)) return e
  return 'sin_fecha'
}

const EMPRESA: EsquemaJson = { type: 'string', description: "Slug de la empresa (ver 'empresas'): p. ej. adc, serviwhite, tecnophos-bb. Sin esto, todas las que la persona ve." }
const ESTADO: EsquemaJson = { type: 'string', enum: ['vencido', 'proximo', 'vigente', 'sin_fecha'], description: 'vencido, proximo (por vencer), vigente (OK) o sin_fecha.' }

// ── Herramientas ─────────────────────────────────────────────────────────────

const empresas: H = {
  nombre: 'empresas',
  titulo: 'Empresas',
  descripcion: 'Las empresas (y sedes) que la persona puede ver, con su slug para usar en las otras herramientas.',
  entrada: { type: 'object', properties: {} },
  soloLectura: true,
  ejecutar: async (_a, ctx) => ({ persona: ctx.quien.nombre, empresas: ctx.empresas.map((e) => ({ slug: e.slug, nombre: e.nombre })) }),
}

const CERT_COLUMNAS = `
  id, fecha_vencimiento, alerta_dias, tipo_nombre_custom,
  tipo:tipos_certificado(nombre),
  empleado:empleados(id, nombre, apellido, activo, empresa_id, empresa:empresas(nombre, slug)),
  vehiculo:vehiculos(id, patente, empresa_id, empresa:empresas(nombre, slug)),
  equipo:equipos(id, nombre, categoria, empresa_id, empresa:empresas(nombre, slug)),
  empresa:empresas(nombre, slug),
  archivos(count)
`
type CertFila = CertConDueno & { fecha_vencimiento: string | null; alerta_dias: number | null; tipo_nombre_custom: string | null; tipo: { nombre: string } | null; empleado?: { activo?: boolean } | null; archivos?: { count: number }[] }

/** Certificados que vencen hasta `hastaDias` (los de alerta larga también), de las empresas pedidas. */
async function certificadosPorVencer(ctx: CtxGestion, slugs: Set<string>, hastaDias = VENTANA_ALERTA_HABITUAL): Promise<(CertFila & { estado: EstadoVencimiento; dias: number })[]> {
  const base = () => ctx.db.from('certificados').select(CERT_COLUMNAS).not('fecha_vencimiento', 'is', null)
  const [a, b] = await Promise.all([
    traerTodo((d, h) => base().lte('fecha_vencimiento', fechaMasDias(hastaDias + 1)).order('fecha_vencimiento').order('id').range(d, h)),
    base().gt('alerta_dias', VENTANA_ALERTA_HABITUAL).lte('fecha_vencimiento', fechaMasDias(ALERTA_DIAS_MAX + 1)),
  ])
  if (a.error || b.error) throw new Error((a.error ?? b.error)!.message)
  return unirPorId((a.data ?? []) as unknown as CertFila[], (b.data ?? []) as unknown as CertFila[])
    .filter((c) => !(c.empleado && c.empleado.activo === false))
    .filter((c) => slugs.has(empresaDeCertificado(c).slug ?? ''))
    .map((c) => ({ ...c, estado: getEstadoVencimiento(c.fecha_vencimiento, c.alerta_dias), dias: diasHastaVencimiento(c.fecha_vencimiento!) }))
    .sort((x, y) => (x.fecha_vencimiento ?? '').localeCompare(y.fecha_vencimiento ?? ''))
}

const vencimientos: H = {
  nombre: 'vencimientos',
  titulo: 'Vencimientos',
  descripcion: 'Certificados vencidos y por vencer (de personas, vehículos, equipos y de la empresa), del más urgente al menos. Por defecto, lo pendiente: vencidos + por vencer dentro de su ventana de aviso.',
  entrada: {
    type: 'object',
    properties: {
      empresa: EMPRESA,
      estado: { type: 'string', enum: ['pendientes', 'vencido', 'proximo'], description: 'pendientes (por defecto), vencido o proximo.' },
      dias: { type: 'integer', minimum: 1, maximum: 365, description: 'Ver también lo que vence en los próximos N días (aunque todavía no esté en aviso).' },
      tipo: { type: 'string', maxLength: 100, description: 'Filtra por tipo de certificado (texto: "ART", "carnet", "curso Unipar"…).' },
      titular: { type: 'string', maxLength: 100, description: 'Filtra por persona, patente o equipo.' },
    },
  },
  soloLectura: true,
  ejecutar: async (a, ctx) => {
    const lista = empresasDe(ctx, a.empresa)
    const dias = typeof a.dias === 'number' ? a.dias : VENTANA_ALERTA_HABITUAL
    let certs = await certificadosPorVencer(ctx, new Set(lista.map((e) => e.slug)), dias)
    const estado = (a.estado as string | undefined) ?? 'pendientes'
    certs = certs.filter((c) => (typeof a.dias === 'number' ? c.dias <= dias : estado === 'pendientes' ? c.estado === 'vencido' || c.estado === 'proximo' : c.estado === estado))
    if (estado !== 'pendientes' && typeof a.dias === 'number') certs = certs.filter((c) => c.estado === estado)
    if (a.tipo) certs = certs.filter((c) => coincide(String(a.tipo), c.tipo?.nombre ?? c.tipo_nombre_custom))
    if (a.titular) certs = certs.filter((c) => coincide(String(a.titular), titularCertificado(c)))
    return {
      total: certs.length,
      vencidos: certs.filter((c) => c.estado === 'vencido').length,
      por_vencer: certs.filter((c) => c.estado === 'proximo').length,
      certificados: certs.slice(0, 300).map((c) => ({
        titular: titularCertificado(c),
        empresa: empresaDeCertificado(c).nombre,
        certificado: c.tipo?.nombre ?? c.tipo_nombre_custom ?? '—',
        vence: dia(c.fecha_vencimiento),
        dias: c.dias,
        estado: ESTADO_LABELS[c.estado],
        sin_archivo: (c.archivos?.[0]?.count ?? 0) === 0,
      })),
    }
  },
}

const resumen: H = {
  nombre: 'resumen',
  titulo: 'Resumen por empresa',
  descripcion: 'Cómo está cada empresa: empleados activos y certificados vencidos y por vencer. Para empezar a mirar qué hay que resolver.',
  entrada: { type: 'object', properties: { empresa: EMPRESA } },
  soloLectura: true,
  ejecutar: async (a, ctx) => {
    const lista = empresasDe(ctx, a.empresa)
    const [certs, emps] = await Promise.all([
      certificadosPorVencer(ctx, new Set(lista.map((e) => e.slug))),
      ctx.db.from('empleados').select('empresa_id').eq('activo', true).in('empresa_id', lista.map((e) => e.id)),
    ])
    if (emps.error) throw new Error(emps.error.message)
    return {
      empresas: lista.map((e) => {
        const propios = certs.filter((c) => empresaDeCertificado(c).slug === e.slug)
        return {
          empresa: e.nombre,
          slug: e.slug,
          empleados_activos: (emps.data ?? []).filter((x) => x.empresa_id === e.id).length,
          certificados_vencidos: propios.filter((c) => c.estado === 'vencido').length,
          certificados_por_vencer: propios.filter((c) => c.estado === 'proximo').length,
        }
      }),
    }
  },
}

const buscarEmpleados: H = {
  nombre: 'buscar_empleados',
  titulo: 'Buscar empleados',
  descripcion: 'Lista empleados (nombre, empresa, sector, cantidad de certificados y su peor estado: Vencido, Por vencer, OK o Sin datos). Se puede buscar por nombre o sector y filtrar por estado.',
  entrada: {
    type: 'object',
    properties: { texto: { type: 'string', maxLength: 100 }, empresa: EMPRESA, estado: ESTADO, incluir_bajas: { type: 'boolean' } },
  },
  soloLectura: true,
  ejecutar: async (a, ctx) => {
    const lista = empresasDe(ctx, a.empresa)
    let q = ctx.db
      .from('empleados')
      .select('id, nombre, apellido, sector, activo, empresa_id, certificados(fecha_vencimiento, alerta_dias)')
      .in('empresa_id', lista.map((e) => e.id))
      .order('nombre')
    if (!a.incluir_bajas) q = q.eq('activo', true)
    const { data, error } = await q
    if (error) throw new Error(error.message)
    const nombreEmpresa = new Map(lista.map((e) => [e.id, e.nombre]))
    let filas = (data ?? []).map((e) => ({
      id: e.id,
      nombre: [e.nombre, e.apellido].filter(Boolean).join(' '),
      empresa: e.empresa_id ? nombreEmpresa.get(e.empresa_id) ?? null : null,
      sector: e.sector,
      activo: e.activo !== false,
      certificados: (e.certificados ?? []).length,
      estado: peorEstado(e.certificados ?? []),
    }))
    if (a.texto) filas = filas.filter((f) => coincide(String(a.texto), f.nombre, f.sector, f.empresa))
    if (a.estado) filas = filas.filter((f) => f.estado === a.estado)
    return { total: filas.length, empleados: filas.slice(0, 300).map((f) => ({ ...f, estado: ESTADO_PERSONA[f.estado] })) }
  },
}

const legajo: H = {
  nombre: 'legajo',
  titulo: 'Legajo de un empleado',
  descripcion: "El legajo de un empleado: sus datos y TODOS sus certificados (tipo, número, vencimiento, estado, si tiene archivo) y las últimas entregas de ropa/EPP. El id sale de 'buscar_empleados'.",
  entrada: { type: 'object', properties: { empleado_id: { type: 'string' } }, required: ['empleado_id'] },
  soloLectura: true,
  ejecutar: async (a, ctx) => {
    const id = String(a.empleado_id)
    if (!/^[0-9a-f-]{36}$/i.test(id)) throw new ErrorHerramienta("Ese id no es válido: buscalo con 'buscar_empleados'.")
    const [emp, certs, entregas] = await Promise.all([
      ctx.db.from('empleados').select('id, nombre, apellido, sector, activo, empresa_id, created_at').eq('id', id).maybeSingle(),
      ctx.db.from('certificados').select('tipo_nombre_custom, numero_documento, fecha_emision, fecha_vencimiento, alerta_dias, notas, tipo:tipos_certificado(nombre, orden), archivos(count)').eq('empleado_id', id).order('fecha_vencimiento'),
      ctx.db.from('stock_movimientos').select('fecha, tipo, cantidad, item:stock_items!stock_movimientos_item_id_fkey(nombre, unidad)').eq('empleado_id', id).in('tipo', ['consumo', 'devolucion']).order('fecha', { ascending: false }).limit(20),
    ])
    if (emp.error || certs.error || entregas.error) throw new Error((emp.error ?? certs.error ?? entregas.error)!.message)
    const e = emp.data
    // Un empleado de otra empresa se trata como inexistente (como la RLS).
    const empresa = e && ctx.empresas.find((x) => x.id === e.empresa_id)
    if (!e || !empresa) throw new ErrorHerramienta('No encontré ese empleado.')
    type C = { tipo_nombre_custom: string | null; numero_documento: string | null; fecha_emision: string | null; fecha_vencimiento: string | null; alerta_dias: number | null; notas: string | null; tipo: { nombre: string } | null; archivos: { count: number }[] }
    type M = { fecha: string; tipo: string; cantidad: number; item: { nombre: string; unidad: string | null } | null }
    return {
      id: e.id,
      nombre: [e.nombre, e.apellido].filter(Boolean).join(' '),
      empresa: empresa.nombre,
      sector: e.sector,
      activo: e.activo !== false,
      certificados: ((certs.data ?? []) as unknown as C[]).map((c) => {
        const estado = getEstadoVencimiento(c.fecha_vencimiento, c.alerta_dias)
        return {
          certificado: c.tipo?.nombre ?? c.tipo_nombre_custom ?? 'Certificado',
          numero: c.numero_documento,
          emision: dia(c.fecha_emision),
          vence: dia(c.fecha_vencimiento),
          dias: c.fecha_vencimiento ? diasHastaVencimiento(c.fecha_vencimiento) : null,
          estado: ESTADO_LABELS[estado],
          tiene_archivo: (c.archivos?.[0]?.count ?? 0) > 0,
          notas: c.notas,
        }
      }),
      entregas_de_ropa_y_epp: ((entregas.data ?? []) as unknown as M[]).map((m) => ({ fecha: dia(m.fecha), tipo: m.tipo === 'consumo' ? 'Entrega' : 'Devolución', item: m.item?.nombre ?? null, cantidad: Math.abs(m.cantidad), unidad: m.item?.unidad ?? null })),
    }
  },
}

const flota: H = {
  nombre: 'flota',
  titulo: 'Flota',
  descripcion: 'Los vehículos con su estado (En orden / A revisar / Requiere atención) y por qué: checklist, services y mantenimiento, documentos que vencen, novedades abiertas y si está apto para circular. Ordenados por urgencia.',
  entrada: { type: 'object', properties: { empresa: EMPRESA, solo_con_problemas: { type: 'boolean', description: 'Solo los que no están En orden.' }, patente: { type: 'string', maxLength: 20 } } },
  soloLectura: true,
  ejecutar: async (a, ctx) => {
    const lista = empresasDe(ctx, a.empresa)
    const ids = new Set(lista.map((e) => e.id))
    const nombre = new Map(lista.map((e) => [e.id, e.nombre]))
    const vehiculos = (await cargarFlota(ctx.db, lista.length === 1 ? { empresaId: lista[0].id } : {})).filter((v) => ids.has(v.empresa_id))
    let filas = vehiculos
      .map((v) => ({ v, r: resumirVehiculo(v), empresa: nombre.get(v.empresa_id) }))
      .sort((x, y) => compararPorUrgencia({ r: x.r, empresa: x.empresa, patente: x.v.patente }, { r: y.r, empresa: y.empresa, patente: y.v.patente }))
    if (a.solo_con_problemas) filas = filas.filter((f) => f.r.semaforo !== 'verde')
    if (a.patente) filas = filas.filter((f) => coincide(String(a.patente), f.v.patente))
    return {
      total: filas.length,
      vehiculos: filas.map(({ v, r, empresa }) => ({
        patente: v.patente,
        vehiculo: [v.marca, v.modelo, v.anio].filter(Boolean).join(' ') || v.descripcion,
        empresa,
        conductor: v.conductor_nombre,
        estado: SEMAFORO_LABEL[r.semaforo],
        apto_para_circular: !r.noApta,
        motivos: r.motivos,
        km: v.km_actual,
        km_por_dia: r.kmDia,
        checklist: v.checklist_activo ? `${ESTADO_CHECKLIST_LABEL[r.checklist.estado]}${r.checklist.ultimoResultado ? ` · último: ${RESULTADO_LABEL[r.checklist.ultimoResultado]}` : ''}` : 'Desactivado',
        mantenimiento: r.mantenimientos.map((m) => ({ que: m.nombre, estado: m.estado, detalle: m.motivo })),
        documentos_a_mirar: r.documentos.filter((d) => d.estado === 'vencido' || d.estado === 'proximo').map((d) => ({ documento: d.nombre, vence: dia(d.vence), estado: ESTADO_LABELS[d.estado] })),
        novedades_abiertas: r.novedades.abiertas,
      })),
    }
  },
}

const stock: H = {
  nombre: 'stock',
  titulo: 'Stock',
  descripcion: 'El inventario de una empresa: cada ítem con su stock actual, el mínimo y su estado (Sin stock, Bajo mínimo, OK, En cero), y la última compra.',
  entrada: { type: 'object', properties: { empresa: EMPRESA, solo_alertas: { type: 'boolean', description: 'Solo lo que está sin stock o bajo el mínimo.' }, texto: { type: 'string', maxLength: 100 } } },
  soloLectura: true,
  ejecutar: async (a, ctx) => {
    const e = unaEmpresa(ctx, a.empresa ?? (ctx.empresas.length === 1 ? ctx.empresas[0].slug : undefined))
    const [items, movs] = await Promise.all([
      ctx.db.from('stock_items').select('id, nombre, categoria, unidad, stock_minimo, activo').eq('empresa_id', e.id).order('nombre'),
      traerTodo((d, h) => ctx.db.from('stock_movimientos').select('item_id, tipo, cantidad, fecha, precio_unitario, proveedor, created_at').eq('empresa_id', e.id).order('fecha', { ascending: false }).order('created_at', { ascending: false }).range(d, h)),
    ])
    if (items.error || movs.error) throw new Error((items.error ?? movs.error)!.message)
    const calculado = calcularStock(items.data ?? [], movs.data ?? [])
    let filas = (items.data ?? [])
      .filter((i) => i.activo !== false)
      .map((i) => {
        const s = calculado.get(i.id)
        const estado = estadoStock(s?.stock ?? 0, i.stock_minimo)
        return { item: i.nombre, categoria: i.categoria, unidad: i.unidad, stock: s?.stock ?? 0, minimo: i.stock_minimo, estado, ultima_compra: s?.ultimaCompra ? { fecha: dia(s.ultimaCompra.fecha), proveedor: s.ultimaCompra.proveedor, precio_unitario: s.ultimaCompra.precio_unitario } : null }
      })
    if (a.solo_alertas) filas = filas.filter((f) => f.estado === 'vencido' || f.estado === 'proximo')
    if (a.texto) filas = filas.filter((f) => coincide(String(a.texto), f.item, f.categoria))
    return {
      empresa: e.nombre,
      sin_stock: filas.filter((f) => f.estado === 'vencido').length,
      bajo_minimo: filas.filter((f) => f.estado === 'proximo').length,
      items: filas.map((f) => ({ ...f, estado: ESTADO_STOCK_LABEL[f.estado] })),
    }
  },
}

const habilitaciones: H = {
  nombre: 'habilitaciones_empresa',
  titulo: 'Habilitaciones de la empresa',
  descripcion: 'La documentación propia de una empresa (habilitaciones, programas de seguridad y otros certificados a nombre de la empresa) con su vencimiento y estado.',
  entrada: { type: 'object', properties: { empresa: EMPRESA } },
  soloLectura: true,
  ejecutar: async (a, ctx) => {
    const e = unaEmpresa(ctx, a.empresa ?? (ctx.empresas.length === 1 ? ctx.empresas[0].slug : undefined))
    const { data, error } = await ctx.db.from('certificados').select('tipo_nombre_custom, categoria, numero_documento, fecha_vencimiento, alerta_dias, notas, tipo:tipos_certificado(nombre), archivos(count)').eq('empresa_id', e.id).order('fecha_vencimiento')
    if (error) throw new Error(error.message)
    type C = { tipo_nombre_custom: string | null; categoria: string | null; numero_documento: string | null; fecha_vencimiento: string | null; alerta_dias: number | null; notas: string | null; tipo: { nombre: string } | null; archivos: { count: number }[] }
    return {
      empresa: e.nombre,
      documentos: ((data ?? []) as unknown as C[]).map((c) => ({
        documento: c.tipo?.nombre ?? c.tipo_nombre_custom ?? 'Documento',
        grupo: c.categoria === 'programa_seguridad' ? 'Programa de seguridad' : 'Habilitación',
        numero: c.numero_documento,
        vence: dia(c.fecha_vencimiento),
        estado: ESTADO_LABELS[getEstadoVencimiento(c.fecha_vencimiento, c.alerta_dias)],
        tiene_archivo: (c.archivos?.[0]?.count ?? 0) > 0,
        notas: c.notas,
      })),
    }
  },
}

export const HERRAMIENTAS: H[] = [empresas, resumen, vencimientos, buscarEmpleados, legajo, flota, stock, habilitaciones]

export const INSTRUCCIONES = [
  'MCP de Gestión de Recursos de Tecnophos, ADC y Serviwhite: personal y sus certificados con vencimiento, flota, stock y habilitaciones.',
  'Es de solo lectura y trabajás como la persona dueña de la clave: ves solo las empresas que ella ve.',
  "Empezá por 'empresas' (slugs) o 'resumen'. Para una persona: 'buscar_empleados' y después 'legajo' con su id.",
  'Las fechas están en dd/mm/aaaa (hora de Argentina) y "dias" es cuántos faltan para vencer (negativo = ya venció).',
].join(' ')
