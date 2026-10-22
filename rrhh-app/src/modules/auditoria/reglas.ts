// Historial de cambios (tabla `auditoria`, migración 28): cómo se cuenta cada fila en castellano.
// Funciones puras, sin I/O: la pantalla (app/(protected)/admin/historial) solo las arma.
//
// Una fila de auditoría dice quién, qué tabla, qué registro (con un nombre congelado en `etiqueta`),
// si fue alta / cambio / baja, y para los cambios solo los campos que cambiaron ({campo: [antes, después]}).

export type Accion = 'alta' | 'cambio' | 'baja'

export interface FilaAuditoria {
  id: number
  ocurrido_en: string
  usuario_id: string | null
  usuario_nombre: string | null
  tabla: string
  registro_id: string | null
  empresa_id: string | null
  accion: Accion
  etiqueta: string | null
  ref: Record<string, string> | null
  cambios: Record<string, [unknown, unknown]> | null
  datos: Record<string, unknown> | null
}

/** Grupos del filtro "Qué": cada uno junta las tablas de un tema. */
export const GRUPOS: Record<string, { etiqueta: string; tablas: string[] }> = {
  personal: { etiqueta: 'Personal', tablas: ['empleados', 'recibos_sueldo'] },
  certificados: { etiqueta: 'Certificados', tablas: ['certificados', 'archivos', 'tipos_certificado'] },
  flota: {
    etiqueta: 'Flota',
    tablas: ['vehiculos', 'vehiculo_checklists', 'vehiculo_novedades', 'vehiculo_services', 'vehiculo_mantenimiento_plan', 'flota_encargados', 'flota_avisos'],
  },
  equipos: { etiqueta: 'Equipos y palas', tablas: ['equipos'] },
  stock: { etiqueta: 'Stock', tablas: ['stock_items', 'stock_movimientos'] },
  documentacion: { etiqueta: 'Documentación mensual', tablas: ['documentos_mensuales'] },
  usuarios: { etiqueta: 'Usuarios', tablas: ['perfiles'] },
  otros: { etiqueta: 'Empresas y ajustes', tablas: ['empresas', 'sectores', 'activo_secciones', 'config'] },
}

/** Qué es cada registro, con artículo ("el certificado"). */
const QUE: Record<string, string> = {
  empleados: 'al empleado',
  certificados: 'el certificado',
  archivos: 'el adjunto',
  tipos_certificado: 'el tipo de certificado',
  empresas: 'la empresa',
  perfiles: 'el usuario',
  sectores: 'el sector',
  activo_secciones: 'la sección',
  config: 'el ajuste',
  documentos_mensuales: 'el documento mensual',
  recibos_sueldo: 'el recibo de sueldo',
  vehiculos: 'el vehículo',
  vehiculo_checklists: 'el checklist',
  vehiculo_novedades: 'la novedad',
  vehiculo_services: 'el service',
  vehiculo_mantenimiento_plan: 'el plan de mantenimiento',
  flota_encargados: 'al encargado de flota',
  flota_avisos: 'el aviso de flota',
  equipos: 'el equipo',
  stock_items: 'el ítem de stock',
  stock_movimientos: 'el movimiento de stock',
}

/** "cargó el certificado", "dio de baja al empleado", "resolvió la novedad"… (sin el nombre del registro). */
export function verboYQue(f: Pick<FilaAuditoria, 'tabla' | 'accion' | 'cambios'>): string {
  const que = QUE[f.tabla] ?? 'el registro'
  // "al empleado" solo pide la "a" con verbos de persona; con cargar/editar/borrar va "el".
  const objeto = que.replace(/^al /, 'el ')
  const cambio = (campo: string) => f.cambios?.[campo]?.[1]
  if (f.accion === 'alta') return `cargó ${objeto}`
  if (f.accion === 'baja') return `borró ${objeto}`
  if (f.tabla === 'empleados' && f.cambios && 'activo' in f.cambios) return cambio('activo') === false ? `dio de baja ${que}` : `reactivó ${que}`
  if (f.tabla === 'vehiculo_novedades' && cambio('estado') === 'resuelta') return 'resolvió la novedad'
  return `editó ${objeto}`
}

/** Nombres de los campos que se muestran en un cambio. Los que no están se arman solos ("km_actual" → "Km actual"). */
const CAMPOS: Record<string, string> = {
  fecha_vencimiento: 'Vencimiento',
  fecha_emision: 'Emisión',
  alerta_dias: 'Aviso (días antes)',
  numero_documento: 'Número',
  tipo_id: 'Tipo',
  tipo_nombre_custom: 'Tipo',
  empresa_id: 'Empresa',
  empresa_acceso: 'Empresa',
  empleado_id: 'Empleado',
  vehiculo_id: 'Vehículo',
  equipo_id: 'Equipo',
  conductor_id: 'Conductor',
  activo: 'Activo',
  anio: 'Año',
  km_actual: 'Kilómetros',
  km: 'Kilómetros',
  conductor_nombre: 'Conductor',
  checklist_activo: 'Checklist activo',
  checklist_cada_dias: 'Checklist cada (días)',
  stock_minimo: 'Stock mínimo',
  precio_unitario: 'Precio unitario',
  ve_recibos: 'Ve recibos de sueldo',
  rol: 'Rol',
  resolucion: 'Resolución',
  descripcion: 'Descripción',
  telefono: 'Teléfono',
  numero_serie: 'Número de serie',
  horometro: 'Horómetro',
  categoria: 'Categoría',
  cada_km: 'Cada (km)',
  cada_meses: 'Cada (meses)',
  nombre_archivo: 'Archivo',
  periodo: 'Período',
}

