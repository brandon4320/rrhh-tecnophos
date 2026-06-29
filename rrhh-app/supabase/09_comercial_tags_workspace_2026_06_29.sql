-- ============================================================
-- Workspace Comercial: etiquetas (tags) libres de colores
-- en proyectos y tareas, estilo Notion.
-- ============================================================

-- 1. Catálogo de tags (nombre único + color)
create table if not exists comercial_tags (
  nombre text primary key,
  color text not null default '#64748b',
  created_at timestamptz default now()
);

-- 2. Columnas de etiquetas en proyectos y tareas
alter table comercial_proyectos add column if not exists etiquetas text[] not null default '{}';
alter table comercial_tareas    add column if not exists etiquetas text[] not null default '{}';

-- 3. Índices GIN para filtrar por etiqueta (etiquetas && array[...])
create index if not exists idx_comercial_proyectos_etiquetas on comercial_proyectos using gin (etiquetas);
create index if not exists idx_comercial_tareas_etiquetas    on comercial_tareas    using gin (etiquetas);

-- 4. RLS: cualquier rol comercial lee y crea tags (create-on-type)
alter table comercial_tags enable row level security;

drop policy if exists "tags_comercial_select" on comercial_tags;
create policy "tags_comercial_select" on comercial_tags
  for select to authenticated using (app_es_comercial());

drop policy if exists "tags_comercial_write" on comercial_tags;
create policy "tags_comercial_write" on comercial_tags
  for all to authenticated
  using (app_es_comercial())
  with check (app_es_comercial());

-- 5. Seed de tags comunes
insert into comercial_tags (nombre, color) values
  ('Urgente',      '#ef4444'),
  ('Exportación',  '#0ea5e9'),
  ('Seguimiento',  '#f59e0b'),
  ('Cotización',   '#8b5cf6'),
  ('Marketing',    '#ec4899'),
  ('Estratégico',  '#10b981')
on conflict (nombre) do nothing;
