import { createHash } from 'node:crypto'
import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { tokenDeIntegracionValido } from '@/lib/integraciones'
import { deleteFromR2, uploadToR2 } from '@/lib/r2/operations'
import { esPeriodoFuturo, esTipoRecibo } from '@/lib/recibos'
import { hashQueCuenta, decidirCarga } from '@/modules/recibos/carga'
import {
  esPdf, leerAprobacion, loteCortado, MAX_RECIBO_SUBIDA_BYTES, nombreDeRecibo, rutaDeRecibo,
  siguienteSecuencia,
} from '@/modules/recibos/archivo'
import {
  anularRecibos, CHOQUE_UNICO, detalleDeCarga, empresaDeEmpleado, insertarRecibo, recibosDeEmpleado,
} from '@/modules/recibos/lote-servidor'

/**
 * Fase 2: el PDF aprobado entra y queda en el legajo de su dueño.
 *
 * ★ El lector NO dice de quién es el archivo que sube. Manda los bytes y el id
 * de la corrida; Gestión reconoce el PDF por su propio sha256 y saca el dueño
 * del vale que escribió /lote cuando decidió. Si el lector emparejara mal un
 * archivo con un legajo, el sha no estaría en el vale y el PDF se rechaza. Esa
 * es la garantía de que a nadie le llegue el recibo de otro, y por eso esta
 * ruta no acepta un empleado ni un legajo como parámetro.
 *
 * La decisión se vuelve a tomar acá con los recibos de AHORA, no con los de
 * cuando corrió /lote: entre una cosa y la otra la oficina pudo cargar algo a
 * mano. El vale dice de quién es el archivo; qué hacer con él se decide
 * siempre contra la base.
 *
 * Orden de las operaciones:
 *   1. R2 primero. Si falla, no se escribió nada en la base.
 *   2. La fila después. Si falla, se borra el objeto y no queda huérfano.
 *   3. Las anulaciones AL FINAL. Si se anulara antes y el insert fallara, la
 *      persona se quedaría sin nada para firmar. Al revés, lo peor que pasa es
 *      que queden dos vigentes del mismo número, que la corrida siguiente
 *      resuelve sola (decidirCarga las anula a las dos).
 */
export const dynamic = 'force-dynamic'

/** Reintentos cuando el número de secuencia lo ganó otro proceso. */
const REINTENTOS_SECUENCIA = 3

