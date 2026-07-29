-- ============================================================
-- Secciones de activos como entidad propia: se crean vacías
-- primero (solo el título) y después se agregan ítems adentro.
-- Los equipos matchean por equipos.categoria = nombre de sección.
-- Aplicada en prod el 2026-07-02 (con backfill de categorías usadas).
-- ============================================================

create table if not exists activo_secciones (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid references empresas(id) on delete cascade,
  nombre text not null,
  created_at timestamptz default now(),
  unique (empresa_id, nombre)
);

alter table activo_secciones enable row level security;

drop policy if exists "secciones_rrhh_all" on activo_secciones;
create policy "secciones_rrhh_all" on activo_secciones for all to authenticated
  using (app_es_rrhh() and app_ve_empresa(empresa_id))
  with check (app_es_rrhh() and app_ve_empresa(empresa_id));

insert into activo_secciones (empresa_id, nombre)
select distinct empresa_id, categoria from equipos where empresa_id is not null
on conflict (empresa_id, nombre) do nothing;
