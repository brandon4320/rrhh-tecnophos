// ============================================================
// Tipos del módulo Gestión Comercial
// ============================================================

// Empresas del grupo (multi-company)
export const EMPRESAS = ['tecnophos', 'adc', 'serviwhite'] as const
export type Empresa = (typeof EMPRESAS)[number]

export const EMPRESA_LABEL: Record<Empresa, string> = {
  tecnophos:  'TECNOPHOS',
  adc:        'ADC',
  serviwhite: 'SERVIWHITE',
}

export const EMPRESA_COLOR: Record<Empresa, string> = {
  tecnophos:  'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800',
  adc:        'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800',
  serviwhite: 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800',
}

export const EMPRESA_DOT: Record<Empresa, string> = {
  tecnophos:  'bg-blue-500',
  adc:        'bg-emerald-500',
  serviwhite: 'bg-amber-500',
}

export const ETAPAS_PROYECTO = [
  'nuevo',
  'contactado',
  'reunion_agendada',
  'relevamiento',
  'cotizacion_pendiente',
  'cotizacion_enviada',
  'seguimiento',
  'negociacion',
  'ganado',
  'perdido',
  'pausado',
] as const
export type EtapaProyecto = (typeof ETAPAS_PROYECTO)[number]

export const ESTADOS_PROYECTO = ['abierto', 'ganado', 'perdido', 'pausado', 'cancelado'] as const
export type EstadoProyecto = (typeof ESTADOS_PROYECTO)[number]

export const PRIORIDADES = ['alta', 'media', 'baja'] as const
export type Prioridad = (typeof PRIORIDADES)[number]

export const TIPOS_TAREA = [
  'llamar',
  'enviar_email',
  'enviar_whatsapp',
  'preparar_cotizacion',
  'hacer_seguimiento',
  'coordinar_reunion',
  'cargar_documentacion',
  'revisar_propuesta',
  'visitar_cliente',
  'actualizar_estado',
  'otro',
] as const
export type TipoTarea = (typeof TIPOS_TAREA)[number]

export const ESTADOS_TAREA = [
  'pendiente',
  'en_proceso',
  'esperando_respuesta',
  'bloqueada',
  'completada',
  'cancelada',
] as const
export type EstadoTarea = (typeof ESTADOS_TAREA)[number]

export const TIPOS_EVENTO = [
  'reunion',
  'llamada',
  'visita',
  'presentacion',
  'seguimiento',
  'evento',
  'recordatorio',
] as const
export type TipoEvento = (typeof TIPOS_EVENTO)[number]

export const ESTADOS_EVENTO = [
  'programado',
  'realizado',
  'cancelado',
  'reprogramado',
  'no_realizado',
] as const
export type EstadoEvento = (typeof ESTADOS_EVENTO)[number]

export const ESTADOS_VIAJE = ['planificado', 'en_curso', 'finalizado', 'cancelado'] as const
export type EstadoViaje = (typeof ESTADOS_VIAJE)[number]

export const TIPOS_ACTIVIDAD = [
  'cliente_creado',
  'contacto_creado',
  'proyecto_creado',
  'proyecto_actualizado',
  'cambio_etapa',
  'tarea_creada',
  'tarea_completada',
  'reunion_agendada',
  'reunion_realizada',
  'nota_creada',
  'archivo_subido',
  'proyecto_ganado',
  'proyecto_perdido',
  'responsable_cambiado',
  'proxima_accion_actualizada',
] as const
export type TipoActividad = (typeof TIPOS_ACTIVIDAD)[number]

// Probabilidad por etapa (%)
export const PROB_POR_ETAPA: Record<EtapaProyecto, number> = {
  nuevo:                 5,
  contactado:           10,
  reunion_agendada:     20,
  relevamiento:         30,
  cotizacion_pendiente: 35,
  cotizacion_enviada:   40,
  seguimiento:          50,
  negociacion:          70,
  ganado:              100,
  perdido:               0,
  pausado:              25,
}

// Etiquetas legibles
export const ETAPA_LABEL: Record<EtapaProyecto, string> = {
  nuevo:                'Nuevo',
  contactado:           'Contactado',
  reunion_agendada:     'Reunión agendada',
  relevamiento:         'Relevamiento',
  cotizacion_pendiente: 'Cotización pendiente',
  cotizacion_enviada:   'Cotización enviada',
  seguimiento:          'Seguimiento',
  negociacion:          'Negociación',
  ganado:               'Ganado',
  perdido:              'Perdido',
  pausado:              'Pausado',
}

export const ESTADO_PROYECTO_LABEL: Record<EstadoProyecto, string> = {
  abierto:   'Abierto',
  ganado:    'Ganado',
  perdido:   'Perdido',
  pausado:   'Pausado',
  cancelado: 'Cancelado',
}

export const PRIORIDAD_LABEL: Record<Prioridad, string> = {
  alta:  'Alta',
  media: 'Media',
  baja:  'Baja',
}

export const TIPO_TAREA_LABEL: Record<TipoTarea, string> = {
  llamar:               'Llamar',
  enviar_email:         'Enviar email',
  enviar_whatsapp:      'Enviar WhatsApp',
  preparar_cotizacion:  'Preparar cotización',
  hacer_seguimiento:    'Hacer seguimiento',
  coordinar_reunion:    'Coordinar reunión',
  cargar_documentacion: 'Cargar documentación',
  revisar_propuesta:    'Revisar propuesta',
  visitar_cliente:      'Visitar cliente',
  actualizar_estado:    'Actualizar estado',
  otro:                 'Otro',
}

export const ESTADO_TAREA_LABEL: Record<EstadoTarea, string> = {
  pendiente:           'Pendiente',
  en_proceso:          'En proceso',
  esperando_respuesta: 'Esperando respuesta',
  bloqueada:           'Bloqueada',
  completada:          'Completada',
  cancelada:           'Cancelada',
}

export const TIPO_EVENTO_LABEL: Record<TipoEvento, string> = {
  reunion:       'Reunión',
  llamada:       'Llamada',
  visita:        'Visita',
  presentacion:  'Presentación',
  seguimiento:   'Seguimiento',
  evento:        'Evento',
  recordatorio:  'Recordatorio',
}

// Tipos de dominio para las entidades principales
export interface ProyectoBase {
  id: string
  titulo: string
  etapa: EtapaProyecto
  estado: EstadoProyecto
  prioridad: Prioridad
  responsable_id: string
  valor_estimado: number | null
  moneda: string | null
  proxima_accion: string | null
  proxima_accion_fecha: string | null
  ultima_actividad_at: string | null
  motivo_perdida_id: string | null
  fecha_estimada_cierre: string | null
}

export interface TareaBase {
  id: string
  titulo: string
  estado: EstadoTarea
  prioridad: Prioridad
  responsable_id: string
  fecha_vencimiento: string | null
  fecha_completada: string | null
  proyecto_id: string | null
}
