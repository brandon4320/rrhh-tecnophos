-- Claves de IA (MCP) — 22/10/2026. Cada persona genera las suyas (menú de usuario → Conectar una IA)
-- para conectar una IA (Grok, Claude…) al MCP de Gestión de Recursos (/api/mcp). La IA trabaja COMO
-- esa persona: solo lectura y solo las empresas que esa persona ve (src/lib/mcp/gestion.ts).
-- En la base va solo el SHA-256 de la clave; la clave se muestra una única vez al crearla.
-- Cada uno ve, crea y revoca SOLO las suyas (RLS). El MCP las busca con el cliente de servicio.

create table if not exists public.claves_ia (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  nombre text not null check (char_length(nombre) between 1 and 60),
  prefijo text not null,
  hash text not null unique,
  created_at timestamptz not null default now(),
  ultimo_uso_at timestamptz,
  revocada_at timestamptz
);

create index if not exists claves_ia_user_idx on public.claves_ia (user_id);

alter table public.claves_ia enable row level security;

drop policy if exists claves_ia_propias_lee on public.claves_ia;
create policy claves_ia_propias_lee on public.claves_ia
  for select to authenticated using (user_id = (select auth.uid()));

drop policy if exists claves_ia_propias_crea on public.claves_ia;
create policy claves_ia_propias_crea on public.claves_ia
  for insert to authenticated with check (user_id = (select auth.uid()) and (select app_es_rrhh()));

drop policy if exists claves_ia_propias_revoca on public.claves_ia;
create policy claves_ia_propias_revoca on public.claves_ia
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

revoke delete, truncate on public.claves_ia from anon, authenticated;
