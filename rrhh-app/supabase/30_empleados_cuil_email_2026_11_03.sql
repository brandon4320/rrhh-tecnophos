-- ============================================================
-- 30 — CUIL y mail en empleados (03/11/2026)
--
-- Los necesita el circuito de firma de recibos de sueldo:
--   · el CUIL es la llave que une a Jaque con Gestión (Jaque no tiene mails y
--     los nombres no coinciden parejo, sobre todo en ADC), y además es lo que
--     el empleado confirma —sus últimos 4 dígitos— antes de ver sus recibos;
--   · el mail es a dónde va el link personal para firmar.
--
-- Las dos columnas son opcionales: hoy ningún empleado las tiene cargadas y se
-- completan una sola vez con la planilla de emparejamiento que revisa Agustín.
--
-- No hace falta tocar la RLS: `empleados` ya tiene sus policies y las columnas
-- nuevas quedan adentro de ellas. Tampoco la auditoría (migración 28): el
-- trigger compara la fila entera, así que un cambio de CUIL o de mail queda
-- registrado solo. Eso implica que el CUIL y el mail van a aparecer en
-- `auditoria`, que lee ÚNICAMENTE el super admin — la misma persona que ya
-- puede leerlos en `empleados`, así que no agrega exposición.
--
-- Se puede correr más de una vez.
-- ============================================================

alter table public.empleados
  add column if not exists cuil  text,
  add column if not exists email text;

comment on column public.empleados.cuil is
  '11 dígitos, sin guiones. Llave con Jaque Sueldos y confirmación del empleado al firmar.';
comment on column public.empleados.email is
  'En minúsculas. A dónde va el link personal para firmar los recibos.';

-- ------------------------------------------------------------
-- Formato
-- ------------------------------------------------------------
-- Guardar "20-12345678-9" y "20123456789" como cosas distintas haría fallar el
-- cruce por CUIL justo cuando más duele (la carga automática de recibos), así
-- que entra una sola forma: 11 dígitos pelados.
alter table public.empleados drop constraint if exists empleados_cuil_formato;
alter table public.empleados add constraint empleados_cuil_formato
  check (cuil is null or cuil ~ '^[0-9]{11}$');

-- Mail en minúsculas y con forma de mail. Lo de las minúsculas no es estética:
-- si no, el mismo mail entra dos veces escrito distinto y las búsquedas fallan.
alter table public.empleados drop constraint if exists empleados_email_formato;
alter table public.empleados add constraint empleados_email_formato
  check (email is null or (email = lower(email) and email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'));

-- ------------------------------------------------------------
-- Un CUIL por empresa
-- ------------------------------------------------------------
-- No es único global a propósito: una misma persona puede tener legajo en dos
-- empresas del grupo (y queda una fila en cada una). Lo que no puede pasar es
-- que esté dos veces en la MISMA empresa, porque entonces un recibo no sabría
-- a cuál de las dos filas colgarse.
create unique index if not exists empleados_empresa_cuil_idx
  on public.empleados (empresa_id, cuil) where cuil is not null;

-- La carga automática busca por CUIL dentro de las empresas de una misma base
-- de Jaque (Tecnophos Services son TRES empresas en Gestión: BB, Rosario y
-- Necochea), así que necesita un índice por CUIL solo.
create index if not exists empleados_cuil_idx
  on public.empleados (cuil) where cuil is not null;
