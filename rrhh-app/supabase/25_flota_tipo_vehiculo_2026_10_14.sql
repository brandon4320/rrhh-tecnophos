-- 25 · Flota: tipo de vehículo, para que el checklist se adapte a lo que es cada uno.
--
-- La flota real (14/10/2026) tiene pickups (Amarok, Ranger, Strada), utilitarios
-- (Partner, Berlingo, Kangoo), furgones (Jumper, Ducato) y un trailer. Un trailer no
-- tiene km, tablero ni motor; un furgón no tiene "caja" sino compartimento de carga.
-- El contenido del checklist por tipo vive en código (modules/flota/reglas.ts:
-- seccionesPara / fotosPara); acá solo se guarda qué es cada vehículo.
--
-- · vehiculos.tipo: pickup | utilitario | furgon | trailer. NULL = se deduce del modelo
--   en la app (inferirTipo). Se rellena con lo que ya está cargado.
-- · Plan de mantenimiento según el tipo: un trailer no lleva service por km ni rotación;
--   lleva una revisión cada 12 meses (rulemanes, frenos, enganche). El trigger de alta
--   y uno nuevo al cambiar el tipo lo mantienen (solo toca los planes por defecto si el
--   vehículo no tiene services cargados del tipo que se saca).
-- · No toca checklist_token: los QR impresos siguen valiendo.

begin;

alter table public.vehiculos add column if not exists tipo text
  check (tipo is null or tipo in ('pickup', 'utilitario', 'furgon', 'trailer'));
comment on column public.vehiculos.tipo is
  'pickup | utilitario | furgon | trailer. Define qué se revisa en el checklist (ver modules/flota/reglas.ts).';

update public.vehiculos set tipo = case
    when coalesce(marca, '') || ' ' || coalesce(modelo, '') ~* '(trailer|acoplado|semirremolque)' or patente ~* '^101[A-Z]' then 'trailer'
    when coalesce(modelo, '') ~* '(jumper|ducato|sprinter|master|boxer|daily|transit|trafic)' then 'furgon'
    when coalesce(modelo, '') ~* '(partner|berlingo|kangoo|fiorino|doblo|caddy|expert|rifter)' then 'utilitario'
    when coalesce(modelo, '') ~* '(amarok|ranger|strada|hilux|s10|toro|saveiro|frontier|oroch|montana|maverick|alaskan)' then 'pickup'
    else null
  end
 where tipo is null;

-- Plan por defecto según el tipo.
create or replace function public.vehiculo_plan_por_defecto()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.empresa_id is null then return new; end if;
  if new.tipo = 'trailer' then
    insert into vehiculo_mantenimiento_plan (vehiculo_id, empresa_id, tipo, cada_km, cada_meses)
    values (new.id, new.empresa_id, 'revision_trailer', null, 12)
    on conflict (vehiculo_id, tipo) do nothing;
  else
    insert into vehiculo_mantenimiento_plan (vehiculo_id, empresa_id, tipo, cada_km, cada_meses)
    values (new.id, new.empresa_id, 'service', 10000, 12),
           (new.id, new.empresa_id, 'cubiertas', 10000, null)
    on conflict (vehiculo_id, tipo) do nothing;
  end if;
  return new;
end;
$$;

-- Al cambiar a trailer (o volver a vehículo con motor), se cambian los planes por
-- defecto. Un plan con services ya cargados no se borra: se conserva el historial.
create or replace function public.vehiculo_plan_por_tipo()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.empresa_id is null or new.tipo is not distinct from old.tipo then return new; end if;
  if new.tipo = 'trailer' then
    delete from vehiculo_mantenimiento_plan p
     where p.vehiculo_id = new.id and p.tipo in ('service', 'cubiertas')
       and not exists (select 1 from vehiculo_services s where s.vehiculo_id = new.id and s.tipo = p.tipo);
    insert into vehiculo_mantenimiento_plan (vehiculo_id, empresa_id, tipo, cada_km, cada_meses)
    values (new.id, new.empresa_id, 'revision_trailer', null, 12)
    on conflict (vehiculo_id, tipo) do nothing;
  elsif old.tipo = 'trailer' then
    delete from vehiculo_mantenimiento_plan p
     where p.vehiculo_id = new.id and p.tipo = 'revision_trailer'
       and not exists (select 1 from vehiculo_services s where s.vehiculo_id = new.id and s.tipo = p.tipo);
    insert into vehiculo_mantenimiento_plan (vehiculo_id, empresa_id, tipo, cada_km, cada_meses)
    values (new.id, new.empresa_id, 'service', 10000, 12),
           (new.id, new.empresa_id, 'cubiertas', 10000, null)
    on conflict (vehiculo_id, tipo) do nothing;
  end if;
  return new;
end;
$$;
drop trigger if exists trg_vehiculo_plan_por_tipo on public.vehiculos;
create trigger trg_vehiculo_plan_por_tipo after update of tipo on public.vehiculos
  for each row execute function public.vehiculo_plan_por_tipo();

-- Los trailers que ya existen: planes de camioneta → revisión anual.
delete from public.vehiculo_mantenimiento_plan p
 using public.vehiculos v
 where v.id = p.vehiculo_id and v.tipo = 'trailer' and p.tipo in ('service', 'cubiertas')
   and not exists (select 1 from public.vehiculo_services s where s.vehiculo_id = v.id and s.tipo = p.tipo);
insert into public.vehiculo_mantenimiento_plan (vehiculo_id, empresa_id, tipo, cada_km, cada_meses)
select v.id, v.empresa_id, 'revision_trailer', null, 12
  from public.vehiculos v where v.tipo = 'trailer' and v.empresa_id is not null
on conflict (vehiculo_id, tipo) do nothing;

commit;
