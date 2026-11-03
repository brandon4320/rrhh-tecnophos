-- ============================================================
-- 31 — Firma de recibos de sueldo (03/11/2026)
--
-- Cada empleado recibe por mail un link personal, confirma los últimos 4 dígitos
-- de su CUIL, ve sus recibos del mes y los firma. El firmado queda en su legajo.
--
-- Esta migración es SOLO la estructura. El proceso que lee los PDF del NAS, el
-- envío de los mails y la pantalla de control vienen después y se apoyan acá.
--
-- Decisiones que se ven en el schema:
--
--  · `recibos_sueldo` se EXTIENDE, no se reemplaza: el recibo sigue siendo la
--    misma fila, ahora con estado de firma. El PDF original NO se pisa nunca;
--    el firmado va aparte. Si alguna vez hay una discusión, están los dos.
--  · La firma dibujada va en su propia tabla y no como columna de `empleados`:
--    es más sensible que un nombre y merece su propia RLS. Cualquiera de RRHH
--    ve la lista de empleados; la imagen de la firma, no.
--  · De los tokens se guarda solo el sha256. Quien tenga la base no puede
--    fabricar un link.
--  · "Un solo mail por día por empleado" lo garantiza un índice único, no el
--    código: si dos procesos corren a la vez, la base rechaza el segundo.
--    Mismo criterio que `flota_avisos`.
--  · `recibo_cargas` deja constancia AUNQUE no haya nada nuevo. Eso es lo que
--    convierte el silencio en alarma: si la última corrida es de hace dos días,
--    algo se rompió y hay que avisar.
--
-- RLS: todo lo nuevo es de LECTURA y solo para quien tiene `ve_recibos`
-- (hoy Brandon y Mariano). **No hay policies de escritura**: escribe el server
-- con service role después de validar el token, igual que el QR de la flota.
-- Las tablas no tienen policies para anon.
--
-- Se puede correr más de una vez.
-- ============================================================

begin;

-- ------------------------------------------------------------
-- 1. Estado de firma en el recibo
-- ------------------------------------------------------------
alter table public.recibos_sueldo
  add column if not exists estado         text not null default 'pendiente',
  add column if not exists firmado_at     timestamptz,
  add column if not exists firmado_path   text,
  add column if not exists firma_ip       text,
  add column if not exists firma_agente   text,
  add column if not exists origen_archivo text,
  add column if not exists origen_hash    text;

comment on column public.recibos_sueldo.firmado_path is
  'PDF con la firma estampada. El original queda intacto en `path`.';
comment on column public.recibos_sueldo.origen_hash is
  'sha256 del PDF del recibo. Hace idempotente la carga automática.';

alter table public.recibos_sueldo drop constraint if exists recibos_estado_check;
alter table public.recibos_sueldo add constraint recibos_estado_check
  check (estado in ('pendiente', 'firmado', 'anulado'));

-- Un recibo firmado SIEMPRE tiene fecha y archivo firmado. Sin esto, un error a
-- mitad de camino deja una fila que dice "firmado" sin nada que lo respalde.
alter table public.recibos_sueldo drop constraint if exists recibos_firmado_completo;
alter table public.recibos_sueldo add constraint recibos_firmado_completo
  check (estado <> 'firmado' or (firmado_at is not null and firmado_path is not null));

-- El mismo PDF no entra dos veces, aunque el proceso corra de nuevo.
create unique index if not exists recibos_origen_hash_idx
  on public.recibos_sueldo (origen_hash) where origen_hash is not null;

create index if not exists recibos_estado_idx
  on public.recibos_sueldo (estado, periodo) where estado = 'pendiente';

