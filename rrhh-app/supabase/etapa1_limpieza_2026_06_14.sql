-- ============================================================
-- Plataforma de Gestión — Foundation modular + Módulo LIMPIEZA (Etapa 1)
-- ADC S.R.L. · Servicio de limpieza UNIPAR — Bahía Blanca
--
-- DISEÑO: un solo sistema/login con módulos, pero RRHH y Limpieza son
-- contextos INDEPENDIENTES. El módulo Limpieza NO referencia las tablas
-- de RRHH (empleados/empresas): tiene su propio personal y sus propios datos.
--
-- Cubre:
--   · Foundation: roles ampliados, módulos por empresa (RRHH), helpers RLS
--   · Módulo 01 — Asistencia diaria        (limpieza_asistencia)
--   · Módulo 02 — Asignación de tareas      (limpieza_asignaciones + limpieza_areas)
--   · Módulo 03 — Reporte diario a UNIPAR   (limpieza_reportes)
--   · Personal del servicio                 (limpieza_personal)
--   · Seed: roster 13+1 y áreas del pliego
--
-- RLS del módulo Limpieza: por ROL (no por empresa de RRHH).
--   internos: admin (super), admin_adc, supervisor, operario
--   externo : admin_unipar -> solo LEE reportes y áreas
-- Idempotente.
-- ============================================================


-- ------------------------------------------------------------
-- 0. FOUNDATION (la app pasa a ser plataforma modular)
-- ------------------------------------------------------------

-- 0.1 Roles ampliados
alter table perfiles drop constraint if exists perfiles_rol_check;
alter table perfiles add constraint perfiles_rol_check
  check (rol in ('admin','usuario','admin_adc','supervisor','operario','admin_unipar'));

-- 0.2 Módulos habilitados por empresa (lado RRHH / multi-empresa)
create table if not exists empresa_modulos (
  empresa_id uuid not null references empresas(id) on delete cascade,
  modulo     text not null check (modulo in ('rrhh','limpieza','mantenimiento')),
  habilitado boolean default true,
  primary key (empresa_id, modulo)
);
insert into empresa_modulos (empresa_id, modulo)
  select id, 'rrhh' from empresas where slug like 'tecnophos-%'
on conflict do nothing;

-- 0.3 Helpers RLS (security definer: leen perfiles sin recursión)
create or replace function app_empresa_acceso() returns uuid
  language sql stable security definer set search_path = public as
$$ select empresa_acceso from perfiles where id = auth.uid() $$;

create or replace function app_rol() returns text
  language sql stable security definer set search_path = public as
$$ select rol from perfiles where id = auth.uid() $$;

create or replace function app_es_super_admin() returns boolean
  language sql stable security definer set search_path = public as
$$ select exists (
     select 1 from perfiles
     where id = auth.uid() and rol = 'admin' and empresa_acceso is null
   ) $$;

-- (para el futuro blindaje de RLS de las tablas RRHH)
create or replace function app_ve_empresa(eid uuid) returns boolean
  language sql stable security definer set search_path = public as
$$ select app_es_super_admin() or eid = app_empresa_acceso() $$;


-- ============================================================
-- MÓDULO LIMPIEZA — contexto independiente (tablas limpieza_*)
-- ============================================================

-- Personal propio del servicio (NO es la tabla empleados de RRHH)
create table if not exists limpieza_personal (
  id        uuid primary key default gen_random_uuid(),
  nombre    text not null,
  apellido  text,
  funcion   text check (funcion in ('tipo1','tipo2','tipo3','supervisor','reemplazo')),
  telefono  text,
  activo    boolean default true,
  created_at timestamptz default now()
);

-- Áreas del servicio (Módulo 02)
create table if not exists limpieza_areas (
  id        uuid primary key default gen_random_uuid(),
  nombre    text not null,
  tipo      text not null check (tipo in ('tipo1','tipo2','tipo3','taller_anodos','u15','supervision')),
  frecuencia text,
  prioridad text not null default 'media' check (prioridad in ('critica','alta','media','baja')),
  activo    boolean default true,
  created_at timestamptz default now()
);

-- Módulo 01 — Asistencia diaria
create table if not exists limpieza_asistencia (
  id             uuid primary key default gen_random_uuid(),
  personal_id    uuid not null references limpieza_personal(id) on delete cascade,
  fecha          date not null,
  estado         text not null default 'presente'
                   check (estado in ('presente','ausente','tarde','reemplazo','no_trabaja')),
  cubre_a        uuid references limpieza_personal(id),
  horas_extra    numeric(4,1) default 0,
  observaciones  text,
  confirmado_por uuid references auth.users(id),
  confirmado_at  timestamptz,
  created_at     timestamptz default now(),
  created_by     uuid references auth.users(id),
  unique (personal_id, fecha)
);
create index if not exists idx_limp_asist_fecha on limpieza_asistencia(fecha);

-- Módulo 02 — Asignación de tareas por área
create table if not exists limpieza_asignaciones (
  id          uuid primary key default gen_random_uuid(),
  fecha       date not null,
  area_id     uuid not null references limpieza_areas(id) on delete cascade,
  personal_id uuid not null references limpieza_personal(id) on delete cascade,
  estado      text not null default 'asignada'
                check (estado in ('asignada','en_progreso','completada')),
  notas       text,
  created_at  timestamptz default now(),
  created_by  uuid references auth.users(id)
);
create index if not exists idx_limp_asig_fecha on limpieza_asignaciones(fecha);

