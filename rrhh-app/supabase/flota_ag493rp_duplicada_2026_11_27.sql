-- ============================================================
-- AG493RP cargada dos veces — unificar en Tecnophos Rosario (27/11/2026)
-- ============================================================
--
-- Qué pasó: la camioneta existía en ADC desde el 28/03/2026, con su QR impreso
-- y pegado adentro. El 20/11/2026 se la volvió a dar de alta en Tecnophos
-- Rosario como si fuera nueva. Quien maneja venía haciendo el checklist con el
-- QR de siempre, así que todo entraba en la fila de ADC y la de Rosario se
-- veía "sin checklist todavía". Es la única patente repetida de toda la flota.
--
-- Decisión de Brandon (27/11/2026): la camioneta queda en Tecnophos Rosario.
--
-- Cómo: se conserva la fila de ROSARIO (es la que tiene los datos cargados a
-- mano: conductor, año, tipo) y se le pasa todo lo que la de ADC tenía de
-- valor. **El QR pegado en la camioneta sigue funcionando** porque se le pasa
-- también el token; no hay que reimprimir ni ir hasta la camioneta.
--
-- ⚠ Por qué NO se mueve la fila de ADC a Rosario cambiando su `empresa_id`,
--   que sería lo obvio: `vehiculo_checklists`, `vehiculo_novedades` y los
--   planes tienen una FK COMPUESTA a `vehiculos (id, empresa_id)` que no es
--   deferrable ni tiene `on update cascade`. Cambiar el padre falla mientras
--   los hijos apunten al par viejo, y cambiar los hijos falla porque el par
--   nuevo todavía no existe. Salir de ahí obliga a tocar los constraints en
--   producción. Mover los hijos de un par existente a otro par existente, en
--   cambio, es un update común.
--
-- Valores ANTERIORES (leídos de la base el 27/11/2026):
--   vehiculo ADC     3a3a8496-1a50-42e8-bd42-17c05ecfe879 · activo = true
--                    km_actual = 85800 · km_actualizado_at = 2026-11-27T17:23:45.313+00
--                    3 checklists, 0 novedades, 2 certificados (VTV y Seguro), 2 planes
--   vehiculo ROSARIO 06b204c5-2c22-4c54-90cb-052a5d49c065 · activo = true
--                    km_actual = null · 0 checklists · 1 certificado (Seguro) · 2 planes
--
-- Para volver atrás: ver el bloque del final.
-- ============================================================

begin;

-- ------------------------------------------------------------
-- 1. El historial de checklists pasa a la fila de Rosario
-- ------------------------------------------------------------
-- Las dos columnas juntas: el par (vehiculo_id, empresa_id) tiene que existir
-- en `vehiculos` en todo momento.
update vehiculo_checklists
   set vehiculo_id = '06b204c5-2c22-4c54-90cb-052a5d49c065',
       empresa_id  = 'b8edab8d-1bbb-49e2-8ee7-db8150cd8e20'
 where vehiculo_id = '3a3a8496-1a50-42e8-bd42-17c05ecfe879';   -- 3 filas

-- Hoy son 0, pero si entra una novedad entre que se lee esto y se corre, tiene
-- que irse con el resto.
update vehiculo_novedades
   set vehiculo_id = '06b204c5-2c22-4c54-90cb-052a5d49c065',
       empresa_id  = 'b8edab8d-1bbb-49e2-8ee7-db8150cd8e20'
 where vehiculo_id = '3a3a8496-1a50-42e8-bd42-17c05ecfe879';

-- ------------------------------------------------------------
-- 2. Los certificados (VTV y Seguro)
-- ------------------------------------------------------------
-- ⚠ Se mueven los DOS, no solo la VTV. No alcanza con dar de baja la fila de
--   ADC y dejárselos: `/vencimientos` descarta los certificados de EMPLEADOS
--   dados de baja, pero no mira `vehiculos.activo` — un certificado colgado de
--   una camioneta desactivada sigue avisando. (Eso es un defecto aparte, ver
--   la nota del final.)
--
-- Queda un Seguro DUPLICADO en Rosario: el que ya tenía y el que viene de ADC,
-- los dos con vencimiento 2027-06-03. Uno hay que borrarlo DESDE LA PANTALLA
-- del vehículo, no por SQL: así se borra también el PDF en R2. Por SQL
-- quedaría el archivo huérfano.
update certificados
   set vehiculo_id = '06b204c5-2c22-4c54-90cb-052a5d49c065'
 where vehiculo_id = '3a3a8496-1a50-42e8-bd42-17c05ecfe879';   -- 2 filas

