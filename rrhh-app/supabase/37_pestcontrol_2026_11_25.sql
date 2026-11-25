-- 37 · Pestcontrol: stock de insumos de fumigación de barcos (Tecnophos Bahía Blanca).
--
-- Pedido de Agustín (25/11/2026): pasar a Gestión la planilla de Pestcontrol
-- (fosfuro de aluminio, latas de 14 kg, equipos de seguridad, mangas, motores AD3 y
-- caños PVC: lo que entra, lo que sale por barco y el saldo de cada insumo) con los
-- remitos y facturas adjuntos. Se había armado primero en el ERP de Serviwhite por error.
--
-- ACCESO POR PERSONA, como los recibos (migración 23): `perfiles.ve_pestcontrol`,
-- además de ser RRHH y ver la empresa. Lectura Y escritura: la RLS es la seguridad real.
-- Los adjuntos van a R2 con prefijo `pestcontrol/` y /api/archivo los firma solo si la
-- fila de `pest_adjuntos` es visible (por eso `pestcontrol` queda como slug reservado).
--
-- El saldo NUNCA se guarda: es la suma de entradas − salidas (modules/pestcontrol/reglas.ts).
-- El historial cargado desde el Excel NO está en este archivo (el repo es público): se
-- corrió aparte en el SQL editor.

begin;

alter table public.perfiles add column if not exists ve_pestcontrol boolean not null default false;

create or replace function public.app_ve_pestcontrol() returns boolean
  language sql stable security definer set search_path = public as
$$ select coalesce((select ve_pestcontrol from perfiles where id = auth.uid()), false) $$;
revoke execute on function public.app_ve_pestcontrol() from public, anon;
grant execute on function public.app_ve_pestcontrol() to authenticated;

-- Insumos (las columnas de la planilla), por empresa.
create table if not exists public.pest_insumos (
  id          uuid primary key default gen_random_uuid(),
  empresa_id  uuid not null references public.empresas (id),
  codigo      text not null,
  nombre      text not null,
  -- Unidad en la que se cuentan entradas, salidas y saldo (tarros, latas, equipos…).
  unidad      text,
  -- Fosfuro: 14 tarros por caja. Se puede cargar en cajas y el saldo se muestra también en cajas.
  por_caja    numeric check (por_caja is null or por_caja > 0),
  orden       smallint not null default 0,
  activo      boolean not null default true,
  created_at  timestamptz not null default now(),
  unique (empresa_id, codigo),
  unique (id, empresa_id)
);