export async function POST(req: Request) {
  const admin = createAdminClient()

  try {
    if (!(await tokenDeIntegracionValido(admin, req, 'recibos'))) {
      return NextResponse.json({ error: 'Token inválido' }, { status: 401 })
    }
  } catch (e) {
    console.error('[externo/recibos/archivo] token:', e)
    return NextResponse.json({ error: 'No disponible' }, { status: 503 })
  }

  if (!req.headers.get('content-type')?.includes('multipart/form-data')) {
    return NextResponse.json({ error: 'Se espera multipart/form-data con cargaId y file.' }, { status: 400 })
  }

  const fd = await req.formData().catch(() => null)
  if (!fd) return NextResponse.json({ error: 'No se pudo leer el formulario.' }, { status: 400 })

  const cargaId = String(fd.get('cargaId') ?? '').trim()
  const file = fd.get('file')
  if (!/^[0-9a-f-]{36}$/i.test(cargaId)) {
    return NextResponse.json({ error: 'Falta el id de la corrida.' }, { status: 400 })
  }
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: 'Falta el archivo.' }, { status: 400 })
  }
  if (file.size > MAX_RECIBO_SUBIDA_BYTES) {
    return NextResponse.json({ error: 'El archivo es demasiado grande para ser una liquidación.' }, { status: 413 })
  }

  const bytes = new Uint8Array(await file.arrayBuffer())
  if (!esPdf(bytes)) {
    return NextResponse.json({ error: 'El archivo no es un PDF.' }, { status: 400 })
  }
  const sha = createHash('sha256').update(bytes).digest('hex')

  // De quien es este PDF: lo dice el vale, no quien lo sube.
  let detalle
  try {
    detalle = await detalleDeCarga(admin, cargaId)
  } catch (e) {
    console.error('[externo/recibos/archivo] corrida:', e)
    return NextResponse.json({ error: 'No disponible' }, { status: 503 })
  }
  if (detalle === null) {
    return NextResponse.json({ error: 'Esa corrida no existe.' }, { status: 404 })
  }

  if (loteCortado(detalle)) {
    // /lote ya dijo que de ese lote no sale nada: la asignación puede estar
    // sistemáticamente mal y es justo donde no se quiere escribir un legajo.
    return NextResponse.json(
      { error: 'Esa corrida quedó cortada: no se carga nada de ese lote.', accion: 'lote_cortado' },
      { status: 409 }
    )
  }

  const aprobacion = leerAprobacion(detalle, sha)
  if (!aprobacion) {
    // Lo normal es que el lector este subiendo un archivo que esa corrida no
    // aprobo. Que vuelva a pedir el informe: la decision es de Gestion.
    return NextResponse.json(
      { error: 'Ese PDF no es ninguna de las liquidaciones aprobadas en esa corrida.', accion: 'no_aprobado' },
      { status: 409 }
    )
  }

  // Lo que viene del vale se vuelve a revisar: lo escribio esta misma app,
  // pero una version anterior, y es jsonb.
  if (!esTipoRecibo(aprobacion.tipo)) {
    return NextResponse.json({ error: 'El tipo de la liquidación no es válido.' }, { status: 409 })
  }
  if (esPeriodoFuturo(aprobacion.periodo)) {
    return NextResponse.json({ error: 'El período no puede ser un mes futuro.' }, { status: 409 })
  }

  let empleado
  let previos
  try {
    // Sin empresa el recibo entra igual (va a la carpeta 'docs'): lo unico que
    // corta es que la persona ya no este.
    empleado = await empresaDeEmpleado(admin, aprobacion.empleadoId)
    if (!empleado.existe) {
      return NextResponse.json({ error: 'El empleado de esa liquidación ya no existe.' }, { status: 409 })
    }
    previos = await recibosDeEmpleado(admin, aprobacion.empleadoId)
  } catch (e) {
    console.error('[externo/recibos/archivo] empleado:', e)
    return NextResponse.json({ error: 'No disponible' }, { status: 503 })
  }

  // La huella con la que se guarda puede ser la de otra copia de la misma
  // liquidacion. Se recalcula contra los recibos de AHORA y no se usa la que
  // eligio /lote: si entre medio se cargo una de las copias, vale esa.
  const hash = hashQueCuenta([aprobacion.hash, sha], previos)

  const decision = decidirCarga(
    { hash, reciboNumero: aprobacion.recibo, origenAt: aprobacion.origenAt },
    previos
  )
  const comun = { legajo: aprobacion.legajo, periodo: aprobacion.periodo, tipo: aprobacion.tipo }

  if (decision.accion === 'ya_estaba') {
    return NextResponse.json({ ...comun, accion: 'ya_estaba', reciboId: decision.id })
  }
  if (decision.accion === 'superada') {
    // Es la version vieja de algo que ya se corrigio: no se guarda ni se avisa.
    return NextResponse.json({ ...comun, accion: 'superada', reciboId: decision.porId })
  }

  const path = rutaDeRecibo(empleado.slug, aprobacion.empleadoId, aprobacion.periodo, aprobacion.tipo, hash ?? sha)
  try {
    await uploadToR2(path, bytes, 'application/pdf')
  } catch (e) {
    console.error('[externo/recibos/archivo] R2:', e)
    return NextResponse.json({ error: 'No se pudo guardar el archivo.' }, { status: 502 })
  }

  const fila = {
    empleadoId: aprobacion.empleadoId,
    periodo: aprobacion.periodo,
    tipo: aprobacion.tipo,
    secuencia: siguienteSecuencia(previos, aprobacion.periodo, aprobacion.tipo),
    nombreArchivo: nombreDeRecibo(aprobacion.tipo, aprobacion.periodo, aprobacion.recibo),
    path,
    sizeBytes: file.size,
    reciboNumero: aprobacion.recibo,
    origenArchivo: aprobacion.archivo,
    origenHash: hash ?? sha,
    origenAt: aprobacion.origenAt,
    notas: aprobacion.concepto,
  }

  let reciboId: string | null = null
  for (let intento = 1; intento <= REINTENTOS_SECUENCIA; intento++) {
    const r = await insertarRecibo(admin, fila)
    if (r.id) {
      reciboId = r.id
      break
    }
    if (r.choque === 'hash') {
      // Carrera: alguien cargo ese mismo PDF entre la decision y el insert.
      // No es un error. El objeto se borra solo si quedo en otro lugar que el
      // de la fila que gano; si es el mismo, borrarlo romperia ese recibo.
      const { data } = await admin
        .from('recibos_sueldo').select('id, path').eq('origen_hash', fila.origenHash).maybeSingle()
      if (data?.path !== path) await deleteFromR2(path).catch(() => {})
      return NextResponse.json({ ...comun, accion: 'ya_estaba', reciboId: data?.id ?? null })
    }
    if (r.choque === 'path') {
      // Ese lugar de R2 ya es de otra fila. No se reintenta (el path sale del
      // hash: saldria siempre igual) y no se borra nada: el objeto no es
      // nuestro. Se dice qué pasó, que es lo único que ayuda a desatarlo.
      console.error('[externo/recibos/archivo] path tomado:', path, r.error)
      return NextResponse.json(
        { error: 'Ese archivo ya tiene lugar asignado en otro comprobante de esta persona.', accion: 'path_tomado' },
        { status: 409 }
      )
    }
    if (r.choque === 'secuencia' && intento < REINTENTOS_SECUENCIA) {
      // Otro proceso numero primero. Se vuelve a mirar la base y se sigue.
      try {
        fila.secuencia = siguienteSecuencia(
          await recibosDeEmpleado(admin, aprobacion.empleadoId), fila.periodo, fila.tipo
        )
      } catch {
        break
      }
      continue
    }
    console.error('[externo/recibos/archivo] insert:', r.error)
    // Un choque con otra fila quiere decir que ese lugar NO es nuestro: puede
    // ser el PDF de un recibo que ya existe y borrarlo lo dejaria sin archivo.
    // Solo se limpia lo que seguro quedo huerfano.
    if (r.codigo !== CHOQUE_UNICO) await deleteFromR2(path).catch(() => {})
    return NextResponse.json({ error: 'No se pudo registrar la liquidación.' }, { status: 500 })
  }

  if (!reciboId) {
    await deleteFromR2(path).catch(() => {})
    return NextResponse.json({ error: 'No se pudo registrar la liquidación.' }, { status: 500 })
  }

  // Recien ahora: la nueva ya existe, asi que anular la vieja no deja a nadie
  // sin nada que firmar.
  let anuladas: string[] = []
  if (decision.accion === 'correccion' && decision.anula.length) {
    try {
      await anularRecibos(admin, decision.anula)
      anuladas = decision.anula
    } catch (e) {
      // La corrida siguiente lo resuelve: con dos vigentes del mismo numero,
      // decidirCarga las anula a las dos. No se deshace la carga por esto.
      console.error('[externo/recibos/archivo] anular:', e)
    }
  }

  return NextResponse.json({
    ...comun,
    accion: decision.accion,
    reciboId,
    anuladas,
    habiaFirma: decision.accion === 'correccion' ? decision.habiaFirma : false,
  })
}
