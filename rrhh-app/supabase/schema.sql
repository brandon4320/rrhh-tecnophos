-- ============================================================
-- RRHH Tecnophos / ADC — Schema Supabase
-- ============================================================

-- 1. EMPRESAS
create table if not exists empresas (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  slug text unique not null,
  color text default '#6366f1',
  created_at timestamptz default now()
);

insert into empresas (nombre, slug, color) values
  ('Tecnophos Bahía Blanca', 'tecnophos-bb',      '#6366f1'),
  ('Tecnophos Rosario',      'tecnophos-rosario',  '#0ea5e9'),
  ('Tecnophos Necochea',     'tecnophos-necochea', '#10b981'),
  ('ADC S.R.L.',             'adc',                '#f59e0b')
on conflict (slug) do nothing;

-- 2. TIPOS DE CERTIFICADO
create table if not exists tipos_certificado (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  descripcion text,
  aplica_personal boolean default true,
  aplica_empresa boolean default false,
  aplica_vehiculo boolean default false,
  orden int default 99
);

insert into tipos_certificado (nombre, aplica_personal, aplica_empresa, aplica_vehiculo, orden) values
  ('Carnet de Conducir',                              true,  false, false, 1),
  ('Carnet de Aplicador',                             true,  false, false, 2),
  ('Carnet de Personal Portuario',                    true,  false, false, 3),
  ('Exámenes Médicos',                                true,  false, false, 4),
  ('Curso Inducción TBB',                             true,  false, false, 5),
  ('Curso Cargill',                                   true,  false, false, 6),
  ('Curso Unipar',                                    true,  false, false, 7),
  ('Curso Viterra',                                   true,  false, false, 8),
  ('Habilitación Transporte Mercancías Peligrosas',   true,  false, false, 9),
  ('Curso Autoelevadores',                            true,  false, false, 10),
  ('Inducción Bunge PGSM',                            true,  false, false, 11),
  ('Inducción Bunge Ramallo',                         true,  false, false, 12),
  ('Inducción Gral Bunge',                            true,  false, false, 13),
  ('Inducción Cofco',                                 true,  false, false, 14),
  ('Inducción Renova',                                true,  false, false, 15),
  ('Inducción Terminal 6',                            true,  false, false, 16),
  ('Inducción Cargill Rosario',                       true,  false, false, 17),
  ('Evaluación de Inducción / Ingreso Sitio 0',       true,  false, false, 18),
  ('Habilitación Municipal',                          false, true,  false, 20),
  ('Certificado de Reinscripción',                    false, true,  false, 21),
  ('Certificado de Inscripción',                      false, true,  false, 22),
  ('Nota SSGA',                                       false, true,  false, 23),
  ('Ordenanza Municipal (cert. verde)',               false, true,  false, 24),
  ('Renovación Anual Depósito',                       false, true,  false, 25),
  ('GAFTA',                                           false, true,  false, 26),
  ('Contrato Social Bunge PGSM',                      false, true,  false, 27),
  ('Contrato Social Bunge Ramallo',                   false, true,  false, 28),
  ('Carta Indemnidad Cofco',                          false, true,  false, 29),
  ('Contrato Renova',                                 false, true,  false, 30),
  ('Prefectura Naval Argentina',                      false, true,  false, 31),
  ('Cumplimiento Fiscal Municipal Ord. 10660',        false, true,  false, 32),
  ('Registro de Inscripción Santa Fe',                false, true,  false, 33),
  ('Consorcio Puerto Rosales',                        false, true,  false, 34),
  ('Inscripción Empresas Portuarias Quequén',         false, true,  false, 35),
  ('Campo Limpio',                                    false, true,  false, 36),
  ('VTV',                                             false, false, true,  40),
  ('Seguro Vehicular',                                false, false, true,  41),
  ('Otro',                                            true,  true,  true,  99)
on conflict do nothing;

-- 3. SECTORES (para ADC)
create table if not exists sectores (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  empresa_id uuid references empresas(id) on delete cascade
);

