import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { tokenDeIntegracionValido } from '@/lib/integraciones'
import { decidirCarga } from '@/modules/recibos/carga'
import {
  agruparPorEmpleado, armarDocumentos, faltantes, revisarLote, tipoDeConcepto, TEXTO_PROBLEMA,
} from '@/modules/recibos/lote'
import {
  fechasPorArchivo, leerManifiesto, TEXTO_ARCHIVO, validarManifiesto,
} from '@/modules/recibos/manifiesto'
import {
  padronDeBase, recibosPorEmpleado, registrarCarga,
} from '@/modules/recibos/lote-servidor'

/**
 * El lector del NAS cuenta qué liquidaciones encontró y Gestión decide de
 * quién es cada una.
 *
 * Máquina a máquina: la ruta es pública en el proxy y valida su propio token,
 * igual que /api/externo/comercial/*. Si la base falla o falta el hash
 * responde 503 y no 401 — un 401 es token equivocado de verdad y haría salir
 * a rotar un token que está bien.
 *
 * ★ Esta ruta NO carga ningún recibo ni manda ningún mail. Solo decide y
 * responde qué se puede usar. Los PDF se suben después, y solo los aprobados:
 * primero se decide, después se recibe.
 */
export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  const admin = createAdminClient()

  try {
    if (!(await tokenDeIntegracionValido(admin, req, 'recibos'))) {
      return NextResponse.json({ error: 'Token inválido' }, { status: 401 })
    }
  } catch (e) {
    console.error('[externo/recibos] token:', e)
    return NextResponse.json({ error: 'No disponible' }, { status: 503 })
  }

  const cuerpo = await req.json().catch(() => null)
  const v = validarManifiesto(cuerpo)
  if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 })
  const manifiesto = v.manifiesto

  const { hojas, rechazados } = leerManifiesto(manifiesto)
  const fechas = fechasPorArchivo(manifiesto)

  let padron
  try {
    padron = await padronDeBase(admin, manifiesto.base)
  } catch (e) {
    console.error('[externo/recibos] nómina:', e)
    return NextResponse.json({ error: 'No disponible' }, { status: 503 })
  }
  if (!padron.length) {
    // Sin legajos cargados TODO se resolvería como "no conozco a nadie", y el
    // informe diría que faltan 93 personas. Mejor decir qué pasa de verdad.
    return NextResponse.json(
      { error: `No hay nadie con legajo cargado en la empresa ${manifiesto.base}.` },
      { status: 409 }
    )
  }

  const documentos = armarDocumentos(hojas)
  const revision = revisarLote(documentos, padron)

  // Qué hacer con cada una: cargarla, ignorarla porque ya está, o reemplazar a
  // la que corrige.
  let recibosPrevios
  try {
    recibosPrevios = await recibosPorEmpleado(admin, [...new Set(revision.asignados.map((a) => a.empleado.id))])
  } catch (e) {
    console.error('[externo/recibos] recibos previos:', e)
    return NextResponse.json({ error: 'No disponible' }, { status: 503 })
  }

  const aprobados = revision.asignados.map(({ documento, empleado }) => {
    // Un documento puede venir de varios archivos (el mismo recibo exportado
    // dos veces): vale la fecha más nueva.
    const origenAt = documento.hojas
      .map((h) => fechas.get(h.archivo) ?? null)
      .filter((f): f is string => !!f)
      .sort()
      .pop() ?? null

    const decision = decidirCarga(
      { hash: documento.hojas[0]?.huella ?? null, reciboNumero: documento.recibo ?? null, origenAt },
      recibosPrevios.get(empleado.id) ?? []
    )

    return {
      archivo: documento.hojas[0]?.archivo ?? null,
      corrida: manifiesto.mes,
      copias: documento.hojas.length,
      empleadoId: empleado.id,
      legajo: empleado.legajo,
      recibo: documento.recibo ?? null,
      periodo: documento.periodo,
      tipo: tipoDeConcepto(documento.concepto),
      concepto: documento.concepto ?? null,
      hash: documento.hojas[0]?.huella ?? null,
      origenAt,
      ...decision,
    }
  })

  const aCargar = aprobados.filter((a) => a.accion === 'nueva' || a.accion === 'correccion')
  const yaEstaban = aprobados.filter((a) => a.accion === 'ya_estaba').length
  const superadas = aprobados.filter((a) => a.accion === 'superada').length

  // Quién de los que se esperan todos los meses no tiene ninguna liquidación.
  // Un recibo que nunca se exportó no da ningún error: si no se cuenta contra
  // la nómina, pasa en silencio.
  const esperados = padron.filter((e) => e.activo)
  const sinRecibo = faltantes(esperados, revision.asignados)

  // El CUIL confirmó quién es, pero el nombre está escrito distinto en Gestión.
  // No frena nada; se avisa para que la oficina empareje el dato.
  const nombresDistintos = [
    ...new Set(revision.asignados.filter((a) => a.nombreDistinto).map((a) => a.empleado.legajo)),
  ]

  const problemas = [
    ...rechazados.map((r) => ({
      archivo: r.archivo, corrida: r.corrida, motivo: r.motivo,
      texto: TEXTO_ARCHIVO[r.motivo], legajo: null as number | null, personas: r.personas,
    })),
    ...revision.problemas.map((p) => ({
      archivo: p.documento.hojas[0]?.archivo ?? null, corrida: manifiesto.mes, motivo: p.motivo,
      texto: TEXTO_PROBLEMA[p.motivo], legajo: p.documento.legajo, personas: undefined,
    })),
  ]

  const cargaId = await registrarCarga(admin, {
    base: manifiesto.base,
    carpeta: manifiesto.mes,
    pdfEncontrados: manifiesto.archivos.length,
    recibosNuevos: aCargar.length,
    yaEstaban,
    errores: problemas.length,
    esperados: esperados.length,
    detalle: {
      puedeEnviar: revision.puedeEnviar,
      motivoCorte: revision.motivoCorte,
      superadas,
      personasConRecibo: agruparPorEmpleado(revision.asignados).length,
      sinRecibo: sinRecibo.map((e) => e.legajo),
      nombresDistintos,
      problemas: problemas.map((p) => ({ archivo: p.archivo, motivo: p.motivo })),
    },
  })

  return NextResponse.json({
    cargaId,
    base: manifiesto.base,
    mes: manifiesto.mes,
    puedeEnviar: revision.puedeEnviar,
    motivoCorte: revision.motivoCorte,
    resumen: {
      archivos: manifiesto.archivos.length,
      liquidaciones: documentos.length,
      personas: agruparPorEmpleado(revision.asignados).length,
      aCargar: aCargar.length,
      yaEstaban,
      superadas,
      problemas: problemas.length,
      esperados: esperados.length,
      sinRecibo: sinRecibo.length,
      nombresDistintos: nombresDistintos.length,
    },
    // Lo que el lector tiene que subir, y nada más. Sin nombres ni CUIL: de
    // este lado no hacen falta y del otro ya los tiene.
    aCargar: aCargar.map((a) => ({
      archivo: a.archivo, legajo: a.legajo, recibo: a.recibo, periodo: a.periodo,
      tipo: a.tipo, hash: a.hash, accion: a.accion,
      anula: 'anula' in a ? a.anula : undefined,
    })),
    problemas,
    sinRecibo: sinRecibo.map((e) => e.legajo),
    nombresDistintos,
  })
}
