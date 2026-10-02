// ============================================================
// Flota: reglas puras (sin I/O) del checklist quincenal, los kilómetros,
// el mantenimiento y los avisos. Ver reglas.test.ts.
//
// El contenido del checklist vive acá a propósito, como las carpetas fijas de
// documentos: agregar o sacar un ítem es editar esta lista, sin migración.
// Las respuestas se guardan por id de ítem, así que renombrar un ítem no
// rompe el historial; cambiarle el id, sí (queda como ítem viejo).
// ============================================================
import { diaClaveAR } from '@/lib/fechas-ar'

// ── Fotos ───────────────────────────────────────────────────────────────────

export interface SlotFoto {
  slot: string
  label: string
  ayuda?: string
  obligatoria: boolean
}

export const FOTOS_CHECKLIST: SlotFoto[] = [
  { slot: 'tablero', label: 'Tablero', ayuda: 'Con el motor en marcha: que se lean los kilómetros y los testigos', obligatoria: true },
  { slot: 'frente', label: 'Frente', obligatoria: true },
  { slot: 'trasera', label: 'Trasera', obligatoria: true },
  { slot: 'lateral_izq', label: 'Lateral izquierdo', obligatoria: true },
  { slot: 'lateral_der', label: 'Lateral derecho', obligatoria: true },
  { slot: 'cubierta_di', label: 'Rueda delantera izquierda', ayuda: 'Que se vea la llanta y el dibujo de la cubierta', obligatoria: true },
  { slot: 'cubierta_dd', label: 'Rueda delantera derecha', ayuda: 'Que se vea la llanta y el dibujo de la cubierta', obligatoria: true },
  { slot: 'cubierta_ti', label: 'Rueda trasera izquierda', ayuda: 'Que se vea la llanta y el dibujo de la cubierta', obligatoria: true },
  { slot: 'cubierta_td', label: 'Rueda trasera derecha', ayuda: 'Que se vea la llanta y el dibujo de la cubierta', obligatoria: true },
  { slot: 'auxilio', label: 'Rueda de auxilio', obligatoria: false },
  { slot: 'caja', label: 'Caja de carga', obligatoria: false },
]

export const SLOTS_VALIDOS = new Set(FOTOS_CHECKLIST.map((f) => f.slot))
/** Slot de las fotos de un reporte de novedad (golpe, falla) hecho por QR. */
export const SLOT_NOVEDAD = 'novedad'

// ── Ítems ───────────────────────────────────────────────────────────────────

export interface ItemChecklist {
  id: string
  label: string
  /** "No OK" en un ítem crítico deja la camioneta como NO APTA para circular. */
  critico: boolean
}

export interface SeccionChecklist {
  id: string
  titulo: string
  items: ItemChecklist[]
}

