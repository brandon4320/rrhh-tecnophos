// ============================================================
// Flota: estado de cada vehículo en una sola estructura (pura, sin I/O).
// La usan la pantalla /flota y el cron de avisos, así lo que ve la oficina y
// lo que llega por WhatsApp sale del mismo cálculo.
// ============================================================
import { diaClaveAR } from '@/lib/fechas-ar'
import { getEstadoVencimiento, type EstadoVencimiento } from '@/types'
import {
  estadoChecklist, kmPorDia, nombreMantenimiento, proximoMantenimiento, diasEntre,
  type EstadoChecklist, type ProximoMantenimiento, type Resultado,
} from './reglas'

export interface DatosVehiculo {
  id: string
  patente: string
  km_actual: number | null
  checklist_cada_dias: number
  checklist_activo: boolean
  checklists: { created_at: string; km: number | null; km_inconsistente: boolean; resultado: string }[]
  plan: { tipo: string; cada_km: number | null; cada_meses: number | null }[]
  services: { tipo: string; fecha: string; km: number | null }[]
  novedades: { gravedad: string; titulo: string; created_at: string }[]
  certificados: { nombre: string; fecha_vencimiento: string; alerta_dias: number | null }[]
}

export type Semaforo = 'rojo' | 'amarillo' | 'verde'

export interface ResumenVehiculo {
  checklist: { estado: EstadoChecklist; venceEn: number | null; diasDesde: number | null; ultimoResultado: Resultado | null; ultimoAt: string | null }
  kmDia: number | null
  mantenimientos: (ProximoMantenimiento & { tipo: string; nombre: string })[]
  documentos: { nombre: string; vence: string; estado: EstadoVencimiento; dias: number }[]
  novedades: { abiertas: number; altas: number; masVieja: string | null }
  semaforo: Semaforo
  /** Motivos del semáforo, en orden de gravedad, para mostrar o mandar. */
  motivos: string[]
}

/**
 * Mensaje de WhatsApp de la mañana para los encargados de una empresa: lo
 * vencido y lo que vence pronto, agrupado por tema y en una línea por grupo.
 * null si no hay nada que avisar (ese día no se manda nada).
 */
