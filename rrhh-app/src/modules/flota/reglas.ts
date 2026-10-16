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

// Los lados se nombran por el conductor, no por izquierda/derecha: según desde
// dónde mire, cada uno entiende otra cosa. En Argentina el conductor va a la
// izquierda (los ids `_izq`/`_der` siguen valiendo: NO cambiarlos).
// ── Tipos de vehículo ───────────────────────────────────────────────────────
//
// El checklist cambia según qué es: a un trailer no se le piden km, tablero ni
// niveles de motor; a un furgón se le revisa el compartimento de carga y no la
// "caja". `vehiculos.tipo` lo fija la oficina; si está vacío se deduce del modelo.

export type TipoVehiculo = 'pickup' | 'utilitario' | 'furgon' | 'trailer'
export const TIPOS_VEHICULO: TipoVehiculo[] = ['pickup', 'utilitario', 'furgon', 'trailer']
export const TIPO_VEHICULO_LABEL: Record<TipoVehiculo, string> = {
  pickup: 'Pickup',
  utilitario: 'Utilitario',
  furgon: 'Furgón',
  trailer: 'Trailer',
}
const MOTOR: TipoVehiculo[] = ['pickup', 'utilitario', 'furgon']
const TODOS: TipoVehiculo[] = TIPOS_VEHICULO
const CON_COMPARTIMENTO: TipoVehiculo[] = ['utilitario', 'furgon']

/** ¿Tiene motor y tablero? (pide km, foto del tablero, niveles, service por km). */
export const tieneMotor = (t: TipoVehiculo) => t !== 'trailer'

const MODELOS: [TipoVehiculo, RegExp][] = [
  ['trailer', /\b(trailer|acoplado|semirremolque|batan|carro)\b/],
  ['furgon', /\b(jumper|ducato|sprinter|master|boxer|daily|transit|trafic|iveco)\b/],
  ['utilitario', /\b(partner|berlingo|kangoo|fiorino|doblo|caddy|expert|rifter)\b/],
  ['pickup', /\b(amarok|ranger|strada|hilux|s10|s-10|toro|saveiro|frontier|oroch|montana|maverick|alaskan|f-?100|f-?150)\b/],
]

/** Tipo deducido de marca/modelo/patente (los acoplados llevan "101" adelante). Sin pistas: pickup. */
export function inferirTipo(marca: string | null | undefined, modelo: string | null | undefined, patente?: string | null): TipoVehiculo {
  const t = `${marca ?? ''} ${modelo ?? ''}`.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
  for (const [tipo, re] of MODELOS) if (re.test(t)) return tipo
  if (patente && /^101[A-Z]/i.test(patente.replace(/\s/g, ''))) return 'trailer'
  return 'pickup'
}

/** El tipo que manda: el elegido por la oficina o, si no hay, el deducido. */
export function tipoDe(v: { tipo?: string | null; marca?: string | null; modelo?: string | null; patente?: string | null }): TipoVehiculo {
  return TIPOS_VEHICULO.includes(v.tipo as TipoVehiculo) ? (v.tipo as TipoVehiculo) : inferirTipo(v.marca, v.modelo, v.patente)
}

// ── Fotos ───────────────────────────────────────────────────────────────────

interface SlotFotoDef extends SlotFoto {
  /** A qué tipos aplica (por defecto, a los que tienen motor). */
  para?: TipoVehiculo[]
  /** Otro rótulo/ayuda/obligatoriedad para algún tipo. */
  segun?: Partial<Record<TipoVehiculo, Partial<SlotFoto>>>
}

const RUEDA = 'Que se vea la llanta y el dibujo de la cubierta'

