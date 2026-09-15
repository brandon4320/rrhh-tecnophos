// ============================================================
// Backfill 2026 · paso 2: subir lo que armó plan-backfill.mjs.
//
// Hace EXACTAMENTE lo mismo que el navegador (lib/upload-client.ts::subirDocumento):
//   1) POST /api/upload-url  → el servidor firma con SUS claves de R2
//   2) PUT a la URL firmada
//   3) POST /api/documentos  → registra la fila (gated por RLS)
// Por eso no hacen falta las claves de Cloudflare acá, y por eso tampoco
// molesta que el bucket no tenga CORS: eso es una restricción del navegador.
//
// La sesión se arma con el MISMO @supabase/ssr que usa la app, dejándole
// escribir las cookies en un frasco en memoria. Así el formato de la cookie
// sale de la librería y no de una suposición mía que se rompa al actualizar.
//
// Uso (desde rrhh-app, que es donde están las dependencias):
//   $env:GESTION_USUARIO   = "tu.usuario"
//   $env:GESTION_PASSWORD  = "tu contraseña"
//   node scripts/backfill-documentos/cargar-backfill.mjs --simular
//   node scripts/backfill-documentos/cargar-backfill.mjs --empresa adc --periodo 2026-01
//   node scripts/backfill-documentos/cargar-backfill.mjs          # todo lo que falte
//
// Es RETOMABLE: cada archivo subido se anota en subidos.json y no se repite.
// Sin eso, un corte a mitad de camino dejaría duplicados (la clave en R2 lleva
// Date.now(), así que reintentar el mismo archivo crea una fila nueva).
// ============================================================
import { readFileSync, writeFileSync, existsSync, statSync } from 'node:fs'
import { basename, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createServerClient } from '@supabase/ssr'

const BASE = process.env.GESTION_URL ?? 'https://gestion-tecnophos.vercel.app'
const USUARIO = process.env.GESTION_USUARIO ?? ''
const PASSWORD = process.env.GESTION_PASSWORD ?? ''
const PLAN = new URL('./plan.json', import.meta.url)
const LEDGER = new URL('./subidos.json', import.meta.url)

const args = process.argv.slice(2)
const flag = (n) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : null }
const SIMULAR = args.includes('--simular')
const SOLO_EMPRESA = flag('--empresa')
const SOLO_PERIODO = flag('--periodo')   // 'YYYY-MM'
const EN_PARALELO = Number(flag('--paralelo') ?? 3)

const MIME = {
  pdf: 'application/pdf', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  doc: 'application/msword', xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', csv: 'text/csv', txt: 'text/plain',
}
const mimeDe = (n) => MIME[n.split('.').pop().toLowerCase()] ?? 'application/octet-stream'

// ── Sesión ───────────────────────────────────────────────────────────────────
// El login de Gestión es por usuario: se convierte al email interno igual que
// src/lib/auth-helpers.ts. Si el usuario ya trae '@', se usa tal cual.
const aEmail = (u) => (u.includes('@') ? u.trim().toLowerCase() : `${u.trim().toLowerCase().replace(/\s+/g, '.')}@users.internal`)

async function iniciarSesion() {
  if (!USUARIO || !PASSWORD) {
    throw new Error('Faltan GESTION_USUARIO / GESTION_PASSWORD en el entorno.')
  }
  const env = leerEnvLocal()
  const frasco = new Map()
  const supabase = createServerClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    cookies: {
      getAll: () => [...frasco].map(([name, value]) => ({ name, value })),
      setAll: (cs) => cs.forEach(({ name, value }) => frasco.set(name, value)),
    },
  })
  const { data, error } = await supabase.auth.signInWithPassword({ email: aEmail(USUARIO), password: PASSWORD })
  if (error) throw new Error(`No se pudo iniciar sesión: ${error.message}`)
  const cookie = [...frasco].map(([n, v]) => `${n}=${encodeURIComponent(v)}`).join('; ')
  if (!cookie) throw new Error('El login anduvo pero no quedó ninguna cookie de sesión.')
  return { supabase, cookie, userId: data.user?.id }
}

/** Lee el .env.local de rrhh-app (dos carpetas arriba de este script). */
function leerEnvLocal() {
  const raiz = join(fileURLToPath(new URL('.', import.meta.url)), '..', '..')
  const txt = readFileSync(join(raiz, '.env.local'), 'utf8')
  const env = {}
  for (const linea of txt.split(/\r?\n/)) {
    const m = /^([A-Z0-9_]+)=(.*)$/.exec(linea.trim())
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '')
  }
  if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    throw new Error('El .env.local de rrhh-app no tiene NEXT_PUBLIC_SUPABASE_URL / ANON_KEY.')
  }
  return env
}

