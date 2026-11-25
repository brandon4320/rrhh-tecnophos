// ============================================================
// Integración con el Portal de Trazabilidad: lectura con service role, SOLO
// después de validar el token. La usan las rutas /api/externo/trazabilidad/*
// (máquina a máquina, sin sesión). NUNCA importar desde un client component.
// El recorte de qué se muestra está en ./reglas.ts.
// ============================================================
import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'
import { tokenDeIntegracionValido } from '@/lib/integraciones'
import { elegirCarnet, empresaDe, esCarnetAplicador, mimeMostrable, slugsDe, TIPO_CARNET_APLICADOR, type Aplicador, type Carnet, type Marca } from './reglas'

export type Admin = ReturnType<typeof createAdminClient>

export function tokenValido(admin: Admin, req: Request): Promise<boolean> {
  return tokenDeIntegracionValido(admin, req, 'trazabilidad')
}

type Uno<T> = T | T[] | null | undefined
const uno = <T,>(v: Uno<T>): T | null => (Array.isArray(v) ? (v[0] ?? null) : (v ?? null))

interface FilaCarnet {
  id: string
  numero_documento: string | null
  fecha_vencimiento: string | null
  tipo: Uno<{ nombre: string }>
  empleado: Uno<{ id: string; nombre: string; apellido: string | null; activo: boolean | null; empresa: Uno<{ slug: string }> }>
  archivos: { id: string; mime_type: string | null; uploaded_at: string | null }[] | null
}

/** Aplicadores activos con carnet de aplicador cargado. */
export async function aplicadores(admin: Admin, marca: Marca | null): Promise<{ generado: string; aplicadores: Aplicador[] }> {
  const { data, error } = await admin
    .from('certificados')
    .select('id, numero_documento, fecha_vencimiento, tipo:tipos_certificado!inner(nombre), empleado:empleados!inner(id, nombre, apellido, activo, empresa:empresas(slug)), archivos(id, mime_type, uploaded_at)')
    .eq('tipo.nombre', TIPO_CARNET_APLICADOR)
    .not('empleado_id', 'is', null)
  if (error) throw new Error(`certificados: ${error.message}`)

  const slugs = new Set(slugsDe(marca))
  const porPersona = new Map<string, { base: Omit<Aplicador, 'carnet'>; carnets: Carnet[] }>()
  for (const f of (data ?? []) as unknown as FilaCarnet[]) {
    const tipo = uno(f.tipo)
    const emp = uno(f.empleado)
    const slug = uno(emp?.empresa ?? null)?.slug
    const empresa = empresaDe(slug)
    // Doble chequeo además del filtro de la consulta: solo carnet de aplicador, personas activas, empresas del recorte.
    if (!emp || !emp.activo || !slug || !slugs.has(slug) || !empresa || !esCarnetAplicador(tipo?.nombre)) continue
    const archivo = (f.archivos ?? []).filter((a) => mimeMostrable(a.mime_type)).sort((a, b) => (b.uploaded_at ?? '').localeCompare(a.uploaded_at ?? ''))[0]
    const carnet: Carnet = { certificadoId: f.id, numero: f.numero_documento, vence: f.fecha_vencimiento?.slice(0, 10) ?? null, archivoId: archivo?.id ?? null }
    const actual = porPersona.get(emp.id) ?? { base: { empleadoId: emp.id, nombre: [emp.nombre, emp.apellido].filter(Boolean).join(' ').trim(), marca: empresa.marca, base: empresa.base }, carnets: [] }
    actual.carnets.push(carnet)
    porPersona.set(emp.id, actual)
  }
  const lista: Aplicador[] = []
  for (const { base, carnets } of porPersona.values()) {
    const carnet = elegirCarnet(carnets)
    if (carnet) lista.push({ ...base, carnet })
  }
  lista.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
  return { generado: new Date().toISOString(), aplicadores: lista }
}

/** Archivo de un carnet de aplicador del recorte, o null (cualquier otro archivo → 404). */
export async function archivoCarnet(admin: Admin, id: string): Promise<{ path: string; nombre: string; mime: string } | null> {
  const { data, error } = await admin
    .from('archivos')
    .select('path, nombre, mime_type, certificado:certificados!inner(empleado:empleados(activo, empresa:empresas(slug)), tipo:tipos_certificado(nombre))')
    .eq('id', id)
    .maybeSingle()
  if (error) throw new Error(`archivos: ${error.message}`)
  const cert = uno(data?.certificado as Uno<{ empleado: Uno<{ activo: boolean | null; empresa: Uno<{ slug: string }> }>; tipo: Uno<{ nombre: string }> }>)
  const emp = uno(cert?.empleado ?? null)
  if (!data?.path || !cert || !emp?.activo || !empresaDe(uno(emp.empresa)?.slug) || !esCarnetAplicador(uno(cert.tipo)?.nombre) || !mimeMostrable(data.mime_type)) return null
  return { path: data.path, nombre: data.nombre, mime: data.mime_type as string }
}