// Los ids de slot NO se cambian (las fotos viejas se guardaron con ellos).
const FOTOS_DEF: SlotFotoDef[] = [
  { slot: 'tablero', label: 'Tablero', ayuda: 'Con el motor en marcha: que se lean los kilómetros y los testigos', obligatoria: true },
  {
    slot: 'frente', label: 'Frente', ayuda: 'Que se vea la patente', obligatoria: true, para: TODOS,
    segun: { trailer: { label: 'Frente y enganche', ayuda: 'Que se vean la lanza, el enganche y la cadena de seguridad' } },
  },
  {
    slot: 'trasera', label: 'Trasera', ayuda: 'Que se vea la patente', obligatoria: true, para: TODOS,
    segun: { trailer: { ayuda: 'Que se vean las luces y la patente' } },
  },
  { slot: 'lateral_izq', label: 'Lateral, lado del conductor', obligatoria: true, para: TODOS },
  { slot: 'lateral_der', label: 'Lateral, lado del acompañante', obligatoria: true, para: TODOS },
  {
    slot: 'cubierta_di', label: 'Rueda delantera, lado del conductor', ayuda: RUEDA, obligatoria: true, para: TODOS,
    segun: { trailer: { label: 'Rueda, lado del conductor' } },
  },
  {
    slot: 'cubierta_dd', label: 'Rueda delantera, lado del acompañante', ayuda: RUEDA, obligatoria: true, para: TODOS,
    segun: { trailer: { label: 'Rueda, lado del acompañante' } },
  },
  {
    slot: 'cubierta_ti', label: 'Rueda trasera, lado del conductor', ayuda: RUEDA, obligatoria: true, para: TODOS,
    segun: { trailer: { label: 'Segundo eje, lado del conductor', ayuda: 'Solo si el trailer tiene dos ejes', obligatoria: false } },
  },
  {
    slot: 'cubierta_td', label: 'Rueda trasera, lado del acompañante', ayuda: RUEDA, obligatoria: true, para: TODOS,
    segun: { trailer: { label: 'Segundo eje, lado del acompañante', ayuda: 'Solo si el trailer tiene dos ejes', obligatoria: false } },
  },
  { slot: 'auxilio', label: 'Rueda de auxilio', obligatoria: false },
  {
    slot: 'caja', label: 'Caja de carga', obligatoria: false, para: TODOS,
    segun: {
      utilitario: { label: 'Compartimento de carga', ayuda: 'Con las puertas abiertas' },
      furgon: { label: 'Compartimento de carga', ayuda: 'Con las puertas abiertas' },
      trailer: { label: 'Carga o piso del trailer' },
    },
  },
]

/** Las fotos que se piden para un tipo de vehículo, con sus rótulos. */
export function fotosPara(tipo: TipoVehiculo): SlotFoto[] {
  return FOTOS_DEF.filter((f) => (f.para ?? MOTOR).includes(tipo)).map((f) => {
    const { para: _para, segun, ...base } = f
    void _para
    return { ...base, ...(segun?.[tipo] ?? {}) }
  })
}

/** Rótulos de una camioneta (el caso de siempre): se usan donde no importa el tipo. */
export const FOTOS_CHECKLIST: SlotFoto[] = fotosPara('pickup')

export const SLOTS_VALIDOS = new Set(FOTOS_DEF.map((f) => f.slot))
/** Slot de las fotos de un reporte de novedad (golpe, falla) hecho por QR. */
export const SLOT_NOVEDAD = 'novedad'

// ── Ítems ───────────────────────────────────────────────────────────────────

export interface ItemChecklist {
  id: string
  label: string
  /** "No OK" en un ítem crítico deja la camioneta como NO APTA para circular. */
  critico: boolean
}

interface ItemDef extends ItemChecklist {
  /** A qué tipos aplica (por defecto, a los que tienen motor). */
  para?: TipoVehiculo[]
  /** Otro rótulo según el tipo (el id no cambia: el historial sigue valiendo). */
  labelSegun?: Partial<Record<TipoVehiculo, string>>
}

export interface SeccionChecklist {
  id: string
  titulo: string
  items: ItemChecklist[]
}

interface SeccionDef {
  id: string
  titulo: string
  items: ItemDef[]
}

