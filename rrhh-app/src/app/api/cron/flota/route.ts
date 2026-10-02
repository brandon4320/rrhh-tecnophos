import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { diaClaveAR } from '@/lib/fechas-ar'
import { avisarEncargados, urlApp } from '@/modules/flota/servidor'
import { cargarFlota } from '@/modules/flota/queries'
import { mensajeResumenDiario, resumirVehiculo } from '@/modules/flota/resumen'

// Cron de Vercel (vercel.json), lunes a viernes 08:00 de Argentina.
// Arma el resumen del día por empresa y lo manda a sus encargados por
// WhatsApp. La clave del aviso incluye la fecha: si el cron corre dos veces el
// mismo día, el segundo no manda nada.
//
// Vercel firma la llamada con `Authorization: Bearer $CRON_SECRET`. Sin esa
// variable configurada, la ruta no hace nada.

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const secreto = process.env.CRON_SECRET
  if (!secreto || request.headers.get('authorization') !== `Bearer ${secreto}`) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const hoy = diaClaveAR(new Date())
  const admin = createAdminClient()

  const [{ data: empresas, error: errEmp }, flota] = await Promise.all([
    admin.from('empresas').select('id, nombre, slug').order('nombre'),
    cargarFlota(admin),
  ])
  if (errEmp) return NextResponse.json({ error: errEmp.message }, { status: 500 })

  const resultado: { empresa: string; vehiculos: number; avisado: boolean }[] = []
  for (const e of empresas ?? []) {
    const propios = flota.filter((v) => v.empresa_id === e.id)
    if (propios.length === 0) continue
    const mensaje = mensajeResumenDiario(
      e,
      propios.map((v) => ({ patente: v.patente, checklistActivo: v.checklist_activo, r: resumirVehiculo(v, hoy) })),
      hoy,
      urlApp()
    )
    if (mensaje) {
      await avisarEncargados(admin, {
        empresaId: e.id,
        tipo: 'resumen_diario',
        clave: `resumen_diario:${e.id}:${hoy}`,
        mensaje,
      })
    }
    resultado.push({ empresa: e.nombre, vehiculos: propios.length, avisado: Boolean(mensaje) })
  }

  return NextResponse.json({ ok: true, fecha: hoy, resultado })
}
