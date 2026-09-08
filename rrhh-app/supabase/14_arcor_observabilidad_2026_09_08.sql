-- ============================================================
-- Observabilidad del sistema ARCOR (certificados de fumigación de
-- contenedores) dentro de Gestión: sección "Tecnophos - ARCOR".
--
-- Módulo independiente: tablas arcor_*, sin FKs cruzadas con RRHH ni
-- Comercial (regla de arquitectura, AGENTS.md §2).
--
-- Quién ESCRIBE: solo el servicio FastAPI / n8n de ARCOR (droplet), vía
--   POST /api/arcor/ingest  — corre con service role y valida un token
--   cuyo sha256 vive en arcor_config. Ningún usuario escribe desde el
--   navegador: NO hay policies de insert/update/delete para authenticated.
--
-- Quién LEE: roles RRHH que ven todas las empresas
--   (app_es_rrhh() and app_ve_todas_empresas())
--   = espejo exacto de puedeVerArcor() en src/modules/arcor/acceso.ts.
--
-- Aplicar en el SQL editor de Supabase. PENDIENTE de aplicar en prod.
-- ============================================================

-- 1) Contenedores: una fila por certificado (espejo de la planilla de Sheets)
create table if not exists arcor_contenedores (
  id            uuid primary key default gen_random_uuid(),
  fecha         date not null,                    -- fecha del certificado (manda el papel, regla 01/09)
  contenedor    text not null,                    -- ISO 6346; '(ilegible)-<hash>' si no se pudo leer
  booking       text,
  oe            text,
  lugar         text not null check (lugar in ('BUENOS AIRES','CORDOBA','MENDOZA','ROSARIO')),
  observaciones text,
  estado        text not null default 'encontrado'
                check (estado in ('encontrado','pendiente_arcor','revisar_foto','descartado')),
  origen        text check (origen in ('whatsapp','manual','respuesta_arcor','conciliacion','backfill')),
  mes           text not null,                    -- pestaña del Sheets: 'AGOSTO 2026'
  publicado     boolean not null default false,   -- certificado publicado en Colabora
  hash_imagen   text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  -- Misma clave que el appendOrUpdate del Sheets (N° DE CONTENEDOR dentro de la pestaña).
  unique (contenedor, mes)
);
create index if not exists arcor_contenedores_fecha_idx on arcor_contenedores (fecha desc);
create index if not exists arcor_contenedores_mes_idx   on arcor_contenedores (mes);

-- 2) Eventos: el log de todo lo que pasa (cargas, alertas, recuperaciones)
create table if not exists arcor_eventos (
  id           uuid primary key default gen_random_uuid(),
  ts           timestamptz not null default now(),
  tipo         text not null,        -- contenedor_cargado | contenedor_pendiente | lectura_dudosa |
                                     -- whatsapp_estado | claude_credito | ocr_fallo | arcor_login |
                                     -- workflow_error | conciliacion | imagen_ignorada | ...
  severidad    text not null default 'info' check (severidad in ('info','warning','critical')),
  titulo       text not null,
  detalle      jsonb,
  origen       text,                 -- servicio | wf0 | wf10 | wf12 | wf13 | backfill
  clave_alerta text,                 -- alertas CON ESTADO (una abierta por clave): whatsapp | claude | ocr | arcor
  resuelto_en  timestamptz,
  created_at   timestamptz not null default now()
);
create index if not exists arcor_eventos_ts_idx on arcor_eventos (ts desc);
create index if not exists arcor_eventos_abiertas_idx on arcor_eventos (clave_alerta)
  where resuelto_en is null and clave_alerta is not null;

-- 3) Estado actual del sistema: clave -> último valor conocido
create table if not exists arcor_estado (
  clave      text primary key,       -- whatsapp | claude | heartbeat | publicaciones
  valor      jsonb not null,
  updated_at timestamptz not null default now()
);

-- 4) Configuración del módulo (la lee SOLO el service role: sin policies)
create table if not exists arcor_config (
  clave      text primary key,
  valor      text not null,
  updated_at timestamptz not null default now()
);

-- ── RLS ──────────────────────────────────────────────────────────────────
alter table arcor_contenedores enable row level security;
alter table arcor_eventos      enable row level security;
alter table arcor_estado       enable row level security;
alter table arcor_config       enable row level security;

drop policy if exists "arcor_contenedores_select" on arcor_contenedores;
create policy "arcor_contenedores_select" on arcor_contenedores for select to authenticated
  using ( app_es_rrhh() and app_ve_todas_empresas() );

drop policy if exists "arcor_eventos_select" on arcor_eventos;
create policy "arcor_eventos_select" on arcor_eventos for select to authenticated
  using ( app_es_rrhh() and app_ve_todas_empresas() );

drop policy if exists "arcor_estado_select" on arcor_estado;
create policy "arcor_estado_select" on arcor_estado for select to authenticated
  using ( app_es_rrhh() and app_ve_todas_empresas() );

-- arcor_config: RLS activa y SIN policies -> invisible para authenticated.

-- ── Token del ingest ──────────────────────────────────────────────────────
-- sha256 (hex) del token que vive en GESTION_INGEST_TOKEN del .env del droplet
-- (/opt/arcor/vps/.env). El token en claro está en Bitwarden.
-- Rotar: generar token nuevo -> insertar acá su sha256 -> actualizar el .env
-- del droplet -> `docker compose up -d servicio`.
insert into arcor_config (clave, valor)
values ('ingest_token_hash', 'ad23e2808bf25fad60b4b0f80b223e0ab36521dc4410146ab719debacca02007')
on conflict (clave) do update set valor = excluded.valor, updated_at = now();
