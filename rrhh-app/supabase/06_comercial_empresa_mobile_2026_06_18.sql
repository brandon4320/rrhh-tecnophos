-- ============================================================
-- Migración 06 · Empresa multi-company + asignación de tareas
-- 2026-06-18
-- ============================================================

-- 1) Campo empresa en tablas de actividad comercial
alter table comercial_tareas
  add column if not exists empresa text
    check (empresa is null or empresa in ('tecnophos', 'adc', 'serviwhite'));

alter table comercial_eventos
  add column if not exists empresa text
    check (empresa is null or empresa in ('tecnophos', 'adc', 'serviwhite'));

alter table comercial_proyectos
  add column if not exists empresa text
    check (empresa is null or empresa in ('tecnophos', 'adc', 'serviwhite'));

alter table comercial_viajes
  add column if not exists empresa text
    check (empresa is null or empresa in ('tecnophos', 'adc', 'serviwhite'));

-- 2) Seguimiento de asignación de tareas (quién asignó + nota)
alter table comercial_tareas
  add column if not exists asignado_por uuid references perfiles(id) on delete set null,
  add column if not exists asignada_at timestamptz,
  add column if not exists nota_asignacion text;

-- 3) Índices para filtros por empresa
create index if not exists idx_comercial_tareas_empresa
  on comercial_tareas(empresa) where empresa is not null;

create index if not exists idx_comercial_tareas_asignado_por
  on comercial_tareas(asignado_por) where asignado_por is not null;

create index if not exists idx_comercial_proyectos_empresa
  on comercial_proyectos(empresa) where empresa is not null;

create index if not exists idx_comercial_eventos_empresa
  on comercial_eventos(empresa) where empresa is not null;
