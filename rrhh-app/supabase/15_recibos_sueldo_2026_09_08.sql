-- ============================================================
-- Comprobantes de sueldo por empleado (sección "Comprobantes de sueldo"
-- en el legajo). Un archivo por período y tipo, guardado en R2 con el
-- mismo circuito que los adjuntos de certificados (URL prefirmada).
--
-- NO son certificados: no vencen, no entran en /vencimientos ni en los
-- conteos de certificados. Tabla propia colgada de empleados.
--
-- `origen`: hoy todo es 'manual' (alguien lo sube desde el legajo).
-- Queda 'automatico' para cuando exista la carga automática desde el
-- sistema de liquidación — la clave única (empleado, periodo, tipo)
-- hace que ese proceso pueda insertar/actualizar sin duplicar.
--
-- RLS: espejo exacto de la de empleados (app_es_rrhh() and
-- app_ve_empresa(empresa del empleado)) — ver LEGAJO_ESCRITURA en la UI.
-- Aplicar en el SQL editor de Supabase. PENDIENTE de aplicar en prod.
-- ============================================================

create table if not exists recibos_sueldo (
  id             uuid primary key default gen_random_uuid(),
  empleado_id    uuid not null references empleados(id) on delete cascade,
  periodo        date not null,                       -- primer día del mes liquidado: 2026-08-01
  tipo           text not null default 'mensual'
                 check (tipo in ('mensual','sac','liquidacion_final','otro')),
  nombre_archivo text not null,
  path           text not null,                       -- objeto en R2
  mime_type      text,
  size_bytes     int,
  notas          text,
  origen         text not null default 'manual' check (origen in ('manual','automatico')),
  uploaded_by    uuid references auth.users(id),
  created_at     timestamptz not null default now(),
  unique (empleado_id, periodo, tipo)
);
create index if not exists recibos_sueldo_empleado_idx on recibos_sueldo (empleado_id, periodo desc);
create unique index if not exists recibos_sueldo_path_idx on recibos_sueldo (path);

alter table recibos_sueldo enable row level security;

drop policy if exists "recibos_rrhh_all" on recibos_sueldo;
create policy "recibos_rrhh_all" on recibos_sueldo for all to authenticated
  using (
    app_es_rrhh() and exists (
      select 1 from empleados e
      where e.id = recibos_sueldo.empleado_id and app_ve_empresa(e.empresa_id)
    )
  )
  with check (
    app_es_rrhh() and exists (
      select 1 from empleados e
      where e.id = recibos_sueldo.empleado_id and app_ve_empresa(e.empresa_id)
    )
  );
