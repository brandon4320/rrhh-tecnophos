-- ============================================================
-- MÓDULO: Gestión Comercial (2026-06-18)
--   1) Actualizar CHECK constraint de perfiles.rol
--   2) Crear tablas del módulo comercial
--   3) Índices
--   4) RLS
-- ============================================================

-- ------------------------------------------------------------
-- 1) ACTUALIZAR CHECK CONSTRAINT DE perfiles.rol
-- ------------------------------------------------------------
alter table perfiles
  drop constraint if exists perfiles_rol_check;

alter table perfiles
  add constraint perfiles_rol_check check (
    rol in (
      'admin',
      'usuario',
      'admin_adc',
      'supervisor',
      'operario',
      'admin_unipar',
      'direccion',
      'gerente_comercial',
      'vendedor',
      'asistente_comercial'
    )
  );

-- ------------------------------------------------------------
-- 2) FUNCIÓN HELPER para módulo comercial
-- ------------------------------------------------------------
create or replace function app_es_comercial() returns boolean
  language sql stable security definer set search_path = public as
$$ select app_rol() in ('admin','direccion','gerente_comercial','vendedor','asistente_comercial') $$;

create or replace function app_es_comercial_gestion() returns boolean
  language sql stable security definer set search_path = public as
$$ select app_rol() in ('admin','direccion','gerente_comercial') $$;

-- ------------------------------------------------------------
-- 3) TABLAS
-- ------------------------------------------------------------

-- Motivos de pérdida (sin FK circular, va antes de proyectos)
create table if not exists comercial_motivos_perdida (
  id          uuid primary key default gen_random_uuid(),
  nombre      text not null,
  descripcion text,
  activo      boolean default true,
  orden       int default 0,
  created_at  timestamptz default now()
);

insert into comercial_motivos_perdida (nombre, orden) values
  ('Precio',                    1),
  ('Sin respuesta',             2),
  ('Competencia',               3),
  ('Sin presupuesto',           4),
  ('Fuera de alcance',          5),
  ('Demora interna',            6),
  ('Cliente no calificado',     7),
  ('Cancelado por el cliente',  8),
  ('Otro',                      9)
on conflict do nothing;

-- Clientes
create table if not exists comercial_clientes (
  id                      uuid primary key default gen_random_uuid(),
  nombre                  text not null,
  razon_social            text,
  cuit_tax_id             text,
  tipo_cliente            text,
  rubro                   text,
  pais                    text,
  provincia_estado        text,
  ciudad                  text,
  direccion               text,
  web                     text,
  origen                  text,
  estado                  text not null default 'prospecto',
  prioridad               text not null default 'media',
  vendedor_asignado_id    uuid references perfiles(id) on delete set null,
  gerente_responsable_id  uuid references perfiles(id) on delete set null,
  notas                   text,
  created_at              timestamptz default now(),
  updated_at              timestamptz default now(),
  created_by              uuid references perfiles(id) on delete set null,
  updated_by              uuid references perfiles(id) on delete set null
);

-- Contactos
create table if not exists comercial_contactos (
  id                    uuid primary key default gen_random_uuid(),
  cliente_id            uuid not null references comercial_clientes(id) on delete cascade,
  nombre                text not null,
  apellido              text,
  cargo                 text,
  area                  text,
  email                 text,
  telefono              text,
  whatsapp              text,
  wechat                text,
  linkedin              text,
  idioma                text,
  pais                  text,
  es_contacto_principal boolean default false,
  estado                text not null default 'activo',
  notas                 text,
  created_at            timestamptz default now(),
  updated_at            timestamptz default now(),
  created_by            uuid references perfiles(id) on delete set null
);

