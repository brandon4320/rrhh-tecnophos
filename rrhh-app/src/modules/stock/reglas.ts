// ============================================================
// Reglas puras de Stock (sin I/O): el stock actual es la suma de los
// movimientos, el estado sale del mínimo, y las compras del mes se
// valorizan con precio × cantidad cuando hay precio.
// ============================================================
import type { EstadoVencimiento } from '@/types'
import { diaClaveAR } from '@/lib/fechas-ar'
import { coincide, normalizarTexto } from '@/lib/texto'

export const TIPOS_MOVIMIENTO = ['compra', 'consumo', 'ajuste', 'devolucion'] as const
export type TipoMovimiento = (typeof TIPOS_MOVIMIENTO)[number]

/**
 * Cómo se llama cada tipo en pantalla. En la DB siguen siendo compra/consumo/ajuste,
 * pero el uso real es otro: casi todos los consumos son ENTREGAS de EPP y ropa a
 * empleados (3 por cada compra). Las devoluciones tienen tipo propio desde la
 * migración 24 (antes entraban como "compra" e inflaban las compras del mes).
 */
export const TIPO_MOVIMIENTO_LABEL: Record<TipoMovimiento, string> = {
  compra: 'Ingreso',
  consumo: 'Entrega',
  ajuste: 'Ajuste',
  devolucion: 'Devolución',
}

/** Plural para los filtros y resúmenes ("Entregas", "Devoluciones"). */
export const TIPO_MOVIMIENTO_PLURAL: Record<TipoMovimiento, string> = {
  compra: 'Ingresos',
  consumo: 'Entregas',
  ajuste: 'Ajustes',
  devolucion: 'Devoluciones',
}

/** Tipos que se cargan con una persona en el encabezado (entrega o devolución). */
export function esMovimientoConPersona(tipo: string): boolean {
  return tipo === 'consumo' || tipo === 'devolucion'
}

/**
 * El empleado cuyo nombre coincide EXACTO (sin acentos ni mayúsculas, en cualquier
 * orden nombre/apellido) con lo escrito. Así una entrega queda en su legajo sin
 * cambiar el campo de texto libre de siempre ("Entregado a"). Ambiguo o sin
 * coincidencia → null (queda solo el texto).
 */
export function empleadoPorNombre<T extends { id: string; nombre: string | null; apellido: string | null }>(
  texto: string, empleados: T[]
): T | null {
  const q = normalizarTexto(texto).replace(/\s+/g, ' ')
  if (!q) return null
  const hits = empleados.filter((e) => {
    const a = normalizarTexto(`${e.nombre ?? ''} ${e.apellido ?? ''}`).replace(/\s+/g, ' ')
    const b = normalizarTexto(`${e.apellido ?? ''} ${e.nombre ?? ''}`).replace(/\s+/g, ' ')
    return q === a || q === b
  })
  return hits.length === 1 ? hits[0] : null
}

/** Sugerencias para el datalist; el campo acepta cualquier texto. */
export const UNIDADES_SUGERIDAS = ['unidad', 'litro', 'kg', 'metro', 'caja', 'bidón', 'rollo', 'par', 'paquete'] as const

export interface ItemBase {
  id: string
  nombre: string
  stock_minimo: number | null
  activo: boolean | null
}

export interface MovimientoBase {
  item_id: string
  tipo: string
  cantidad: number
  fecha: string
  precio_unitario?: number | null
  proveedor?: string | null
  /** Desempata compras del mismo día (la más reciente manda). */
  created_at?: string | null
}

/** ¿`a` es una compra más reciente que `b`? Por fecha y, a igual fecha, por created_at. */
function esMasReciente(a: { fecha: string; created_at?: string | null }, b: { fecha: string; created_at?: string | null }): boolean {
  if (a.fecha !== b.fecha) return a.fecha > b.fecha
  return (a.created_at ?? '') > (b.created_at ?? '')
}

