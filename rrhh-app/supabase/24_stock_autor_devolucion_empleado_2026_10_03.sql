-- 24 · Stock: quién cargó cada movimiento, tipo "devolución" y entrega vinculada al empleado.
--
-- 1) created_by toma el usuario de la sesión por defecto (hasta hoy quedaba null en todas
--    las filas: nunca se supo quién cargó qué).
-- 2) tipo 'devolucion': suma stock como una compra pero no cuenta como compra (antes se
--    cargaban como "compra" con la nota "Devolucion …" e inflaban el KPI de compras).
-- 3) empleado_id opcional: a quién se le entregó (FK dentro de RRHH, no cruza módulos).
--    Permite ver en el legajo el EPP y la ropa entregados. El texto de `notas` se conserva.
-- Backfill: las "compras" cuya nota dice "devoluc" pasan a 'devolucion' (el stock no cambia:
-- las dos suman) y los consumos cuya nota es EXACTAMENTE el nombre de un único empleado de la
-- misma empresa quedan vinculados (17 de 62 al 03/10; el resto sigue como texto libre).

begin;

alter table public.stock_movimientos alter column created_by set default auth.uid();

alter table public.stock_movimientos drop constraint stock_movimientos_tipo_check;
alter table public.stock_movimientos add constraint stock_movimientos_tipo_check
  check (tipo in ('compra', 'consumo', 'ajuste', 'devolucion'));

alter table public.stock_movimientos
  add column if not exists empleado_id uuid references public.empleados(id) on delete set null;
create index if not exists stock_movimientos_empleado_idx
  on public.stock_movimientos (empleado_id) where empleado_id is not null;

update public.stock_movimientos set tipo = 'devolucion'
  where tipo = 'compra' and notas ilike '%devoluc%';

with norm as (
  select m.id, m.empresa_id,
    lower(translate(btrim(regexp_replace(coalesce(m.notas, ''), '\s+', ' ', 'g')), 'áéíóúÁÉÍÓÚñÑüÜ', 'aeiouAEIOUnNuU')) n
  from public.stock_movimientos m where m.tipo = 'consumo' and m.empleado_id is null),
emp as (
  select e.id, e.empresa_id,
    lower(translate(btrim(coalesce(e.nombre, '') || ' ' || coalesce(e.apellido, '')), 'áéíóúÁÉÍÓÚñÑüÜ', 'aeiouAEIOUnNuU')) a,
    lower(translate(btrim(coalesce(e.apellido, '') || ' ' || coalesce(e.nombre, '')), 'áéíóúÁÉÍÓÚñÑüÜ', 'aeiouAEIOUnNuU')) b
  from public.empleados e),
unico as (
  select n.id, min(e.id::text)::uuid as empleado_id
  from norm n join emp e on e.empresa_id = n.empresa_id and (n.n = e.a or n.n = e.b)
  group by n.id having count(e.id) = 1)
update public.stock_movimientos m set empleado_id = u.empleado_id from unico u where m.id = u.id;

commit;
