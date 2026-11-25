-- 39 · Pestcontrol: tubos de los equipos de seguridad chicos.
--
-- Pedido de Nicole (25/11/2026): en el Excel, el Falkonera (19/11/2026) dice en equipos
-- chicos "-3 (y dos tubos extra)" y quiere que figure en la DEUDA de equipos chicos:
-- "deberían 4 equipos simples y dos tubos". Los tubos pasan a ser un insumo propio que se
-- muestra DENTRO de la tarjeta de equipos chicos (dentro_de), con su columna en el libro.

begin;

alter table public.pest_insumos
  add column if not exists dentro_de uuid references public.pest_insumos (id);
comment on column public.pest_insumos.dentro_de is
  'Insumo que se muestra dentro de la tarjeta de otro (los tubos, en equipos chicos). Ver 39.';

-- Orden: los tubos van pegados a equipos chicos.
update public.pest_insumos set orden = orden + 1 where codigo in ('eqg', 'man', 'mot', 'pvc') and orden >= 4;

insert into public.pest_insumos (id, empresa_id, codigo, nombre, unidad, orden, dentro_de)
select '25911907-43f8-45a1-b6b4-eff16000cbff', i.empresa_id, 'tub', 'Tubos equipos seg. chicos', 'tubos', 4, i.id
from public.pest_insumos i where i.codigo = 'eqc'
on conflict do nothing;

-- Los dos tubos del Falkonera (19/11/2026), como salida de ese barco.
insert into public.pest_lineas (empresa_id, movimiento_id, insumo_id, entrada, salida)
select m.empresa_id, m.id, '25911907-43f8-45a1-b6b4-eff16000cbff', 0, 2
from public.pest_movimientos m
where m.id = '58b13536-c032-4223-8751-5ea7906e655c'
on conflict (movimiento_id, insumo_id) do nothing;

commit;

-- Control: equipos chicos -4, tubos -2.
select i.nombre, i.orden, coalesce(sum(l.entrada - l.salida), 0) as saldo
from public.pest_insumos i left join public.pest_lineas l on l.insumo_id = i.id
where i.activo group by i.nombre, i.orden order by i.orden;
