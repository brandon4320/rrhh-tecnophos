-- ============================================================
-- Operaciones (Limpieza) — Etapa 2 y 3: tablas restantes
-- (Aplicado en prod vía MCP el 2026-06-14; versionado acá.)
-- cronograma, tiempos, consumibles(+mov), feedback. RLS por rol.
-- ============================================================

create table if not exists limpieza_cronograma (
  id uuid primary key default gen_random_uuid(),
  semana date not null,
  area_id uuid not null references limpieza_areas(id) on delete cascade,
  personal_id uuid not null references limpieza_personal(id) on delete cascade,
  dia int not null check (dia between 1 and 7),
  turno text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  created_by uuid references auth.users(id),
  unique (semana, area_id, personal_id, dia)
);
create index if not exists idx_limp_crono_semana on limpieza_cronograma(semana);

create table if not exists limpieza_tiempos (
  id uuid primary key default gen_random_uuid(),
  fecha date not null,
  personal_id uuid not null references limpieza_personal(id) on delete cascade,
  area_id uuid references limpieza_areas(id) on delete set null,
  inicio time,
  fin time,
  duracion_min int,
  estado text not null default 'ok' check (estado in ('ok','observacion')),
  notas text,
  validado_por uuid references auth.users(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  created_by uuid references auth.users(id)
);
create index if not exists idx_limp_tiempos_fecha on limpieza_tiempos(fecha);

create table if not exists limpieza_consumibles (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  stock_pct numeric(5,1) not null default 100 check (stock_pct >= 0 and stock_pct <= 100),
  minimo_pct numeric(5,1) not null default 30 check (minimo_pct >= 0 and minimo_pct <= 100),
  provee text,
  activo boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists limpieza_consumible_mov (
  id uuid primary key default gen_random_uuid(),
  consumible_id uuid not null references limpieza_consumibles(id) on delete cascade,
  pct_anterior numeric(5,1),
  pct_nuevo numeric(5,1),
  tipo text check (tipo in ('reposicion','consumo','ajuste')),
  notas text,
  created_at timestamptz default now(),
  created_by uuid references auth.users(id)
);
create index if not exists idx_limp_consmov_cons on limpieza_consumible_mov(consumible_id);

create table if not exists limpieza_feedback (
  id uuid primary key default gen_random_uuid(),
  fecha timestamptz default now(),
  registrado_por text,
  sector text,
  area_id uuid references limpieza_areas(id) on delete set null,
  tipo text not null default 'observacion' check (tipo in ('reclamo','observacion','sugerencia','felicitacion')),
  prioridad text not null default 'media' check (prioridad in ('critica','alta','media','baja')),
  descripcion text not null,
  evidencia_url text,
  estado text not null default 'pendiente' check (estado in ('pendiente','en_gestion','resuelto','cerrado')),
  respuesta_adc text,
  cerrado_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  created_by uuid references auth.users(id)
);
create index if not exists idx_limp_feedback_estado on limpieza_feedback(estado);

-- RLS (por rol). UNIPAR (admin_unipar): solo lee consumibles y reportes/areas;
-- en feedback puede leer e insertar (registra reclamos), no actualizar.
alter table limpieza_cronograma     enable row level security;
alter table limpieza_tiempos        enable row level security;
alter table limpieza_consumibles    enable row level security;
alter table limpieza_consumible_mov enable row level security;
alter table limpieza_feedback       enable row level security;

create policy "lc_select" on limpieza_cronograma for select to authenticated using (app_es_super_admin() or app_rol() in ('admin_adc','supervisor','operario'));
create policy "lc_write"  on limpieza_cronograma for all    to authenticated using (app_es_super_admin() or app_rol() in ('admin_adc','supervisor')) with check (app_es_super_admin() or app_rol() in ('admin_adc','supervisor'));

create policy "lt_select" on limpieza_tiempos for select to authenticated using (app_es_super_admin() or app_rol() in ('admin_adc','supervisor','operario'));
create policy "lt_write"  on limpieza_tiempos for all    to authenticated using (app_es_super_admin() or app_rol() in ('admin_adc','supervisor')) with check (app_es_super_admin() or app_rol() in ('admin_adc','supervisor'));

create policy "lcons_select" on limpieza_consumibles for select to authenticated using (app_es_super_admin() or app_rol() in ('admin_adc','supervisor','operario','admin_unipar'));
create policy "lcons_write"  on limpieza_consumibles for all    to authenticated using (app_es_super_admin() or app_rol() in ('admin_adc','supervisor')) with check (app_es_super_admin() or app_rol() in ('admin_adc','supervisor'));

create policy "lcm_select" on limpieza_consumible_mov for select to authenticated using (app_es_super_admin() or app_rol() in ('admin_adc','supervisor','operario'));
create policy "lcm_write"  on limpieza_consumible_mov for all    to authenticated using (app_es_super_admin() or app_rol() in ('admin_adc','supervisor')) with check (app_es_super_admin() or app_rol() in ('admin_adc','supervisor'));

create policy "lf_select" on limpieza_feedback for select to authenticated using (app_es_super_admin() or app_rol() in ('admin_adc','supervisor','operario','admin_unipar'));
create policy "lf_insert" on limpieza_feedback for insert to authenticated with check (app_es_super_admin() or app_rol() in ('admin_adc','supervisor','admin_unipar'));
create policy "lf_update" on limpieza_feedback for update to authenticated using (app_es_super_admin() or app_rol() in ('admin_adc','supervisor')) with check (app_es_super_admin() or app_rol() in ('admin_adc','supervisor'));
create policy "lf_delete" on limpieza_feedback for delete to authenticated using (app_es_super_admin() or app_rol() in ('admin_adc','supervisor'));

do $$
declare t text;
begin
  foreach t in array array['limpieza_cronograma','limpieza_tiempos','limpieza_consumibles','limpieza_feedback']
  loop
    execute format('drop trigger if exists trg_set_updated_at on %I', t);
    execute format('create trigger trg_set_updated_at before update on %I for each row execute function set_updated_at()', t);
  end loop;
end $$;
