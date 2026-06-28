-- ============================================================
-- EQUIPOS DE MEDICIÓN (ej: Draeger) — entidad por empresa, con
-- certificados de calibración/vencimiento igual que vehículos.
-- (El Matafuegos sigue siendo certificado de vehículo; el Draeger
--  NO es de vehículos, es equipo de medición con su propia calibración.)
-- ============================================================

-- 1. Tabla equipos
create table if not exists equipos (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,            -- identificador (ej: "Draeger Pac 8000")
  tipo text,                       -- categoría (ej: "Draeger", "Medidor de gas")
  numero_serie text,
  empresa_id uuid references empresas(id) on delete cascade,
  descripcion text,
  activo boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 2. tipos_certificado: columna aplica_equipo + tipo Calibración
alter table tipos_certificado add column if not exists aplica_equipo boolean default false;

insert into tipos_certificado (nombre, aplica_personal, aplica_empresa, aplica_vehiculo, aplica_equipo, orden)
values ('Calibración', false, false, false, true, 50)
on conflict do nothing;

update tipos_certificado set aplica_equipo = true where nombre = 'Otro';

-- 3. certificados: columna equipo_id + nuevo check_owner (4ª opción excluyente)
alter table certificados add column if not exists equipo_id uuid references equipos(id) on delete cascade;

alter table certificados drop constraint if exists check_owner;
alter table certificados add constraint check_owner check (
  (empleado_id is not null and empresa_id is null and vehiculo_id is null and equipo_id is null) or
  (empleado_id is null and empresa_id is not null and vehiculo_id is null and equipo_id is null) or
  (empleado_id is null and empresa_id is null and vehiculo_id is not null and equipo_id is null) or
  (empleado_id is null and empresa_id is null and vehiculo_id is null and equipo_id is not null)
);

create index if not exists idx_certificados_equipo on certificados(equipo_id);

-- 4. RLS equipos (espejo de vehiculos_rrhh_all)
alter table equipos enable row level security;

drop policy if exists "equipos_rrhh_all" on equipos;
create policy "equipos_rrhh_all" on equipos for all to authenticated
  using (app_es_rrhh() and app_ve_empresa(empresa_id))
  with check (app_es_rrhh() and app_ve_empresa(empresa_id));

-- 5. Actualizar policy de certificados para incluir match por equipo
drop policy if exists "certificados_rrhh_all" on certificados;
create policy "certificados_rrhh_all" on certificados for all to authenticated
  using (
    app_es_rrhh() and (
      app_ve_todas_empresas()
      or empresa_id = app_empresa_acceso()
      or exists (select 1 from empleados e where e.id = certificados.empleado_id and e.empresa_id = app_empresa_acceso())
      or exists (select 1 from vehiculos v where v.id = certificados.vehiculo_id and v.empresa_id = app_empresa_acceso())
      or exists (select 1 from equipos q where q.id = certificados.equipo_id and q.empresa_id = app_empresa_acceso())
    )
  )
  with check (
    app_es_rrhh() and (
      app_ve_todas_empresas()
      or empresa_id = app_empresa_acceso()
      or exists (select 1 from empleados e where e.id = certificados.empleado_id and e.empresa_id = app_empresa_acceso())
      or exists (select 1 from vehiculos v where v.id = certificados.vehiculo_id and v.empresa_id = app_empresa_acceso())
      or exists (select 1 from equipos q where q.id = certificados.equipo_id and q.empresa_id = app_empresa_acceso())
    )
  );