export const SECCIONES_CHECKLIST: SeccionChecklist[] = [
  {
    id: 'cubiertas',
    titulo: 'Cubiertas y ruedas',
    items: [
      { id: 'cubiertas_desgaste', label: 'Dibujo por encima del testigo de desgaste', critico: true },
      { id: 'cubiertas_danos', label: 'Sin cortes, globos ni deformaciones', critico: true },
      { id: 'cubiertas_presion', label: 'Presión correcta', critico: false },
      { id: 'bulones', label: 'Bulones completos y ajustados', critico: true },
      { id: 'auxilio', label: 'Auxilio inflado y en condiciones', critico: false },
    ],
  },
  {
    id: 'motor',
    titulo: 'Motor y niveles',
    items: [
      { id: 'aceite', label: 'Nivel de aceite', critico: true },
      { id: 'refrigerante', label: 'Nivel de refrigerante', critico: true },
      { id: 'liquido_frenos', label: 'Nivel de líquido de frenos', critico: true },
      { id: 'agua_limpiaparabrisas', label: 'Agua del limpiaparabrisas', critico: false },
      { id: 'perdidas', label: 'Sin pérdidas debajo (aceite, agua, gasoil)', critico: true },
      { id: 'testigos', label: 'Ningún testigo encendido con el motor en marcha', critico: true },
    ],
  },
  {
    id: 'luces',
    titulo: 'Luces',
    items: [
      { id: 'luces_bajas_altas', label: 'Bajas y altas', critico: true },
      { id: 'luces_freno', label: 'Luces de freno', critico: true },
      { id: 'luces_giro', label: 'Giros y balizas', critico: true },
      { id: 'luces_posicion', label: 'Posición', critico: false },
      { id: 'luces_reversa', label: 'Reversa', critico: false },
    ],
  },
  {
    id: 'manejo',
    titulo: 'Frenos y manejo',
    items: [
      { id: 'frenos', label: 'Frenos: responden bien y sin ruidos', critico: true },
      { id: 'freno_mano', label: 'Freno de mano', critico: true },
      { id: 'direccion', label: 'Dirección sin juego ni ruidos', critico: true },
      { id: 'cinturones', label: 'Cinturones de seguridad', critico: true },
      { id: 'parabrisas', label: 'Parabrisas sin fisuras en la vista', critico: false },
      { id: 'escobillas', label: 'Escobillas del limpiaparabrisas', critico: false },
      { id: 'espejos', label: 'Espejos completos', critico: false },
      { id: 'bocina', label: 'Bocina', critico: false },
    ],
  },
  {
    id: 'obligatorios',
    titulo: 'Elementos obligatorios',
    items: [
      { id: 'matafuegos', label: 'Matafuegos cargado, con precinto y carga vigente', critico: true },
      { id: 'balizas_triangulo', label: 'Dos balizas triangulares', critico: false },
      { id: 'chaleco', label: 'Chaleco reflectivo', critico: false },
      { id: 'botiquin', label: 'Botiquín', critico: false },
      { id: 'gato_llave', label: 'Gato y llave de rueda', critico: false },
    ],
  },
  {
    id: 'documentacion',
    titulo: 'Documentación a bordo',
    items: [
      { id: 'cedula', label: 'Cédula del vehículo', critico: false },
      { id: 'seguro', label: 'Comprobante del seguro', critico: false },
      { id: 'vtv', label: 'Oblea y certificado de VTV', critico: false },
    ],
  },
  {
    id: 'carga',
    titulo: 'Carga y productos',
    items: [
      // Fumigantes (fosfuro): con humedad liberan gas, y dentro de una cabina
      // cerrada es un riesgo grave para quien maneja.
      { id: 'productos_fuera_cabina', label: 'Ningún producto dentro de la cabina', critico: true },
      { id: 'productos_envases', label: 'Productos en envases originales, cerrados y secos', critico: true },
      { id: 'carga_sujeta', label: 'Carga sujeta y bien estibada', critico: false },
      { id: 'kit_derrames', label: 'Kit para derrames a bordo', critico: false },
      { id: 'epp', label: 'EPP a bordo (máscara, guantes, antiparras)', critico: false },
    ],
  },
  {
    id: 'orden',
    titulo: 'Orden y limpieza',
    items: [
      { id: 'cabina_limpia', label: 'Cabina limpia y ordenada', critico: false },
      { id: 'caja_limpia', label: 'Caja limpia, sin restos de producto', critico: false },
    ],
  },
]

export const ITEMS_CHECKLIST: ItemChecklist[] = SECCIONES_CHECKLIST.flatMap((s) => s.items)
const ITEM_POR_ID = new Map(ITEMS_CHECKLIST.map((i) => [i.id, i]))

export function itemPorId(id: string): ItemChecklist | undefined {
  return ITEM_POR_ID.get(id)
}

export type Respuesta = 'ok' | 'obs' | 'no_ok'
export const RESPUESTAS: Respuesta[] = ['ok', 'obs', 'no_ok']
export const RESPUESTA_LABEL: Record<Respuesta, string> = { ok: 'Bien', obs: 'Observación', no_ok: 'Mal' }