-- 4. EMPLEADOS
create table if not exists empleados (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  apellido text,
  empresa_id uuid references empresas(id) on delete cascade,
  sector text,
  activo boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 5. VEHÍCULOS
create table if not exists vehiculos (
  id uuid primary key default gen_random_uuid(),
  patente text not null,
  empresa_id uuid references empresas(id) on delete cascade,
  descripcion text,
  activo boolean default true,
  created_at timestamptz default now()
);

-- 6. CERTIFICADOS (registro de vencimiento por empleado / empresa / vehículo)
create table if not exists certificados (
  id uuid primary key default gen_random_uuid(),
  tipo_id uuid references tipos_certificado(id),
  tipo_nombre_custom text,          -- para tipo "Otro"
  empleado_id uuid references empleados(id) on delete cascade,
  empresa_id uuid references empresas(id) on delete cascade,
  vehiculo_id uuid references vehiculos(id) on delete cascade,
  fecha_vencimiento date,
  fecha_emision date,
  numero_documento text,
  notas text,
  alerta_dias int default 30,       -- alertar N días antes del vencimiento
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  constraint check_owner check (
    (empleado_id is not null and empresa_id is null and vehiculo_id is null) or
    (empleado_id is null and empresa_id is not null and vehiculo_id is null) or
    (empleado_id is null and empresa_id is null and vehiculo_id is not null)
  )
);

-- 7. ARCHIVOS adjuntos a certificados
create table if not exists archivos (
  id uuid primary key default gen_random_uuid(),
  certificado_id uuid references certificados(id) on delete cascade,
  nombre text not null,
  path text not null,              -- path en Supabase Storage
  mime_type text,
  size_bytes int,
  uploaded_at timestamptz default now(),
  uploaded_by uuid references auth.users(id)
);

-- 8. USUARIOS APP (metadata adicional)
create table if not exists perfiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nombre text,
  rol text check (rol in ('admin', 'usuario')) default 'usuario',
  empresa_acceso uuid references empresas(id),  -- null = acceso a todas
  created_at timestamptz default now()
);

-- ============================================================
-- ÍNDICES
-- ============================================================
create index if not exists idx_certificados_empleado on certificados(empleado_id);
create index if not exists idx_certificados_empresa on certificados(empresa_id);
create index if not exists idx_certificados_vehiculo on certificados(vehiculo_id);
create index if not exists idx_certificados_vencimiento on certificados(fecha_vencimiento);
create index if not exists idx_empleados_empresa on empleados(empresa_id);
create index if not exists idx_archivos_certificado on archivos(certificado_id);

-- ============================================================
-- RLS (Row Level Security)
-- ============================================================
alter table empresas enable row level security;
alter table empleados enable row level security;
alter table vehiculos enable row level security;
alter table certificados enable row level security;
alter table archivos enable row level security;
alter table perfiles enable row level security;
alter table tipos_certificado enable row level security;

-- Todos los usuarios autenticados pueden leer
create policy "Lectura autenticada" on empresas for select to authenticated using (true);
create policy "Lectura autenticada" on tipos_certificado for select to authenticated using (true);
create policy "Lectura autenticada" on empleados for select to authenticated using (true);
create policy "Lectura autenticada" on vehiculos for select to authenticated using (true);
create policy "Lectura autenticada" on certificados for select to authenticated using (true);
create policy "Lectura autenticada" on archivos for select to authenticated using (true);

-- Solo admin puede escribir
create policy "Escritura admin" on empleados for all to authenticated
  using (exists (select 1 from perfiles where id = auth.uid() and rol = 'admin'))
  with check (exists (select 1 from perfiles where id = auth.uid() and rol = 'admin'));

create policy "Escritura admin" on certificados for all to authenticated
  using (exists (select 1 from perfiles where id = auth.uid() and rol = 'admin'))
  with check (exists (select 1 from perfiles where id = auth.uid() and rol = 'admin'));

create policy "Escritura admin" on archivos for all to authenticated
  using (exists (select 1 from perfiles where id = auth.uid() and rol = 'admin'))
  with check (exists (select 1 from perfiles where id = auth.uid() and rol = 'admin'));

create policy "Escritura admin" on vehiculos for all to authenticated
  using (exists (select 1 from perfiles where id = auth.uid() and rol = 'admin'))
  with check (exists (select 1 from perfiles where id = auth.uid() and rol = 'admin'));

-- Perfil propio
create policy "Perfil propio" on perfiles for select to authenticated using (id = auth.uid());
create policy "Admin ve todo" on perfiles for select to authenticated
  using (exists (select 1 from perfiles p where p.id = auth.uid() and p.rol = 'admin'));

-- ============================================================
-- STORAGE BUCKET
-- ============================================================
insert into storage.buckets (id, name, public, file_size_limit)
values ('certificados', 'certificados', false, 20971520)  -- 20MB máx
on conflict do nothing;

create policy "Upload autenticado" on storage.objects for insert to authenticated
  with check (bucket_id = 'certificados');

create policy "Lectura autenticada" on storage.objects for select to authenticated
  using (bucket_id = 'certificados');

create policy "Delete admin" on storage.objects for delete to authenticated
  using (bucket_id = 'certificados' and exists (
    select 1 from perfiles where id = auth.uid() and rol = 'admin'
  ));

-- ============================================================
-- USUARIO ADMIN INICIAL
-- Ejecutar DESPUÉS de crear el usuario en Supabase Auth dashboard:
-- Email: admin@tecnophos.internal | Password: (el que elijas)
-- ============================================================
-- insert into perfiles (id, nombre, rol)
-- values ('<uuid-del-usuario-creado>', 'Administrador', 'admin');
