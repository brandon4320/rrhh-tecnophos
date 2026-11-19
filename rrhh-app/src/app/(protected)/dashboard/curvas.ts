// Cuentas puras de las curvas del Inicio (con tests en curvas.test.ts).
import { diaClaveAR } from '@/lib/fechas-ar'

const DIA_MS = 86_400_000
const enDias = (a: string, b: string) => Math.round((Date.parse(b + 'T12:00:00Z') - Date.parse(a + 'T12:00:00Z')) / DIA_MS)

/** Lo que vence en cada una de las próximas `semanas` (semana 0 = hoy a 6 días). */
export function curvaSemanal(dias: number[], semanas = 9): number[] {
  const out = Array.from({ length: semanas }, () => 0)
  for (const d of dias) if (d >= 0 && d < semanas * 7) out[Math.floor(d / 7)]++
  return out
}

/**
 * Km de la flota por semana (las últimas `semanas`, la última es la que corre). Los checklists
 * son quincenales: los km entre dos lecturas se reparten parejo entre los días que pasaron
 * (lo mismo que hace `kmPorDia`), así una semana sin checklist no cae a cero.
 * Las lecturas marcadas como inconsistentes no cuentan.
 */
export function kmPorSemana(
  vehiculos: { checklists: { created_at: string; km: number | null; km_inconsistente: boolean }[] }[],
  hoy: string,
  semanas = 8
): number[] {
  const inicio = new Date(hoy + 'T12:00:00Z')
  inicio.setUTCDate(inicio.getUTCDate() - semanas * 7 + 1)
  const desde = inicio.toISOString().slice(0, 10)
  const out = Array.from({ length: semanas }, () => 0)
  for (const v of vehiculos) {
    const l = v.checklists
      .filter((c) => c.km != null && !c.km_inconsistente)
      .map((c) => ({ dia: diaClaveAR(c.created_at), km: c.km as number }))
      .sort((a, b) => (a.dia < b.dia ? -1 : a.dia > b.dia ? 1 : a.km - b.km))
    for (let i = 1; i < l.length; i++) {
      const dias = enDias(l[i - 1].dia, l[i].dia)
      const delta = l[i].km - l[i - 1].km
      if (dias <= 0 || delta <= 0) continue
      const porDia = delta / dias
      for (let k = 1; k <= dias; k++) {
        const d = new Date(l[i - 1].dia + 'T12:00:00Z')
        d.setUTCDate(d.getUTCDate() + k)
        const dia = d.toISOString().slice(0, 10)
        if (dia < desde || dia > hoy) continue
        out[Math.floor(enDias(desde, dia) / 7)] += porDia
      }
    }
  }
  return out.map((x) => Math.round(x))
}

/** Movimientos de un tipo por semana (las últimas `semanas`). */
export function porSemana(fechas: string[], hoy: string, semanas = 8): number[] {
  const inicio = new Date(hoy + 'T12:00:00Z')
  inicio.setUTCDate(inicio.getUTCDate() - semanas * 7 + 1)
  const desde = inicio.toISOString().slice(0, 10)
  const out = Array.from({ length: semanas }, () => 0)
  for (const f of fechas) {
    const dia = f.slice(0, 10)
    if (dia < desde || dia > hoy) continue
    out[Math.floor(enDias(desde, dia) / 7)]++
  }
  return out
}