-- Proyectos
create table if not exists comercial_proyectos (
  id                      uuid primary key default gen_random_uuid(),
  codigo                  text unique,
  titulo                  text not null,
  cliente_id              uuid references comercial_clientes(id) on delete set null,
  contacto_principal_id   uuid references comercial_contactos(id) on delete set null,
  responsable_id          uuid not null references perfiles(id),
  gerente_id              uuid references perfiles(id) on delete set null,
  tipo_proyecto           text,
  servicio_producto       text,
  etapa                   text not null default 'nuevo',
  estado                  text not null default 'abierto',
  prioridad               text not null default 'media',
  valor_estimado          numeric(14,2),
  moneda                  text default 'USD',
  probabilidad            int default 0,
  fecha_inicio            date default current_date,
  fecha_estimada_cierre   date,
  fecha_cierre_real       date,
  ultima_actividad_at     timestamptz,
  proxima_accion          text,
  proxima_accion_fecha    date,
  motivo_perdida_id       uuid references comercial_motivos_perdida(id) on delete set null,
  resultado_cierre        text,
  descripcion             text,
  notas_internas          text,
  created_at              timestamptz default now(),
  updated_at              timestamptz default now(),
  created_by              uuid references perfiles(id) on delete set null,
  updated_by              uuid references perfiles(id) on delete set null
);

-- Eventos (reuniones, llamadas, visitas)
create table if not exists comercial_eventos (
  id             uuid primary key default gen_random_uuid(),
  titulo         text not null,
  tipo           text not null default 'reunion',
  estado         text not null default 'programado',
  cliente_id     uuid references comercial_clientes(id) on delete set null,
  proyecto_id    uuid references comercial_proyectos(id) on delete cascade,
  contacto_id    uuid references comercial_contactos(id) on delete set null,
  responsable_id uuid not null references perfiles(id),
  fecha_inicio   timestamptz not null,
  fecha_fin      timestamptz,
  timezone       text default 'America/Argentina/Buenos_Aires',
  ubicacion      text,
  link_reunion   text,
  objetivo       text,
  resultado      text,
  proxima_accion text,
  created_at     timestamptz default now(),
  updated_at     timestamptz default now(),
  created_by     uuid references perfiles(id) on delete set null
);

-- Tareas
create table if not exists comercial_tareas (
  id                  uuid primary key default gen_random_uuid(),
  titulo              text not null,
  descripcion         text,
  tipo                text not null default 'otro',
  estado              text not null default 'pendiente',
  prioridad           text not null default 'media',
  responsable_id      uuid not null references perfiles(id),
  creador_id          uuid references perfiles(id) on delete set null,
  cliente_id          uuid references comercial_clientes(id) on delete set null,
  proyecto_id         uuid references comercial_proyectos(id) on delete cascade,
  contacto_id         uuid references comercial_contactos(id) on delete set null,
  evento_id           uuid references comercial_eventos(id) on delete set null,
  fecha_vencimiento   timestamptz,
  fecha_recordatorio  timestamptz,
  fecha_completada    timestamptz,
  resultado           text,
  bloqueada_motivo    text,
  created_at          timestamptz default now(),
  updated_at          timestamptz default now()
);

-- Viajes
create table if not exists comercial_viajes (
  id               uuid primary key default gen_random_uuid(),
  titulo           text not null,
  responsable_id   uuid not null references perfiles(id),
  pais             text,
  ciudad           text,
  fecha_inicio     date,
  fecha_fin        date,
  motivo           text,
  estado           text not null default 'planificado',
  costo_estimado   numeric(14,2),
  moneda           text default 'USD',
  notas            text,
  created_at       timestamptz default now(),
  updated_at       timestamptz default now(),
  created_by       uuid references perfiles(id) on delete set null
);

-- Viaje ↔ reuniones
create table if not exists comercial_viaje_reuniones (
  id          uuid primary key default gen_random_uuid(),
  viaje_id    uuid not null references comercial_viajes(id) on delete cascade,
  evento_id   uuid references comercial_eventos(id) on delete cascade,
  cliente_id  uuid references comercial_clientes(id) on delete set null,
  proyecto_id uuid references comercial_proyectos(id) on delete set null,
  orden       int default 0,
  notas       text
);