// ── Subida de un archivo (mismo circuito que el navegador) ───────────────────
async function subirUno(item, empresaId, cookie) {
  const nombre = basename(item.origenLocal)
  const mimeType = mimeDe(nombre)
  const cuerpo = {
    recurso: 'documento', empresaId, periodo: item.periodo.slice(0, 7),
    carpeta: item.carpeta, nombre, mimeType, sizeBytes: item.sizeBytes,
  }

  const firma = await fetch(`${BASE}/api/upload-url`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', cookie }, body: JSON.stringify(cuerpo),
  })
  if (!firma.ok) throw new Error(`upload-url ${firma.status}: ${(await firma.text()).slice(0, 200)}`)
  const { url, path } = await firma.json()

  const bytes = readFileSync(item.origenLocal)
  const put = await fetch(url, { method: 'PUT', body: bytes, headers: { 'Content-Type': mimeType } })
  if (!put.ok) throw new Error(`PUT a R2 ${put.status}`)

  const reg = await fetch(`${BASE}/api/documentos`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', cookie },
    body: JSON.stringify({ empresaId, periodo: item.periodo.slice(0, 7), carpeta: item.carpeta, path, nombre, mimeType, sizeBytes: item.sizeBytes }),
  })
  if (!reg.ok) throw new Error(`registro ${reg.status}: ${(await reg.text()).slice(0, 200)}`)
  const { documento } = await reg.json()
  return { id: documento.id, path }
}

// ── Main ─────────────────────────────────────────────────────────────────────
const plan = JSON.parse(readFileSync(PLAN, 'utf8'))
const ledger = existsSync(LEDGER) ? JSON.parse(readFileSync(LEDGER, 'utf8')) : {}

let pendientes = plan.filter((p) => !ledger[p.origenLocal])
if (SOLO_EMPRESA) pendientes = pendientes.filter((p) => p.empresaSlug === SOLO_EMPRESA)
if (SOLO_PERIODO) pendientes = pendientes.filter((p) => p.periodo.startsWith(SOLO_PERIODO))

const yaHechos = plan.length - plan.filter((p) => !ledger[p.origenLocal]).length
console.log(`Plan: ${plan.length} archivos · ya subidos ${yaHechos} · a subir ahora ${pendientes.length}`)
if (SOLO_EMPRESA || SOLO_PERIODO) console.log(`Filtro: ${SOLO_EMPRESA ?? 'todas las empresas'} · ${SOLO_PERIODO ?? 'todos los meses'}`)

// Coherencia: el plan se armó leyendo el disco; si un archivo cambió de tamaño
// desde entonces, el sizeBytes declarado no sirve y el registro lo rechazaría.
for (const p of pendientes) {
  if (!existsSync(p.origenLocal)) throw new Error(`Falta el archivo ${p.origenLocal} — volvé a correr plan-backfill.mjs`)
  const real = statSync(p.origenLocal).size
  if (real !== p.sizeBytes) throw new Error(`${p.origenLocal} cambió de tamaño (${p.sizeBytes} → ${real}) — volvé a correr plan-backfill.mjs`)
}

if (pendientes.length === 0) { console.log('No queda nada por subir.'); process.exit(0) }
if (SIMULAR) {
  for (const p of pendientes.slice(0, 20)) console.log(`  ${p.empresa} · ${p.periodo.slice(0, 7)} · ${p.carpeta || '(raíz)'} · ${basename(p.origenLocal)}`)
  if (pendientes.length > 20) console.log(`  … y ${pendientes.length - 20} más`)
  console.log('\n--simular: no se subió nada.')
  process.exit(0)
}

const { supabase, cookie } = await iniciarSesion()
console.log('Sesión iniciada.')

// empresa_id por slug, leído con la sesión (o sea: pasando por la RLS).
const { data: empresas, error: errEmp } = await supabase.from('empresas').select('id, slug, nombre')
if (errEmp) throw new Error(`No se pudieron leer las empresas: ${errEmp.message}`)
const idPorSlug = Object.fromEntries(empresas.map((e) => [e.slug, e.id]))
for (const slug of new Set(pendientes.map((p) => p.empresaSlug))) {
  if (!idPorSlug[slug]) throw new Error(`Tu usuario no ve la empresa '${slug}' (o no existe).`)
}

let hechos = 0, ok = 0
const fallas = []
let siguiente = 0
const guardarLedger = () => writeFileSync(LEDGER, JSON.stringify(ledger, null, 1), 'utf8')

const worker = async () => {
  while (siguiente < pendientes.length) {
    const item = pendientes[siguiente++]
    try {
      const r = await subirUno(item, idPorSlug[item.empresaSlug], cookie)
      ledger[item.origenLocal] = { ...r, cuando: new Date().toISOString() }
      ok++
      if (ok % 25 === 0) guardarLedger()
    } catch (e) {
      fallas.push({ archivo: item.origenLocal, error: e.message })
    } finally {
      hechos++
      if (hechos % 10 === 0 || hechos === pendientes.length) {
        process.stdout.write(`\r  ${hechos}/${pendientes.length} · ok ${ok} · fallas ${fallas.length}   `)
      }
    }
  }
}
await Promise.all(Array.from({ length: Math.min(EN_PARALELO, pendientes.length) }, worker))
guardarLedger()

console.log(`\n\nSubidos ${ok} de ${pendientes.length}.`)
if (fallas.length) {
  console.log(`\nFallaron ${fallas.length} (se pueden reintentar volviendo a correr el script):`)
  for (const f of fallas.slice(0, 15)) console.log(`  · ${basename(f.archivo)} → ${f.error}`)
  if (fallas.length > 15) console.log(`  … y ${fallas.length - 15} más`)
  process.exitCode = 1
}
