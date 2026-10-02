-- ============================================================
-- 20 — Flota: checklist quincenal por QR, kilómetros, novedades y
-- mantenimiento (02/10/2026).
--
-- Cada camioneta lleva un QR impreso que abre un formulario en el celular,
-- SIN login (lo completa quien la maneja). El formulario pide fotos (4 lados,
-- 4 cubiertas, tablero), el kilometraje y una revisión de ítems. Con eso:
--   · los km alimentan la proyección del próximo service,
--   · cada ítem "No OK" se convierte en una novedad a resolver,
--   · un cron diario avisa por WhatsApp a los encargados qué está vencido.
--
-- El formulario público NO escribe con permisos de usuario: lo hacen route
-- handlers con service role, después de validar el token del QR. Por eso
-- ninguna tabla tiene policies para anon.
--
-- Fotos en R2 bajo el prefijo `flota/<vehiculo_id>/…`: `flota` pasa a ser
-- slug de empresa reservado (igual que recibos/documentos, ver /api/archivo).
--
-- Se puede correr más de una vez.
-- ============================================================

-- ------------------------------------------------------------
-- 0. Slug reservado
-- ------------------------------------------------------------
alter table public.empresas drop constraint if exists empresas_slug_formato;
alter table public.empresas add constraint empresas_slug_formato
  check (slug ~ '^[a-z0-9][a-z0-9-]*$'
         and slug <> all (array['recibos', 'documentos', 'docs', 'flota']));

-- ------------------------------------------------------------
-- 1. Datos de flota en el vehículo
-- ------------------------------------------------------------
alter table public.vehiculos
  add column if not exists marca text,
  add column if not exists modelo text,
  add column if not exists anio int,
  add column if not exists km_actual int,
  add column if not exists km_actualizado_at timestamptz,
  add column if not exists conductor_id uuid references public.empleados(id) on delete set null,
  add column if not exists checklist_token text,
  add column if not exists checklist_activo boolean not null default true,
  add column if not exists checklist_cada_dias int not null default 15;

alter table public.vehiculos drop constraint if exists vehiculos_anio_check;
alter table public.vehiculos add constraint vehiculos_anio_check
  check (anio is null or anio between 1980 and 2100);
alter table public.vehiculos drop constraint if exists vehiculos_km_actual_check;
alter table public.vehiculos add constraint vehiculos_km_actual_check
  check (km_actual is null or km_actual >= 0);
alter table public.vehiculos drop constraint if exists vehiculos_checklist_cada_dias_check;
alter table public.vehiculos add constraint vehiculos_checklist_cada_dias_check
  check (checklist_cada_dias between 1 and 90);

-- Token del QR: ~90 bits de azar (gen_random_uuid usa el generador seguro).
-- Si un QR se filtra, se rota desde Gestión y se reimprime.
update public.vehiculos
   set checklist_token = substr(replace(gen_random_uuid()::text, '-', ''), 1, 24)
 where checklist_token is null;
alter table public.vehiculos
  alter column checklist_token set default substr(replace(gen_random_uuid()::text, '-', ''), 1, 24);
alter table public.vehiculos alter column checklist_token set not null;
create unique index if not exists uq_vehiculos_checklist_token on public.vehiculos (checklist_token);

-- Para las FK compuestas: la empresa denormalizada de cada fila hija tiene
-- que ser la del vehículo (mismo criterio que stock, migración 18).
create unique index if not exists uq_vehiculos_id_empresa on public.vehiculos (id, empresa_id);

-- ------------------------------------------------------------
-- 2. Checklists
-- ------------------------------------------------------------
create table if not exists public.vehiculo_checklists (
  id uuid primary key default gen_random_uuid(),
  vehiculo_id uuid not null,
  empresa_id uuid not null,
  realizado_por uuid references public.empleados(id) on delete set null,
  -- Congelado: si el empleado se da de baja, el checklist sigue diciendo quién lo hizo.
  realizado_por_nombre text not null,
  km int check (km is null or km >= 0),
  -- El km no cuadra con el historial (menor al último, o un salto imposible):
  -- se guarda igual —no se traba a quien maneja— pero no pisa el km del vehículo.
  km_inconsistente boolean not null default false,
  resultado text not null check (resultado in ('ok', 'observaciones', 'no_apto')),
  respuestas jsonb not null default '{}'::jsonb,   -- { item_id: 'ok' | 'obs' | 'no_ok' }
  notas_items jsonb not null default '{}'::jsonb,  -- { item_id: 'texto' }
  fotos jsonb not null default '{}'::jsonb,        -- { slot: path_r2 }
  observaciones text,
  origen text not null default 'qr' check (origen in ('qr', 'gestion')),
  created_at timestamptz not null default now(),
  constraint vehiculo_checklists_vehiculo_fkey
    foreign key (vehiculo_id, empresa_id) references public.vehiculos (id, empresa_id) on delete restrict
);
create index if not exists idx_vchk_vehiculo_fecha on public.vehiculo_checklists (vehiculo_id, created_at desc);
create index if not exists idx_vchk_empresa_fecha on public.vehiculo_checklists (empresa_id, created_at desc);

