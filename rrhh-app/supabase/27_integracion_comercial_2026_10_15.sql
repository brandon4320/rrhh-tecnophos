-- ============================================================
-- Integración con el Sistema de Gestión Comercial (Cloudflare, otro sistema).
-- El comercial LEE la documentación de la empresa que RRHH decide mostrar
-- (habilitaciones de la empresa + ART y Seguro de Vida mensuales). Nada de
-- personal, sueldos ni recibos: el recorte vive en
-- src/modules/integracion-comercial/reglas.ts.
--
-- Token máquina a máquina: acá se guarda SOLO su sha256. La tabla tiene RLS
-- prendida y ninguna política: la lee únicamente la service role (las rutas
-- /api/externo/*). Para rotar: generar otro token, actualizar token_hash y
-- cargar el nuevo en el otro sistema.
-- ============================================================
create table if not exists public.integraciones (
  clave text primary key,
  token_hash text not null,
  notas text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.integraciones enable row level security;
revoke all on public.integraciones from anon, authenticated;

drop trigger if exists trg_set_updated_at on public.integraciones;
create trigger trg_set_updated_at before update on public.integraciones
  for each row execute function set_updated_at();