export type Resultado = 'ok' | 'observaciones' | 'no_apto'
export const RESULTADO_LABEL: Record<Resultado, string> = {
  ok: 'Todo en orden',
  observaciones: 'Con observaciones',
  no_apto: 'No apta para circular',
}

/** Ítems del checklist sin responder (vacío = completo). */
export function itemsSinResponder(respuestas: Record<string, string | undefined>): string[] {
  return ITEMS_CHECKLIST.filter((i) => !RESPUESTAS.includes(respuestas[i.id] as Respuesta)).map((i) => i.id)
}

/** Fotos obligatorias que faltan. */
export function fotosFaltantes(fotos: Record<string, string | undefined>): SlotFoto[] {
  return FOTOS_CHECKLIST.filter((f) => f.obligatoria && !fotos[f.slot])
}

/**
 * Un "Mal" en un ítem crítico deja la camioneta no apta. Cualquier otro "Mal"
 * u "Observación" la deja con observaciones. El resto, en orden.
 */
export function calcularResultado(respuestas: Record<string, string | undefined>): Resultado {
  let observaciones = false
  for (const item of ITEMS_CHECKLIST) {
    const r = respuestas[item.id]
    if (r === 'no_ok' && item.critico) return 'no_apto'
    if (r === 'no_ok' || r === 'obs') observaciones = true
  }
  return observaciones ? 'observaciones' : 'ok'
}

export interface NovedadPropuesta {
  item: string
  titulo: string
  descripcion: string | null
  gravedad: 'baja' | 'media' | 'alta'
}

/**
 * Cada "Mal" se convierte en una novedad a resolver (alta si el ítem es
 * crítico). Las "Observaciones" quedan anotadas en el checklist: avisan, pero
 * no abren un pendiente.
 */
export function novedadesDelChecklist(
  respuestas: Record<string, string | undefined>,
  notas: Record<string, string | undefined> = {}
): NovedadPropuesta[] {
  return ITEMS_CHECKLIST.filter((i) => respuestas[i.id] === 'no_ok').map((i) => ({
    item: i.id,
    titulo: i.label,
    descripcion: notas[i.id]?.trim() || null,
    gravedad: i.critico ? 'alta' : 'media',
  }))
}

// ── Kilómetros ──────────────────────────────────────────────────────────────

/** Promedio diario máximo creíble para una camioneta de servicio. */
const KM_DIA_MAXIMO = 1200
const SALTO_MINIMO_TOLERADO = 3000

/**
 * ¿El km cargado cuadra con el historial? Un odómetro no retrocede, y un salto
 * imposible es casi siempre un dígito de más. NO se rechaza: quien está en la
 * camioneta no puede corregir el pasado. Se guarda marcado y no pisa el km del
 * vehículo hasta que alguien lo revise en Gestión.
 */
export function evaluarKm(
  kmNuevo: number,
  anterior: { km: number | null; fecha: string | null }
): { inconsistente: boolean; motivo: string | null } {
  if (anterior.km == null) return { inconsistente: false, motivo: null }
  if (kmNuevo < anterior.km) {
    return { inconsistente: true, motivo: `Menor que el último registrado (${anterior.km.toLocaleString('es-AR')} km)` }
  }
  const dias = anterior.fecha ? Math.max(1, diasEntre(diaClaveAR(anterior.fecha), diaClaveAR(new Date()))) : 1
  const salto = kmNuevo - anterior.km
  if (salto > Math.max(SALTO_MINIMO_TOLERADO, KM_DIA_MAXIMO * dias)) {
    return {
      inconsistente: true,
      motivo: `Salto de ${salto.toLocaleString('es-AR')} km en ${dias} ${dias === 1 ? 'día' : 'días'}`,
    }
  }
  return { inconsistente: false, motivo: null }
}

export interface LecturaKm {
  fecha: string // timestamptz o 'YYYY-MM-DD'
  km: number
}

/**
 * Kilómetros por día de los últimos 120 días, para proyectar el próximo
 * service. null si no hay al menos una semana de historia entre la primera y
 * la última lectura.
 */
