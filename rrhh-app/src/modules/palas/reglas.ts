// ============================================================
// Reglas puras de las palas cargadoras (sin I/O).
//
// Una pala NO tiene tabla propia: es una fila de `equipos` con
// `categoria = CATEGORIA_PALAS`. Ver el encabezado de la migración 26 para el
// porqué (el constraint `check_owner` de `certificados` admite un solo dueño y
// `equipo` ya está contemplado, con su RLS y su lugar en /vencimientos).
//
// Esta constante es la frontera entre las dos pantallas: lo que cae acá se ve en
// Recursos → Palas cargadoras y se saca de Documentación → Habilitaciones, para
// que una misma unidad no aparezca en dos lugares.
// ============================================================

/** La categoría de `equipos` que marca a una pala cargadora. */
export const CATEGORIA_PALAS = 'Palas cargadoras'

/** Forma mínima de una pala para las reglas de acá. */
export interface PalaMinima {
  nombre: string
  marca?: string | null
  modelo?: string | null
  anio?: number | null
  numero_serie?: string | null
  horometro?: number | null
}

/** `true` si esa categoría de equipo es la de las palas (tolera espacios y mayúsculas). */
export function esPala(categoria: unknown): boolean {
  return typeof categoria === 'string' && categoria.trim().toLowerCase() === CATEGORIA_PALAS.toLowerCase()
}

/**
 * Marca, modelo y año en una línea, que es el subtítulo de la tarjeta.
 * Vacío si no se cargó ninguno: la pantalla no muestra el renglón.
 */
export function detallePala(p: PalaMinima): string {
  return [p.marca, p.modelo, p.anio].filter(Boolean).join(' ')
}

/**
 * Horómetro para mostrar: "1.234 h". Sin separador de miles se lee mal, y es un
 * número que llega a cinco cifras. `null`/vacío devuelve '' (no "0 h", que
 * significaría una máquina sin uso y no "nadie lo cargó todavía").
 */
export function fmtHorometro(h: number | null | undefined): string {
  if (h === null || h === undefined || !Number.isFinite(h)) return ''
  return `${new Intl.NumberFormat('es-AR', { maximumFractionDigits: 1 }).format(h)} h`
}

/**
 * Valida el horómetro que se escribe a mano. Devuelve el mensaje de error o null.
 * `permitirMenor` deja bajar la lectura a propósito (se cambió el instrumento,
 * se corrige un dedazo); sin eso, un valor menor al guardado se rechaza, porque
 * el horómetro solo avanza y lo normal es que falte un dígito.
 */
export function validarHorometro(
  valor: string,
  anterior: number | null | undefined,
  permitirMenor = false
): string | null {
  const limpio = valor.trim().replace(',', '.')
  if (!limpio) return null // vacío = no se toca
  const n = Number(limpio)
  if (!Number.isFinite(n)) return 'El horómetro tiene que ser un número.'
  if (n < 0) return 'El horómetro no puede ser negativo.'
  if (n > 200000) return 'Ese horómetro parece un dedazo: son más de 200.000 horas.'
  if (!permitirMenor && anterior != null && n < anterior) {
    return `El horómetro no puede bajar: el último cargado es ${fmtHorometro(anterior)}.`
  }
  return null
}

/** Año verosímil para el formulario (el mismo rango que la CHECK de la migración 26). */
export function validarAnio(valor: string): string | null {
  const limpio = valor.trim()
  if (!limpio) return null
  const n = Number(limpio)
  if (!Number.isInteger(n)) return 'El año tiene que ser un número entero.'
  if (n < 1950 || n > 2100) return 'Revisá el año: tiene que estar entre 1950 y 2100.'
  return null
}

/**
 * Orden de la lista: por nombre, como las lee la oficina. `localeCompare` con
 * 'es' y `numeric` para que "Pala 2" vaya antes que "Pala 10".
 */
export function ordenarPalas<T extends { nombre: string }>(palas: T[]): T[] {
  return [...palas].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es', { numeric: true, sensitivity: 'base' }))
}