-- ------------------------------------------------------------
-- 3. Novedades: lo que hay que arreglar
--    Nacen de un ítem "No OK" del checklist, de un reporte suelto por QR
--    (un golpe, una pinchadura) o se cargan desde Gestión.
-- ------------------------------------------------------------
create table if not exists public.vehiculo_novedades (
  id uuid primary key default gen_random_uuid(),
  vehiculo_id uuid not null,
  empresa_id uuid not null,
  checklist_id uuid references public.vehiculo_checklists (id) on delete set null,
  origen text not null default 'checklist' check (origen in ('checklist', 'reporte', 'gestion')),
  item text,
  titulo text not null,
  descripcion text,
  gravedad text not null default 'media' check (gravedad in ('baja', 'media', 'alta')),
  fotos jsonb not null default '[]'::jsonb,        -- [path_r2]
  reportado_por_nombre text,
  km int check (km is null or km >= 0),
  estado text not null default 'abierta' check (estado in ('abierta', 'resuelta', 'descartada')),
  resolucion text,
  costo numeric(12, 2) check (costo is null or costo >= 0),
  resuelta_at timestamptz,
  resuelta_por uuid references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint vehiculo_novedades_vehiculo_fkey
    foreign key (vehiculo_id, empresa_id) references public.vehiculos (id, empresa_id) on delete restrict
);
create index if not exists idx_vnov_vehiculo on public.vehiculo_novedades (vehiculo_id, estado);
create index if not exists idx_vnov_empresa_abiertas on public.vehiculo_novedades (empresa_id) where estado = 'abierta';

drop trigger if exists trg_vnov_updated_at on public.vehiculo_novedades;
create trigger trg_vnov_updated_at before update on public.vehiculo_novedades
  for each row execute function public.set_updated_at();

-- ------------------------------------------------------------
-- 4. Mantenimiento: plan por vehículo + historial de services
--    El próximo service se calcula en código (modules/flota/reglas.ts):
--    último service del tipo + intervalo, proyectado con los km por día
--    que salen de los checklists.
-- ------------------------------------------------------------
create table if not exists public.vehiculo_mantenimiento_plan (
  id uuid primary key default gen_random_uuid(),
  vehiculo_id uuid not null,
  empresa_id uuid not null,
  tipo text not null,
  cada_km int check (cada_km is null or cada_km > 0),
  cada_meses int check (cada_meses is null or cada_meses > 0),
  created_at timestamptz not null default now(),
  constraint vmp_intervalo check (cada_km is not null or cada_meses is not null),
  constraint vmp_unico unique (vehiculo_id, tipo),
  constraint vmp_vehiculo_fkey
    foreign key (vehiculo_id, empresa_id) references public.vehiculos (id, empresa_id) on delete cascade
);

create table if not exists public.vehiculo_services (
  id uuid primary key default gen_random_uuid(),
  vehiculo_id uuid not null,
  empresa_id uuid not null,
  tipo text not null,
  fecha date not null,
  km int check (km is null or km >= 0),
  taller text,
  costo numeric(12, 2) check (costo is null or costo >= 0),
  notas text,
  created_by uuid references auth.users (id) default auth.uid(),
  created_at timestamptz not null default now(),
  constraint vehiculo_services_vehiculo_fkey
    foreign key (vehiculo_id, empresa_id) references public.vehiculos (id, empresa_id) on delete restrict
);
create index if not exists idx_vserv_vehiculo on public.vehiculo_services (vehiculo_id, tipo, fecha desc);

-- Plan por defecto (camionetas diésel de uso intensivo): service de aceite y
-- filtros cada 10.000 km o 12 meses, rotación de cubiertas cada 10.000 km.
-- Se ajusta por vehículo desde Gestión.
insert into public.vehiculo_mantenimiento_plan (vehiculo_id, empresa_id, tipo, cada_km, cada_meses)
select v.id, v.empresa_id, p.tipo, p.cada_km, p.cada_meses
  from public.vehiculos v
 cross join (values ('service', 10000, 12), ('cubiertas', 10000, null::int)) as p (tipo, cada_km, cada_meses)
 where v.empresa_id is not null
