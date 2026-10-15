// ============================================================
// Integración con el Sistema de Gestión Comercial: lectura con service role,
// SOLO después de validar el token. Lo usan las rutas /api/externo/comercial/*
// (máquina a máquina, sin sesión de navegador). NUNCA importar desde un client
// component. El recorte de qué se muestra está en ./reglas.ts.
// ============================================================
import 'server-only'
import { createHash, timingSafeEqual } from 'node:crypto'
import { createAdminClient } from '@/lib/supabase/admin'
import { CARPETAS_MENSUALES, esCarpetaMensual, esDeEmpresa, marcaDe, slugsDe, ultimosPeriodos, type CarpetaMensual, type Marca } from './reglas'

export type Admin = ReturnType<typeof createAdminClient>

/**
 * ¿El token es el de la integración? Que la DB falle o falte el hash NO es
 * "token inválido": lanza, para responder 503 y no hacer rotar el token en vano.
 */
export async function tokenValido(admin: Admin, req: Request): Promise<boolean> {
  const auth = req.headers.get('authorization') ?? ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : ''
  if (token.length < 32) return false
  const { data, error } = await admin.from('integraciones').select('token_hash').eq('clave', 'comercial').maybeSingle()
  if (error) throw new Error(`integraciones: ${error.message}`)
  if (!data?.token_hash) throw new Error('integraciones sin el hash de "comercial"')
  const a = Buffer.from(createHash('sha256').update(token).digest('hex'), 'utf8')
  const b = Buffer.from(data.token_hash, 'utf8')
  return a.length === b.length && timingSafeEqual(a, b)
}

export interface ArchivoDoc { id: string; nombre: string; mime: string | null; tamano: number | null }

export interface CertificadoEmpresa {
  id: string
  marca: Marca
  sede: string
  tipo: string
  categoria: string | null
  numero: string | null
  emision: string | null
  vence: string | null
  alertaDias: number | null
  archivos: ArchivoDoc[]
}

export interface DocumentoMensual extends ArchivoDoc {
  marca: Marca
  sede: string
  carpeta: CarpetaMensual
  /** 'AAAA-MM-DD', primer día del mes. */
  periodo: string
}

export interface RespuestaDocumentos {
  generado: string
  certificados: CertificadoEmpresa[]
  mensuales: DocumentoMensual[]
}

type Uno<T> = T | T[] | null | undefined
const uno = <T,>(v: Uno<T>): T | null => (Array.isArray(v) ? (v[0] ?? null) : (v ?? null))

export async function documentosComercial(admin: Admin, marca: Marca | null): Promise<RespuestaDocumentos> {
  const slugs = slugsDe(marca)
  const [certs, mensuales] = await Promise.all([
    admin
      .from('certificados')
      .select('id, empleado_id, vehiculo_id, equipo_id, categoria, numero_documento, fecha_emision, fecha_vencimiento, alerta_dias, tipo_nombre_custom, tipo:tipos_certificado(nombre), empresa:empresas!inner(slug, nombre), archivos(id, nombre, mime_type, size_bytes)')
      .is('empleado_id', null)
      .is('vehiculo_id', null)
      .is('equipo_id', null)
      .in('empresa.slug', slugs),
    admin
      .from('documentos_mensuales')
      .select('id, carpeta, periodo, nombre_archivo, mime_type, size_bytes, empresa:empresas!inner(slug, nombre)')
      .in('carpeta', [...CARPETAS_MENSUALES])
      .in('empresa.slug', slugs)
      .order('periodo', { ascending: false })
      .limit(1000),
  ])
  if (certs.error) throw new Error(`certificados: ${certs.error.message}`)
  if (mensuales.error) throw new Error(`documentos_mensuales: ${mensuales.error.message}`)

  const certificados: CertificadoEmpresa[] = []
  for (const c of certs.data ?? []) {
    const empresa = uno(c.empresa as Uno<{ slug: string; nombre: string }>)
    const m = marcaDe(empresa?.slug)
    // Doble chequeo además del filtro de la consulta: nada de personas, vehículos ni equipos.
    if (!empresa || !m || !esDeEmpresa(c)) continue
    const tipo = uno(c.tipo as Uno<{ nombre: string }>)?.nombre ?? c.tipo_nombre_custom ?? 'Documento'
    certificados.push({
      id: c.id,
      marca: m,
      sede: empresa.nombre,
      tipo,
      categoria: c.categoria,
      numero: c.numero_documento,
      emision: c.fecha_emision?.slice(0, 10) ?? null,
      vence: c.fecha_vencimiento?.slice(0, 10) ?? null,
      alertaDias: c.alerta_dias,
      archivos: ((c.archivos ?? []) as { id: string; nombre: string; mime_type: string | null; size_bytes: number | null }[]).map((a) => ({ id: a.id, nombre: a.nombre, mime: a.mime_type, tamano: a.size_bytes })),
    })
  }
  certificados.sort((a, b) => a.marca.localeCompare(b.marca) || a.sede.localeCompare(b.sede, 'es') || a.tipo.localeCompare(b.tipo, 'es'))

  const filas: (DocumentoMensual & { empresa: string })[] = []
  for (const d of mensuales.data ?? []) {
    const empresa = uno(d.empresa as Uno<{ slug: string; nombre: string }>)
    const m = marcaDe(empresa?.slug)
    if (!empresa || !m || !esCarpetaMensual(d.carpeta)) continue
    filas.push({ id: d.id, nombre: d.nombre_archivo, mime: d.mime_type, tamano: d.size_bytes, marca: m, sede: empresa.nombre, carpeta: d.carpeta, periodo: d.periodo.slice(0, 10), empresa: empresa.slug })
  }
  const recientes = ultimosPeriodos(filas).map(({ empresa: _empresa, ...resto }) => resto)

  return { generado: new Date().toISOString(), certificados, mensuales: recientes }
}

/** Archivo que puede abrir el comercial: path y nombre, o null si no entra en el recorte. */
export async function archivoComercial(admin: Admin, tipo: 'certificado' | 'mensual', id: string): Promise<{ path: string; nombre: string } | null> {
  if (tipo === 'certificado') {
    const { data, error } = await admin
      .from('archivos')
      .select('path, nombre, certificado:certificados!inner(empleado_id, vehiculo_id, equipo_id, empresa:empresas(slug))')
      .eq('id', id)
      .maybeSingle()
    if (error) throw new Error(`archivos: ${error.message}`)
    const cert = uno(data?.certificado as Uno<{ empleado_id: string | null; vehiculo_id: string | null; equipo_id: string | null; empresa: Uno<{ slug: string }> }>)
    if (!data?.path || !cert || !esDeEmpresa(cert) || !marcaDe(uno(cert.empresa)?.slug)) return null
    return { path: data.path, nombre: data.nombre }
  }
  const { data, error } = await admin
    .from('documentos_mensuales')
    .select('path, nombre_archivo, carpeta, empresa:empresas(slug)')
    .eq('id', id)
    .maybeSingle()
  if (error) throw new Error(`documentos_mensuales: ${error.message}`)
  if (!data?.path || !esCarpetaMensual(data.carpeta) || !marcaDe(uno(data.empresa as Uno<{ slug: string }>)?.slug)) return null
  return { path: data.path, nombre: data.nombre_archivo }
}