-- Notas
create table if not exists comercial_notas (
  id          uuid primary key default gen_random_uuid(),
  cliente_id  uuid references comercial_clientes(id) on delete cascade,
  proyecto_id uuid references comercial_proyectos(id) on delete cascade,
  contacto_id uuid references comercial_contactos(id) on delete set null,
  tarea_id    uuid references comercial_tareas(id) on delete set null,
  evento_id   uuid references comercial_eventos(id) on delete set null,
  usuario_id  uuid references perfiles(id) on delete set null,
  tipo        text not null default 'nota_general',
  contenido   text not null,
  visibilidad text not null default 'interna',
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

-- Archivos
create table if not exists comercial_archivos (
  id           uuid primary key default gen_random_uuid(),
  cliente_id   uuid references comercial_clientes(id) on delete cascade,
  proyecto_id  uuid references comercial_proyectos(id) on delete cascade,
  evento_id    uuid references comercial_eventos(id) on delete set null,
  subido_por   uuid references perfiles(id) on delete set null,
  nombre       text not null,
  path         text not null,
  mime_type    text,
  size_bytes   int,
  tipo_archivo text default 'otro',
  created_at   timestamptz default now()
);

-- Actividad (audit trail)
create table if not exists comercial_actividad (
  id          uuid primary key default gen_random_uuid(),
  tipo        text not null,
  cliente_id  uuid references comercial_clientes(id) on delete cascade,
  proyecto_id uuid references comercial_proyectos(id) on delete cascade,
  tarea_id    uuid references comercial_tareas(id) on delete set null,
  evento_id   uuid references comercial_eventos(id) on delete set null,
  viaje_id    uuid references comercial_viajes(id) on delete set null,
  usuario_id  uuid references perfiles(id) on delete set null,
  titulo      text not null,
  descripcion text,
  metadata    jsonb default '{}'::jsonb,
  created_at  timestamptz default now()
);

-- Config del módulo
create table if not exists comercial_config (
  clave      text primary key,
  valor      jsonb not null default '{}'::jsonb,
  updated_at timestamptz default now(),
  updated_by uuid references perfiles(id) on delete set null
);

insert into comercial_config (clave, valor) values
  ('dias_sin_movimiento_alerta', '7'),
  ('moneda_default', '"USD"'),
  ('etapas_activas', '["nuevo","contactado","reunion_agendada","relevamiento","cotizacion_pendiente","cotizacion_enviada","seguimiento","negociacion"]')
on conflict do nothing;

-- ------------------------------------------------------------
-- 4) TRIGGER updated_at
-- ------------------------------------------------------------
create or replace function set_updated_at()
  returns trigger language plpgsql as
$$ begin new.updated_at = now(); return new; end; $$;

create or replace trigger comercial_clientes_updated_at
  before update on comercial_clientes
  for each row execute function set_updated_at();

create or replace trigger comercial_contactos_updated_at
  before update on comercial_contactos
  for each row execute function set_updated_at();

create or replace trigger comercial_proyectos_updated_at
  before update on comercial_proyectos
  for each row execute function set_updated_at();

create or replace trigger comercial_eventos_updated_at
  before update on comercial_eventos
  for each row execute function set_updated_at();

create or replace trigger comercial_tareas_updated_at
  before update on comercial_tareas
  for each row execute function set_updated_at();

create or replace trigger comercial_viajes_updated_at
  before update on comercial_viajes
  for each row execute function set_updated_at();

create or replace trigger comercial_notas_updated_at
  before update on comercial_notas
  for each row execute function set_updated_at();

