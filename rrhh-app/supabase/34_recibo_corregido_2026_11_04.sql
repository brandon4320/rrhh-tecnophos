-- ============================================================
-- 34 — Liquidación corregida (04/11/2026)
--
-- Decisión de Agustín: cuando se corrige una liquidación ya emitida, a la
-- persona se le manda el link DE NUEVO, con un mail que le avisa que se
-- corrigió y le pide volver a firmar.
--
-- Eso obliga a poder reconocer que un PDF que entra es la corrección de algo
-- que ya está cargado y no una liquidación más del mes. La diferencia importa:
--
--   · liquidación más  → se suma, hay DOS cosas para firmar
--   · corrección       → la vieja deja de valer, hay UNA sola para firmar
--
-- Lo que las distingue es el NÚMERO DE RECIBO impreso. Por eso se guarda:
-- mismo número + contenido distinto = corrección.
--
-- ⚠ Esto funciona si el sistema de sueldos reemite la corrección con el MISMO
--   número de recibo. Si le pone uno nuevo, desde afuera es indistinguible de
--   una segunda liquidación y hay que resolverlo a mano. Pendiente de
--   confirmar con quien liquida.
--
-- La fila vieja NO se borra: pasa a 'anulado' y conserva su archivo, su fecha
-- de firma y el PDF firmado. Si alguna vez hay una discusión tienen que estar
-- las dos — el mismo criterio de la migración 31, que nunca pisa el original.
--
-- Se puede correr más de una vez.
-- ============================================================

begin;

-- ------------------------------------------------------------
-- 1. El número de recibo impreso
-- ------------------------------------------------------------
alter table public.recibos_sueldo
  add column if not exists recibo_numero text,
  add column if not exists origen_at     timestamptz;

comment on column public.recibos_sueldo.recibo_numero is
  'Número de recibo que imprime la liquidación. Mismo número + distinto '
  'origen_hash = corrección de un recibo ya emitido, no una liquidación nueva.';

-- ★ Cuál de las dos versiones es la buena.
--
-- Cuando se corrige una liquidación, en la carpeta quedan las DOS: el PDF
-- original y el corregido. El proceso los lee a los dos en la misma corrida y
-- sin una fecha no hay forma de saber cuál manda — decidiría el orden
-- alfabético de los nombres de archivo, y la persona podría terminar firmando
-- la versión vieja.
--
-- Es la fecha del ARCHIVO, no la de la carga: dos PDF leídos en la misma
-- corrida tienen la misma hora de carga y eso no desempata nada.
comment on column public.recibos_sueldo.origen_at is
  'Fecha del archivo de origen. Entre dos recibos con el mismo número, vale el '
  'de origen_at más nuevo.';

-- Buscar "¿ya tengo este recibo de esta persona?" es lo que hace la carga por
-- cada documento que entra. NO es único: una corrección convive con la fila
-- anulada que reemplaza.
create index if not exists recibos_recibo_numero_idx
  on public.recibos_sueldo (empleado_id, recibo_numero)
  where recibo_numero is not null;

-- ------------------------------------------------------------
-- 2. El mail que avisa que se corrigió
-- ------------------------------------------------------------
-- Va como tipo propio y no como 'adicional' porque no son lo mismo y el
-- registro tiene que poder distinguirlos: "te cargamos algo más" no es
-- "lo que ya firmaste cambió".
alter table public.recibo_mails drop constraint if exists recibo_mails_tipo_check;
alter table public.recibo_mails add constraint recibo_mails_tipo_check
  check (tipo in ('aviso', 'recordatorio', 'adicional', 'correccion', 'copia_firmada', 'alerta'));

-- Entra al tope de uno por día: si se corrigen tres liquidaciones de la misma
-- persona en la misma tarde, va UN mail con las tres.
drop index if exists recibo_mails_uno_por_dia;
create unique index if not exists recibo_mails_uno_por_dia
  on public.recibo_mails (empleado_id, dia, tipo)
  where tipo in ('aviso', 'recordatorio', 'adicional', 'correccion') and estado = 'enviado';

commit;

-- ============================================================
-- Comprobar después de aplicar:
--
--   select count(*) from recibos_sueldo where recibo_numero is not null;  -- 0 todavía
--   select pg_get_constraintdef(oid) from pg_constraint
--    where conname = 'recibo_mails_tipo_check';   -- tiene que incluir 'correccion'
-- ============================================================
