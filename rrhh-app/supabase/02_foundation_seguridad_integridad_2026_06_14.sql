-- ============================================================
-- FUNDACIÓN: Seguridad + Integridad (2026-06-14)
-- Aplicado y verificado sobre datos reales (impersonando usuarios).
--   1) Blindaje RLS de tablas RRHH (scope por empresa + rol)
--   2) Integridad: trigger updated_at
--   3) Endurecimiento de funciones (search_path + execute)
-- ============================================================

-- ------------------------------------------------------------
-- 1) BLINDAJE RLS — tablas RRHH
--    "acceso null" = ve todas las empresas (semántica original).
--    Solo roles RRHH (admin/usuario) acceden a RRHH; limpieza/UNIPAR NO.
--    Una sola política ALL por tabla: cubre lectura Y escritura scopeadas.
-- ------------------------------------------------------------
create or replace function app_ve_todas_empresas() returns boolean
  language sql stable security definer set search_path = public as
$$ select app_empresa_acceso() is null $$;

create or replace function app_ve_empresa(eid uuid) returns boolean
  language sql stable security definer set search_path = public as
$$ select app_ve_todas_empresas() or eid = app_empresa_acceso() $$;

create or replace function app_es_rrhh() returns boolean
  language sql stable security definer set search_path = public as
$$ select app_rol() in ('admin','usuario') $$;

drop policy if exists "read_empresas" on empresas;
create policy "empresas_rrhh_select" on empresas for select to authenticated
  using ( app_es_rrhh() and app_ve_empresa(id) );

drop policy if exists "read_empleados" on empleados;
drop policy if exists "write_empleados" on empleados;
create policy "empleados_rrhh_all" on empleados for all to authenticated
  using ( app_es_rrhh() and app_ve_empresa(empresa_id) )
  with check ( app_es_rrhh() and app_ve_empresa(empresa_id) );

drop policy if exists "read_vehiculos" on vehiculos;
drop policy if exists "write_vehiculos" on vehiculos;
create policy "vehiculos_rrhh_all" on vehiculos for all to authenticated
  using ( app_es_rrhh() and app_ve_empresa(empresa_id) )
  with check ( app_es_rrhh() and app_ve_empresa(empresa_id) );

drop policy if exists "read_certificados" on certificados;
drop policy if exists "write_certificados" on certificados;
create policy "certificados_rrhh_all" on certificados for all to authenticated
  using (
    app_es_rrhh() and (
      app_ve_todas_empresas()
      or empresa_id = app_empresa_acceso()
      or exists (select 1 from empleados e where e.id = certificados.empleado_id and e.empresa_id = app_empresa_acceso())
      or exists (select 1 from vehiculos v where v.id = certificados.vehiculo_id and v.empresa_id = app_empresa_acceso())
    )
  )
  with check (
    app_es_rrhh() and (
      app_ve_todas_empresas()
      or empresa_id = app_empresa_acceso()
      or exists (select 1 from empleados e where e.id = certificados.empleado_id and e.empresa_id = app_empresa_acceso())
      or exists (select 1 from vehiculos v where v.id = certificados.vehiculo_id and v.empresa_id = app_empresa_acceso())
    )
  );

drop policy if exists "read_archivos" on archivos;
drop policy if exists "write_archivos" on archivos;
create policy "archivos_rrhh_all" on archivos for all to authenticated
  using (
    app_es_rrhh() and (
      app_ve_todas_empresas()
      or exists (
        select 1 from certificados c
        left join empleados e on e.id = c.empleado_id
        left join vehiculos v on v.id = c.vehiculo_id
        where c.id = archivos.certificado_id
          and ( c.empresa_id = app_empresa_acceso()
             or e.empresa_id = app_empresa_acceso()
             or v.empresa_id = app_empresa_acceso() )
      )
    )
  )
  with check (
    app_es_rrhh() and (
      app_ve_todas_empresas()
      or exists (
        select 1 from certificados c
        left join empleados e on e.id = c.empleado_id
        left join vehiculos v on v.id = c.vehiculo_id
        where c.id = archivos.certificado_id
          and ( c.empresa_id = app_empresa_acceso()
             or e.empresa_id = app_empresa_acceso()
             or v.empresa_id = app_empresa_acceso() )
      )
    )
  );

-- sectores estaba con RLS DESACTIVADO
alter table sectores enable row level security;
drop policy if exists "sectores_rrhh_all" on sectores;
create policy "sectores_rrhh_all" on sectores for all to authenticated
  using ( app_es_rrhh() and app_ve_empresa(empresa_id) )
  with check ( app_es_rrhh() and app_ve_empresa(empresa_id) );

drop policy if exists "em_select" on empresa_modulos;
create policy "em_select" on empresa_modulos for select to authenticated
  using ( app_es_rrhh() and app_ve_empresa(empresa_id) );

-- ------------------------------------------------------------
-- 2) INTEGRIDAD — updated_at automático
-- ------------------------------------------------------------
create or replace function set_updated_at() returns trigger
  language plpgsql set search_path = public as
$$ begin new.updated_at = now(); return new; end $$;

alter table vehiculos             add column if not exists updated_at timestamptz default now();
alter table limpieza_personal     add column if not exists updated_at timestamptz default now();
alter table limpieza_areas        add column if not exists updated_at timestamptz default now();
alter table limpieza_asistencia   add column if not exists updated_at timestamptz default now();
alter table limpieza_asignaciones add column if not exists updated_at timestamptz default now();
alter table limpieza_reportes     add column if not exists updated_at timestamptz default now();

do $$
declare t text;
begin
  foreach t in array array[
    'empleados','certificados','config','vehiculos',
    'limpieza_personal','limpieza_areas','limpieza_asistencia',
    'limpieza_asignaciones','limpieza_reportes'
  ]
  loop
    execute format('drop trigger if exists trg_set_updated_at on %I', t);
    execute format('create trigger trg_set_updated_at before update on %I for each row execute function set_updated_at()', t);
  end loop;
end $$;

-- ------------------------------------------------------------
-- 3) ENDURECIMIENTO — funciones helper no llamables por API anónima
--    (RLS las usa internamente como authenticated)
-- ------------------------------------------------------------
revoke execute on function app_rol()               from public;
revoke execute on function app_empresa_acceso()    from public;
revoke execute on function app_es_super_admin()    from public;
revoke execute on function app_ve_todas_empresas() from public;
revoke execute on function app_ve_empresa(uuid)    from public;
revoke execute on function app_es_rrhh()           from public;

grant execute on function app_rol()               to authenticated;
grant execute on function app_empresa_acceso()    to authenticated;
grant execute on function app_es_super_admin()    to authenticated;
grant execute on function app_ve_todas_empresas() to authenticated;
grant execute on function app_ve_empresa(uuid)    to authenticated;
grant execute on function app_es_rrhh()           to authenticated;
