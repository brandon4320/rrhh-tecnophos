// ============================================================
// Inicio · lo que el hub y el dashboard viejos no mostraban y la demo aprobada sí
// (overhaul 18/11/2026): documentación mensual por empresa, recursos (flota, palas,
// stock, ARCOR) y la curva de lo que vence semana a semana. SOLO LEE, sin tocar el
// esquema: cada dibujo sale de datos que ya están en la base. Lo que no existe (horas
// de uso de las palas por semana) no se dibuja.
// Puro donde se puede (las cuentas, con tests en recursos.test.ts); las lecturas son
// del cliente de la sesión, así que la RLS decide qué ve cada uno.
// ============================================================
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import { traerTodo } from '@/lib/paginar'
import { diaClaveAR } from '@/lib/fechas-ar'
import { duenoDeBaja, fechaMasDias } from '@/lib/vencimientos'
import { getEstadoVencimiento, diasHastaVencimiento } from '@/types'
import { cargarFlota } from '@/modules/flota/queries'
import { resumirVehiculo, compararPorUrgencia, type Semaforo } from '@/modules/flota/resumen'
import { CATEGORIA_PALAS, fmtHorometro, ordenarPalas } from '@/modules/palas/reglas'
import { calcularStock, estadoStock, fmtCantidad } from '@/modules/stock/reglas'
import { carpetasFijasDe, completitudMes, periodoActual } from '@/modules/documentos/reglas'
import { getAlertasAbiertas, getEstados } from '@/modules/arcor/queries'
import { adb, rows } from '@/modules/arcor/db'
import { evaluarSilencio, mesActual, nivelCredito } from '@/modules/arcor/reglas'
import type { EstadoClaude, EstadoHeartbeat, EstadoWhatsapp } from '@/modules/arcor/tipos'
import { tiempoRelativo } from '@/lib/fechas-ar'
import type { PasoRecurso, RecursoInicio } from './tipos'
import { curvaSemanal, kmPorSemana, porSemana } from './curvas'

type Db = SupabaseClient<Database>
interface EmpresaMin { id: string; nombre: string; slug: string }

