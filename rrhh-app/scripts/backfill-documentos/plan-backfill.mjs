// ============================================================
// Backfill 2026 · paso 1: armar el plan (no toca la red ni la base).
//
// Lee las carpetas que mandó la oficinista y decide, para cada archivo,
// a qué empresa / período / carpeta del sistema va. Imprime el resumen y
// deja el plan en plan.json para que el paso 2 lo suba tal cual.
//
// Reglas acordadas con Agus (2026-09-15):
//  - El período es el MES DE LA CARPETA, no el mes que dice el archivo:
//    la carpeta ABRIL guarda papeles de marzo y así los busca ella.
//  - Todo "Tecno" va a Tecnophos Bahía Blanca; Rosario y Necochea quedan
//    como subcarpetas de Recibos de sueldos, como están en su PC.
//  - Los recibos van como archivos de la carpeta, NO atados al legajo.
//  - La ruta completa (sector y sub-sector) se guarda en `carpeta`.
// ============================================================
import { readdirSync, statSync, writeFileSync } from 'node:fs'
import { join, relative, sep } from 'node:path'

const RAIZ = 'C:/Dev/Documentación Tecno y ADC 2026/_extraido'
const SALIDA = new URL('./plan.json', import.meta.url)

const FUENTES = [
  { dir: join(RAIZ, 'adc'), empresaSlug: 'adc', etiqueta: 'ADC S.R.L.' },
  { dir: join(RAIZ, 'tecno'), empresaSlug: 'tecnophos-bb', etiqueta: 'Tecnophos Bahía Blanca' },
]

const MESES = {
  ENERO: '01', FEBRERO: '02', MARZO: '03', ABRIL: '04', MAYO: '05', JUNIO: '06',
  JULIO: '07', AGOSTO: '08', SEPTIEMBRE: '09', OCTUBRE: '10', NOVIEMBRE: '11', DICIEMBRE: '12',
}

// Carpetas fijas del sistema. Las variantes de tipeo de la oficinista caen todas
// en el mismo nombre canónico; si no, el mes se vería partido en dos carpetas.
const FIJAS = {
  'APORTES SINDICALES': 'Aportes sindicales',
  'APORTES SINDIC': 'Aportes sindicales',
  'APORTES': 'Aportes sindicales',
  'ART': 'ART',
  'F931': 'F931',
  'PAGOS': 'Pagos',
  'RECIBOS DE SUELDOS': 'Recibos de sueldos',
  'SVO': 'SVO',
}

// Sectores y plantas (segundo nivel, dentro de Recibos de sueldos). Los nombres
// largos ganan: en la base los empleados figuran como Limpieza, Sal, Palas, Fumigación.
const SECTORES = {
  'LIMPIEZA': 'Limpieza', 'SAL': 'Sal', 'PALAS': 'Palas',
  'OFI': 'Oficina', 'OFICINA': 'Oficina',
  'FUMI': 'Fumigación', 'FUMIGACIÓN': 'Fumigación',
  'BAHIA': 'Bahía Blanca', 'BAHIA BLANCA': 'Bahía Blanca',
  'NECO': 'Necochea', 'NECOCHEA': 'Necochea',
  'ROSARIO': 'Rosario',
}

// Tercer nivel: conceptos de liquidación.
const CONCEPTOS = {
  'AGUINALDO': 'Aguinaldo',
  'PREMIO ANUAL': 'Premio anual',
  'RECIBO Y AGUINALDO UNIDOS': 'Recibo y aguinaldo unidos',
  'SUELDO Y AGUINALDO UNIDOS': 'Sueldo y aguinaldo unidos',
  'DICIEMBRE- 2°SAC': 'Diciembre · 2° SAC',
  'FEBRERO': 'Febrero',
}

/** Siglas que NO se pasan a minúscula al normalizar una carpeta desconocida. */
const SIGLAS = /^(ARCA|REPSAL|SVO|ART|F931|SAC|ADC|TBB|DDJJ)$/i

function normalizarTramo(tramo, nivel) {
  const crudo = tramo.replace(/\s+/g, ' ').trim()
  const clave = crudo.toUpperCase()
  if (nivel === 0 && FIJAS[clave]) return FIJAS[clave]
  if (nivel === 1 && SECTORES[clave]) return SECTORES[clave]
  if (nivel >= 2 && CONCEPTOS[clave]) return CONCEPTOS[clave]
  if (SECTORES[clave]) return SECTORES[clave]
  if (CONCEPTOS[clave]) return CONCEPTOS[clave]
  if (SIGLAS.test(crudo)) return crudo.toUpperCase()
  // Desconocida: primera en mayúscula, resto en minúscula (respeta acentos).
  return crudo.charAt(0).toUpperCase() + crudo.slice(1).toLowerCase()
}

