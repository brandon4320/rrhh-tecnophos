-- ============================================================
-- Flota — elementos obligatorios de la flota y baja de AD778EL (16/10/2026)
--
-- NO es una migración de schema: no crea ni modifica tablas. Es una corrección
-- de DATOS pedida por la oficina, versionada acá para que quede registro de qué
-- se cambió, cuándo y por qué (mismo criterio que rosario_update_2026_04_29.sql).
--
-- 1) Se compraron matafuegos y balizas triangulares para TODA la flota, así que
--    los checklists que los marcaron "Mal" u "Obs." pasan a "OK". La nota
--    original de quien manejaba se CONSERVA y se le agrega la línea de la
--    corrección: el checklist sigue contando lo que se encontró ese día.
--
--    El `resultado` de cada checklist se recalculó con la regla del código
--    (reglas.ts::calcularResultado) tal como está HOY, después de que el
--    16/10 se retiraran balizas, chaleco, botiquín, kit de derrames, productos
--    en envases y carga sujeta: un "Mal" en un ítem crítico deja la unidad no
--    apta, cualquier otro "Mal" u "Obs." la deja con observaciones, y lo
--    retirado no cuenta. Los valores de abajo ya salen de esa cuenta.
--
--    `balizas_triangulo` ya no se pide en los checklists nuevos, pero se
--    corrige igual porque la ficha del vehículo sigue mostrando lo que los
--    checklists viejos respondieron en los ítems retirados.
--
--    El BOTIQUÍN queda como está a propósito: todavía no se compraron.
--
-- 2) AD778EL se da de baja (ya no está en la flota). Es baja lógica
--    (`activo = false`), que es como el sistema saca de circulación un
--    vehículo: desaparece de todas las pantallas y su QR deja de funcionar,
--    pero no se pierde el registro. No tenía checklists, novedades, services ni
--    documentación cargada.
--
-- Se puede correr más de una vez.
-- ============================================================

begin;

-- ------------------------------------------------------------
-- 1. Matafuego y balizas triangulares: toda la flota los tiene
-- ------------------------------------------------------------
-- AF540SP · 2026-10-14 · balizas_triangulo: no_ok -> ok · resultado observaciones (sin cambio)
update public.vehiculo_checklists set
  respuestas  = respuestas || '{"balizas_triangulo":"ok"}'::jsonb,
  notas_items = notas_items || '{"balizas_triangulo":"no tiene · Actualizado 16/10/2026 desde Gestión: la unidad tiene balizas triangulares."}'::jsonb,
  resultado   = 'observaciones'
where id = 'd52a94ff-5465-4cae-98c1-3fa65804373b';

-- AG048TW · 2026-10-14 · balizas_triangulo: no_ok -> ok · resultado observaciones (sin cambio)
update public.vehiculo_checklists set
  respuestas  = respuestas || '{"balizas_triangulo":"ok"}'::jsonb,
  notas_items = notas_items || '{"balizas_triangulo":"No tiene · Actualizado 16/10/2026 desde Gestión: la unidad tiene balizas triangulares."}'::jsonb,
  resultado   = 'observaciones'
where id = '431a245e-dbc1-49f7-b181-b979729c6b28';

-- AI433DK · 2026-10-14 · matafuegos: obs -> ok | balizas_triangulo: obs -> ok · resultado observaciones (sin cambio)
update public.vehiculo_checklists set
  respuestas  = respuestas || '{"matafuegos":"ok","balizas_triangulo":"ok"}'::jsonb,
  notas_items = notas_items || '{"matafuegos":"No cuenta con matafuego fijo. · Actualizado 16/10/2026 desde Gestión: la unidad tiene matafuego.","balizas_triangulo":"Sin balizas. · Actualizado 16/10/2026 desde Gestión: la unidad tiene balizas triangulares."}'::jsonb,
  resultado   = 'observaciones'
where id = '71b6c151-0a60-4a57-8d61-e32e8011c34d';

-- AH797GH · 2026-10-15 · matafuegos: obs -> ok | balizas_triangulo: obs -> ok · resultado observaciones -> ok
update public.vehiculo_checklists set
  respuestas  = respuestas || '{"matafuegos":"ok","balizas_triangulo":"ok"}'::jsonb,
  notas_items = notas_items || '{"matafuegos":"Actualizado 16/10/2026 desde Gestión: la unidad tiene matafuego.","balizas_triangulo":"Sin balizas · Actualizado 16/10/2026 desde Gestión: la unidad tiene balizas triangulares."}'::jsonb,
  resultado   = 'ok'
where id = 'baa5425d-1186-4ec9-8e06-dd65f002a055';

-- AE268VT · 2026-10-15 · matafuegos: obs -> ok | balizas_triangulo: obs -> ok · resultado observaciones (sin cambio)
update public.vehiculo_checklists set
  respuestas  = respuestas || '{"matafuegos":"ok","balizas_triangulo":"ok"}'::jsonb,
  notas_items = notas_items || '{"matafuegos":"No tiene fijo. · Actualizado 16/10/2026 desde Gestión: la unidad tiene matafuego.","balizas_triangulo":"No tiene · Actualizado 16/10/2026 desde Gestión: la unidad tiene balizas triangulares."}'::jsonb,
  resultado   = 'observaciones'
