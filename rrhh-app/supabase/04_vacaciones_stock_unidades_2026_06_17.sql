-- ============================================================
-- Vacaciones + Stock por unidades (aplicado en prod vía MCP 2026-06-17)
-- Mismo patrón limpieza_*, RLS por rol. Las pantallas (UI) se construyen aparte.
-- ============================================================

-- 1) Vacaciones / ausencias programadas
create table if not exists limpieza_vacaciones (
  id uuid primary key default gen_random_uuid(),
  personal_id uuid not null references limpieza_personal(id) on delete cascade,
  desde date not null,
  hasta date not null,
  dias int not null default 0,
  tipo text not null default 'vacaciones' check (tipo in ('vacaciones','licencia','franco','enfermedad','otro')),
  estado text not null default 'pendiente' check (estado in ('pendiente','aprobado','rechazado','cancelado')),
  motivo text,
  aprobado_por uuid references auth.users(id),
  aprobado_at timestamptz,
  created_at timestamptz default now(),
  created_by uuid references auth.users(id),
  updated_at timestamptz default now(),
  check (hasta >= desde)
);
create index if not exists idx_limp_vac_personal on limpieza_vacaciones(personal_id);
create index if not exists idx_limp_vac_rango on limpieza_vacaciones(desde, hasta);

alter table limpieza_vacaciones enable row level security;
create policy "lvac_select" on limpieza_vacaciones for select to authenticated
  using (app_es_super_admin() or app_rol() in ('admin_adc','supervisor','operario'));
create policy "lvac_write" on limpieza_vacaciones for all to authenticated
  using (app_es_super_admin() or app_rol() in ('admin_adc','supervisor'))
  with check (app_es_super_admin() or app_rol() in ('admin_adc','supervisor'));

drop trigger if exists trg_set_updated_at on limpieza_vacaciones;
create trigger trg_set_updated_at before update on limpieza_vacaciones
  for each row execute function set_updated_at();

-- 2) Stock por unidades (el % se deriva en la app: cantidad_actual/cantidad_maxima)
alter table limpieza_consumibles
  add column if not exists unidad          text,
  add column if not exists cantidad_actual numeric(10,2),
  add column if not exists cantidad_maxima numeric(10,2),
  add column if not exists minimo_unidades numeric(10,2);

alter table limpieza_consumible_mov
  add column if not exists cant_anterior numeric(10,2),
  add column if not exists cant_nueva    numeric(10,2),
  add column if not exists delta         numeric(10,2);
