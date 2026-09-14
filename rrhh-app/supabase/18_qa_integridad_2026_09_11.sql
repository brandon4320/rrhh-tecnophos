-- ============================================================
-- Integridad que salió de la revisión de código del 2026-09-11 (QA audit).
--
-- 1) Slugs reservados. `GET /api/archivo` decide la tabla dueña de un archivo
--    por el prefijo de la clave en R2: `recibos/…` → recibos_sueldo,
--    `documentos/…` → documentos_mensuales, el resto → archivos (cuya clave
--    empieza con el slug de la empresa). Una empresa con slug `recibos` o
--    `documentos` rompería ese despacho; `docs` es el fallback del código.
--    Hasta hoy las empresas se crean solo por SQL: esta CHECK es la única
--    guarda real.
--
-- 2) stock_movimientos.empresa_id está denormalizado (para que la RLS sea la
--    misma de RRHH) pero nada lo ataba a la empresa del ítem: un movimiento
--    podía apuntar a un ítem de OTRA empresa y quedar invisible para ambas.
--    FK compuesta (item_id, empresa_id) → stock_items(id, empresa_id).
--
-- Aplicar en el SQL editor de Supabase. PENDIENTE de aplicar en prod.
-- Si la CHECK de slug falla al aplicarse, hay un slug con mayúsculas o
-- caracteres raros: revisar `select slug from empresas` antes de forzar.
-- ============================================================

alter table empresas
  drop constraint if exists empresas_slug_formato,
  add constraint empresas_slug_formato
    check (slug ~ '^[a-z0-9][a-z0-9-]*$' and slug not in ('recibos', 'documentos', 'docs'));

alter table stock_items
  drop constraint if exists stock_items_id_empresa_uniq,
  add constraint stock_items_id_empresa_uniq unique (id, empresa_id);

alter table stock_movimientos
  drop constraint if exists stock_movimientos_item_empresa_fkey,
  add constraint stock_movimientos_item_empresa_fkey
    foreign key (item_id, empresa_id) references stock_items (id, empresa_id) on delete cascade;