/** '1.234,5' · '12,5' · '12.5' · '7' → número. null si no parsea. */
export function parseCantidad(v: unknown): number | null {
  if (typeof v === 'number') return Number.isFinite(v) ? Math.round(v * 100) / 100 : null
  if (typeof v !== 'string') return null
  let s = v.trim().replace(/\s/g, '')
  if (!s) return null
  // formato AR: punto de miles, coma decimal
  if (/^-?\d{1,3}(\.\d{3})+(,\d+)?$/.test(s)) s = s.replace(/\./g, '').replace(',', '.')
  else s = s.replace(',', '.')
  if (!/^-?\d+(\.\d+)?$/.test(s)) return null
  const n = Number(s)
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : null
}

/** Efecto de un movimiento sobre el stock. */
export function deltaDe(m: { tipo: string; cantidad: number }): number {
  if (m.tipo === 'compra' || m.tipo === 'devolucion') return Math.abs(m.cantidad)
  if (m.tipo === 'consumo') return -Math.abs(m.cantidad)
  return m.cantidad // ajuste: con signo
}

export interface StockCalculado {
  stock: number
  movimientos: number
  ultimaCompra: { fecha: string; precio_unitario: number | null; proveedor: string | null; created_at?: string | null } | null
  /** stock × último precio de compra (si hay). */
  valorizado: number | null
}

export function calcularStock(items: ItemBase[], movimientos: MovimientoBase[]): Map<string, StockCalculado> {
  const out = new Map<string, StockCalculado>()
  for (const it of items) out.set(it.id, { stock: 0, movimientos: 0, ultimaCompra: null, valorizado: null })
  for (const m of movimientos) {
    const s = out.get(m.item_id)
    if (!s) continue
    s.stock = Math.round((s.stock + deltaDe(m)) * 100) / 100
    s.movimientos++
    if (m.tipo === 'compra' && (!s.ultimaCompra || esMasReciente(m, s.ultimaCompra))) {
      s.ultimaCompra = { fecha: m.fecha, precio_unitario: m.precio_unitario ?? null, proveedor: m.proveedor ?? null, created_at: m.created_at ?? null }
    }
  }
  for (const s of out.values()) {
    const p = s.ultimaCompra?.precio_unitario
    s.valorizado = p != null && s.stock > 0 ? Math.round(s.stock * p * 100) / 100 : null
  }
  return out
}

/**
 * Sin stock → rojo; bajo el mínimo → naranja; si no, OK.
 * Mínimo 0 (o null) significa "sin alerta" DE VERDAD: un ítem que no se controla
 * (p. ej. EPP que esa empresa no maneja) no aparece en rojo por estar en 0 — se
 * muestra gris "Sin alerta". Con stock > 0 sigue siendo OK.
 */
export function estadoStock(stock: number, minimo: number | null | undefined): EstadoVencimiento {
  const sinAlerta = minimo == null || minimo <= 0
  if (stock <= 0) return sinAlerta ? 'sin_fecha' : 'vencido'
  if (!sinAlerta && stock <= minimo) return 'proximo'
  return 'vigente'
}

export const ESTADO_STOCK_LABEL: Record<EstadoVencimiento, string> = {
  vencido: 'Sin stock',
  proximo: 'Bajo mínimo',
  vigente: 'OK',
  // 'sin_fecha' SOLO ocurre con stock <= 0 y sin mínimo: el ítem está vacío, pero
  // nadie pidió que avise. Decía "Sin alerta", que describe la configuración y no
  // el stock: la fila parecía normal estando en cero. Gris (no alarma) pero honesto.
  sin_fecha: 'En cero',
}

/** Compras de un mes ('YYYY-MM'): cuántas y cuánto (solo las que tienen precio). */
export function comprasDelMes(movimientos: MovimientoBase[], mes: string): { compras: number; total: number; sinPrecio: number } {
  let compras = 0, total = 0, sinPrecio = 0
  for (const m of movimientos) {
    if (m.tipo !== 'compra' || !m.fecha.startsWith(mes)) continue
    compras++
    if (m.precio_unitario != null) total += Math.abs(m.cantidad) * m.precio_unitario
    else sinPrecio++
  }
  return { compras, total: Math.round(total * 100) / 100, sinPrecio }
}

