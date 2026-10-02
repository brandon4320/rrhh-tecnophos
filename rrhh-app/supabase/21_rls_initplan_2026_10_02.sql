-- 21 · RLS: las funciones de permisos se calculan UNA vez por consulta, no por fila.
--
-- Antes: `app_es_rrhh() AND app_ve_empresa(empresa_id)`. Son SECURITY DEFINER, Postgres no
-- las puede inlinear y las evaluaba fila por fila (cada una consulta `perfiles`): 1,9 M de
-- idx_scan sobre una tabla de 6 filas, certificados a 130-360 ms.
-- Ahora: cada función sin argumentos va envuelta en `(select …)` (initplan, se evalúa una
-- vez) y `app_ve_empresa(x)` se reemplaza por su cuerpo literal:
--   app_ve_todas_empresas() or x = app_empresa_acceso()
-- La lógica es idéntica (mismas funciones, misma semántica de NULL, using = with check como
-- estaba). Verificado: mismas filas visibles para admin, usuario de todas las empresas,
-- usuario de una sola sede y usuario sin perfil.
--
-- REGLA para policies nuevas: escribirlas con este patrón, no con app_ve_empresa(empresa_id).

begin;

alter policy secciones_rrhh_all on public.activo_secciones
  using ((select app_es_rrhh()) and ((select app_ve_todas_empresas()) or empresa_id = (select app_empresa_acceso())))
  with check ((select app_es_rrhh()) and ((select app_ve_todas_empresas()) or empresa_id = (select app_empresa_acceso())));

alter policy documentos_mensuales_rrhh_all on public.documentos_mensuales
  using ((select app_es_rrhh()) and ((select app_ve_todas_empresas()) or empresa_id = (select app_empresa_acceso())))
  with check ((select app_es_rrhh()) and ((select app_ve_todas_empresas()) or empresa_id = (select app_empresa_acceso())));

alter policy empleados_rrhh_all on public.empleados
  using ((select app_es_rrhh()) and ((select app_ve_todas_empresas()) or empresa_id = (select app_empresa_acceso())))
  with check ((select app_es_rrhh()) and ((select app_ve_todas_empresas()) or empresa_id = (select app_empresa_acceso())));

alter policy equipos_rrhh_all on public.equipos
  using ((select app_es_rrhh()) and ((select app_ve_todas_empresas()) or empresa_id = (select app_empresa_acceso())))
  with check ((select app_es_rrhh()) and ((select app_ve_todas_empresas()) or empresa_id = (select app_empresa_acceso())));

alter policy fenc_rrhh_all on public.flota_encargados
  using ((select app_es_rrhh()) and ((select app_ve_todas_empresas()) or empresa_id = (select app_empresa_acceso())))
  with check ((select app_es_rrhh()) and ((select app_ve_todas_empresas()) or empresa_id = (select app_empresa_acceso())));

alter policy sectores_rrhh_all on public.sectores
  using ((select app_es_rrhh()) and ((select app_ve_todas_empresas()) or empresa_id = (select app_empresa_acceso())))
  with check ((select app_es_rrhh()) and ((select app_ve_todas_empresas()) or empresa_id = (select app_empresa_acceso())));

alter policy stock_items_rrhh_all on public.stock_items
  using ((select app_es_rrhh()) and ((select app_ve_todas_empresas()) or empresa_id = (select app_empresa_acceso())))
  with check ((select app_es_rrhh()) and ((select app_ve_todas_empresas()) or empresa_id = (select app_empresa_acceso())));

alter policy stock_movimientos_rrhh_all on public.stock_movimientos
  using ((select app_es_rrhh()) and ((select app_ve_todas_empresas()) or empresa_id = (select app_empresa_acceso())))
  with check ((select app_es_rrhh()) and ((select app_ve_todas_empresas()) or empresa_id = (select app_empresa_acceso())));

alter policy vchk_rrhh_all on public.vehiculo_checklists
  using ((select app_es_rrhh()) and ((select app_ve_todas_empresas()) or empresa_id = (select app_empresa_acceso())))
  with check ((select app_es_rrhh()) and ((select app_ve_todas_empresas()) or empresa_id = (select app_empresa_acceso())));

alter policy vmp_rrhh_all on public.vehiculo_mantenimiento_plan
  using ((select app_es_rrhh()) and ((select app_ve_todas_empresas()) or empresa_id = (select app_empresa_acceso())))
  with check ((select app_es_rrhh()) and ((select app_ve_todas_empresas()) or empresa_id = (select app_empresa_acceso())));

alter policy vnov_rrhh_all on public.vehiculo_novedades
  using ((select app_es_rrhh()) and ((select app_ve_todas_empresas()) or empresa_id = (select app_empresa_acceso())))
  with check ((select app_es_rrhh()) and ((select app_ve_todas_empresas()) or empresa_id = (select app_empresa_acceso())));