-- ------------------------------------------------------------
-- 5) ÍNDICES
-- ------------------------------------------------------------
create index if not exists idx_comercial_clientes_vendedor  on comercial_clientes(vendedor_asignado_id);
create index if not exists idx_comercial_clientes_estado    on comercial_clientes(estado);
create index if not exists idx_comercial_contactos_cliente  on comercial_contactos(cliente_id);
create index if not exists idx_comercial_proyectos_responsable on comercial_proyectos(responsable_id);
create index if not exists idx_comercial_proyectos_cliente  on comercial_proyectos(cliente_id);
create index if not exists idx_comercial_proyectos_estado   on comercial_proyectos(estado);
create index if not exists idx_comercial_proyectos_etapa    on comercial_proyectos(etapa);
create index if not exists idx_comercial_proyectos_prox_fecha on comercial_proyectos(proxima_accion_fecha);
create index if not exists idx_comercial_proyectos_ult_act  on comercial_proyectos(ultima_actividad_at);
create index if not exists idx_comercial_tareas_responsable on comercial_tareas(responsable_id);
create index if not exists idx_comercial_tareas_proyecto    on comercial_tareas(proyecto_id);
create index if not exists idx_comercial_tareas_estado      on comercial_tareas(estado);
create index if not exists idx_comercial_tareas_vencimiento on comercial_tareas(fecha_vencimiento);
create index if not exists idx_comercial_eventos_responsable on comercial_eventos(responsable_id);
create index if not exists idx_comercial_eventos_proyecto   on comercial_eventos(proyecto_id);
create index if not exists idx_comercial_eventos_fecha      on comercial_eventos(fecha_inicio);
create index if not exists idx_comercial_viajes_responsable on comercial_viajes(responsable_id);
create index if not exists idx_comercial_actividad_proyecto on comercial_actividad(proyecto_id);
create index if not exists idx_comercial_actividad_cliente  on comercial_actividad(cliente_id);
create index if not exists idx_comercial_actividad_fecha    on comercial_actividad(created_at desc);

-- ------------------------------------------------------------
-- 6) RLS
-- ------------------------------------------------------------
alter table comercial_motivos_perdida   enable row level security;
alter table comercial_clientes          enable row level security;
alter table comercial_contactos         enable row level security;
alter table comercial_proyectos         enable row level security;
alter table comercial_tareas            enable row level security;
alter table comercial_eventos           enable row level security;
alter table comercial_viajes            enable row level security;
alter table comercial_viaje_reuniones   enable row level security;
alter table comercial_notas             enable row level security;
alter table comercial_archivos          enable row level security;
alter table comercial_actividad         enable row level security;
alter table comercial_config            enable row level security;

-- Motivos de pérdida: lectura para todos los roles comerciales
drop policy if exists "motivos_comercial_select" on comercial_motivos_perdida;
create policy "motivos_comercial_select" on comercial_motivos_perdida
  for select to authenticated using ( app_es_comercial() );

drop policy if exists "motivos_comercial_write" on comercial_motivos_perdida;
create policy "motivos_comercial_write" on comercial_motivos_perdida
  for all to authenticated
  using ( app_es_comercial_gestion() )
  with check ( app_es_comercial_gestion() );

-- Config: solo gestión puede ver y escribir
drop policy if exists "config_comercial_select" on comercial_config;
create policy "config_comercial_select" on comercial_config
  for select to authenticated using ( app_es_comercial_gestion() );

drop policy if exists "config_comercial_write" on comercial_config;
create policy "config_comercial_write" on comercial_config
  for all to authenticated
  using ( app_es_comercial_gestion() )
  with check ( app_es_comercial_gestion() );

-- Clientes: gestión ve todos; vendedor ve los asignados a él; asistente puede leer e insertar
drop policy if exists "clientes_comercial_select" on comercial_clientes;
create policy "clientes_comercial_select" on comercial_clientes
  for select to authenticated using (
    app_es_comercial_gestion()
    or (app_rol() = 'vendedor'           and vendedor_asignado_id = auth.uid())
    or (app_rol() = 'asistente_comercial')
  );

drop policy if exists "clientes_comercial_insert" on comercial_clientes;
create policy "clientes_comercial_insert" on comercial_clientes
  for insert to authenticated with check ( app_es_comercial() );

drop policy if exists "clientes_comercial_update" on comercial_clientes;
create policy "clientes_comercial_update" on comercial_clientes
  for update to authenticated
  using (
    app_es_comercial_gestion()
    or (app_rol() = 'vendedor' and vendedor_asignado_id = auth.uid())
  )
  with check (
    app_es_comercial_gestion()
    or (app_rol() = 'vendedor' and vendedor_asignado_id = auth.uid())
  );

-- Contactos: misma lógica que clientes (a través del cliente)
drop policy if exists "contactos_comercial_select" on comercial_contactos;
create policy "contactos_comercial_select" on comercial_contactos
  for select to authenticated using (
    app_es_comercial_gestion()
    or app_rol() = 'asistente_comercial'
    or (app_rol() = 'vendedor' and exists (
      select 1 from comercial_clientes c
      where c.id = comercial_contactos.cliente_id
        and c.vendedor_asignado_id = auth.uid()
    ))
  );

