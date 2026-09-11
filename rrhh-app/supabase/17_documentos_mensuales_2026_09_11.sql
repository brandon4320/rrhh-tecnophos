-- ============================================================
-- Documentación mensual por empresa (vista "Doc. mensual" en el shell de RRHH).
--
-- Réplica de las carpetas que la oficinista mantiene en disco:
--   AÑO → MES → { Aportes sindicales, ART, F931, Pagos, Recibos de sueldos, SVO }
--   + archivos sueltos del mes (constancia ARCA, ART-06-07, SVO firmado…).
--
-- Las carpetas NO son filas: son un atributo del archivo (`carpeta`). Las seis
-- fijas viven en código (modules/documentos/reglas.ts::CARPETAS_FIJAS) y se
-- muestran siempre, aunque estén vacías, para que cada mes tenga el mismo
-- orden. `carpeta = ''` = raíz del mes (archivos sueltos). Se admiten
-- carpetas extra escritas a mano.
--
-- Son documentos de la EMPRESA (F931, ART, SVO…). Lo que es de cada persona
-- (recibo de sueldo) ya vive en recibos_sueldo, colgado del empleado; la
-- carpeta "Recibos de sueldos" de un mes muestra cuántos empleados tienen el
-- suyo y además acepta el PDF del lote si lo guardan así.
--
-- `origen` + `clave_externa`: hoy todo entra 'manual' desde la UI. Cuando
-- exista la descarga automática desde ARCA/ART/etc., ese proceso inserta con
-- origen='automatico' y una clave_externa estable (p. ej. 'f931-2026-07')
-- para poder re-correr sin duplicar. La UI no cambia.
--
-- RLS idéntica al resto de RRHH: app_es_rrhh() and app_ve_empresa(empresa_id).
-- Aplicar en el SQL editor de Supabase. PENDIENTE de aplicar en prod.
-- ============================================================

create table if not exists documentos_mensuales (
  id             uuid primary key default gen_random_uuid(),
  empresa_id     uuid not null references empresas(id) on delete cascade,
  periodo        date not null,                        -- primer día del mes: 2026-07-01
  carpeta        text not null default '',             -- '' = archivos sueltos del mes
  nombre_archivo text not null,
  path           text not null,                        -- objeto en R2
  mime_type      text,
  size_bytes     int,
  notas          text,
  origen         text not null default 'manual' check (origen in ('manual','automatico')),
  clave_externa  text,                                 -- id estable del proceso automático (opcional)
  uploaded_by    uuid references auth.users(id),
  created_at     timestamptz not null default now(),
  check (periodo = date_trunc('month', periodo)::date)
);
create index if not exists documentos_mensuales_empresa_periodo_idx on documentos_mensuales (empresa_id, periodo desc);
create unique index if not exists documentos_mensuales_path_idx on documentos_mensuales (path);
create unique index if not exists documentos_mensuales_clave_externa_idx
  on documentos_mensuales (empresa_id, clave_externa) where clave_externa is not null;

alter table documentos_mensuales enable row level security;

drop policy if exists "documentos_mensuales_rrhh_all" on documentos_mensuales;
create policy "documentos_mensuales_rrhh_all" on documentos_mensuales for all to authenticated
  using ( app_es_rrhh() and app_ve_empresa(empresa_id) )
  with check ( app_es_rrhh() and app_ve_empresa(empresa_id) );