-- Los planes de mantenimiento NO se mueven: Rosario ya tiene los suyos y
-- moverlos dejaría cuatro. Los de ADC quedan colgados de la fila desactivada,
-- donde no molestan (no generan avisos, solo se ven en la ficha).

-- ------------------------------------------------------------
-- 3. Los kilómetros
-- ------------------------------------------------------------
update vehiculos
   set km_actual = 85800,
       km_actualizado_at = '2026-11-27T17:23:45.313+00:00'
 where id = '06b204c5-2c22-4c54-90cb-052a5d49c065';

-- ------------------------------------------------------------
-- 4. El QR: el token se muda, el papel de la camioneta sigue sirviendo
-- ------------------------------------------------------------
-- `uq_vehiculos_checklist_token` es único, así que primero hay que liberar el
-- valor dándole uno nuevo a la fila de ADC. Se hace en un bloque con variable
-- para que el token no quede escrito en ningún lado.
do $$
declare t text;
begin
  select checklist_token into t from vehiculos
   where id = '3a3a8496-1a50-42e8-bd42-17c05ecfe879';

  update vehiculos
     set checklist_token = substr(replace(gen_random_uuid()::text, '-', ''), 1, 24)
   where id = '3a3a8496-1a50-42e8-bd42-17c05ecfe879';

  update vehiculos set checklist_token = t
   where id = '06b204c5-2c22-4c54-90cb-052a5d49c065';
end $$;

-- ------------------------------------------------------------
-- 5. La fila de ADC sale de la flota
-- ------------------------------------------------------------
-- `activo = false`, nunca un delete (AGENTS.md §6): el QR viejo deja de abrir
-- —`/v/<token>` filtra por activo— y la fila desaparece de las pantallas, pero
-- se puede volver atrás.
update vehiculos
   set activo = false
 where id = '3a3a8496-1a50-42e8-bd42-17c05ecfe879';

commit;

-- ============================================================
-- Comprobar después de aplicar
-- ============================================================
select v.patente, e.nombre as empresa, v.activo, v.km_actual,
       (select count(*) from vehiculo_checklists c where c.vehiculo_id = v.id) as checklists,
       (select count(*) from certificados ct where ct.vehiculo_id = v.id)      as certificados
  from vehiculos v join empresas e on e.id = v.empresa_id
 where v.patente = 'AG493RP';
-- Esperado:
--   Tecnophos Rosario · activo = true  · km 85800 · 3 checklists · 3 certificados
--   ADC S.R.L.        · activo = false · 0 checklists · 0 certificados

-- ============================================================
-- Para volver atrás (si hiciera falta)
-- ============================================================
-- begin;
-- update vehiculos set activo = true where id = '3a3a8496-1a50-42e8-bd42-17c05ecfe879';
-- -- el token hay que devolverlo con el mismo bloque del punto 4, al revés
-- update vehiculos set km_actual = null, km_actualizado_at = null
--  where id = '06b204c5-2c22-4c54-90cb-052a5d49c065';
-- update certificados set vehiculo_id = '3a3a8496-1a50-42e8-bd42-17c05ecfe879'
--  where vehiculo_id = '06b204c5-2c22-4c54-90cb-052a5d49c065'
--    and id <> '348a78e1-3f33-4186-81af-a4fd09292dd1';   -- el Seguro que ya tenía Rosario
-- update vehiculo_checklists
--    set vehiculo_id = '3a3a8496-1a50-42e8-bd42-17c05ecfe879',
--        empresa_id  = 'd5a028c3-aba7-479c-952b-548713a3ccb2'
--  where vehiculo_id = '06b204c5-2c22-4c54-90cb-052a5d49c065';
-- commit;

-- ============================================================
-- Defecto de fondo, NO lo arregla este archivo
-- ============================================================
-- 1. El alta de vehículos no avisa si la patente ya existe en otra empresa.
--    Esto se podría haber evitado el 20/11 con una advertencia, como la que ya
--    existe para empleados duplicados (`lib/empleados.ts`).
-- 2. `/vencimientos` no filtra `vehiculos.activo`: los certificados de una
--    camioneta dada de baja siguen apareciendo. Hoy no afecta a nadie porque
--    este archivo mueve los dos certificados, pero va a morder en la próxima
--    baja de vehículo.
