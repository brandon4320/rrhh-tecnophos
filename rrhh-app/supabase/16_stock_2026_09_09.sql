-- ============================================================
-- Stock / Compras por empresa (vista "Stock" en el shell de RRHH).
--
-- Modelo: catálogo de ítems + libro de movimientos. El stock actual NO se
-- edita a mano: es la suma de movimientos (compra +, consumo −, ajuste ±).
-- Así la oficinista registra rápido cada compra y el sistema responde
-- cuánto hay, qué está bajo el mínimo y cuánto se gastó en el mes.
--
-- stock_movimientos.empresa_id está denormalizado a propósito: la RLS
-- queda idéntica a la del resto de RRHH (app_es_rrhh() and
-- app_ve_empresa(empresa_id)) sin subconsulta por movimiento.
--
-- Aplicar en el SQL editor de Supabase. PENDIENTE de aplicar en prod.
-- ============================================================

create table if not exists stock_items (
  id            uuid primary key default gen_random_uuid(),
  empresa_id    uuid not null references empresas(id) on delete cascade,
  nombre        text not null,
  categoria     text,                                  -- libre: "Limpieza", "Insumos fumigación", "Librería"…
  unidad        text not null default 'unidad',        -- unidad, litro, kg, caja, bidón…
  stock_minimo  numeric(12,2) not null default 0,      -- 0 = sin alerta de mínimo
  activo        boolean not null default true,         -- false = archivado (conserva historial)
  notas         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (empresa_id, nombre)
);
create index if not exists stock_items_empresa_idx on stock_items (empresa_id, activo);

create table if not exists stock_movimientos (
  id              uuid primary key default gen_random_uuid(),
  item_id         uuid not null references stock_items(id) on delete cascade,
  empresa_id      uuid not null references empresas(id) on delete cascade,
  tipo            text not null check (tipo in ('compra','consumo','ajuste')),
  -- compra/consumo: siempre positiva. ajuste: con signo (diferencia contra el stock contado).
  cantidad        numeric(12,2) not null check (tipo = 'ajuste' or cantidad > 0),
  fecha           date not null default current_date,
  proveedor       text,
  precio_unitario numeric(14,2),                       -- ARS, opcional (solo tiene sentido en compras)
  comprobante     text,                                -- nro de factura / remito
  notas           text,
  created_by      uuid references auth.users(id),
  created_at      timestamptz not null default now()
);
create index if not exists stock_movimientos_item_idx on stock_movimientos (item_id, fecha desc);
create index if not exists stock_movimientos_empresa_fecha_idx on stock_movimientos (empresa_id, fecha desc);

alter table stock_items       enable row level security;
alter table stock_movimientos enable row level security;

drop policy if exists "stock_items_rrhh_all" on stock_items;
create policy "stock_items_rrhh_all" on stock_items for all to authenticated
  using ( app_es_rrhh() and app_ve_empresa(empresa_id) )
  with check ( app_es_rrhh() and app_ve_empresa(empresa_id) );

drop policy if exists "stock_movimientos_rrhh_all" on stock_movimientos;
create policy "stock_movimientos_rrhh_all" on stock_movimientos for all to authenticated
  using ( app_es_rrhh() and app_ve_empresa(empresa_id) )
  with check ( app_es_rrhh() and app_ve_empresa(empresa_id) );