const fmtNum = (n: number) => n.toLocaleString('es-AR')
const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`
function fCorta(f: string): string {
  const d = new Date(f.slice(0, 10) + 'T12:00:00Z')
  const meses = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
  const hoy = diaClaveAR(new Date())
  return `${d.getUTCDate()} ${meses[d.getUTCMonth()]}${f.slice(0, 4) !== hoy.slice(0, 4) ? ' ' + f.slice(0, 4) : ''}`
}

/** Documentación mensual del mes en curso: carpetas fijas con archivos, por empresa. */
export async function mensualPorEmpresa(db: Db, empresas: EmpresaMin[]): Promise<Map<string, { con: number; de: number }>> {
  const periodo = periodoActual()
  const res = await traerTodo((d, h) =>
    db.from('documentos_mensuales').select('id, empresa_id, carpeta').eq('periodo', periodo).order('id').range(d, h)
  )
  const out = new Map<string, { con: number; de: number }>()
  if (res.error) return out
  for (const e of empresas) {
    const fijas = carpetasFijasDe(e.slug)
    const c = completitudMes(res.data.filter((x) => x.empresa_id === e.id).map((x) => ({ carpeta: x.carpeta })) as never, [], fijas)
    out.set(e.id, { con: c.completas.length, de: c.total })
  }
  return out
}

/** Curva del protagonista: cuántos certificados vencen en cada una de las próximas 9 semanas. */
export async function curvaVencimientos(db: Db, enFiltro: (empresaId: string | null | undefined) => boolean): Promise<number[]> {
  const res = await traerTodo((d, h) =>
    db
      .from('certificados')
      .select('id, empresa_id, fecha_vencimiento, empleado:empleados(activo, empresa_id), vehiculo:vehiculos(activo, empresa_id), equipo:equipos(activo, empresa_id)')
      .gte('fecha_vencimiento', fechaMasDias(0))
      .lte('fecha_vencimiento', fechaMasDias(63))
      .order('id')
      .range(d, h)
  )
  if (res.error) return []
  const dias: number[] = []
  for (const c of res.data) {
    const empleado = Array.isArray(c.empleado) ? c.empleado[0] : c.empleado
    const vehiculo = Array.isArray(c.vehiculo) ? c.vehiculo[0] : c.vehiculo
    const equipo = Array.isArray(c.equipo) ? c.equipo[0] : c.equipo
    // Lo de un dueño dado de baja no cuenta: persona, camioneta o ítem.
    if (duenoDeBaja({ empleado, vehiculo, equipo })) continue
    if (!enFiltro(empleado?.empresa_id ?? vehiculo?.empresa_id ?? equipo?.empresa_id ?? c.empresa_id)) continue
    if (c.fecha_vencimiento) dias.push(diasHastaVencimiento(c.fecha_vencimiento))
  }
  return curvaSemanal(dias)
}

const SEMAFORO_ORDEN: Record<Semaforo, number> = { verde: 0, amarillo: 1, rojo: 2 }

/** Tarjeta de Flota: semáforo de cada vehículo (el mismo cálculo de /flota) y lo que hay que resolver. */
async function tarjetaFlota(db: Db, empresas: EmpresaMin[], hrefFlota: string, hoy: string): Promise<RecursoInicio | null> {
  const ids = new Set(empresas.map((e) => e.id))
  const flota = (await cargarFlota(db, {})).filter((v) => ids.has(v.empresa_id))
  if (!flota.length) return null
  const filas = flota
    .map((v) => ({ v, r: resumirVehiculo(v) }))
    .sort((a, b) => compararPorUrgencia({ r: a.r, patente: a.v.patente }, { r: b.r, patente: b.v.patente }))
  const rojo = filas.filter((f) => f.r.semaforo === 'rojo').length
  const amarillo = filas.filter((f) => f.r.semaforo === 'amarillo').length
  const verde = filas.length - rojo - amarillo
  const serie = kmPorSemana(flota, hoy)
  const pasos: PasoRecurso[] = filas
    .filter((f) => f.r.semaforo !== 'verde')
    .slice(0, 3)
    .map(({ v, r }) => {
      const doc = r.documentos.find((d) => d.estado === 'vencido') ?? r.documentos.find((d) => d.estado === 'proximo')
      const motivo = r.motivos[0] ?? 'Revisar'
      if (doc) {
        return {
          icono: doc.dias < 0 ? 'alerta' : 'reloj',
          texto: `${doc.nombre} · ${v.patente}`,
          detalle: doc.dias < 0 ? `hace ${plural(-doc.dias, 'día', 'días')}` : doc.dias === 0 ? 'hoy' : `en ${plural(doc.dias, 'día', 'días')}`,
          tono: doc.dias < 0 ? 'v' : 'am',
          href: `/flota/${v.id}`,
        }
      }
      return { icono: r.semaforo === 'rojo' ? 'alerta' : 'llave', texto: `${motivo} · ${v.patente}`, detalle: '', tono: r.semaforo === 'rojo' ? 'v' : 'am', href: `/flota/${v.id}` }
    })
  return {
    key: 'flota',
    titulo: 'Flota',
    href: hrefFlota,
    icono: 'truck',
    color: 'var(--f-log)',
    chip: rojo ? { texto: `${rojo} ${rojo === 1 ? 'requiere' : 'requieren'} atención`, tono: 'ro' } : amarillo ? { texto: `${amarillo} a revisar`, tono: 'am' } : null,
    tags: [],
    segs: filas.map((f) => (f.r.semaforo === 'rojo' ? 'rojo' : f.r.semaforo === 'amarillo' ? 'amarillo' : 'verde')).sort((a, b) => SEMAFORO_ORDEN[a] - SEMAFORO_ORDEN[b]),
    resumen: `${verde} de ${filas.length} en orden`,
    meta: `${rojo} para resolver · ${amarillo} a revisar`,
    serie: serie.some((x) => x > 0) ? { valores: serie, rotulo: 'Km de la flota por semana', ultimo: `${fmtNum(serie.at(-1) ?? 0)} km` } : null,
    pasosTitulo: 'Para resolver',
    pasosCuenta: rojo + amarillo,
    pasos,
  }
}

/** Tarjeta de Palas cargadoras: documentación de cada pala y lo próximo que vence. */
async function tarjetaPalas(db: Db, empresas: EmpresaMin[]): Promise<RecursoInicio | null> {
  const ids = empresas.map((e) => e.id)
  const { data, error } = await db
    .from('equipos')
    .select('id, nombre, empresa_id, horometro, certificados(fecha_vencimiento, alerta_dias, tipo_nombre_custom, tipo:tipos_certificado(nombre))')
    .eq('categoria', CATEGORIA_PALAS)
    .in('empresa_id', ids)
  if (error || !data?.length) return null
  const palas = ordenarPalas(data.map((p) => ({ ...p, nombre: p.nombre ?? 'Pala' })))
  const est = palas.map((p) => {
    const certs = (p.certificados ?? []).filter((c) => c.fecha_vencimiento)
    const estados = certs.map((c) => getEstadoVencimiento(c.fecha_vencimiento, c.alerta_dias))
    const s: 'rojo' | 'amarillo' | 'verde' = estados.includes('vencido') ? 'rojo' : estados.includes('proximo') ? 'amarillo' : 'verde'
    const prox = [...certs].sort((a, b) => (a.fecha_vencimiento! < b.fecha_vencimiento! ? -1 : 1)).find((c) => diasHastaVencimiento(c.fecha_vencimiento!) >= -365)
    return { p, s, prox }
  })
  const alDia = est.filter((x) => x.s === 'verde').length
  const conHoras = palas.filter((p) => p.horometro != null)
  const empresaDe = new Map(empresas.map((e) => [e.id, e]))
  const unaEmpresa = new Set(palas.map((p) => p.empresa_id)).size === 1 ? empresaDe.get(palas[0].empresa_id!) : null
  const rojo = est.filter((x) => x.s === 'rojo').length
  const amarillo = est.filter((x) => x.s === 'amarillo').length
  return {
    key: 'palas',
    titulo: 'Palas cargadoras',
    href: `/palas?empresa=${unaEmpresa?.slug ?? empresaDe.get(palas[0].empresa_id!)?.slug ?? ''}`,
    icono: 'bulldozer',
    color: 'var(--f-ope)',
    chip: rojo ? { texto: plural(rojo, 'con algo vencido', 'con algo vencido'), tono: 'ro' } : amarillo ? { texto: `${amarillo} por vencer`, tono: 'am' } : null,
    tags: unaEmpresa ? [unaEmpresa.nombre] : [],
    segs: est.map((x) => x.s).sort((a, b) => SEMAFORO_ORDEN[a] - SEMAFORO_ORDEN[b]),
    resumen: `${alDia} de ${palas.length} al día`,
    meta: conHoras.length
      ? `Horómetro promedio ${fmtHorometro(Math.round(conHoras.reduce((a, p) => a + (p.horometro ?? 0), 0) / conHoras.length))}`
      : plural(palas.length, 'pala', 'palas'),
    // Sin historia de horómetro en la base (se carga a mano, un valor): no hay curva.
    serie: null,
    pasosTitulo: 'Próximo',
    pasosCuenta: palas.length,
    pasos: est.slice(0, 3).map(({ p, prox }) => {
      const slug = empresaDe.get(p.empresa_id!)?.slug ?? ''
      if (!prox) return { icono: 'calendario', texto: p.nombre, detalle: 'Sin vencimientos', tono: '', href: `/palas?empresa=${slug}&pala=${p.id}` }
      const d = diasHastaVencimiento(prox.fecha_vencimiento!)
      const tipo = (Array.isArray(prox.tipo) ? prox.tipo[0] : prox.tipo)?.nombre ?? prox.tipo_nombre_custom ?? 'Documento'
      return {
        icono: d < 0 ? 'alerta' : 'calendario',
        texto: `${tipo} · ${p.nombre}`,
        detalle: d < 0 ? `hace ${plural(-d, 'día', 'días')}` : fCorta(prox.fecha_vencimiento!),
        tono: d < 0 ? 'v' : d <= (prox.alerta_dias ?? 30) ? 'am' : '',
        href: `/palas?empresa=${slug}&pala=${p.id}`,
      }
    }),
  }
}

/** Tarjeta de Stock: ítems bajo el mínimo (el stock es la suma de movimientos, como /stock) y entregas por semana. */
async function tarjetaStock(db: Db, empresas: EmpresaMin[], hoy: string): Promise<RecursoInicio | null> {
  const ids = empresas.map((e) => e.id)
  const [items, movs] = await Promise.all([
    traerTodo((d, h) => db.from('stock_items').select('id, nombre, stock_minimo, activo, unidad, empresa_id').in('empresa_id', ids).order('id').range(d, h)),
    traerTodo((d, h) => db.from('stock_movimientos').select('id, item_id, tipo, cantidad, fecha').in('empresa_id', ids).order('id').range(d, h)),
  ])
  if (items.error || movs.error) return null
  const activos = items.data.filter((i) => i.activo !== false)
  if (!activos.length) return null
  // calcularStock SIEMPRE con el catálogo completo (AGENTS.md: si no, los ocultos pierden su stock).
  const stock = calcularStock(items.data, movs.data)
  const conMinimo = activos.filter((i) => (i.stock_minimo ?? 0) > 0)
  const bajo = conMinimo
    .map((i) => ({ i, s: stock.get(i.id)?.stock ?? 0 }))
    .filter(({ i, s }) => estadoStock(s, i.stock_minimo) !== 'vigente')
    .sort((a, b) => a.s / (a.i.stock_minimo ?? 1) - b.s / (b.i.stock_minimo ?? 1))
  const empresaDe = new Map(empresas.map((e) => [e.id, e]))
  const una = empresas.length === 1 ? empresas[0] : null
  const entregas = porSemana(movs.data.filter((m) => m.tipo === 'consumo').map((m) => m.fecha), hoy)
  const pctOk = conMinimo.length ? Math.round(((conMinimo.length - bajo.length) / conMinimo.length) * 100) : 100
  const llenos = conMinimo.length ? Math.round(((conMinimo.length - bajo.length) / conMinimo.length) * 10) : 10
  return {
    key: 'stock',
    titulo: 'Stock',
    href: una ? `/stock?empresa=${una.slug}` : '/stock',
    icono: 'package',
    color: 'var(--f-ope)',
    chip: bajo.length ? { texto: `${bajo.length} bajo el mínimo`, tono: 'am' } : null,
    tags: ['EPP y ropa'],
    segs: Array.from({ length: 10 }, (_, i) => (i < llenos ? 'verde' : 'amarillo')),
    resumen: `${pctOk} % sobre el mínimo`,
    meta: `${plural(activos.length, 'ítem', 'ítems')} en ${plural(new Set(activos.map((i) => i.empresa_id)).size, 'empresa', 'empresas')}`,
    serie: entregas.some((x) => x > 0) ? { valores: entregas, rotulo: 'Entregas por semana', ultimo: fmtNum(entregas.at(-1) ?? 0) } : null,
    pasosTitulo: 'Bajo el mínimo',
    pasosCuenta: bajo.length,
    pasos: bajo.slice(0, 3).map(({ i, s }) => {
      const e = empresaDe.get(i.empresa_id)
      return {
        icono: 'alerta',
        texto: `${i.nombre}${!una && e ? ` · ${e.nombre.replace(/^Tecnophos\s+/i, '')}` : ''}`,
        detalle: `${fmtCantidad(s)} de ${fmtCantidad(i.stock_minimo ?? 0, i.unidad)}`,
        tono: 'am',
        href: `/stock?empresa=${e?.slug ?? ''}`,
      }
    }),
  }
}

/** Tarjeta de ARCOR: estado del sistema externo, contenedores del mes y por día (lo que ya muestra /arcor). */
async function tarjetaArcor(): Promise<RecursoInicio | null> {
  const ahora = new Date()
  const mes = mesActual(ahora)
  const db = await adb()
  const [estados, abiertas, items]: [Awaited<ReturnType<typeof getEstados>>, Awaited<ReturnType<typeof getAlertasAbiertas>>, { fecha: string; estado: string }[]] = await Promise.all([
    getEstados(),
    getAlertasAbiertas(),
    db.from('arcor_contenedores').select('fecha, estado').eq('mes', mes).limit(1000).then((r: { data: unknown; error: { message: string } | null }) => rows<{ fecha: string; estado: string }>(r)),
  ])
  const vivos = items.filter((i) => i.estado !== 'descartado')
  const hoy = diaClaveAR(ahora)
  const dia = Number(hoy.slice(8, 10))
  const porDia = Array.from({ length: Math.min(10, dia) }, (_, k) => {
    const d = String(dia - Math.min(10, dia) + 1 + k).padStart(2, '0')
    return vivos.filter((i) => i.fecha.slice(8, 10) === d).length
  })
  const deHoy = porDia.at(-1) ?? 0
  const wa = estados.whatsapp?.valor as EstadoWhatsapp | undefined
  const claude = estados.claude?.valor as EstadoClaude | undefined
  const hb = estados.heartbeat?.valor as EstadoHeartbeat | undefined
  const silencio = evaluarSilencio(hb?.ts ?? null, ahora)
  const nivel = nivelCredito(claude?.porcentaje_usado, claude?.sin_credito)
  const n = abiertas.length + (silencio.silencio ? 1 : 0)
  const encontrados = vivos.filter((i) => i.estado === 'encontrado').length
  const llenos = vivos.length ? Math.round((encontrados / vivos.length) * 10) : 0
  return {
    key: 'arcor',
    titulo: 'Tecnophos - ARCOR',
    href: '/arcor',
    icono: 'container',
    color: 'var(--f-log)',
    chip: n ? { texto: plural(n, 'alerta abierta', 'alertas abiertas'), tono: abiertas.some((a) => a.severidad === 'critical') || silencio.silencio ? 'ro' : 'am' } : null,
    tags: [],
    segs: Array.from({ length: 10 }, (_, i) => (i < llenos ? 'verde' : null)),
    resumen: plural(vivos.length, 'contenedor', 'contenedores'),
    meta: `En ${mes.split(' ')[0].toLowerCase()} · ${deHoy} hoy`,
    serie: porDia.length > 1 ? { valores: porDia, rotulo: 'Contenedores por día', ultimo: `${deHoy} hoy` } : null,
    pasosTitulo: 'Estado del sistema',
    pasosCuenta: 3,
    pasos: [
      { icono: 'whatsapp', texto: 'WhatsApp', detalle: wa ? (wa.ok ? 'En línea' : 'Desconectado') : 'Sin dato', tono: wa ? (wa.ok ? 'ok' : 'v') : '', href: '/arcor' },
      { icono: 'chispa', texto: 'Crédito Claude', detalle: claude ? `US$ ${claude.restante_usd.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : 'Sin dato', tono: nivel === 'critical' ? 'v' : nivel === 'warning' ? 'am' : '', href: '/arcor' },
      { icono: 'reloj', texto: 'Último reporte', detalle: hb?.ts ? tiempoRelativo(hb.ts, ahora) : 'Sin dato', tono: silencio.silencio ? 'v' : '', href: '/arcor/actividad' },
    ],
  }
}

