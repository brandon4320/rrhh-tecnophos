-- ============================================================
-- Palas cargadoras de ADC (Recursos → Palas cargadoras).
--
-- NO hay tabla nueva: una pala es un `equipos` con categoria = 'Palas cargadoras'.
-- La razón es el constraint `check_owner` de `certificados`, que admite UN dueño
-- entre empleado | empresa | vehiculo | equipo. Sumar un quinto obligaría a tocar
-- ese constraint, las policies de `certificados` y `archivos`, y todas las
-- consultas de /vencimientos y /dashboard. Colgándolas de `equipos` heredan tal
-- cual lo que ya funciona: certificados con vencimiento, adjuntos en R2, RLS
-- (migración 10) y el tablero de vencimientos.
--
-- Lo único que falta son los datos de la ficha. `equipos` ya tiene nombre, tipo,
-- numero_serie y descripcion; se agregan marca, modelo, año y horómetro. Todas
-- NULL y opcionales, así que no afectan a los equipos que ya existen
-- (matafuegos, equipos de medición) ni a ninguna policy.
--
-- El horómetro es el equivalente al kilometraje de las camionetas; acá se carga
-- a mano, porque las palas no tienen el checklist por QR de la flota (ese lo
-- hace el sistema aparte de checklist.serviwhite.com).
--
-- Aplicar en el SQL editor de Supabase.
-- ============================================================

alter table equipos add column if not exists marca  text;
alter table equipos add column if not exists modelo text;
alter table equipos add column if not exists anio   int;
alter table equipos add column if not exists horometro numeric;
alter table equipos add column if not exists horometro_actualizado_at timestamptz;

-- Año verosímil: evita el dedazo de 20226 o de un año anterior a la máquina.
alter table equipos
  drop constraint if exists equipos_anio_rango,
  add constraint equipos_anio_rango
    check (anio is null or (anio between 1950 and 2100));

-- Un horómetro no puede ser negativo.
alter table equipos
  drop constraint if exists equipos_horometro_no_negativo,
  add constraint equipos_horometro_no_negativo
    check (horometro is null or horometro >= 0);

-- Las palas se listan por empresa en su propia pantalla.
create index if not exists equipos_empresa_categoria_idx on equipos (empresa_id, categoria);

comment on column equipos.horometro is
  'Horas de uso (equivalente al km de un vehículo). Se carga a mano: las palas no tienen checklist por QR.';