drop policy if exists "contactos_comercial_insert" on comercial_contactos;
create policy "contactos_comercial_insert" on comercial_contactos
  for insert to authenticated with check ( app_es_comercial() );

drop policy if exists "contactos_comercial_update" on comercial_contactos;
create policy "contactos_comercial_update" on comercial_contactos
  for update to authenticated
  using (
    app_es_comercial_gestion()
    or app_rol() = 'asistente_comercial'
    or (app_rol() = 'vendedor' and exists (
      select 1 from comercial_clientes c
      where c.id = comercial_contactos.cliente_id
        and c.vendedor_asignado_id = auth.uid()
    ))
  )
  with check (
    app_es_comercial_gestion()
    or app_rol() = 'asistente_comercial'
    or (app_rol() = 'vendedor' and exists (
      select 1 from comercial_clientes c
      where c.id = comercial_contactos.cliente_id
        and c.vendedor_asignado_id = auth.uid()
    ))
  );

-- Proyectos: gestión ve todos; vendedor solo los propios; asistente puede leer
drop policy if exists "proyectos_comercial_select" on comercial_proyectos;
create policy "proyectos_comercial_select" on comercial_proyectos
  for select to authenticated using (
    app_es_comercial_gestion()
    or app_rol() = 'asistente_comercial'
    or (app_rol() = 'vendedor' and responsable_id = auth.uid())
  );

drop policy if exists "proyectos_comercial_insert" on comercial_proyectos;
create policy "proyectos_comercial_insert" on comercial_proyectos
  for insert to authenticated with check (
    app_es_comercial_gestion()
    or (app_rol() = 'vendedor' and responsable_id = auth.uid())
  );

drop policy if exists "proyectos_comercial_update" on comercial_proyectos;
create policy "proyectos_comercial_update" on comercial_proyectos
  for update to authenticated
  using (
    app_es_comercial_gestion()
    or (app_rol() = 'vendedor' and responsable_id = auth.uid())
  )
  with check (
    app_es_comercial_gestion()
    or (app_rol() = 'vendedor' and responsable_id = auth.uid())
  );

-- Tareas: gestión ve todas; vendedor y asistente ven las propias
drop policy if exists "tareas_comercial_select" on comercial_tareas;
create policy "tareas_comercial_select" on comercial_tareas
  for select to authenticated using (
    app_es_comercial_gestion()
    or responsable_id = auth.uid()
    or creador_id = auth.uid()
  );

drop policy if exists "tareas_comercial_insert" on comercial_tareas;
create policy "tareas_comercial_insert" on comercial_tareas
  for insert to authenticated with check ( app_es_comercial() );

drop policy if exists "tareas_comercial_update" on comercial_tareas;
create policy "tareas_comercial_update" on comercial_tareas
  for update to authenticated
  using ( app_es_comercial_gestion() or responsable_id = auth.uid() )
  with check ( app_es_comercial_gestion() or responsable_id = auth.uid() );

-- Eventos: gestión ve todos; otros ven los propios
drop policy if exists "eventos_comercial_select" on comercial_eventos;
create policy "eventos_comercial_select" on comercial_eventos
  for select to authenticated using (
    app_es_comercial_gestion()
    or responsable_id = auth.uid()
    or created_by = auth.uid()
  );

drop policy if exists "eventos_comercial_insert" on comercial_eventos;
create policy "eventos_comercial_insert" on comercial_eventos
  for insert to authenticated with check ( app_es_comercial() );

drop policy if exists "eventos_comercial_update" on comercial_eventos;
create policy "eventos_comercial_update" on comercial_eventos
  for update to authenticated
  using ( app_es_comercial_gestion() or responsable_id = auth.uid() )
  with check ( app_es_comercial_gestion() or responsable_id = auth.uid() );

-- Viajes: gestión ve todos; otros ven los propios
drop policy if exists "viajes_comercial_select" on comercial_viajes;
create policy "viajes_comercial_select" on comercial_viajes
  for select to authenticated using (
    app_es_comercial_gestion()
    or responsable_id = auth.uid()
  );