where id = 'eaec0496-b38a-4287-bfd5-846ebf5b678e';

-- AG491JU · 2026-10-15 · matafuegos: no_ok -> ok | balizas_triangulo: no_ok -> ok · resultado no_apto -> observaciones
update public.vehiculo_checklists set
  respuestas  = respuestas || '{"matafuegos":"ok","balizas_triangulo":"ok"}'::jsonb,
  notas_items = notas_items || '{"matafuegos":"No tiene · Actualizado 16/10/2026 desde Gestión: la unidad tiene matafuego.","balizas_triangulo":"No tiene · Actualizado 16/10/2026 desde Gestión: la unidad tiene balizas triangulares."}'::jsonb,
  resultado   = 'observaciones'
where id = '67c5ddc9-6783-400c-9e8a-6d454af2661b';

-- AH797GK · 2026-10-15 · matafuegos: obs -> ok | balizas_triangulo: obs -> ok · resultado observaciones (sin cambio)
update public.vehiculo_checklists set
  respuestas  = respuestas || '{"matafuegos":"ok","balizas_triangulo":"ok"}'::jsonb,
  notas_items = notas_items || '{"matafuegos":"Faltante · Actualizado 16/10/2026 desde Gestión: la unidad tiene matafuego.","balizas_triangulo":"Faltante · Actualizado 16/10/2026 desde Gestión: la unidad tiene balizas triangulares."}'::jsonb,
  resultado   = 'observaciones'
where id = 'fccb4d7d-4873-499a-91c4-ba26bea7a7d3';

-- AD113UY · 2026-10-16 · matafuegos: no_ok -> ok | balizas_triangulo: obs -> ok · resultado no_apto -> observaciones
-- OJO: este checklist es de HOY (11:43 hs).
--   matafuegos: lo que reportó quien manejaba fue "Vencido y sin presion".
--   balizas_triangulo: lo que reportó quien manejaba fue "No tiene".
-- Si todavía no se cambió en ESTA unidad, salteá este update y corré el resto.
update public.vehiculo_checklists set
  respuestas  = respuestas || '{"matafuegos":"ok","balizas_triangulo":"ok"}'::jsonb,
  notas_items = notas_items || '{"matafuegos":"Vencido y sin presion · Actualizado 16/10/2026 desde Gestión: la unidad tiene matafuego.","balizas_triangulo":"No tiene · Actualizado 16/10/2026 desde Gestión: la unidad tiene balizas triangulares."}'::jsonb,
  resultado   = 'observaciones'
where id = '1a86fcd0-528c-4fc5-9cf0-f7acde29542d';

-- Las novedades abiertas por esos dos ítems quedan resueltas (es lo que saca a
-- una unidad de "No apta para circular").
--
-- El corte por fecha NO es decorativo: sin él, correr este archivo dentro de un
-- mes cerraría un matafuego descargado reportado la semana que viene, y encima
-- le dejaría escrito que se compró en octubre. Solo se cierra lo que ya estaba
-- abierto cuando se compraron.
update public.vehiculo_novedades set
  estado      = 'resuelta',
  resolucion  = 'Se compraron matafuegos y balizas triangulares para toda la flota. Actualizado desde Gestión el 16/10/2026.',
  resuelta_at = now()
where item in ('matafuegos', 'balizas_triangulo')
  and estado = 'abierta'
  and created_at <= '2026-10-16T23:59:59-03:00';

-- ------------------------------------------------------------
-- 2. Baja de AD778EL
-- ------------------------------------------------------------
update public.vehiculos set
  activo           = false,
  checklist_activo = false
where patente = 'AD778EL';

commit;

-- ============================================================
-- Verificación (correr después del commit)
-- ============================================================

-- a) Ningún checklist debería quedar con matafuego o balizas fuera de "OK".
--    Si aparece alguno, es un checklist nuevo hecho después de este script.
select v.patente,
       c.created_at::date as fecha,
       c.respuestas->>'matafuegos'        as matafuego,
       c.respuestas->>'balizas_triangulo' as balizas,
       c.resultado
  from public.vehiculo_checklists c
  join public.vehiculos v on v.id = c.vehiculo_id
 where coalesce(c.respuestas->>'matafuegos', 'ok') <> 'ok'
    or coalesce(c.respuestas->>'balizas_triangulo', 'ok') <> 'ok'
 order by c.created_at;

-- b) Qué novedades quedan abiertas.
select v.patente, n.item, n.gravedad, n.titulo, n.created_at::date as desde
  from public.vehiculo_novedades n
  join public.vehiculos v on v.id = n.vehiculo_id
 where n.estado = 'abierta'
 order by n.gravedad desc, n.created_at;

-- c) AD778EL fuera de la flota, el resto intacto.
select patente, activo, checklist_activo
  from public.vehiculos
 where patente = 'AD778EL';

select count(*) filter (where activo)     as en_flota,
       count(*) filter (where not activo) as dadas_de_baja
  from public.vehiculos;
