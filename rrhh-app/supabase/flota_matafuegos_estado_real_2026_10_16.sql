-- ============================================================
-- Flota — estado real del matafuego y las balizas (16/10/2026, segunda tanda)
--
-- A la mañana se corrigió TODA la flota dando por hecho que la compra había
-- alcanzado para todas las unidades. La oficina pasó después el detalle y no
-- fue así, con lo cual esto deshace lo que no corresponde:
--
--   · Ford Ranger (AI433DK, AH797GH, AH797GK): tienen matafuego y balizas.
--     Quedan como están, no se tocan.
--   · Fiat Strada (AE268VT): tiene las dos cosas. Queda como está.
--   · Amarok cabina simple (AD113UY, Bahía Blanca): TIENE matafuego pero está
--     VENCIDO. O sea que el checklist de hoy 11:43 ("Vencido y sin presion")
--     decía la verdad y la corrección de la mañana lo tapó. Vuelve a "Mal".
--   · Berlingo (AG491JU): pendiente de revisión. Vuelve a lo que reportó quien
--     manejaba ("No tiene") hasta que se confirme.
--   · Amarok de Rosario (AF540SP, AG048TW): no entraron en la compra de
--     balizas. Vuelven a "No tiene".
--   · Partner (AH928EQ): pendiente de revisión, pero nunca hizo un checklist,
--     así que no hay nada que tocar.
--
-- Las notas vuelven a ser las de quien manejaba, sin la línea que les había
-- agregado la corrección de la mañana.
--
-- Nota: las balizas triangulares salieron del checklist a la mañana y VOLVIERON
-- el mismo día (commit 640ac66), así que su respuesta vuelve a contar para el
-- resultado. No cambia ningún valor de los de abajo —balizas no es un ítem
-- crítico—, pero sí significa que el checklist las vuelve a preguntar.
--
-- Se puede correr más de una vez.
-- ============================================================

begin;

-- ------------------------------------------------------------
-- 1. Los checklists vuelven a decir lo que se encontró
-- ------------------------------------------------------------
-- AF540SP · 2026-10-14 · balizas_triangulo: ok -> no_ok · resultado observaciones (sin cambio)
update public.vehiculo_checklists set
  respuestas  = respuestas || '{"balizas_triangulo":"no_ok"}'::jsonb,
  notas_items = notas_items || '{"balizas_triangulo":"no tiene"}'::jsonb,
  resultado   = 'observaciones'
where id = 'd52a94ff-5465-4cae-98c1-3fa65804373b';

-- AG048TW · 2026-10-14 · balizas_triangulo: ok -> no_ok · resultado observaciones (sin cambio)
update public.vehiculo_checklists set
  respuestas  = respuestas || '{"balizas_triangulo":"no_ok"}'::jsonb,
  notas_items = notas_items || '{"balizas_triangulo":"No tiene"}'::jsonb,
  resultado   = 'observaciones'
where id = '431a245e-dbc1-49f7-b181-b979729c6b28';

-- AG491JU · 2026-10-15 · matafuegos: ok -> no_ok | balizas_triangulo: ok -> no_ok · resultado observaciones -> no_apto
update public.vehiculo_checklists set
  respuestas  = respuestas || '{"matafuegos":"no_ok","balizas_triangulo":"no_ok"}'::jsonb,
  notas_items = notas_items || '{"matafuegos":"No tiene","balizas_triangulo":"No tiene"}'::jsonb,
  resultado   = 'no_apto'
where id = '67c5ddc9-6783-400c-9e8a-6d454af2661b';

-- AD113UY · 2026-10-16 · matafuegos: ok -> no_ok | balizas_triangulo: ok -> obs · resultado observaciones -> no_apto
update public.vehiculo_checklists set
  respuestas  = respuestas || '{"matafuegos":"no_ok","balizas_triangulo":"obs"}'::jsonb,
  notas_items = notas_items || '{"matafuegos":"Vencido y sin presion","balizas_triangulo":"No tiene"}'::jsonb,
  resultado   = 'no_apto'
where id = '1a86fcd0-528c-4fc5-9cf0-f7acde29542d';

-- ------------------------------------------------------------
-- 2. La novedad de la Berlingo vuelve a estar abierta
--    Es lo que la hace figurar "No apta para circular": el matafuego es un
--    ítem crítico y sigue sin confirmarse.
-- ------------------------------------------------------------
update public.vehiculo_novedades set
  estado      = 'abierta',
  resolucion  = null,
  resuelta_at = null,
  resuelta_por = null
where vehiculo_id = '8ee1ff93-cc5c-4d37-9dd6-83d65871b919'
  and item = 'matafuegos'
  and estado = 'resuelta';

-- ------------------------------------------------------------
-- 3. La novedad que le falta a AD113UY
--    Su checklist de hoy marcó el matafuego en "Mal" y la novedad nunca se
--    creó (el servidor se come el error si el insert falla). Sin ella la
--    camioneta figura apta con el matafuego vencido. El `where not exists`
--    es para poder correr esto más de una vez sin duplicarla.
-- ------------------------------------------------------------
insert into public.vehiculo_novedades
  (vehiculo_id, empresa_id, checklist_id, origen, item, titulo, descripcion, gravedad, reportado_por_nombre, km)
select '250d1927-e9bf-460a-b836-93ba7eaba12a', '0ad862c6-361d-49ea-8e8c-02db603805ff', '1a86fcd0-528c-4fc5-9cf0-f7acde29542d', 'checklist', 'matafuegos',
       'Matafuegos cargado, con precinto y carga vigente',
       'Vencido y sin presion. Confirmado por la oficina el 16/10/2026: la unidad tiene matafuego pero está vencido.',
       'alta', 'Moraga', 223939
where not exists (
  select 1 from public.vehiculo_novedades
   where vehiculo_id = '250d1927-e9bf-460a-b836-93ba7eaba12a' and item = 'matafuegos' and estado = 'abierta'
);

commit;

-- ============================================================
-- Verificación (correr después del commit)
-- ============================================================

-- a) Cómo queda el matafuego y las balizas en cada checklist.
select v.patente,
       c.created_at::date as fecha,
       c.respuestas->>'matafuegos'        as matafuego,
       c.respuestas->>'balizas_triangulo' as balizas,
       c.resultado
  from public.vehiculo_checklists c
  join public.vehiculos v on v.id = c.vehiculo_id
 order by c.created_at;

-- b) Las unidades no aptas para circular (novedades graves abiertas).
--    Tienen que aparecer la Berlingo (AG491JU) y la Amarok (AD113UY).
select v.patente, n.item, n.titulo, n.created_at::date as desde
  from public.vehiculo_novedades n
  join public.vehiculos v on v.id = n.vehiculo_id
 where n.estado = 'abierta' and n.gravedad = 'alta'
 order by n.created_at;