export function kmPorDia(lecturas: LecturaKm[], hoy: string = diaClaveAR(new Date())): number | null {
  const desde = sumarDias(hoy, -120)
  const validas = lecturas
    .map((l) => ({ dia: diaClaveAR(l.fecha), km: l.km }))
    .filter((l) => l.dia >= desde && l.dia <= hoy && Number.isFinite(l.km))
    .sort((a, b) => (a.dia < b.dia ? -1 : a.dia > b.dia ? 1 : a.km - b.km))
  if (validas.length < 2) return null
  const primera = validas[0]
  const ultima = validas[validas.length - 1]
  const dias = diasEntre(primera.dia, ultima.dia)
  if (dias < 7 || ultima.km < primera.km) return null
  return Math.round(((ultima.km - primera.km) / dias) * 10) / 10
}

// ── Checklist: ¿está al día? ────────────────────────────────────────────────

export type EstadoChecklist = 'al_dia' | 'vence_pronto' | 'vencido' | 'nunca'

export const ESTADO_CHECKLIST_LABEL: Record<EstadoChecklist, string> = {
  al_dia: 'Al día',
  vence_pronto: 'Vence pronto',
  vencido: 'Vencido',
  nunca: 'Sin checklist',
}

/** Días de anticipación con que se avisa que el checklist está por vencer. */
export const AVISO_CHECKLIST_DIAS = 2

export function estadoChecklist(
  ultimoAt: string | null,
  cadaDias: number,
  hoy: string = diaClaveAR(new Date())
): { estado: EstadoChecklist; diasDesde: number | null; venceEn: number | null } {
  if (!ultimoAt) return { estado: 'nunca', diasDesde: null, venceEn: null }
  const diasDesde = diasEntre(diaClaveAR(ultimoAt), hoy)
  const venceEn = cadaDias - diasDesde
  const estado: EstadoChecklist = venceEn < 0 ? 'vencido' : venceEn <= AVISO_CHECKLIST_DIAS ? 'vence_pronto' : 'al_dia'
  return { estado, diasDesde, venceEn }
}

// ── Mantenimiento ───────────────────────────────────────────────────────────

export const TIPOS_MANTENIMIENTO: Record<string, string> = {
  service: 'Service (aceite y filtros)',
  cubiertas: 'Rotación y alineación',
  frenos: 'Frenos (pastillas y discos)',
  distribucion: 'Correa de distribución',
}

export function nombreMantenimiento(tipo: string): string {
  return TIPOS_MANTENIMIENTO[tipo] ?? tipo
}

/** Cuánto antes se avisa un service: lo que llegue primero. */
export const AVISO_SERVICE_KM = 1000
export const AVISO_SERVICE_DIAS = 21

export type EstadoMantenimiento = 'ok' | 'proximo' | 'vencido' | 'sin_dato'

export interface ProximoMantenimiento {
  estado: EstadoMantenimiento
  kmObjetivo: number | null
  kmRestantes: number | null
  /** Fecha en que se estima llegar: por km (al ritmo actual) o por tiempo, la primera. */
  fechaEstimada: string | null
  motivo: string
}