export function mensajeResumenDiario(
  empresa: { nombre: string; slug: string },
  filas: { patente: string; checklistActivo: boolean; r: ResumenVehiculo }[],
  hoy: string,
  url: string
): string | null {
  const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`
  const activos = filas.filter((f) => f.checklistActivo)

  const vencidos = activos.filter((f) => f.r.checklist.estado === 'vencido')
    .map((f) => `${f.patente} (hace ${plural(Math.abs(f.r.checklist.venceEn!), 'día', 'días')})`)
  const porVencer = activos.filter((f) => f.r.checklist.estado === 'vence_pronto')
    .map((f) => `${f.patente} (${f.r.checklist.venceEn === 0 ? 'hoy' : f.r.checklist.venceEn === 1 ? 'mañana' : `en ${f.r.checklist.venceEn} días`})`)
  const nunca = activos.filter((f) => f.r.checklist.estado === 'nunca').map((f) => f.patente)

  const services = filas.flatMap((f) =>
    f.r.mantenimientos
      .filter((m) => m.estado === 'vencido' || m.estado === 'proximo')
      .map((m) => `${f.patente}: ${m.nombre.toLowerCase()}${m.estado === 'vencido' ? ' VENCIDO' : ''} (${m.motivo})`)
  )
  const documentos = filas.flatMap((f) =>
    f.r.documentos
      .filter((d) => d.estado === 'vencido' || d.estado === 'proximo')
      .map((d) => `${f.patente}: ${d.nombre} ${d.estado === 'vencido' ? 'VENCIDO' : `vence en ${plural(d.dias, 'día', 'días')}`}`)
  )
  const noAptas = filas.filter((f) => f.r.checklist.ultimoResultado === 'no_apto').map((f) => f.patente)
  const graves = filas.filter((f) => f.r.novedades.altas > 0)
    .map((f) => `${f.patente} (${plural(f.r.novedades.altas, 'grave', 'graves')})`)

  const bloques: string[] = []
  const checklist = [
    vencidos.length ? `• Vencido: ${vencidos.join(', ')}` : null,
    porVencer.length ? `• Vence pronto: ${porVencer.join(', ')}` : null,
    nunca.length ? `• Sin hacer todavía: ${nunca.join(', ')}` : null,
  ].filter(Boolean)
  if (checklist.length) bloques.push(['*Checklist*', ...checklist].join('\n'))
  if (noAptas.length) bloques.push(`*No aptas para circular*\n• ${noAptas.join(', ')}`)
  if (graves.length) bloques.push(`*Novedades graves sin resolver*\n• ${graves.join(', ')}`)
  if (services.length) bloques.push(['*Service*', ...services.map((s) => `• ${s}`)].join('\n'))
  if (documentos.length) bloques.push(['*Documentación*', ...documentos.map((d) => `• ${d}`)].join('\n'))
  if (!bloques.length) return null

  const fecha = new Date(`${hoy}T12:00:00-03:00`).toLocaleDateString('es-AR', {
    weekday: 'long', day: '2-digit', month: '2-digit', timeZone: 'America/Argentina/Buenos_Aires',
  })
  return [`Flota ${empresa.nombre} · ${fecha}`, '', bloques.join('\n\n'), '', `Ver: ${url}/flota?empresa=${empresa.slug}`].join('\n')
}

export function resumirVehiculo(d: DatosVehiculo, hoy: string = diaClaveAR(new Date())): ResumenVehiculo {
  const ordenados = [...d.checklists].sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
  const ultimo = ordenados[0] ?? null
  const chk = estadoChecklist(ultimo?.created_at ?? null, d.checklist_cada_dias, hoy)

  const lecturas = d.checklists
    .filter((c) => c.km != null && !c.km_inconsistente)
    .map((c) => ({ fecha: c.created_at, km: c.km as number }))
  const kmDia = kmPorDia(lecturas, hoy)

  const mantenimientos = d.plan.map((p) => {
    const ultimoService = d.services
      .filter((s) => s.tipo === p.tipo)
      .sort((a, b) => (a.fecha < b.fecha ? 1 : -1))[0] ?? null
    return {
      tipo: p.tipo,
      nombre: nombreMantenimiento(p.tipo),
      ...proximoMantenimiento(p, ultimoService, d.km_actual, kmDia, hoy),
    }
  })

  // El vencimiento más lejano de cada tipo de documento (la VTV nueva manda sobre la vieja).
  const porTipo = new Map<string, { nombre: string; vence: string; alerta: number | null }>()
  for (const c of d.certificados) {
    const vence = c.fecha_vencimiento.slice(0, 10)
    const previo = porTipo.get(c.nombre)
    if (!previo || vence > previo.vence) porTipo.set(c.nombre, { nombre: c.nombre, vence, alerta: c.alerta_dias })
  }
  const documentos = [...porTipo.values()].map((x) => ({
    nombre: x.nombre,
    vence: x.vence,
    estado: getEstadoVencimiento(x.vence, x.alerta),
    dias: diasEntre(hoy, x.vence),
  }))

  const altas = d.novedades.filter((n) => n.gravedad === 'alta').length
  const masVieja = d.novedades.map((n) => n.created_at).sort()[0] ?? null

  const rojos: string[] = []
  const amarillos: string[] = []
  if (ultimo?.resultado === 'no_apto') rojos.push('No apta en el último checklist')
  if (altas > 0) rojos.push(`${altas} ${altas === 1 ? 'novedad grave abierta' : 'novedades graves abiertas'}`)
  for (const m of mantenimientos) {
    if (m.estado === 'vencido') rojos.push(`${m.nombre}: ${m.motivo}`)
    else if (m.estado === 'proximo') amarillos.push(`${m.nombre}: ${m.motivo}`)
  }
  for (const doc of documentos) {
    if (doc.estado === 'vencido') rojos.push(`${doc.nombre} vencido`)
    else if (doc.estado === 'proximo') amarillos.push(`${doc.nombre} vence en ${doc.dias} ${doc.dias === 1 ? 'día' : 'días'}`)
  }
  if (d.checklist_activo) {
    if (chk.estado === 'vencido') rojos.push(`Checklist vencido hace ${Math.abs(chk.venceEn!)} ${Math.abs(chk.venceEn!) === 1 ? 'día' : 'días'}`)
    else if (chk.estado === 'vence_pronto') amarillos.push(chk.venceEn === 0 ? 'Checklist vence hoy' : `Checklist vence en ${chk.venceEn} ${chk.venceEn === 1 ? 'día' : 'días'}`)
    else if (chk.estado === 'nunca') amarillos.push('Sin checklist todavía')
  }
  const abiertasNoAltas = d.novedades.length - altas
  if (abiertasNoAltas > 0) amarillos.push(`${abiertasNoAltas} ${abiertasNoAltas === 1 ? 'novedad abierta' : 'novedades abiertas'}`)

  return {
    checklist: {
      ...chk,
      ultimoResultado: (ultimo?.resultado as Resultado | undefined) ?? null,
      ultimoAt: ultimo?.created_at ?? null,
    },
    kmDia,
    mantenimientos,
    documentos,
    novedades: { abiertas: d.novedades.length, altas, masVieja },
    semaforo: rojos.length ? 'rojo' : amarillos.length ? 'amarillo' : 'verde',
    motivos: [...rojos, ...amarillos],
  }
}