-- ------------------------------------------------------------
-- 2. La firma guardada de cada empleado
-- ------------------------------------------------------------
create table if not exists public.firmas_empleado (
  id             uuid primary key default gen_random_uuid(),
  empleado_id    uuid not null unique references public.empleados(id) on delete cascade,
  path           text not null,                    -- PNG en R2
  ancho          int,
  alto           int,
  created_at     timestamptz not null default now(),
  actualizada_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- 3. Los links de firma
-- ------------------------------------------------------------
create table if not exists public.recibo_tokens (
  id              uuid primary key default gen_random_uuid(),
  empleado_id     uuid not null references public.empleados(id) on delete cascade,
  -- sha256 del token en hexadecimal. El token en claro vive solo en el mail.
  token_hash      text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  vence_at        timestamptz not null,
  revocado        boolean not null default false,
  -- Freno a quien pruebe los últimos 4 del CUIL hasta acertar: son 10.000
  -- combinaciones, cuestión de minutos sin un bloqueo.
  intentos        int not null default 0,
  bloqueado_hasta timestamptz,
  ultimo_uso_at   timestamptz,
  created_at      timestamptz not null default now()
);
create index if not exists recibo_tokens_empleado_idx on public.recibo_tokens (empleado_id);
-- Pueden convivir varios vigentes del mismo empleado: si alguien abre el mail de
-- la semana pasada, tiene que funcionar igual.
create index if not exists recibo_tokens_vigentes_idx
  on public.recibo_tokens (empleado_id, vence_at) where not revocado;

-- ------------------------------------------------------------
-- 4. Registro de los mails enviados
-- ------------------------------------------------------------
create table if not exists public.recibo_mails (
  id            uuid primary key default gen_random_uuid(),
  empleado_id   uuid not null references public.empleados(id) on delete cascade,
  tipo          text not null check (tipo in ('aviso', 'recordatorio', 'copia_firmada', 'alerta')),
  -- El día en hora ARGENTINA: a las 21:00 de acá ya es mañana en UTC y el tope
  -- de "uno por día" se correría de lugar (AGENTS.md §9).
  dia           date not null default (now() at time zone 'America/Argentina/Buenos_Aires')::date,
  destinatario  text not null,
  asunto        text,
  recibos       jsonb not null default '[]'::jsonb,
  token_id      uuid references public.recibo_tokens(id) on delete set null,
  estado        text not null default 'enviado' check (estado in ('enviado', 'error')),
  error         text,
  created_at    timestamptz not null default now()
);

-- ★ El "máximo un mail por día por empleado" vive ACÁ y no en el código.
-- Un mail que falló no cuenta: se puede reintentar el mismo día.
create unique index if not exists recibo_mails_uno_por_dia
  on public.recibo_mails (empleado_id, dia, tipo)
  where tipo in ('aviso', 'recordatorio') and estado = 'enviado';

create index if not exists recibo_mails_empleado_idx on public.recibo_mails (empleado_id, created_at desc);

-- ------------------------------------------------------------
-- 5. Registro de cada corrida del proceso que lee el NAS
-- ------------------------------------------------------------
create table if not exists public.recibo_cargas (
  id              uuid primary key default gen_random_uuid(),
  origen          text not null default 'automatico' check (origen in ('automatico', 'manual')),
  base            text,          -- base de Jaque (1, 3-ADC…)
  carpeta         text,          -- carpeta mirada en el NAS
  inicio_at       timestamptz not null default now(),
  fin_at          timestamptz,
  pdf_encontrados int not null default 0,
  recibos_nuevos  int not null default 0,
  ya_estaban      int not null default 0,
  errores         int not null default 0,
  -- Cuántas personas liquidó Jaque ese período. Es contra esto que se concilia:
  -- "no hubo errores" no quiere decir que estén todos.
  esperados       int,
  detalle         jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now()
);
create index if not exists recibo_cargas_fecha_idx on public.recibo_cargas (created_at desc);

-- ------------------------------------------------------------
-- 6. RLS — lectura solo con ve_recibos, ninguna escritura
-- ------------------------------------------------------------
alter table public.firmas_empleado enable row level security;
alter table public.recibo_tokens   enable row level security;
alter table public.recibo_mails    enable row level security;
alter table public.recibo_cargas   enable row level security;

-- Mismo molde que la policy de recibos_sueldo (migración 23), en la forma rápida
-- de la migración 21: los helpers van envueltos en (select ...) para que Postgres
-- los evalúe UNA vez por consulta y no una vez por fila.
drop policy if exists firmas_empleado_lectura on public.firmas_empleado;
create policy firmas_empleado_lectura on public.firmas_empleado for select
  using ((select app_es_rrhh()) and (select app_ve_recibos()) and exists (
    select 1 from empleados e where e.id = firmas_empleado.empleado_id
      and ((select app_ve_todas_empresas()) or e.empresa_id = (select app_empresa_acceso()))));

drop policy if exists recibo_tokens_lectura on public.recibo_tokens;
create policy recibo_tokens_lectura on public.recibo_tokens for select
  using ((select app_es_rrhh()) and (select app_ve_recibos()) and exists (
    select 1 from empleados e where e.id = recibo_tokens.empleado_id
      and ((select app_ve_todas_empresas()) or e.empresa_id = (select app_empresa_acceso()))));

drop policy if exists recibo_mails_lectura on public.recibo_mails;
create policy recibo_mails_lectura on public.recibo_mails for select
  using ((select app_es_rrhh()) and (select app_ve_recibos()) and exists (
    select 1 from empleados e where e.id = recibo_mails.empleado_id
      and ((select app_ve_todas_empresas()) or e.empresa_id = (select app_empresa_acceso()))));

-- Las cargas no tienen empleado: son conteos del proceso.
drop policy if exists recibo_cargas_lectura on public.recibo_cargas;
create policy recibo_cargas_lectura on public.recibo_cargas for select
  using ((select app_es_rrhh()) and (select app_ve_recibos()));

-- ------------------------------------------------------------
-- 7. Auditoría
-- ------------------------------------------------------------
-- `recibos_sueldo` ya está auditada (migración 28) y sus columnas nuevas entran
-- solas, porque el trigger compara la fila entera.
--
-- Se suma `firmas_empleado`: cambiar la firma de alguien es exactamente lo que
-- hay que poder rastrear.
--
-- NO se auditan `recibo_tokens`, `recibo_mails` ni `recibo_cargas`: las escribe
-- el sistema, no una persona, son de mucho volumen y su propio contenido ya es
-- el registro. Auditar los tokens además duplicaría sus hashes.
drop trigger if exists trg_auditoria on public.firmas_empleado;
create trigger trg_auditoria
  after insert or update or delete on public.firmas_empleado
  for each row execute function public.app_auditar();

commit;

-- ============================================================
-- Verificación (correr después del commit)
-- ============================================================

-- a) Las cuatro tablas nuevas, con RLS prendida y sin policies de escritura.
select c.relname as tabla,
       c.relrowsecurity as rls_prendida,
       count(p.polname) filter (where p.polcmd = 'r') as policies_lectura,
       count(p.polname) filter (where p.polcmd <> 'r') as policies_escritura
  from pg_class c
  left join pg_policy p on p.polrelid = c.oid
 where c.relname in ('firmas_empleado', 'recibo_tokens', 'recibo_mails', 'recibo_cargas')
 group by c.relname, c.relrowsecurity
 order by c.relname;

-- b) Las columnas nuevas de recibos_sueldo.
select column_name, data_type, column_default
  from information_schema.columns
 where table_name = 'recibos_sueldo'
   and column_name in ('estado', 'firmado_at', 'firmado_path', 'firma_ip', 'firma_agente', 'origen_archivo', 'origen_hash')
 order by column_name;

-- c) Que el tope de un mail por día esté como índice y no como promesa.
select indexname from pg_indexes
 where tablename in ('recibo_mails', 'recibos_sueldo', 'recibo_tokens')
 order by indexname;
