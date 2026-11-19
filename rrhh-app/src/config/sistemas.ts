// ============================================================
// Otros sistemas del grupo, por marca: lo que antes mostraba el hub (/) y ahora vive en la
// sección "Otros sistemas" del Inicio (overhaul 18/11/2026). El hub sigue usándolo para los
// roles que no entran a Gestión de Recursos. Un solo lugar para las URLs.
// ============================================================

// Sistema del servicio de limpieza para UNIPAR (deploy propio, fuera de este repo).
export const UNIPAR_APP_URL = 'https://unipar-app.vercel.app/'
// Checklist de maquinaria pesada (fotos, chequeo interior y horómetro por turno):
// otro proyecto con deploy propio, carpeta `C:\Dev\Detalle maquinaria`. Apunta al
// panel de administración, que es lo que usa la oficina; los operarios entran por
// su propio enlace.
export const CHECKLIST_MAQUINARIA_URL = 'https://checklist.serviwhite.com/admin'
// ERP de Serviwhite (alquiler y venta de módulos): otro repo, con su propio login.
// La raíz redirige sola al login si no hay sesión.
export const SERVIWHITE_ERP_URL = 'https://gestion.serviwhite.com/'
// El Sistema de Gestión Comercial nuevo (otro proyecto, en Cloudflare; repo comercial-tecnophos), con
// su propio login. `?empresa=` abre esa empresa (la suma a las que se miran). El módulo /comercial
// de acá es el CRM viejo: queda en el código pero el inicio ya no lo ofrece.
export const CRM_URL = 'https://crm.tecnophos.com.ar/'
// Recorrido de limpieza de baños: vive en el ERP de Serviwhite (arma el recorrido
// y el link del encargado). Se pide con el mismo login del ERP.
export const SERVIWHITE_LIMPIEZA_URL = 'https://gestion.serviwhite.com/limpieza'
// App de control de plagas: página estática autocontenida en public/
// (los datos viven en el dispositivo del operario, no usa Supabase).
export const CONTROL_PLAGAS_URL = '/control-plagas.html'

// Marcas del grupo: agrupan las empresas (sedes) por prefijo de slug
export const MARCAS = [
  { key: 'tecnophos', nombre: 'Tecnophos', logo: '/logo-tecnophos-iso.png', icono: '/icono-tecnophos.png', match: (s: string) => s.startsWith('tecnophos') },
  { key: 'adc', nombre: 'ADC S.R.L.', logo: '/logo-adc.png', icono: '/icono-adc.png', match: (s: string) => s === 'adc' },
  { key: 'serviwhite', nombre: 'Serviwhite', logo: '/logo-serviwhite-iso.png', icono: '/icono-serviwhite.png', match: (s: string) => s === 'serviwhite' },
] as const
