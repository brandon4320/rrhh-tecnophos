-- ============================================================
-- Fix RLS de archivos: la policy no contemplaba certificados de
-- EQUIPOS (agregados en migración 08) — un usuario scopeado por
-- empresa no podía adjuntar/ver archivos de equipos de medición.
-- Aplicada en prod el 2026-07-02.
-- ============================================================

drop policy if exists "archivos_rrhh_all" on archivos;
create policy "archivos_rrhh_all" on archivos for all to authenticated
  using (
    app_es_rrhh() and (
      app_ve_todas_empresas()
      or exists (
        select 1 from certificados c
          left join empleados e on e.id = c.empleado_id
          left join vehiculos v on v.id = c.vehiculo_id
          left join equipos q on q.id = c.equipo_id
        where c.id = archivos.certificado_id
          and (c.empresa_id = app_empresa_acceso()
            or e.empresa_id = app_empresa_acceso()
            or v.empresa_id = app_empresa_acceso()
            or q.empresa_id = app_empresa_acceso())
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
          left join equipos q on q.id = c.equipo_id
        where c.id = archivos.certificado_id
          and (c.empresa_id = app_empresa_acceso()
            or e.empresa_id = app_empresa_acceso()
            or v.empresa_id = app_empresa_acceso()
            or q.empresa_id = app_empresa_acceso())
      )
    )
  );