/** Mes en curso 'YYYY-MM' en hora Argentina (Vercel corre en UTC). */
export function mesClave(d: Date = new Date()): string {
  return diaClaveAR(d).slice(0, 7)
}

/** Hoy 'YYYY-MM-DD' en hora Argentina: fecha por defecto y tope de los movimientos. */
export function hoyClave(d: Date = new Date()): string {
  return diaClaveAR(d)
}

/** Stock actual a partir de una lista de movimientos de UN ítem (para recalcular con datos frescos antes de un ajuste). */
export function sumarStock(movimientos: { tipo: string; cantidad: number }[]): number {
  return Math.round(movimientos.reduce((acc, m) => acc + deltaDe(m), 0) * 100) / 100
}

export function fmtCantidad(n: number, unidad?: string | null): string {
  const num = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 2 }).format(n)
  return unidad ? `${num} ${unidad}` : num
}

export function fmtMoneda(n: number): string {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n)
}

export function normalizarNombre(s: string): string {
  return s.replace(/\s+/g, ' ').trim()
}

/** Categorías distintas presentes, ordenadas; sin vacíos. */
export function categoriasDe(items: { categoria?: string | null }[]): string[] {
  return [...new Set(items.map((i) => (i.categoria ?? '').trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'es'))
}


// ============================================================
// Organización del inventario para la vista (rediseño 2026-10).
// La mitad del catálogo son talles de una misma prenda ("Camisa ADC T 36"…
// "T 54"): la ropa se muestra como MATRIZ prenda × talle (una fila por prenda,
// una columna por talle) y el resto como tabla plana ordenada por urgencia.
// La categoría pasó a ser un filtro, no un encabezado intercalado.
//
// Regla que NO cambia: las prendas se ROTULAN, nunca se fusionan. Cada celda
// de la matriz es un ítem real con su id, porque los movimientos (y sobre todo
// el ajuste por conteo, que escribe la diferencia contra el stock del ítem)
// necesitan un id verdadero. Una fila-prenda con stock sumado escribiría basura.
// ============================================================

export const SIN_CATEGORIA = 'Sin categoría'

/** Categoría para filtrar: la vacía cuenta como "Sin categoría". */
export function categoriaDe(item: { categoria?: string | null }): string {
  return (item.categoria ?? '').trim() || SIN_CATEGORIA
}

/** Talles alfabéticos en orden real; los numéricos se ordenan como números. */
const TALLES = ['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL']

/**
 * "Camisa ADC T 42" → { base: 'Camisa ADC', variante: '42' }. null si no es una variante.
 * Exige el marcador T/Talle antes del talle, así "Bidón 20 L" o "Lavandina 5 L"
 * no se parten. Conservador a propósito: lo peor que puede pasar con un falso
 * positivo es que dos filas queden agrupadas de más — nada se oculta ni se suma.
 */
export function partirVariante(nombre: string): { base: string; variante: string } | null {
  const m = /^(.+?)\s+(?:T|Talle)\.?\s*([A-Za-z]{1,4}|\d{1,2})$/.exec(nombre.trim())
  if (!m) return null
  const v = m[2].toUpperCase()
  if (/^\d+$/.test(v)) return { base: m[1].trim(), variante: v }
  return TALLES.includes(v) ? { base: m[1].trim(), variante: v } : null
}

/**
 * "BOTINES SEGURIDAD 39" → { base: 'BOTINES SEGURIDAD', variante: '39' }: dos cifras
 * al final y SIN marcador T/Talle (así carga Rosario los botines). Es solo un
 * candidato: `agruparPrendas` lo acepta cuando 3 o más ítems comparten la base.
 * Con dos no alcanza ("Bidón 10" y "Bidón 20" no son talles).
 */
export function partirTalleSinMarcador(nombre: string): { base: string; variante: string } | null {
  const m = /^(.+?)\s+(\d{2})$/.exec(nombre.trim())
  return m ? { base: m[1].trim(), variante: m[2] } : null
}

/**
 * Clave para decidir si dos nombres base son la misma prenda: sin acentos ni
 * mayúsculas y sin "de"/"del" ("BOTINES DE SEGURIDAD" = "Botines seguridad").
 */
export function claveBase(base: string): string {
  return normalizarTexto(base).split(/\s+/).filter((w) => w && w !== 'de' && w !== 'del').join(' ')
}

/** Orden real de talles: S < M < L < XL; los números como números. */
export function compararTalle(a: string, b: string): number {
  const ia = TALLES.indexOf(a), ib = TALLES.indexOf(b)
  if (ia !== -1 && ib !== -1) return ia - ib
  if (ia !== -1) return -1 // letras antes que números
  if (ib !== -1) return 1
  const na = Number(a), nb = Number(b)
  if (Number.isFinite(na) && Number.isFinite(nb)) return na - nb
  return a.localeCompare(b, 'es')
}

/** Orden del catálogo: por nombre base y, dentro de una familia, por talle real (S, M, L, XL). */
export function compararItems(a: { nombre: string }, b: { nombre: string }): number {
  const va = partirVariante(a.nombre), vb = partirVariante(b.nombre)
  const base = (va?.base ?? a.nombre).localeCompare(vb?.base ?? b.nombre, 'es')
  if (base !== 0) return base
  if (!va || !vb) return a.nombre.localeCompare(b.nombre, 'es')
  return compararTalle(va.variante, vb.variante)
}

export type SistemaTalles = 'letras' | 'numeros'

/** Una prenda con ≥2 talles. Cada talle es UN ítem real (nunca una suma). */
export interface Prenda<T> {
  clave: string
  base: string
  sistema: SistemaTalles
  talles: { talle: string; item: T }[]
}

/**
 * Separa la ropa por talle (prendas) del resto (sueltos). Todo ítem aparece
 * exactamente una vez: en una celda o en la tabla plana.
 * - Con marcador ("T 44", "Talle XL"): prenda desde 2 talles.
 * - Sin marcador ("BOTINES SEGURIDAD 39"): solo si la familia junta 3 o más.
 * - La base se compara sin acentos, mayúsculas ni "de": "BOTINES SEGURIDAD 39"
 *   y "BOTINES DE SEGURIDAD 40" son la misma prenda.
 * - Un talle, un ítem: si dos ítems dicen el mismo talle, el segundo va a la
 *   tabla plana (no se pisan ni se suman).
 */
export function agruparPrendas<T extends { nombre: string }>(items: T[]): { prendas: Prenda<T>[]; sueltos: T[] } {
  type Candidato = { item: T; base: string; talle: string; marcado: boolean }
  const porClave = new Map<string, Candidato[]>()
  const sueltos: T[] = []

  for (const item of items) {
    const conMarcador = partirVariante(item.nombre)
    const partido = conMarcador ?? partirTalleSinMarcador(item.nombre)
    if (!partido) { sueltos.push(item); continue }
    const clave = claveBase(partido.base)
    const c = { item, base: partido.base, talle: partido.variante, marcado: !!conMarcador }
    const arr = porClave.get(clave)
    if (arr) arr.push(c)
    else porClave.set(clave, [c])
  }

  const prendas: Prenda<T>[] = []
  for (const [clave, candidatos] of porClave) {
    let miembros = candidatos
    if (candidatos.length < 3) {
      miembros = candidatos.filter((c) => c.marcado)
      for (const c of candidatos) if (!c.marcado) sueltos.push(c.item)
    }

    const porTalle = new Map<string, Candidato>()
    for (const c of [...miembros].sort((a, b) => a.item.nombre.localeCompare(b.item.nombre, 'es'))) {
      if (porTalle.has(c.talle)) sueltos.push(c.item)
      else porTalle.set(c.talle, c)
    }
    // Una "prenda" de un solo talle sería un rótulo sobre una celda: ruido, no estructura.
    if (porTalle.size < 2) {
      for (const c of porTalle.values()) sueltos.push(c.item)
      continue
    }

    const elegidos = [...porTalle.values()]
    // El nombre que se muestra es la escritura más usada ("BOTINES DE SEGURIDAD" ×6 le gana a "BOTINES SEGURIDAD" ×1).
    const usos = new Map<string, number>()
    for (const c of elegidos) usos.set(c.base, (usos.get(c.base) ?? 0) + 1)
    const base = [...usos.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'es'))[0][0]

    const talles = elegidos
      .map((c) => ({ talle: c.talle, item: c.item }))
      .sort((a, b) => compararTalle(a.talle, b.talle))
    const sistema: SistemaTalles = talles.every((t) => /^\d+$/.test(t.talle)) ? 'numeros' : 'letras'
    prendas.push({ clave, base, sistema, talles })
  }

  prendas.sort((a, b) => a.base.localeCompare(b.base, 'es'))
  return { prendas, sueltos }
}

