-- ============================================================
-- Un objeto de R2 no puede estar registrado dos veces en `archivos`.
--
-- `recibos_sueldo` y `documentos_mensuales` ya tienen su índice único sobre
-- `path` (migraciones 15 y 17); `archivos` era la única de las tres sin él. Junto
-- con la validación de path que faltaba en `/api/upload` (agregada el 14/09/2026),
-- cierra el camino por el que una fila podía apuntar al archivo de otra empresa y
-- lograr que `GET /api/archivo` lo firmara.
--
-- ANTES de aplicar, comprobar que no haya duplicados (debería devolver 0 filas):
--
--   select path, count(*) from archivos group by path having count(*) > 1;
--
-- Si devolviera alguna, revisar esas filas a mano antes de crear el índice: son
-- justamente las que habría que mirar con atención.
--
-- Aplicar en el SQL editor de Supabase. PENDIENTE de aplicar en prod.
-- ============================================================

create unique index if not exists archivos_path_idx on archivos (path);
