-- ============================================================
-- AG493RP cargada dos veces — borrar la duplicada (27/11/2026)
-- ============================================================
--
-- Qué pasó: la camioneta existía en ADC desde el 28/03/2026, con su QR impreso
-- y pegado adentro. El 20/11/2026 se la volvió a dar de alta en Tecnophos
-- Rosario como si fuera nueva. Quien maneja siguió usando el QR de siempre,
-- así que los checklists entraban en la fila de ADC y la de Rosario se veía
-- "sin checklist todavía". Es la única patente repetida de toda la flota.
--
-- Decisión de Brandon (27/11/2026): la camioneta es de ADC. La fila de ADC ya
-- tiene TODO —3 checklists, los 85.800 km, VTV y Seguro, y el QR que la gente
-- usa a diario— así que no hay nada que mover: alcanza con sacar la copia.
--
-- ⚠ Acá SÍ se borra la fila, en contra de la regla de AGENTS.md §6 ("sacar un
--   vehículo de la flota es activo = false, nunca borrar"). Esa regla protege
--   el historial de una camioneta real. Esta fila no es una camioneta: es una
--   copia de 7 días con 0 checklists, 0 novedades y 0 services. Dejarla
--   desactivada sería dejar para siempre una segunda AG493RP en otra empresa,
--   que es justo lo que confundió a todo el mundo esta semana.
--
-- Valores ANTERIORES (leídos de la base el 27/11/2026):
--   vehiculo 06b204c5-2c22-4c54-90cb-052a5d49c065 · Tecnophos Rosario
--     patente AG493RP · descripcion "AMAROK - FERNANDO"
--     Volkswagen Amarok 2024 · tipo pickup · conductor FERNANDO GONZALEZ
--     activo = true · km_actual = null · checklist_cada_dias = 15
--     0 checklists · 0 novedades · 0 services · 0 avisos · 2 planes
--     1 certificado (Seguro Vehicular, vence 2027-06-03)
--   La fila que queda es 3a3a8496-1a50-42e8-bd42-17c05ecfe879 (ADC), intacta.
--
-- ⚠ Un delete no tiene undo. Lo que se pierde son los datos de arriba, que
--   están todos escritos acá y se vuelven a cargar a mano en dos minutos.
--
-- ============================================================
-- ANTES DE CORRER ESTO
-- ============================================================
-- Borrá el certificado "Seguro Vehicular" de esa camioneta DESDE LA PANTALLA
-- (Tecnophos Rosario → Habilitaciones → la AG493RP sin checklists), no por
-- SQL. `certificados.vehiculo_id` tiene `on delete cascade`, así que borrar el
-- vehículo por SQL se llevaría puesto el certificado y su fila de archivo,
-- pero el PDF quedaría HUÉRFANO en R2 para siempre: desde el SQL editor no hay
-- forma de borrar un objeto del bucket. Desde la pantalla se borra la fila Y
-- el objeto.
--
-- Ese mismo Seguro ya está cargado en la fila de ADC, con el mismo
-- vencimiento. No se pierde el papel.
--
-- El bloque de abajo se niega a correr si el certificado sigue ahí.
-- ============================================================

begin;

do $$
declare
  v_id   uuid := '06b204c5-2c22-4c54-90cb-052a5d49c065';
  n_cert int;
  n_hist int;
begin
  select count(*) into n_cert from certificados where vehiculo_id = v_id;
  if n_cert > 0 then
    raise exception
      'La camioneta todavia tiene % certificado(s). Borralos primero DESDE LA PANTALLA, asi se borra tambien el PDF en R2.', n_cert;
  end if;

  -- Por si alguien escaneó el QR equivocado entre que se leyó esto y se corre:
  -- un checklist es historial de verdad y no se tira sin mirarlo.
  select (select count(*) from vehiculo_checklists where vehiculo_id = v_id)
       + (select count(*) from vehiculo_novedades  where vehiculo_id = v_id)
    into n_hist;
  if n_hist > 0 then
    raise exception
      'Aparecio historial en la fila duplicada (% checklists/novedades). Para y revisa antes de borrar nada.', n_hist;
  end if;

  -- Los planes de mantenimiento se van solos (`on delete cascade`).
  delete from vehiculos where id = v_id;
end $$;

commit;

-- ============================================================
-- Comprobar después de aplicar
-- ============================================================
select v.patente, e.nombre as empresa, v.activo, v.km_actual,
       (select count(*) from vehiculo_checklists c where c.vehiculo_id = v.id) as checklists,
       (select count(*) from certificados ct where ct.vehiculo_id = v.id)      as certificados
  from vehiculos v join empresas e on e.id = v.empresa_id
 where v.patente = 'AG493RP';
-- Esperado: UNA sola fila — ADC S.R.L. · activo · 85800 km · 3 checklists · 2 certificados.

-- ============================================================
-- Defecto de fondo, NO lo arregla este archivo
-- ============================================================
-- El alta de vehículos no avisaba si la patente ya existía en otra empresa, y
-- quien tiene una sola empresa asignada no puede verlo por RLS — que es
-- exactamente quien cargó esta copia. Eso se arregla aparte.