-- Módulo 03 — Reporte diario
create table if not exists limpieza_reportes (
  id                   uuid primary key default gen_random_uuid(),
  fecha                date not null unique,
  turno_inicio         time,
  turno_fin            time,
  dotacion_presente    int,
  dotacion_planificada int default 13,
  tareas_resumen       jsonb,
  incidencias          text,
  estado_consumibles   text,
  observaciones        text,
  firmado_por          uuid references auth.users(id),
  firmado_at           timestamptz,
  created_at           timestamptz default now(),
  created_by           uuid references auth.users(id)
);


-- ------------------------------------------------------------
-- RLS — Módulo Limpieza (por ROL)
-- ------------------------------------------------------------
alter table empresa_modulos      enable row level security;
alter table limpieza_personal    enable row level security;
alter table limpieza_areas       enable row level security;
alter table limpieza_asistencia  enable row level security;
alter table limpieza_asignaciones enable row level security;
alter table limpieza_reportes    enable row level security;

create policy "em_select" on empresa_modulos for select to authenticated
  using (app_es_super_admin() or empresa_id = app_empresa_acceso());
create policy "em_write" on empresa_modulos for all to authenticated
  using (app_es_super_admin()) with check (app_es_super_admin());

-- PERSONAL: equipo interno; UNIPAR no ve
create policy "lp_select" on limpieza_personal for select to authenticated
  using (app_es_super_admin() or app_rol() in ('admin_adc','supervisor','operario'));
create policy "lp_write" on limpieza_personal for all to authenticated
  using (app_es_super_admin() or app_rol() in ('admin_adc','supervisor'))
  with check (app_es_super_admin() or app_rol() in ('admin_adc','supervisor'));

-- AREAS: internos + UNIPAR leen; internos escriben
create policy "la_select" on limpieza_areas for select to authenticated
  using (app_es_super_admin() or app_rol() in ('admin_adc','supervisor','operario','admin_unipar'));
create policy "la_write" on limpieza_areas for all to authenticated
  using (app_es_super_admin() or app_rol() in ('admin_adc','supervisor'))
  with check (app_es_super_admin() or app_rol() in ('admin_adc','supervisor'));

-- ASISTENCIA: interno; UNIPAR no ve
create policy "lasist_select" on limpieza_asistencia for select to authenticated
  using (app_es_super_admin() or app_rol() in ('admin_adc','supervisor','operario'));
create policy "lasist_write" on limpieza_asistencia for all to authenticated
  using (app_es_super_admin() or app_rol() in ('admin_adc','supervisor'))
  with check (app_es_super_admin() or app_rol() in ('admin_adc','supervisor'));

-- ASIGNACIONES: interno; UNIPAR no ve
create policy "lasig_select" on limpieza_asignaciones for select to authenticated
  using (app_es_super_admin() or app_rol() in ('admin_adc','supervisor','operario'));
create policy "lasig_write" on limpieza_asignaciones for all to authenticated
  using (app_es_super_admin() or app_rol() in ('admin_adc','supervisor'))
  with check (app_es_super_admin() or app_rol() in ('admin_adc','supervisor'));

-- REPORTES: internos escriben; UNIPAR + internos leen
create policy "lrep_select" on limpieza_reportes for select to authenticated
  using (app_es_super_admin() or app_rol() in ('admin_adc','supervisor','operario','admin_unipar'));
create policy "lrep_write" on limpieza_reportes for all to authenticated
  using (app_es_super_admin() or app_rol() in ('admin_adc','supervisor'))
  with check (app_es_super_admin() or app_rol() in ('admin_adc','supervisor'));


-- ------------------------------------------------------------
-- SEED — servicio de limpieza (roster 13+1, editable desde la UI)
-- ------------------------------------------------------------
insert into limpieza_personal (nombre, apellido, funcion)
select v.nombre, v.apellido, v.funcion
from (values
  ('Juan','García','tipo1'),('María','Pérez','tipo2'),('Carlos','López','tipo3'),
  ('Ana','Romero','tipo1'),('Diego','Sosa','tipo2'),('Laura','Díaz','reemplazo'),
  ('Pedro','Martínez','tipo1'),('Lucía','Fernández','tipo2'),('Roberto','Gómez','tipo3'),
  ('Carolina','Álvarez','tipo1'),('Marcos','Ruiz','tipo2'),('Silvia','Torres','tipo3'),
  ('Nicolás','Herrera','tipo3'),('Supervisor','López','supervisor')
) as v(nombre, apellido, funcion)
where not exists (
  select 1 from limpieza_personal p
  where p.nombre = v.nombre and p.apellido = v.apellido
);

insert into limpieza_areas (nombre, tipo, frecuencia, prioridad)
select v.nombre, v.tipo, v.frecuencia, v.prioridad
from (values
  ('Administrativos (oficinas, baños, vestuarios)','tipo1','Diaria','alta'),
  ('Industrial (CCM, pasarelas, canaletas)','tipo2','Según Anexo 1','alta'),
  ('Veredas y playas (calles, estacionamientos)','tipo3','Según Anexo 1','media'),
  ('Taller de Ánodos UE','taller_anodos','2 repasos/día hasta 15:00','critica'),
  ('U-15 Puerto Galván','u15','Lun a Vie, diaria','alta'),
  ('Supervisión','supervision','Diaria','media')
) as v(nombre, tipo, frecuencia, prioridad)
where not exists (
  select 1 from limpieza_areas a where a.nombre = v.nombre
);
