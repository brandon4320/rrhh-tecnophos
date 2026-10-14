-- ============================================================
-- 26 · Flota: el conductor habitual se escribe a mano
-- ------------------------------------------------------------
-- Igual que en el QR (cada uno escribe su nombre), el conductor habitual deja
-- de elegirse de la lista de empleados: muchos choferes no tienen legajo en la
-- empresa de la camioneta. conductor_id queda sin uso (estaba vacío en las 19).
-- ============================================================

alter table public.vehiculos
  add column if not exists conductor_nombre text
    check (conductor_nombre is null or length(conductor_nombre) between 1 and 80);

-- Por si alguna se cargó antes con la lista.
update public.vehiculos v
set conductor_nombre = trim(concat_ws(' ', e.nombre, e.apellido))
from public.empleados e
where v.conductor_id = e.id and v.conductor_nombre is null;

comment on column public.vehiculos.conductor_nombre is 'Conductor habitual, escrito a mano.';
comment on column public.vehiculos.conductor_id is 'Sin uso desde la 26: el conductor se escribe en conductor_nombre.';
