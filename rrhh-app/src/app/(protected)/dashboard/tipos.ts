// Lo que la página del Inicio (server) le pasa a su vista. La vista solo dibuja: todo
// número, link y permiso ya viene calculado acá (skill: guias/overhaul.md §2.1).

export type TipoTitular = 'persona' | 'vehiculo' | 'equipo' | 'empresa'

export interface AlertaInicio {
  id: string
  estado: 'vencido' | 'proximo'
  /** Días hasta el vencimiento (negativo = ya venció), en hora AR. */
  dias: number
  fecha: string
  titular: string
  tipoTitular: TipoTitular
  empresaSlug: string | null
  empresaNombre: string | null
  tipo: string
  /** Link profundo de siempre (legajo con ?cert=, vehículo, ítem o empresa). */
  href: string
  /** Renovar: abre el certificado para cargar las fechas nuevas (null = no se puede desde acá). */
  hrefRenovar: string | null
}

export type ToneSeg = 'verde' | 'amarillo' | 'rojo' | null

export interface PasoRecurso {
  icono: 'alerta' | 'reloj' | 'llave' | 'calendario' | 'whatsapp' | 'chispa'
  texto: string
  detalle: string
  tono: 'v' | 'am' | 'ok' | ''
  href: string
}

export interface RecursoInicio {
  key: string
  titulo: string
  href: string
  icono: 'truck' | 'bulldozer' | 'package' | 'container'
  /** Color de la familia del cuadro (var(--f-…)). */
  color: string
  chip: { texto: string; tono: 'ro' | 'am' } | null
  tags: string[]
  segs: ToneSeg[]
  resumen: string
  meta: string
  /** Curva de la tarjeta; null cuando el dato no existe en la base (no se dibuja). */
  serie: { valores: number[]; rotulo: string; ultimo: string } | null
  pasosTitulo: string
  pasosCuenta: number
  pasos: PasoRecurso[]
}

export interface EmpresaInicio {
  id: string
  slug: string
  nombre: string
  empleados: number
  vencidos: number
  proximos: number
  /** Carpetas fijas del mes con archivos (null = no se pudo leer). */
  mensual: { con: number; de: number } | null
}

export interface SistemaInicio {
  key: string
  nombre: string
  icono: string
  links: { icono: 'contenedor' | 'escoba' | 'bicho' | 'checklist' | 'cuadros' | 'mapa' | 'apreton'; label: string; href: string; externo: boolean }[]
}

export interface DatosInicio {
  fecha: string
  saludo: string
  nombre: string
  hrefs: {
    empleados: string
    vencimientos: string
    vencidos: string
    proximos: string
    vigentes: string
  }
  proximos: { total: number; semana: number; porTipo: { tipo: TipoTitular; n: number }[]; curva: number[] }
  vencidos: { total: number; masAntiguo: number; hasta7: number; mas7: number }
  alDia: { total: number; conFecha: number }
  empleados: { total: number; bajas: number; porEmpresa: { slug: string; nombre: string; n: number }[] }
  alertas: { todos: AlertaInicio[]; vencidos: AlertaInicio[]; proximos: AlertaInicio[] }
  /** Pestaña de Vencimientos (los valores de siempre de ?tab=). */
  tab: 'todos' | 'vencidos' | 'proximos'
  empresas: EmpresaInicio[]
  mes: string
  recursos: RecursoInicio[]
  /** Recursos que no se pudieron leer: se dice, no se esconde. */
  fallas: string[]
  sistemas: SistemaInicio[]
  /** Puede cargar certificados (LEGAJO_ESCRITURA, espejo de la RLS). */
  puedeCargar: boolean
}
