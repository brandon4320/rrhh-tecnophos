-- ============================================================
-- Categoría de documentos de empresa en `certificados`:
--   null                  = habilitación de empresa (default histórico)
--   'programa_seguridad'  = programas de seguridad (sección propia
--                           en la vista Documentación)
-- Solo tiene sentido en certificados con empresa_id (dueño empresa).
-- Aplicada en prod el 2026-08-20.
-- ============================================================

alter table certificados add column if not exists categoria text;
