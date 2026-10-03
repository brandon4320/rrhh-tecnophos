-- 23 · Recibos de sueldo: solo los ven quienes tienen `perfiles.ve_recibos` (pedido de
-- Brandon, 2026-10-03: ocultos para todos menos él y Mariano).
--
-- Alcance (lectura Y escritura, la RLS es la seguridad real):
--   · recibos_sueldo (comprobantes por empleado en el legajo).
--   · documentos_mensuales cuya carpeta raíz es "Recibos de sueldos" (con subcarpetas:
--     'Recibos de sueldos/Limpieza/Aguinaldo'). Se compara la raíz sin mayúsculas y por
--     prefijo 'recibo' para que una variante de nombre no se escape.
-- Los archivos en R2 se firman solo si la fila es visible (/api/archivo), así que ocultar
-- la fila oculta el archivo. `perfiles` es de solo lectura para los usuarios (migración 22):
-- nadie se puede dar el permiso a sí mismo; se otorga con el cliente admin o por SQL.

begin;

alter table public.perfiles add column if not exists ve_recibos boolean not null default false;

create or replace function public.app_ve_recibos() returns boolean
  language sql stable security definer set search_path = public as
$$ select coalesce((select ve_recibos from perfiles where id = auth.uid()), false) $$;
revoke execute on function public.app_ve_recibos() from public, anon;
grant execute on function public.app_ve_recibos() to authenticated;

-- Brandon (Administrador) y Mariano.
update public.perfiles set ve_recibos = true
  where id in ('a5b527a3-847b-4c4d-9be7-58c8533fafba', '91a13255-fee0-44d5-957a-0b617bd1b6ab');

alter policy recibos_rrhh_all on public.recibos_sueldo
  using ((select app_es_rrhh()) and (select app_ve_recibos()) and exists (select 1 from empleados e where e.id = recibos_sueldo.empleado_id
    and ((select app_ve_todas_empresas()) or e.empresa_id = (select app_empresa_acceso()))))
  with check ((select app_es_rrhh()) and (select app_ve_recibos()) and exists (select 1 from empleados e where e.id = recibos_sueldo.empleado_id
    and ((select app_ve_todas_empresas()) or e.empresa_id = (select app_empresa_acceso()))));

alter policy documentos_mensuales_rrhh_all on public.documentos_mensuales
  using ((select app_es_rrhh()) and ((select app_ve_todas_empresas()) or empresa_id = (select app_empresa_acceso()))
    and (lower(split_part(carpeta, '/', 1)) not like 'recibo%' or (select app_ve_recibos())))
  with check ((select app_es_rrhh()) and ((select app_ve_todas_empresas()) or empresa_id = (select app_empresa_acceso()))
    and (lower(split_part(carpeta, '/', 1)) not like 'recibo%' or (select app_ve_recibos())));

commit;