/**
 * Una matriz por sistema de talles (letras S…XXXL / números 36…56): mezclar los
 * dos en una sola tabla dejaría filas casi vacías. Las columnas son la unión de
 * los talles de las prendas de esa matriz, en orden real.
 */
export function matricesDePrendas<T>(prendas: Prenda<T>[]): { sistema: SistemaTalles; prendas: Prenda<T>[]; talles: string[] }[] {
  const out: { sistema: SistemaTalles; prendas: Prenda<T>[]; talles: string[] }[] = []
  for (const sistema of ['letras', 'numeros'] as const) {
    const propias = prendas.filter((p) => p.sistema === sistema)
    if (propias.length === 0) continue
    const talles = [...new Set(propias.flatMap((p) => p.talles.map((t) => t.talle)))].sort(compararTalle)
    out.push({ sistema, prendas: propias, talles })
  }
  return out
}

const PESO_URGENCIA: Record<EstadoVencimiento, number> = { vencido: 0, proximo: 1, vigente: 2, sin_fecha: 2 }

/** Tabla plana: primero lo que está en cero (rojo), después bajo mínimo (naranja), después alfabético. */
export function ordenarPorUrgencia<T extends { nombre: string }>(items: T[], estadoDe: (item: T) => EstadoVencimiento): T[] {
  return [...items].sort((a, b) => PESO_URGENCIA[estadoDe(a)] - PESO_URGENCIA[estadoDe(b)] || compararItems(a, b))
}