function archivos(dir) {
  const salida = []
  for (const nombre of readdirSync(dir)) {
    const p = join(dir, nombre)
    if (statSync(p).isDirectory()) salida.push(...archivos(p))
    else salida.push(p)
  }
  return salida
}

const plan = []
const descartes = []

for (const fuente of FUENTES) {
  for (const absoluto of archivos(fuente.dir)) {
    const tramos = relative(fuente.dir, absoluto).split(sep)
    const nombreArchivo = tramos.at(-1)

    // Los accesos directos de Windows no son documentos.
    if (/\.lnk$/i.test(nombreArchivo)) {
      descartes.push({ motivo: 'acceso directo de Windows', archivo: absoluto })
      continue
    }
    // tramos = ['AÑO 2026', 'ABRIL', ...carpetas..., 'archivo.pdf']
    const anio = (tramos[0].match(/(\d{4})/) || [])[1]
    const mes = MESES[(tramos[1] || '').toUpperCase()]
    if (!anio || !mes) {
      descartes.push({ motivo: 'no se pudo deducir año/mes de la ruta', archivo: absoluto })
      continue
    }

    const carpeta = tramos
      .slice(2, -1)
      .map((t, i) => normalizarTramo(t, i))
      .join('/')

    plan.push({
      empresaSlug: fuente.empresaSlug,
      empresa: fuente.etiqueta,
      periodo: `${anio}-${mes}-01`,
      carpeta, // '' = archivos sueltos del mes
      nombreArchivo,
      sizeBytes: statSync(absoluto).size,
      origenLocal: absoluto,
    })
  }
}

// ───────────────────────── resumen para revisar a ojo ─────────────────────────
const fmtMB = (b) => (b / 1048576).toFixed(1) + ' MB'
const etiquetaMes = (p) => {
  const nombres = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']
  return `${nombres[Number(p.slice(5, 7)) - 1]} ${p.slice(0, 4)}`
}

console.log('═'.repeat(78))
console.log('PLAN DE CARGA · simulación, no se sube ni se escribe nada')
console.log('═'.repeat(78))

for (const fuente of FUENTES) {
  const de = plan.filter((p) => p.empresaSlug === fuente.empresaSlug)
  console.log(`\n■ ${fuente.etiqueta}  (${de.length} archivos · ${fmtMB(de.reduce((a, b) => a + b.sizeBytes, 0))})`)

  const periodos = [...new Set(de.map((p) => p.periodo))].sort()
  for (const periodo of periodos) {
    const delMes = de.filter((p) => p.periodo === periodo)
    console.log(`\n  ${etiquetaMes(periodo)} — ${delMes.length} archivos`)
    const porCarpeta = new Map()
    for (const d of delMes) porCarpeta.set(d.carpeta, (porCarpeta.get(d.carpeta) || 0) + 1)
    for (const [carpeta, n] of [...porCarpeta].sort((a, b) => a[0].localeCompare(b[0], 'es'))) {
      console.log(`     ${String(n).padStart(3)}  ${carpeta || '(sueltos en la raíz del mes)'}`)
    }
  }
}

console.log('\n' + '─'.repeat(78))
console.log('CARPETAS QUE VAN A QUEDAR (nombre ya normalizado)')
const raices = new Map()
for (const p of plan) {
  const raiz = p.carpeta.split('/')[0]
  if (!raices.has(raiz)) raices.set(raiz, new Set())
  if (p.carpeta.includes('/')) raices.get(raiz).add(p.carpeta.split('/').slice(1).join('/'))
}
for (const [raiz, hijas] of [...raices].sort((a, b) => a[0].localeCompare(b[0], 'es'))) {
  console.log(`  ${raiz || '(sueltos en la raíz del mes)'}`)
  for (const h of [...hijas].sort((a, b) => a.localeCompare(b, 'es'))) console.log(`      └ ${h}`)
}

if (descartes.length) {
  console.log('\n' + '─'.repeat(78))
  console.log(`NO SE SUBEN (${descartes.length})`)
  for (const d of descartes) console.log(`  · ${d.motivo}: ${relative(RAIZ, d.archivo)}`)
}

const grande = plan.filter((p) => p.sizeBytes > 25 * 1024 * 1024)
console.log('\n' + '─'.repeat(78))
console.log(`TOTAL: ${plan.length} archivos · ${fmtMB(plan.reduce((a, b) => a + b.sizeBytes, 0))}`)
console.log(`Archivos por encima del tope de 25 MB del sistema: ${grande.length}`)

writeFileSync(SALIDA, JSON.stringify(plan, null, 1), 'utf8')
console.log(`\nPlan escrito en ${SALIDA.pathname.slice(1)}`)
