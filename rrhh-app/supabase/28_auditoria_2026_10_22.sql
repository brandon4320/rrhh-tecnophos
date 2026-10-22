-- Historial de cambios (auditoría) — 22/10/2026, pedido de Brandon: "quién cargó o cambió cada cosa",
-- solo para el administrador. Lo escribe la BASE con un trigger en cada tabla de Gestión de Recursos,
-- así queda TODO registrado venga de donde venga (pantallas, server actions, API, formulario QR).
--
-- Reglas:
-- - El trigger nunca frena el guardado: si algo del historial falla, avisa (warning) y sigue.
-- - Solo lee el super admin (rol admin sin empresa_acceso, como Brandon). Nadie escribe a mano:
--   no hay políticas de escritura y se revocan los permisos; el trigger es SECURITY DEFINER.
-- - Un cambio guarda solo los campos que cambiaron ({campo: [antes, después]}); un alta, la fila
--   nueva; una baja, la fila borrada (así se puede ver qué se perdió).
-- - Sin secretos: el token del QR de las camionetas no se guarda nunca. `updated_at` tampoco (ruido).
-- - `etiqueta` congela un nombre legible (empleado, patente, certificado · titular…) al momento del
--   cambio: sirve aunque después se borre el registro. `ref` guarda los ids para armar el link.
-- - Afuera: ARCOR (miles de eventos automáticos), el módulo comercial viejo, limpieza (sistema
--   aparte) e integraciones (tienen claves).

create table if not exists public.auditoria (
  id bigint generated always as identity primary key,
  ocurrido_en timestamptz not null default now(),
  usuario_id uuid,
  usuario_nombre text,
  tabla text not null,
  registro_id text,
  empresa_id uuid,
  accion text not null check (accion in ('alta', 'cambio', 'baja')),
  etiqueta text,
  ref jsonb,
  cambios jsonb,
  datos jsonb
);

create index if not exists auditoria_ocurrido_idx on public.auditoria (ocurrido_en desc);
create index if not exists auditoria_registro_idx on public.auditoria (tabla, registro_id, ocurrido_en desc);
create index if not exists auditoria_usuario_idx on public.auditoria (usuario_id, ocurrido_en desc);

alter table public.auditoria enable row level security;

drop policy if exists auditoria_super_admin_lee on public.auditoria;
create policy auditoria_super_admin_lee on public.auditoria
  for select to authenticated
  using ((select app_es_super_admin()));

revoke insert, update, delete, truncate on public.auditoria from anon, authenticated;

create or replace function public.app_auditar()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_ocultos text[] := array['updated_at', 'checklist_token'];
  v_old jsonb;
  v_new jsonb;
  v_fila jsonb;
  v_cambios jsonb := '{}'::jsonb;
  v_etiqueta text;
  v_nombre text;
  v_ref jsonb;
  k text;