/** Texto del mínimo para la fila: el mínimo 1 es el criterio general y no se muestra (ruido). */
export function textoMinimo(minimo: number | null | undefined, unidad?: string | null): string | null {
  if (minimo === 1) return null
  if (minimo == null || minimo <= 0) return 'sin mínimo'
  return `mín. ${fmtCantidad(minimo, unidad)}`
}

// ============================================================
// Movimientos: el último de cada ítem, cómo describirlo y el filtro de la
// pestaña "Movimientos". El destinatario de una entrega se tipea en `notas`
// (no hay vínculo con empleados), por eso la búsqueda mira las notas.
// ============================================================

type MovimientoOrdenable = { fecha: string; created_at?: string | null }

/** Más reciente primero: por fecha y, a igual fecha, por created_at. */
export function compararMovimientosDesc(a: MovimientoOrdenable, b: MovimientoOrdenable): number {
  if (a.fecha !== b.fecha) return a.fecha < b.fecha ? 1 : -1
  const ca = a.created_at ?? '', cb = b.created_at ?? ''
  return ca === cb ? 0 : ca < cb ? 1 : -1
}

/** Último movimiento de cada ítem (para la columna "Último movimiento"). */
export function ultimoMovimientoPorItem<M extends MovimientoOrdenable & { item_id: string }>(movimientos: M[]): Map<string, M> {
  const out = new Map<string, M>()
  for (const m of movimientos) {
    const actual = out.get(m.item_id)
    if (!actual || esMasReciente(m, actual)) out.set(m.item_id, m)
  }
  return out
}

