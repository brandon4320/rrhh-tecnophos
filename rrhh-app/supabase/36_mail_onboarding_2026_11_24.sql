-- ============================================================
-- 36 — El mail de onboarding de la firma (24/11/2026)
--
-- Decisión de Brandon: antes de que haya ningún recibo cargado, se le manda a
-- TODOS los empleados activos de Tecnophos y ADC un mail con su link personal
-- para que dejen la firma guardada de una vez. Después, el día que terminan
-- las liquidaciones, firmar cada recibo es un toque.
--
-- Es un tipo de mail propio y no 'aviso' porque no dice lo mismo ni se manda
-- por lo mismo: 'aviso' es "tenés un recibo para firmar" y sale cada mes;
-- 'onboarding' es "así va a funcionar de ahora en más" y sale una sola vez.
-- Mezclarlos rompería dos cosas:
--
--   · el tope de uno por día — en el mes que arranque el circuito, el
--     onboarding se comería el aviso del primer recibo;
--   · poder contestar "¿a quién le mandamos el onboarding y quién todavía no
--     dejó su firma?", que es toda la pantalla de envío.
--
-- El tope de uno por día SÍ lo comparte, con su propio índice: si alguien
-- aprieta "Enviar" dos veces, la segunda no manda nada.
--
-- Quién puede disparar el envío NO se agrega acá: es `perfiles.ve_recibos`,
-- el permiso de la migración 23. Quien manda el link es quien después va a
-- leer lo que se firmó, así que van juntos y no hay un permiso nuevo que
-- mantener. Hoy lo tienen Brandon, Mariano, Aylen y Magali.
--
-- Se puede correr más de una vez.
-- ============================================================

begin;

-- ------------------------------------------------------------
-- 1. El tipo nuevo
-- ------------------------------------------------------------
alter table public.recibo_mails drop constraint if exists recibo_mails_tipo_check;
alter table public.recibo_mails add constraint recibo_mails_tipo_check
  check (tipo in (
    'onboarding',
    'aviso', 'recordatorio', 'adicional', 'correccion',
    'copia_firmada', 'alerta'
  ));

-- ------------------------------------------------------------
-- 2. Uno por día también para el onboarding
-- ------------------------------------------------------------
-- ⚠ Nombre propio, por lo mismo que explica la migración 34: las 31, 33 y 34
-- crean índices con sus propias listas de tipos y las cuatro dicen que se
-- pueden correr más de una vez. Si compartieran nombre, reaplicar una vieja
-- borraría el tope de los tipos nuevos. Con nombres distintos conviven, y
-- como cada uno cubre un subconjunto, que reaparezca el viejo no rompe nada.
create unique index if not exists recibo_mails_uno_por_dia_onboarding
  on public.recibo_mails (empleado_id, dia, tipo)
  where tipo = 'onboarding' and estado = 'enviado';

commit;

-- ============================================================
-- Comprobar después de aplicar:
--
--   select pg_get_constraintdef(oid) from pg_constraint
--    where conname = 'recibo_mails_tipo_check';          -- incluye 'onboarding'
--
--   select indexname from pg_indexes
--    where tablename = 'recibo_mails';                   -- está el _onboarding
--
--   select count(*) from recibo_mails where tipo = 'onboarding';  -- 0 todavía
-- ============================================================