begin
  begin
    if tg_op in ('UPDATE', 'DELETE') then v_old := to_jsonb(old) - v_ocultos; end if;
    if tg_op in ('UPDATE', 'INSERT') then v_new := to_jsonb(new) - v_ocultos; end if;
    v_fila := coalesce(v_new, v_old);

    if tg_op = 'UPDATE' then
      for k in select jsonb_object_keys(v_new) loop
        if (v_old -> k) is distinct from (v_new -> k) then
          v_cambios := v_cambios || jsonb_build_object(k, jsonb_build_array(v_old -> k, v_new -> k));
        end if;
      end loop;
      -- Un update que no cambió nada (o solo updated_at / el token) no ensucia el historial.
      if v_cambios = '{}'::jsonb then return null; end if;
    end if;

    -- Nombre legible del registro, congelado al momento del cambio.
    v_etiqueta := case tg_table_name
      when 'empleados' then nullif(trim(concat_ws(' ', v_fila ->> 'nombre', v_fila ->> 'apellido')), '')
      when 'vehiculos' then v_fila ->> 'patente'
      when 'documentos_mensuales' then concat_ws(' · ', v_fila ->> 'carpeta', v_fila ->> 'nombre_archivo')
      when 'archivos' then v_fila ->> 'nombre'
      when 'config' then v_fila ->> 'clave'
      else v_fila ->> 'nombre'
    end;

    if tg_table_name = 'certificados' then
      select concat_ws(' · ',
        coalesce(t.nombre, v_fila ->> 'tipo_nombre_custom', 'Certificado'),
        coalesce(
          (select nullif(trim(concat_ws(' ', e.nombre, e.apellido)), '') from empleados e where e.id = (v_fila ->> 'empleado_id')::uuid),
          (select v.patente from vehiculos v where v.id = (v_fila ->> 'vehiculo_id')::uuid),
          (select q.nombre from equipos q where q.id = (v_fila ->> 'equipo_id')::uuid),
          (select m.nombre from empresas m where m.id = (v_fila ->> 'empresa_id')::uuid)))
      into v_etiqueta
      from (select 1) x
      left join tipos_certificado t on t.id = (v_fila ->> 'tipo_id')::uuid;
    elsif tg_table_name in ('vehiculo_checklists', 'vehiculo_novedades', 'vehiculo_services', 'vehiculo_mantenimiento_plan', 'flota_avisos') then
      select concat_ws(' · ', v.patente, coalesce(v_fila ->> 'titulo', v_fila ->> 'tipo', v_fila ->> 'resultado'))
      into v_etiqueta from vehiculos v where v.id = (v_fila ->> 'vehiculo_id')::uuid;
    elsif tg_table_name = 'stock_movimientos' then
      select concat_ws(' · ', i.nombre, v_fila ->> 'tipo', v_fila ->> 'cantidad')
      into v_etiqueta from stock_items i where i.id = (v_fila ->> 'item_id')::uuid;
    elsif tg_table_name = 'recibos_sueldo' then
      select concat_ws(' · ', nullif(trim(concat_ws(' ', e.nombre, e.apellido)), ''), v_fila ->> 'periodo')
      into v_etiqueta from empleados e where e.id = (v_fila ->> 'empleado_id')::uuid;
    elsif tg_table_name = 'archivos' then
      select concat_ws(' · ', v_fila ->> 'nombre', coalesce(t.nombre, c.tipo_nombre_custom))
      into v_etiqueta
      from certificados c left join tipos_certificado t on t.id = c.tipo_id
      where c.id = (v_fila ->> 'certificado_id')::uuid;
      v_etiqueta := coalesce(v_etiqueta, v_fila ->> 'nombre');
    end if;

    -- Los ids para armar el link a la ficha (legajo, vehículo, certificado…).
    select coalesce(jsonb_object_agg(key, value), '{}'::jsonb) into v_ref
    from jsonb_each(v_fila)
    where key in ('empleado_id', 'vehiculo_id', 'equipo_id', 'certificado_id', 'item_id')
      and value <> 'null'::jsonb;

    if v_uid is not null then
      select p.nombre into v_nombre from perfiles p where p.id = v_uid;
    end if;

    insert into auditoria (usuario_id, usuario_nombre, tabla, registro_id, empresa_id, accion, etiqueta, ref, cambios, datos)
    values (
      v_uid,
      v_nombre,
      tg_table_name,
      coalesce(v_fila ->> 'id', v_fila ->> 'clave'),
      case when v_fila ? 'empresa_id' then (v_fila ->> 'empresa_id')::uuid end,
      case tg_op when 'INSERT' then 'alta' when 'UPDATE' then 'cambio' else 'baja' end,
      v_etiqueta,
      nullif(v_ref, '{}'::jsonb),
      case when tg_op = 'UPDATE' then v_cambios end,
      case when tg_op = 'UPDATE' then null else v_fila end
    );
  exception when others then
    -- El historial nunca frena el guardado.
    raise warning 'auditoria (%): %', tg_table_name, sqlerrm;
  end;
  return null;
end;
$$;

revoke execute on function public.app_auditar() from public, anon, authenticated;

do $$
declare
  t text;
begin
  foreach t in array array[
    'empleados', 'certificados', 'archivos', 'tipos_certificado', 'empresas', 'perfiles', 'sectores',
    'activo_secciones', 'config', 'documentos_mensuales', 'recibos_sueldo',
    'vehiculos', 'vehiculo_checklists', 'vehiculo_novedades', 'vehiculo_services',
    'vehiculo_mantenimiento_plan', 'flota_encargados', 'flota_avisos', 'equipos',
    'stock_items', 'stock_movimientos'
  ] loop
    execute format('drop trigger if exists trg_auditoria on public.%I', t);
    execute format('create trigger trg_auditoria after insert or update or delete on public.%I for each row execute function public.app_auditar()', t);
  end loop;
end $$;