/**
 * Lo que pasó, en palabras: "entregado a Nicolas Fernandez", "Soluciones Integrales",
 * "stock inicial", "ajuste por conteo". Sin fecha (la pone quien muestra).
 */
export function describirMovimiento(m: { tipo: string; notas?: string | null; proveedor?: string | null }): string {
  const notas = (m.notas ?? '').trim()
  if (m.tipo === 'consumo') return notas ? `entregado a ${notas}` : 'entregado'
  if (m.tipo === 'devolucion') return notas ? `devuelto por ${notas}` : 'devolución'
  if (m.tipo === 'compra') {
    const proveedor = (m.proveedor ?? '').trim()
    if (proveedor) return proveedor
    return notas ? `ingreso · ${notas}` : 'ingreso'
  }
  if (notas === 'Stock inicial') return 'stock inicial'
  // El ajuste deja "Conteo: X (había Y)" en notas: se muestra solo lo que escribió la persona.
  const partes = notas.split(' · ').filter(Boolean)
  const propias = partes.filter((p) => !p.startsWith('Conteo:'))
  if (propias.length > 0) return `ajuste · ${propias.join(' · ')}`
  return partes.length > 0 ? 'ajuste por conteo' : 'ajuste'
}

/** A quién/de dónde: la columna "Para / Proveedor" de la pestaña Movimientos. */
export function contraparteDe(m: { tipo: string; notas?: string | null; proveedor?: string | null }): { principal: string; detalle: string | null } {
  const notas = (m.notas ?? '').trim()
  const proveedor = (m.proveedor ?? '').trim()
  if (m.tipo === 'compra') return proveedor ? { principal: proveedor, detalle: notas || null } : { principal: notas, detalle: null }
  if (m.tipo === 'consumo' || m.tipo === 'devolucion') return { principal: notas, detalle: null }
  const d = describirMovimiento(m)
  return { principal: d.replace(/^ajuste · /, ''), detalle: null }
}

/**
 * Destinatarios ya usados en entregas, el más reciente primero y sin duplicados
 * por mayúsculas/acentos. Alimenta el autocompletado de "Entregado a" para que
 * el mismo nombre se escriba siempre igual (y la búsqueda lo encuentre).
 */
export function destinatariosFrecuentes<M extends MovimientoOrdenable & { tipo: string; notas?: string | null }>(movimientos: M[], max = 300): string[] {
  const vistos = new Set<string>()
  const out: string[] = []
  for (const m of [...movimientos].filter((x) => x.tipo === 'consumo').sort(compararMovimientosDesc)) {
    const n = normalizarNombre(m.notas ?? '')
    if (!n) continue
    const k = normalizarTexto(n)
    if (vistos.has(k)) continue
    vistos.add(k)
    out.push(n)
    if (out.length >= max) break
  }
  return out
}

/** Rango del mes en curso: del día 1 a hoy ('YYYY-MM-DD', hora AR la pone quien llama). */
export function rangoMesActual(hoy: string): { desde: string; hasta: string } {
  return { desde: `${hoy.slice(0, 7)}-01`, hasta: hoy }
}

/** Rango del mes anterior completo. */
export function rangoMesAnterior(hoy: string): { desde: string; hasta: string } {
  const [y, m] = hoy.split('-').map(Number)
  const py = m === 1 ? y - 1 : y
  const pm = m === 1 ? 12 : m - 1
  const ultimo = new Date(Date.UTC(py, pm, 0)).getUTCDate()
  const mm = String(pm).padStart(2, '0')
  return { desde: `${py}-${mm}-01`, hasta: `${py}-${mm}-${String(ultimo).padStart(2, '0')}` }
}

export interface FiltroMovimientos {
  tipo: TipoMovimiento | null
  /** 'YYYY-MM-DD' o '' (sin límite). */
  desde: string
  hasta: string
  busqueda: string
}