alter policy vserv_rrhh_all on public.vehiculo_services
  using ((select app_es_rrhh()) and ((select app_ve_todas_empresas()) or empresa_id = (select app_empresa_acceso())))
  with check ((select app_es_rrhh()) and ((select app_ve_todas_empresas()) or empresa_id = (select app_empresa_acceso())));

alter policy vehiculos_rrhh_all on public.vehiculos
  using ((select app_es_rrhh()) and ((select app_ve_todas_empresas()) or empresa_id = (select app_empresa_acceso())))
  with check ((select app_es_rrhh()) and ((select app_ve_todas_empresas()) or empresa_id = (select app_empresa_acceso())));

alter policy certificados_rrhh_all on public.certificados
  using ((select app_es_rrhh()) and ((select app_ve_todas_empresas()) or empresa_id = (select app_empresa_acceso())
    or exists (select 1 from empleados e where e.id = certificados.empleado_id and e.empresa_id = (select app_empresa_acceso()))
    or exists (select 1 from vehiculos v where v.id = certificados.vehiculo_id and v.empresa_id = (select app_empresa_acceso()))
    or exists (select 1 from equipos q where q.id = certificados.equipo_id and q.empresa_id = (select app_empresa_acceso()))))
  with check ((select app_es_rrhh()) and ((select app_ve_todas_empresas()) or empresa_id = (select app_empresa_acceso())
    or exists (select 1 from empleados e where e.id = certificados.empleado_id and e.empresa_id = (select app_empresa_acceso()))
    or exists (select 1 from vehiculos v where v.id = certificados.vehiculo_id and v.empresa_id = (select app_empresa_acceso()))
    or exists (select 1 from equipos q where q.id = certificados.equipo_id and q.empresa_id = (select app_empresa_acceso()))));

alter policy archivos_rrhh_all on public.archivos
  using ((select app_es_rrhh()) and ((select app_ve_todas_empresas()) or exists (
    select 1 from certificados c
      left join empleados e on e.id = c.empleado_id
      left join vehiculos v on v.id = c.vehiculo_id
      left join equipos q on q.id = c.equipo_id
    where c.id = archivos.certificado_id
      and (c.empresa_id = (select app_empresa_acceso()) or e.empresa_id = (select app_empresa_acceso()) or v.empresa_id = (select app_empresa_acceso()) or q.empresa_id = (select app_empresa_acceso())))))
  with check ((select app_es_rrhh()) and ((select app_ve_todas_empresas()) or exists (
    select 1 from certificados c
      left join empleados e on e.id = c.empleado_id
      left join vehiculos v on v.id = c.vehiculo_id
      left join equipos q on q.id = c.equipo_id
    where c.id = archivos.certificado_id
      and (c.empresa_id = (select app_empresa_acceso()) or e.empresa_id = (select app_empresa_acceso()) or v.empresa_id = (select app_empresa_acceso()) or q.empresa_id = (select app_empresa_acceso())))));

alter policy recibos_rrhh_all on public.recibos_sueldo
  using ((select app_es_rrhh()) and exists (select 1 from empleados e where e.id = recibos_sueldo.empleado_id
    and ((select app_ve_todas_empresas()) or e.empresa_id = (select app_empresa_acceso()))))
  with check ((select app_es_rrhh()) and exists (select 1 from empleados e where e.id = recibos_sueldo.empleado_id
    and ((select app_ve_todas_empresas()) or e.empresa_id = (select app_empresa_acceso()))));

alter policy favisos_rrhh_select on public.flota_avisos using ((select app_es_rrhh()) and ((select app_ve_todas_empresas()) or empresa_id = (select app_empresa_acceso())));
alter policy em_select on public.empresa_modulos using ((select app_es_rrhh()) and ((select app_ve_todas_empresas()) or empresa_id = (select app_empresa_acceso())));
alter policy em_write on public.empresa_modulos
  using ((select app_es_super_admin())) with check ((select app_es_super_admin()));
alter policy empresas_rrhh_select on public.empresas
  using ((select app_es_rrhh()) and ((select app_ve_todas_empresas()) or id = (select app_empresa_acceso())));
alter policy arcor_contenedores_select on public.arcor_contenedores using ((select app_es_rrhh()) and (select app_ve_todas_empresas()));
alter policy arcor_estado_select on public.arcor_estado using ((select app_es_rrhh()) and (select app_ve_todas_empresas()));
alter policy arcor_eventos_select on public.arcor_eventos using ((select app_es_rrhh()) and (select app_ve_todas_empresas()));
alter policy read_perfiles on public.perfiles using (id = (select auth.uid()));
alter policy config_write on public.config
  using (exists (select 1 from perfiles where perfiles.id = (select auth.uid()) and perfiles.rol = 'admin'));

alter function public.set_updated_at() set search_path = '';

commit;

-- Tablas chicas que nunca se analizaron (el planner las estimaba mal).
analyze public.empresas, public.perfiles, public.equipos, public.tipos_certificado,
        public.recibos_sueldo, public.empleados, public.certificados, public.archivos;