/**
 * Las tarjetas de Recursos de las empresas a la vista. Cada una se arma por su lado: si una
 * lectura falla, esa tarjeta no aparece y el resto sí (el Inicio no se cae por la flota).
 */
export async function cargarRecursos(
  db: Db,
  empresas: EmpresaMin[],
  opciones: { hrefFlota: string; arcor: boolean }
): Promise<{ tarjetas: RecursoInicio[]; fallas: string[] }> {
  const hoy = diaClaveAR(new Date())
  const tieneTecnophos = empresas.some((e) => e.slug.startsWith('tecnophos'))
  const pedidos: [string, Promise<RecursoInicio | null>][] = [
    ['Flota', tarjetaFlota(db, empresas, opciones.hrefFlota, hoy)],
    ['Palas cargadoras', tarjetaPalas(db, empresas)],
    ['Stock', tarjetaStock(db, empresas, hoy)],
  ]
  if (opciones.arcor && tieneTecnophos) pedidos.push(['Tecnophos - ARCOR', tarjetaArcor()])
  const res = await Promise.allSettled(pedidos.map(([, p]) => p))
  const tarjetas: RecursoInicio[] = []
  const fallas: string[] = []
  res.forEach((r, i) => {
    if (r.status === 'fulfilled') { if (r.value) tarjetas.push(r.value) }
    else { fallas.push(pedidos[i][0]); console.warn(`[inicio] ${pedidos[i][0]}:`, r.reason) }
  })
  return { tarjetas, fallas }
}