drop policy if exists "viajes_comercial_insert" on comercial_viajes;
create policy "viajes_comercial_insert" on comercial_viajes
  for insert to authenticated with check ( app_es_comercial() );

drop policy if exists "viajes_comercial_update" on comercial_viajes;
create policy "viajes_comercial_update" on comercial_viajes
  for update to authenticated
  using ( app_es_comercial_gestion() or responsable_id = auth.uid() )
  with check ( app_es_comercial_gestion() or responsable_id = auth.uid() );

-- Viaje reuniones: sigue al viaje
drop policy if exists "viaje_reuniones_comercial_select" on comercial_viaje_reuniones;
create policy "viaje_reuniones_comercial_select" on comercial_viaje_reuniones
  for select to authenticated using (
    app_es_comercial_gestion()
    or exists (
      select 1 from comercial_viajes v
      where v.id = comercial_viaje_reuniones.viaje_id
        and (app_es_comercial_gestion() or v.responsable_id = auth.uid())
    )
  );

drop policy if exists "viaje_reuniones_comercial_write" on comercial_viaje_reuniones;
create policy "viaje_reuniones_comercial_write" on comercial_viaje_reuniones
  for all to authenticated
  using ( app_es_comercial() )
  with check ( app_es_comercial() );

-- Notas: comercial puede leer/escribir según su scope
drop policy if exists "notas_comercial_select" on comercial_notas;
create policy "notas_comercial_select" on comercial_notas
  for select to authenticated using (
    app_es_comercial_gestion()
    or usuario_id = auth.uid()
    or (app_rol() = 'vendedor' and (
      exists (select 1 from comercial_proyectos p where p.id = comercial_notas.proyecto_id and p.responsable_id = auth.uid())
      or exists (select 1 from comercial_clientes c where c.id = comercial_notas.cliente_id and c.vendedor_asignado_id = auth.uid())
    ))
    or app_rol() = 'asistente_comercial'
  );

drop policy if exists "notas_comercial_insert" on comercial_notas;
create policy "notas_comercial_insert" on comercial_notas
  for insert to authenticated with check ( app_es_comercial() );

drop policy if exists "notas_comercial_update" on comercial_notas;
create policy "notas_comercial_update" on comercial_notas
  for update to authenticated
  using ( app_es_comercial_gestion() or usuario_id = auth.uid() )
  with check ( app_es_comercial_gestion() or usuario_id = auth.uid() );

-- Archivos: comercial puede leer; gestión puede eliminar
drop policy if exists "archivos_comercial_select" on comercial_archivos;
create policy "archivos_comercial_select" on comercial_archivos
  for select to authenticated using ( app_es_comercial() );

drop policy if exists "archivos_comercial_insert" on comercial_archivos;
create policy "archivos_comercial_insert" on comercial_archivos
  for insert to authenticated with check ( app_es_comercial() );

drop policy if exists "archivos_comercial_delete" on comercial_archivos;
create policy "archivos_comercial_delete" on comercial_archivos
  for delete to authenticated using (
    app_es_comercial_gestion() or subido_por = auth.uid()
  );

-- Actividad: solo lectura para comercial; escritura interna via service_role
drop policy if exists "actividad_comercial_select" on comercial_actividad;
create policy "actividad_comercial_select" on comercial_actividad
  for select to authenticated using (
    app_es_comercial_gestion()
    or usuario_id = auth.uid()
    or (app_rol() = 'vendedor' and exists (
      select 1 from comercial_proyectos p
      where p.id = comercial_actividad.proyecto_id and p.responsable_id = auth.uid()
    ))
    or app_rol() = 'asistente_comercial'
  );

drop policy if exists "actividad_comercial_insert" on comercial_actividad;
create policy "actividad_comercial_insert" on comercial_actividad
  for insert to authenticated with check ( app_es_comercial() );

-- Revocar ejecución pública de helpers
revoke execute on function app_es_comercial()         from public;
revoke execute on function app_es_comercial_gestion() from public;
grant  execute on function app_es_comercial()         to authenticated;
grant  execute on function app_es_comercial_gestion() to authenticated;
