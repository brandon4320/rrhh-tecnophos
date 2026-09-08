// ============================================================
// URLs del sistema externo de ARCOR (droplet + Caddy → servicio FastAPI).
// Único lugar donde vive el dominio: si cambia (DuckDNS → dominio propio),
// se cambia acá. Ver C:\Dev\Arcor\CONTEXTO-PARA-NUEVA-SESION.md §2.
// ============================================================

const BASE = 'https://tecnophos-n8n.duckdns.org'

export const ENLACES_ARCOR = {
  /** Página de carga manual: subir la foto de un certificado (con o sin código a mano). */
  cargar: `${BASE}/cargar`,
  /** Galería de lecturas dudosas: cada foto se resuelve tipeando el N° de contenedor. */
  revisar: `${BASE}/cargar/revisar`,
  /** Cargar la respuesta de ARCOR (Booking + OE) a un reclamo. */
  respuestaArcor: `${BASE}/subir-respuesta-arcor`,
} as const