-- Movimientos (las filas de la planilla): una fumigación, una compra, una entrega, un ajuste.
create table if not exists public.pest_movimientos (
  id           uuid primary key default gen_random_uuid(),
  empresa_id   uuid not null references public.empresas (id),
  fecha        date not null,
  -- Barco fumigado (salidas). Vacío en compras, entregas y ajustes.
  barco        text,
  detalle      text,
  -- Factura o remito (Fc 4299, Rto 6827…).
  comprobante  text,
  lugar        text,
  notas        text,
  -- Orden de carga: desempata movimientos del mismo día y conserva el orden de la planilla.
  orden        bigint generated always as identity,
  created_by   uuid default auth.uid() references public.perfiles (id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (id, empresa_id)
);
create index if not exists pest_movimientos_fecha on public.pest_movimientos (empresa_id, fecha, orden);

-- Cantidades por insumo de cada movimiento. Mismas empresa que el movimiento y el insumo
-- (FK compuestas, como stock): una línea no puede mezclar empresas.
create table if not exists public.pest_lineas (
  id             uuid primary key default gen_random_uuid(),
  empresa_id     uuid not null,
  movimiento_id  uuid not null,
  insumo_id      uuid not null,
  entrada        numeric not null default 0,
  salida         numeric not null default 0,
  constraint pest_lineas_movimiento_fk foreign key (movimiento_id, empresa_id)
    references public.pest_movimientos (id, empresa_id) on delete cascade,
  constraint pest_lineas_insumo_fk foreign key (insumo_id, empresa_id)
    references public.pest_insumos (id, empresa_id),
  constraint pest_lineas_no_negativas check (entrada >= 0 and salida >= 0),
  constraint pest_lineas_con_cantidad check (entrada > 0 or salida > 0),
  unique (movimiento_id, insumo_id)
);
create index if not exists pest_lineas_insumo on public.pest_lineas (insumo_id);

-- Comprobantes adjuntos (fotos o PDF de remitos y facturas de lo que entra o sale).
create table if not exists public.pest_adjuntos (
  id              uuid primary key default gen_random_uuid(),
  empresa_id      uuid not null,
  movimiento_id   uuid not null,
  path            text not null unique,
  nombre_archivo  text not null,
  mime_type       text,
  size_bytes      bigint,
  uploaded_by     uuid default auth.uid() references public.perfiles (id) on delete set null,
  created_at      timestamptz not null default now(),
  constraint pest_adjuntos_movimiento_fk foreign key (movimiento_id, empresa_id)
    references public.pest_movimientos (id, empresa_id) on delete cascade
);
create index if not exists pest_adjuntos_movimiento on public.pest_adjuntos (movimiento_id);

-- RLS: RRHH + permiso de Pestcontrol + la empresa visible. Forma rápida (migración 21).
alter table public.pest_insumos enable row level security;
alter table public.pest_movimientos enable row level security;
alter table public.pest_lineas enable row level security;
alter table public.pest_adjuntos enable row level security;

do $$
declare
  t text;
begin
  foreach t in array array['pest_insumos', 'pest_movimientos', 'pest_lineas', 'pest_adjuntos'] loop
    execute format('drop policy if exists %I on public.%I', t || '_rrhh_all', t);
    execute format(
      'create policy %I on public.%I for all to authenticated
         using ((select app_es_rrhh()) and (select app_ve_pestcontrol())
                and ((select app_ve_todas_empresas()) or empresa_id = (select app_empresa_acceso())))
         with check ((select app_es_rrhh()) and (select app_ve_pestcontrol())
                and ((select app_ve_todas_empresas()) or empresa_id = (select app_empresa_acceso())))',
      t || '_rrhh_all', t);
  end loop;
end $$;

-- Historial de cambios (migración 28): movimientos, líneas, adjuntos e insumos.
do $$
declare
  t text;
begin
  foreach t in array array['pest_insumos', 'pest_movimientos', 'pest_lineas', 'pest_adjuntos'] loop
    execute format('drop trigger if exists trg_auditoria on public.%I', t);
    execute format('create trigger trg_auditoria after insert or update or delete on public.%I for each row execute function public.app_auditar()', t);
  end loop;
end $$;

-- Guardar un movimiento con sus líneas en UNA transacción (alta o edición). SECURITY
-- INVOKER: corre con los permisos de quien llama, así que la RLS de arriba decide todo.
-- p_lineas = [{ "insumo_id": uuid, "entrada": n, "salida": n }, …] (las que van en 0/0 se ignoran).
create or replace function public.pest_guardar_movimiento(
  p_id uuid, p_empresa_id uuid, p_fecha date, p_barco text, p_detalle text,
  p_comprobante text, p_lugar text, p_notas text, p_lineas jsonb
) returns uuid
  language plpgsql security invoker set search_path = public as
$$
declare
  v_id uuid := p_id;
begin
  if not exists (
    select 1 from jsonb_array_elements(coalesce(p_lineas, '[]'::jsonb)) l
    where coalesce((l ->> 'entrada')::numeric, 0) > 0 or coalesce((l ->> 'salida')::numeric, 0) > 0
  ) then
    raise exception 'El movimiento no tiene cantidades.' using errcode = '23514';
  end if;

  if v_id is null then
    insert into pest_movimientos (empresa_id, fecha, barco, detalle, comprobante, lugar, notas)
    values (p_empresa_id, p_fecha, nullif(trim(p_barco), ''), nullif(trim(p_detalle), ''),
            nullif(trim(p_comprobante), ''), nullif(trim(p_lugar), ''), nullif(trim(p_notas), ''))
    returning id into v_id;
  else
    update pest_movimientos set
      fecha = p_fecha, barco = nullif(trim(p_barco), ''), detalle = nullif(trim(p_detalle), ''),
      comprobante = nullif(trim(p_comprobante), ''), lugar = nullif(trim(p_lugar), ''),
      notas = nullif(trim(p_notas), ''), updated_at = now()
    where id = v_id and empresa_id = p_empresa_id;
    if not found then raise exception 'Movimiento no encontrado o sin permiso.' using errcode = '42501'; end if;
    delete from pest_lineas where movimiento_id = v_id;
  end if;

  insert into pest_lineas (empresa_id, movimiento_id, insumo_id, entrada, salida)
  select p_empresa_id, v_id, (l ->> 'insumo_id')::uuid,
         coalesce((l ->> 'entrada')::numeric, 0), coalesce((l ->> 'salida')::numeric, 0)
  from jsonb_array_elements(p_lineas) l
  where coalesce((l ->> 'entrada')::numeric, 0) > 0 or coalesce((l ->> 'salida')::numeric, 0) > 0;

  return v_id;
end;
$$;
revoke execute on function public.pest_guardar_movimiento(uuid, uuid, date, text, text, text, text, text, jsonb) from public, anon;
grant execute on function public.pest_guardar_movimiento(uuid, uuid, date, text, text, text, text, text, jsonb) to authenticated;

-- Los 7 insumos de la planilla, en Tecnophos Bahía Blanca.
insert into public.pest_insumos (id, empresa_id, codigo, nombre, unidad, por_caja, orden)
select v.id::uuid, e.id, v.codigo, v.nombre, v.unidad, v.por_caja::numeric, v.orden::smallint
from public.empresas e
cross join (values
  ('0a1fbf7e-8268-455c-a439-216e46eba3b3', 'fos',  'Fosfuro de aluminio',  'tarros',  '14', 1),
  ('24446b47-c2b7-41df-b0b5-785ad9a84e8f', 'lata', 'Fosfuro lata 14 kg',   'latas',   null, 2),
  ('71a23a03-9a91-4e43-ba2a-7a5de8e5faaa', 'eqc',  'Equipos seg. chicos',  'equipos', null, 3),
  ('c504c0c8-4325-42b4-8afc-4d3295d582c5', 'eqg',  'Equipos seg. grandes', 'equipos', null, 4),
  ('d939fc88-0546-4448-8e7f-a13d16a774df', 'man',  'Mangas',               null,      null, 5),
  ('7688324b-0cf4-44f1-a3eb-1a25f887556e', 'mot',  'Motores AD3',          'motores', null, 6),
  ('8927a35e-70e4-40f6-bc76-6e95aac3d81d', 'pvc',  'Caños PVC',            'caños',   null, 7)
) as v(id, codigo, nombre, unidad, por_caja, orden)
where e.slug = 'tecnophos-bahia-blanca'
on conflict (empresa_id, codigo) do nothing;

-- Acceso: Brandon (super admin) y Nicole. Quién lo tiene vive en la tabla:
-- select nombre, ve_pestcontrol from perfiles order by nombre;
update public.perfiles set ve_pestcontrol = true
  where (rol = 'admin' and empresa_acceso is null) or nombre ilike 'nicole%';

commit;

-- Para ver a quién le quedó el acceso:
select nombre, rol, ve_pestcontrol from public.perfiles where ve_pestcontrol order by nombre;