on conflict (vehiculo_id, tipo) do nothing;

create or replace function public.vehiculo_plan_por_defecto()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.empresa_id is not null then
    insert into vehiculo_mantenimiento_plan (vehiculo_id, empresa_id, tipo, cada_km, cada_meses)
    values (new.id, new.empresa_id, 'service', 10000, 12),
           (new.id, new.empresa_id, 'cubiertas', 10000, null)
    on conflict (vehiculo_id, tipo) do nothing;
  end if;
  return new;
end;
$$;
drop trigger if exists trg_vehiculo_plan_por_defecto on public.vehiculos;
create trigger trg_vehiculo_plan_por_defecto after insert on public.vehiculos
  for each row execute function public.vehiculo_plan_por_defecto();

-- ------------------------------------------------------------
-- 5. Avisos por WhatsApp
-- ------------------------------------------------------------
create table if not exists public.flota_encargados (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas (id) on delete cascade,
  nombre text not null,
  -- Formato internacional sin "+" ni espacios: 549 + característica + número.
  telefono text not null check (telefono ~ '^[0-9]{10,15}$'),
  activo boolean not null default true,
  created_at timestamptz not null default now()
);

-- Registro de lo que se avisó (o se quiso avisar). `clave` evita mandar dos
-- veces lo mismo: el cron puede correr de nuevo sin duplicar mensajes.
create table if not exists public.flota_avisos (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas (id) on delete cascade,
  vehiculo_id uuid references public.vehiculos (id) on delete set null,
  tipo text not null,
  clave text not null unique,
  mensaje text not null,
  estado text not null default 'pendiente' check (estado in ('pendiente', 'enviado', 'sin_canal', 'error')),
  destinatarios int not null default 0,
  error text,
  created_at timestamptz not null default now()
);
create index if not exists idx_favisos_empresa on public.flota_avisos (empresa_id, created_at desc);

-- ------------------------------------------------------------
-- 6. RLS — mismo criterio que vehiculos: RRHH de la empresa.
--    flota_avisos solo se lee: la escriben el cron y las rutas del QR con
--    service role.
-- ------------------------------------------------------------
alter table public.vehiculo_checklists enable row level security;
alter table public.vehiculo_novedades enable row level security;
alter table public.vehiculo_mantenimiento_plan enable row level security;
alter table public.vehiculo_services enable row level security;
alter table public.flota_encargados enable row level security;
alter table public.flota_avisos enable row level security;

drop policy if exists vchk_rrhh_all on public.vehiculo_checklists;
create policy vchk_rrhh_all on public.vehiculo_checklists for all to authenticated
  using (app_es_rrhh() and app_ve_empresa(empresa_id))
  with check (app_es_rrhh() and app_ve_empresa(empresa_id));

drop policy if exists vnov_rrhh_all on public.vehiculo_novedades;
create policy vnov_rrhh_all on public.vehiculo_novedades for all to authenticated
  using (app_es_rrhh() and app_ve_empresa(empresa_id))
  with check (app_es_rrhh() and app_ve_empresa(empresa_id));

drop policy if exists vmp_rrhh_all on public.vehiculo_mantenimiento_plan;
create policy vmp_rrhh_all on public.vehiculo_mantenimiento_plan for all to authenticated
  using (app_es_rrhh() and app_ve_empresa(empresa_id))
  with check (app_es_rrhh() and app_ve_empresa(empresa_id));

drop policy if exists vserv_rrhh_all on public.vehiculo_services;
create policy vserv_rrhh_all on public.vehiculo_services for all to authenticated
  using (app_es_rrhh() and app_ve_empresa(empresa_id))
  with check (app_es_rrhh() and app_ve_empresa(empresa_id));

drop policy if exists fenc_rrhh_all on public.flota_encargados;
create policy fenc_rrhh_all on public.flota_encargados for all to authenticated
  using (app_es_rrhh() and app_ve_empresa(empresa_id))
  with check (app_es_rrhh() and app_ve_empresa(empresa_id));

drop policy if exists favisos_rrhh_select on public.flota_avisos;
create policy favisos_rrhh_select on public.flota_avisos for select to authenticated
  using (app_es_rrhh() and app_ve_empresa(empresa_id));