export function proximoMantenimiento(
  plan: { cada_km: number | null; cada_meses: number | null },
  ultimo: { fecha: string; km: number | null } | null,
  kmActual: number | null,
  kmDia: number | null,
  hoy: string = diaClaveAR(new Date())
): ProximoMantenimiento {
  if (!ultimo) {
    return { estado: 'sin_dato', kmObjetivo: null, kmRestantes: null, fechaEstimada: null, motivo: 'Cargá el último service para calcular el próximo' }
  }

  let kmObjetivo: number | null = null
  let kmRestantes: number | null = null
  let fechaPorKm: string | null = null
  if (plan.cada_km && ultimo.km != null) {
    kmObjetivo = ultimo.km + plan.cada_km
    if (kmActual != null) {
      kmRestantes = kmObjetivo - kmActual
      if (kmDia && kmDia > 0) fechaPorKm = sumarDias(hoy, Math.max(0, Math.round(kmRestantes / kmDia)))
    }
  }
  const fechaPorTiempo = plan.cada_meses ? sumarMeses(diaClaveAR(ultimo.fecha), plan.cada_meses) : null

  const candidatas = [fechaPorKm, fechaPorTiempo].filter((f): f is string => !!f)
  const fechaEstimada = candidatas.length ? candidatas.sort()[0] : null

  const vencidoKm = kmRestantes != null && kmRestantes <= 0
  const vencidoTiempo = fechaPorTiempo != null && fechaPorTiempo <= hoy
  if (vencidoKm || vencidoTiempo) {
    return {
      estado: 'vencido',
      kmObjetivo,
      kmRestantes,
      fechaEstimada,
      motivo: vencidoKm
        ? `Pasado por ${Math.abs(kmRestantes!).toLocaleString('es-AR')} km`
        : `Venció por tiempo el ${fmtDia(fechaPorTiempo!)}`,
    }
  }

  const proximoKm = kmRestantes != null && kmRestantes <= AVISO_SERVICE_KM
  const proximoFecha = fechaEstimada != null && diasEntre(hoy, fechaEstimada) <= AVISO_SERVICE_DIAS
  const partes = [
    kmRestantes != null ? `faltan ${kmRestantes.toLocaleString('es-AR')} km` : null,
    fechaEstimada ? `aprox. ${fmtDia(fechaEstimada)}` : null,
  ].filter(Boolean)
  if (kmObjetivo != null && kmActual == null) partes.unshift(`a los ${kmObjetivo.toLocaleString('es-AR')} km`)

  return {
    estado: proximoKm || proximoFecha ? 'proximo' : 'ok',
    kmObjetivo,
    kmRestantes,
    fechaEstimada,
    motivo: partes.join(' · ') || 'Sin datos suficientes',
  }
}

// ── Teléfonos (WhatsApp) ────────────────────────────────────────────────────

/**
 * Normaliza a formato internacional sin "+": 549 + característica + número.
 * Acepta lo que la gente escribe: "0291 15 412-3456", "+54 9 291 4123456",
 * "2914123456". null si no parece un celular válido.
 */
export function normalizarTelefono(input: string): string | null {
  let d = input.replace(/\D/g, '')
  if (!d) return null
  if (d.startsWith('00')) d = d.slice(2)
  if (d.startsWith('54')) {
    d = d.slice(2)
    if (d.startsWith('9')) d = d.slice(1)
  }
  if (d.startsWith('0')) d = d.slice(1)
  // El "15" de los celulares viejos va después de la característica (2 a 4 dígitos).
  const con15 = /^(\d{2,4})15(\d{6,8})$/.exec(d)
  if (con15 && (con15[1] + con15[2]).length === 10) d = con15[1] + con15[2]
  if (d.length !== 10) return null
  return `549${d}`
}

// ── Fechas (date-only, 'YYYY-MM-DD') ────────────────────────────────────────

function aUTC(dia: string): number {
  const [y, m, d] = dia.split('-').map(Number)
  return Date.UTC(y, m - 1, d)
}

export function diasEntre(desde: string, hasta: string): number {
  return Math.round((aUTC(hasta) - aUTC(desde)) / 86_400_000)
}

export function sumarDias(dia: string, n: number): string {
  return new Date(aUTC(dia) + n * 86_400_000).toISOString().slice(0, 10)
}

export function sumarMeses(dia: string, n: number): string {
  const [y, m, d] = dia.split('-').map(Number)
  const fecha = new Date(Date.UTC(y, m - 1 + n, 1))
  // Último día del mes destino si el día no existe (31/01 + 1 mes = 28/02).
  const ultimo = new Date(Date.UTC(fecha.getUTCFullYear(), fecha.getUTCMonth() + 1, 0)).getUTCDate()
  fecha.setUTCDate(Math.min(d, ultimo))
  return fecha.toISOString().slice(0, 10)
}

export function fmtDia(dia: string): string {
  return `${dia.slice(8, 10)}/${dia.slice(5, 7)}`
}