/**
 * Filtra el libro por tipo, rango y búsqueda (por palabras, sin acentos, con
 * `coincide`). `camposDe` da el texto buscable de cada movimiento (ítem,
 * categoría, notas, proveedor, comprobante). `fueraDeRango` cuenta los que
 * coinciden en todo menos en la fecha: así "¿qué recibió Nicolás?" no se
 * contesta "nada" solo porque fue el mes pasado.
 */
export function filtrarMovimientos<M extends { tipo: string; fecha: string }>(
  movimientos: M[],
  f: FiltroMovimientos,
  camposDe: (m: M) => (string | null | undefined)[]
): { visibles: M[]; fueraDeRango: number } {
  const visibles: M[] = []
  let fueraDeRango = 0
  for (const m of movimientos) {
    if (f.tipo && m.tipo !== f.tipo) continue
    if (f.busqueda.trim() && !coincide(f.busqueda, ...camposDe(m))) continue
    const fecha = m.fecha.slice(0, 10)
    if ((f.desde && fecha < f.desde) || (f.hasta && fecha > f.hasta)) { fueraDeRango++; continue }
    visibles.push(m)
  }
  return { visibles, fueraDeRango }
}

// ============================================================
// Formulario de varias líneas (una entrega = un kit de N ítems, un ingreso =
// un remito de N ítems). Se guarda en UN insert: o entran todas o ninguna.
// ============================================================

export interface LineaForm {
  item_id: string
  cantidad: string
  precio?: string
}

export type LineasPreparadas =
  | { ok: true; lineas: { item_id: string; cantidad: number; precio_unitario: number | null }[] }
  | { ok: false; error: string; indice: number }

/**
 * Valida las líneas. Las vacías (sin ítem ni cantidad) se ignoran: el formulario
 * siempre deja una línea en blanco al final para seguir cargando.
 */
export function prepararLineas(lineas: LineaForm[], conPrecio: boolean): LineasPreparadas {
  const out: { item_id: string; cantidad: number; precio_unitario: number | null }[] = []
  for (let i = 0; i < lineas.length; i++) {
    const l = lineas[i]
    const vacia = !l.item_id && !l.cantidad.trim() && !(l.precio ?? '').trim()
    if (vacia) continue
    const n = i + 1
    if (!l.item_id) return { ok: false, error: `Elegí el ítem de la línea ${n}.`, indice: i }
    const cantidad = parseCantidad(l.cantidad)
    if (cantidad == null || cantidad <= 0) return { ok: false, error: `La cantidad de la línea ${n} tiene que ser mayor a 0.`, indice: i }
    let precio: number | null = null
    if (conPrecio && (l.precio ?? '').trim()) {
      precio = parseCantidad(l.precio)
      if (precio == null || precio < 0) return { ok: false, error: `El precio de la línea ${n} tiene que ser un número.`, indice: i }
    }
    out.push({ item_id: l.item_id, cantidad, precio_unitario: precio })
  }
  if (out.length === 0) return { ok: false, error: 'Agregá al menos un ítem.', indice: 0 }
  return { ok: true, lineas: out }
}

/**
 * Ítems que quedarían en negativo con esta entrega. Suma las líneas del mismo
 * ítem (dos líneas de "Camisa T 44" cuentan juntas contra su stock).
 */
export function excedenStock(lineas: { item_id: string; cantidad: number }[], stockDe: (itemId: string) => number): { item_id: string; pedido: number; stock: number }[] {
  const pedido = new Map<string, number>()
  for (const l of lineas) pedido.set(l.item_id, Math.round(((pedido.get(l.item_id) ?? 0) + l.cantidad) * 100) / 100)
  const out: { item_id: string; pedido: number; stock: number }[] = []
  for (const [item_id, p] of pedido) {
    const stock = stockDe(item_id)
    if (p > stock) out.push({ item_id, pedido: p, stock })
  }
  return out
}