/** Campos que no aportan en un cambio (se mueven solos o son técnicos). */
const OCULTOS = new Set(['id', 'created_at', 'uploaded_at', 'km_actualizado_at', 'horometro_actualizado_at', 'path', 'mime_type', 'size_bytes'])

export function nombreCampo(campo: string): string {
  if (CAMPOS[campo]) return CAMPOS[campo]
  const t = campo.replace(/_id$/, '').replace(/_/g, ' ')
  return t.charAt(0).toUpperCase() + t.slice(1)
}

export interface Contexto {
  /** id → nombre de empresas y tipos de certificado, para no mostrar uuids. */
  nombres: Record<string, string>
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const FECHA = /^(\d{4})-(\d{2})-(\d{2})$/
const FECHA_HORA = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/

/** Un valor del historial para leer: fechas en dd/mm/aaaa, Sí/No, nombres en vez de ids, "—" si está vacío. */
export function valorLegible(valor: unknown, ctx: Contexto): string {
  if (valor === null || valor === undefined || valor === '') return '—'
  if (typeof valor === 'boolean') return valor ? 'Sí' : 'No'
  if (typeof valor === 'number') return valor.toLocaleString('es-AR')
  if (typeof valor === 'string') {
    if (UUID.test(valor)) return ctx.nombres[valor] ?? 'otro registro'
    const f = FECHA.exec(valor)
    if (f) return `${f[3]}/${f[2]}/${f[1]}`
    const fh = FECHA_HORA.exec(valor)
    if (fh) return `${fh[3]}/${fh[2]}/${fh[1]}`
    return valor.length > 120 ? `${valor.slice(0, 117)}…` : valor
  }
  if (Array.isArray(valor)) return valor.length ? `${valor.length} ${valor.length === 1 ? 'elemento' : 'elementos'}` : '—'
  return 'actualizado'
}

export interface LineaCambio {
  campo: string
  antes: string
  despues: string
}

/** Los campos que cambiaron, listos para mostrar ("Vencimiento: 21/08/2026 → 21/08/2027"). */
export function lineasCambio(cambios: FilaAuditoria['cambios'], ctx: Contexto): LineaCambio[] {
  if (!cambios) return []
  return Object.entries(cambios)
    .filter(([campo]) => !OCULTOS.has(campo))
    .map(([campo, [antes, despues]]) => ({ campo: nombreCampo(campo), antes: valorLegible(antes, ctx), despues: valorLegible(despues, ctx) }))
}

/** A dónde lleva la fila: la ficha del registro o la de quien lo contiene. null si ya no existe o no tiene página. */
export function hrefDe(f: Pick<FilaAuditoria, 'tabla' | 'accion' | 'registro_id' | 'ref' | 'empresa_id'>, slugs: Record<string, string>): string | null {
  const ref = f.ref ?? {}
  const vivo = f.accion !== 'baja'
  const slug = f.empresa_id ? slugs[f.empresa_id] : undefined
  switch (f.tabla) {
    case 'empleados':
      return vivo && f.registro_id ? `/legajo/${f.registro_id}` : null
    case 'vehiculos':
      return vivo && f.registro_id ? `/flota/${f.registro_id}` : null
    case 'certificados':
    case 'recibos_sueldo':
      if (ref.empleado_id) return `/legajo/${ref.empleado_id}`
      if (ref.vehiculo_id) return `/flota/${ref.vehiculo_id}`
      return slug ? `/empresa/${slug}?vista=documentacion` : null
    case 'vehiculo_checklists':
    case 'vehiculo_novedades':
    case 'vehiculo_services':
    case 'vehiculo_mantenimiento_plan':
    case 'flota_avisos':
      return ref.vehiculo_id ? `/flota/${ref.vehiculo_id}` : null
    case 'stock_items':
    case 'stock_movimientos':
      return slug ? `/stock?empresa=${slug}` : null
    case 'documentos_mensuales':
      return slug ? `/documentos?empresa=${slug}` : null
    case 'equipos':
      return slug ? `/empresa/${slug}?vista=documentacion` : null
    case 'perfiles':
      return '/admin/usuarios'
    default:
      return null
  }
}

/** El día anterior a 'YYYY-MM-DD' (sin horas: no se corre con los cambios de huso). */
export function diaAnterior(dia: string): string {
  const [a, m, d] = dia.split('-').map(Number)
  return new Date(Date.UTC(a, m - 1, d - 1)).toISOString().slice(0, 10)
}

/** Encabezado de cada día: "Hoy", "Ayer" o "lunes 20 de octubre" (en hora de Argentina). */
export function tituloDia(diaAR: string, hoyAR: string, ayerAR: string): string {
  if (diaAR === hoyAR) return 'Hoy'
  if (diaAR === ayerAR) return 'Ayer'
  const [a, m, d] = diaAR.split('-').map(Number)
  const fecha = new Date(Date.UTC(a, m - 1, d, 12))
  const t = new Intl.DateTimeFormat('es-AR', { timeZone: 'UTC', weekday: 'long', day: 'numeric', month: 'long' }).format(fecha).replace(',', '')
  return t.charAt(0).toUpperCase() + t.slice(1)
}