// Los ids de ítem NO se cambian: las respuestas viejas se guardaron con ellos.
const SECCIONES_DEF: SeccionDef[] = [
  {
    id: 'enganche',
    titulo: 'Enganche',
    items: [
      { id: 'enganche_traba', label: 'Enganche bien calzado y trabado', critico: true, para: ['trailer'] },
      { id: 'cadena_seguridad', label: 'Cadena o cable de seguridad colocado', critico: true, para: ['trailer'] },
      { id: 'ficha_electrica', label: 'Ficha eléctrica conectada, sin cables pelados', critico: true, para: ['trailer'] },
    ],
  },
  {
    id: 'cubiertas',
    titulo: 'Cubiertas y ruedas',
    items: [
      { id: 'cubiertas_desgaste', label: 'Dibujo por encima del testigo de desgaste', critico: true, para: TODOS },
      { id: 'cubiertas_danos', label: 'Sin cortes, globos ni deformaciones', critico: true, para: TODOS },
      { id: 'cubiertas_presion', label: 'Presión correcta', critico: false, para: TODOS },
      { id: 'bulones', label: 'Bulones completos y ajustados', critico: true, para: TODOS },
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
      { id: 'luces_freno', label: 'Luces de freno', critico: true, para: TODOS },
      { id: 'luces_giro', label: 'Giros y balizas', critico: true, para: TODOS, labelSegun: { trailer: 'Giros' } },
      { id: 'luces_posicion', label: 'Posición', critico: false, para: TODOS },
      { id: 'luces_reversa', label: 'Reversa', critico: false },
      { id: 'luz_patente', label: 'Luz de patente', critico: false, para: ['trailer'] },
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
    id: 'estructura',
    titulo: 'Chasis y estructura',
    items: [
      { id: 'chasis_lanza', label: 'Chasis, lanza y piso sin fisuras ni óxido avanzado', critico: false, para: ['trailer'] },
      { id: 'guardabarros', label: 'Guardabarros completos y firmes', critico: false, para: ['trailer'] },
      { id: 'patente_visible', label: 'Patente colocada y legible', critico: false, para: ['trailer'] },
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
      { id: 'cedula', label: 'Cédula del vehículo', critico: false, para: TODOS, labelSegun: { trailer: 'Cédula del trailer' } },
      { id: 'seguro', label: 'Comprobante del seguro', critico: false, para: TODOS },
      { id: 'vtv', label: 'Oblea y certificado de VTV', critico: false, para: TODOS },
    ],
  },
  {
    id: 'carga',
    titulo: 'Carga y productos',
    items: [
      // Fumigantes (fosfuro): con humedad liberan gas, y dentro de una cabina
      // cerrada es un riesgo grave para quien maneja.
      { id: 'productos_fuera_cabina', label: 'Ningún producto dentro de la cabina', critico: true },
      // En utilitarios y furgones la carga va en el mismo cuerpo que la cabina:
      // la separación es lo que mantiene el gas lejos de quien maneja.
      { id: 'mampara', label: 'Separación entre cabina y carga sin aberturas', critico: false, para: CON_COMPARTIMENTO },
      { id: 'puertas_carga', label: 'Puertas de carga cierran y traban', critico: false, para: CON_COMPARTIMENTO },
      { id: 'caja_cobertor', label: 'Tapa o lona de la caja en buen estado', critico: false, para: ['pickup'] },
      { id: 'productos_envases', label: 'Productos en envases originales, cerrados y secos', critico: true, para: TODOS },
      { id: 'carga_sujeta', label: 'Carga sujeta y bien estibada', critico: false, para: TODOS },
      { id: 'kit_derrames', label: 'Kit para derrames a bordo', critico: false },
      { id: 'epp', label: 'EPP a bordo (máscara, guantes, antiparras)', critico: false },
    ],
  },
  {
    id: 'orden',
    titulo: 'Orden y limpieza',
    items: [
      { id: 'cabina_limpia', label: 'Cabina limpia y ordenada', critico: false },
      {
        id: 'caja_limpia', label: 'Caja limpia, sin restos de producto', critico: false, para: TODOS,
        labelSegun: {
          utilitario: 'Compartimento de carga limpio, sin restos de producto',
          furgon: 'Compartimento de carga limpio, sin restos de producto',
          trailer: 'Trailer limpio, sin restos de producto',
        },
      },
    ],
  },
]

const aItem = (i: ItemDef, tipo: TipoVehiculo): ItemChecklist => ({ id: i.id, label: i.labelSegun?.[tipo] ?? i.label, critico: i.critico })

/** Las secciones y los ítems que se revisan en un tipo de vehículo (sin secciones vacías). */
export function seccionesPara(tipo: TipoVehiculo): SeccionChecklist[] {
  return SECCIONES_DEF.map((s) => ({
    id: s.id,
    titulo: s.titulo,
    items: s.items.filter((i) => (i.para ?? MOTOR).includes(tipo)).map((i) => aItem(i, tipo)),
  })).filter((s) => s.items.length > 0)
}

export function itemsPara(tipo: TipoVehiculo): ItemChecklist[] {
  return seccionesPara(tipo).flatMap((s) => s.items)
}

/** El checklist de una camioneta (el caso de siempre). */
export const SECCIONES_CHECKLIST: SeccionChecklist[] = seccionesPara('pickup')
/** TODOS los ítems que existen (de cualquier tipo): para validar y mostrar respuestas guardadas. */
export const ITEMS_CHECKLIST: ItemChecklist[] = SECCIONES_DEF.flatMap((s) => s.items.map((i) => aItem(i, (i.para ?? MOTOR)[0])))
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

/** Ítems del checklist sin responder para ese tipo de vehículo (vacío = completo). */
export function itemsSinResponder(respuestas: Record<string, string | undefined>, tipo: TipoVehiculo = 'pickup'): string[] {
  return itemsPara(tipo).filter((i) => !RESPUESTAS.includes(respuestas[i.id] as Respuesta)).map((i) => i.id)
}

/** Fotos obligatorias que faltan para ese tipo de vehículo. */
export function fotosFaltantes(fotos: Record<string, string | undefined>, tipo: TipoVehiculo = 'pickup'): SlotFoto[] {
  return fotosPara(tipo).filter((f) => f.obligatoria && !fotos[f.slot])
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
  notas: Record<string, string | undefined> = {},
  tipo?: TipoVehiculo
): NovedadPropuesta[] {
  return (tipo ? itemsPara(tipo) : ITEMS_CHECKLIST).filter((i) => respuestas[i.id] === 'no_ok').map((i) => ({
    item: i.id,
    titulo: i.label,
    descripcion: notas[i.id]?.trim() || null,
    gravedad: i.critico ? 'alta' : 'media',
  }))
}

/**
 * Saca las novedades de ítems que ya tienen una novedad ABIERTA en el vehículo:
 * una falla sin arreglar no abre un pendiente nuevo en cada checklist.
 */
export function novedadesNuevas<T extends { item: string }>(propuestas: T[], itemsAbiertos: Iterable<string>): T[] {
  const abiertos = new Set(itemsAbiertos)
  return propuestas.filter((n) => !abiertos.has(n.item))
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

/** Sin historial no hay contra qué comparar: más que esto es casi seguro un dígito de más. */
export const KM_PRIMERA_LECTURA_DUDOSA = 500_000

/** La primera lectura de un vehículo se confirma si es altísima (la siguiente se mide contra ella). */
export function kmPideConfirmacion(kmNuevo: number, kmAnterior: number | null): boolean {
  return kmAnterior == null && kmNuevo > KM_PRIMERA_LECTURA_DUDOSA
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
//
// Se cuenta por PERÍODO DE CALENDARIO, no "N días desde el último": el
// checklist se hace los días 1 y 15. Con `checklist_cada_dias` < 28 los
// períodos son quincenas (1 al 14 y 15 a fin de mes); con 28 o más, el mes
// calendario (por si la empresa pasa a mensual). Hecho en cualquier día del
// período, el período queda cubierto. Los primeros días de cada período sin
// checklist son de gracia ("toca hacerlo"); después, vencido.
//
// No se es estricto con la fecha (pedido de Brandon, 16/10): hecho en los
// últimos días antes de que arranque un período (el 13 o el 14 para la quincena
// del 15), ya cuenta para ese período. Lo que importa es que se haga. Hacer uno
// solo por mes no alcanza igual: el período que queda sin hacer se ve vencido.

export type EstadoChecklist = 'al_dia' | 'vence_pronto' | 'vencido' | 'nunca'

export const ESTADO_CHECKLIST_LABEL: Record<EstadoChecklist, string> = {
  al_dia: 'Al día',
  vence_pronto: 'Toca hacerlo',
  vencido: 'Vencido',
  nunca: 'Sin checklist',
}

/** Días al comienzo de cada período para hacer el checklist antes de que quede vencido. */
export const GRACIA_CHECKLIST_DIAS = 3

/** Días antes de que empiece un período en los que el checklist ya cuenta para ese período. */
export const ADELANTO_CHECKLIST_DIAS = 3

export function checklistMensual(cadaDias: number): boolean {
  return cadaDias >= 28
}

/** 'Quincenal (días 1 y 15)' · 'Mensual (día 1)' */
export function frecuenciaChecklist(cadaDias: number): string {
  return checklistMensual(cadaDias) ? 'Mensual (día 1)' : 'Quincenal (días 1 y 15)'
}

export interface PeriodoChecklist {
  desde: string
  hasta: string
  mensual: boolean
}

/** Período de calendario que contiene un día ('YYYY-MM-DD'). */
export function periodoChecklist(dia: string, cadaDias: number): PeriodoChecklist {
  const mes = dia.slice(0, 7)
  const finDeMes = `${mes}-${String(ultimoDiaDelMes(dia)).padStart(2, '0')}`
  if (checklistMensual(cadaDias)) return { desde: `${mes}-01`, hasta: finDeMes, mensual: true }
  return Number(dia.slice(8, 10)) < 15
    ? { desde: `${mes}-01`, hasta: `${mes}-14`, mensual: false }
    : { desde: `${mes}-15`, hasta: finDeMes, mensual: false }
}

/**
 * Hasta qué período deja al día un checklist hecho ese día: el suyo o, si se hizo
 * en los últimos `ADELANTO_CHECKLIST_DIAS` antes de que arranque el siguiente, ese.
 */
export function periodoCubierto(dia: string, cadaDias: number): PeriodoChecklist {
  const propio = periodoChecklist(dia, cadaDias)
  const siguiente = periodoChecklist(sumarDias(propio.hasta, 1), cadaDias)
  return dia >= sumarDias(siguiente.desde, -ADELANTO_CHECKLIST_DIAS) ? siguiente : propio
}

/** Último día para hacer el checklist de un período sin que quede vencido. */
function limiteDelPeriodo(p: PeriodoChecklist): string {
  return sumarDias(p.desde, GRACIA_CHECKLIST_DIAS - 1)
}

export interface EstadoChecklistInfo {
  estado: EstadoChecklist
  /** Días desde el último checklist (null si nunca se hizo). */
  diasDesde: number | null
  /** Período en curso. */
  periodo: PeriodoChecklist
  /** Primer día del período siguiente: desde cuándo toca el próximo. */
  proximo: string
  /**
   * Hasta qué día hay tiempo (o desde cuándo está vencido): fin de la gracia del
   * primer período que quedó sin checklist. null si está al día.
   */
  limite: string | null
  /**
   * al_dia: días hasta el período siguiente · vence_pronto / nunca: días de
   * gracia que quedan (0 = hoy es el último; negativo = pasado) · vencido:
   * negativo, días de atraso desde el límite.
   */
  venceEn: number
}

export function estadoChecklist(
  ultimoAt: string | null,
  cadaDias: number,
  hoy: string = diaClaveAR(new Date())
): EstadoChecklistInfo {
  const periodo = periodoChecklist(hoy, cadaDias)
  const proximo = sumarDias(periodo.hasta, 1)

  if (!ultimoAt) {
    const limite = limiteDelPeriodo(periodo)
    return { estado: 'nunca', diasDesde: null, periodo, proximo, limite, venceEn: diasEntre(hoy, limite) }
  }

  const diaUltimo = diaClaveAR(ultimoAt)
  const diasDesde = diasEntre(diaUltimo, hoy)
  const cubierto = periodoCubierto(diaUltimo, cadaDias)
  if (cubierto.desde >= periodo.desde) {
    // Hecho un poco antes de que arrancara el período siguiente: el próximo toca después de ese.
    const siguiente = sumarDias(cubierto.hasta, 1)
    return { estado: 'al_dia', diasDesde, periodo, proximo: siguiente, limite: null, venceEn: diasEntre(hoy, siguiente) }
  }

  // El primer período que quedó sin checklist es el siguiente al último cubierto.
  // Si es el actual, todavía puede estar en la gracia; si es uno anterior (se
  // saltearon quincenas enteras), está vencido desde entonces.
  const primeroSinHacer = periodoChecklist(sumarDias(cubierto.hasta, 1), cadaDias)
  const limite = limiteDelPeriodo(primeroSinHacer)
  const venceEn = diasEntre(hoy, limite)
  return { estado: venceEn >= 0 ? 'vence_pronto' : 'vencido', diasDesde, periodo, proximo, limite, venceEn }
}

/** 'hasta hoy' · 'hasta mañana' · 'hasta el 03/10': cuánto queda de la gracia del período. */
export function hastaCuando(chk: Pick<EstadoChecklistInfo, 'venceEn' | 'limite'>): string {
  if (chk.venceEn === 0) return 'hasta hoy'
  if (chk.venceEn === 1) return 'hasta mañana'
  return chk.limite ? `hasta el ${fmtDia(chk.limite)}` : ''
}

// ── Mantenimiento ───────────────────────────────────────────────────────────

export const TIPOS_MANTENIMIENTO: Record<string, string> = {
  service: 'Service (aceite y filtros)',
  revision_trailer: 'Revisión del trailer (rulemanes, frenos, enganche)',
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

  // Sin km para comparar (falta el del service o el actual) y sin intervalo por
  // tiempo no hay nada que calcular: decirlo, no mostrarlo "al día".
  if (kmRestantes == null && fechaPorTiempo == null) {
    return {
      estado: 'sin_dato',
      kmObjetivo,
      kmRestantes: null,
      fechaEstimada: null,
      motivo: kmObjetivo != null
        ? `A los ${kmObjetivo.toLocaleString('es-AR')} km · falta el km actual del vehículo`
        : 'Falta el km del último service para calcular el próximo',
    }
  }

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

export function ultimoDiaDelMes(dia: string): number {
  const [y, m] = dia.split('-').map(Number)
  return new Date(Date.UTC(y, m, 0)).getUTCDate()
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
