-- ============================================================
-- 33 — De quién es cada PDF, y varias liquidaciones en el mismo mes (04/11/2026)
--
-- Sale de lo que confirmó el contador (Ger) el 04/11/2026:
--
--  · En un mes, a UN legajo se le pueden generar VARIOS PDF: el sueldo, un
--    premio, una liquidación final. Cada uno es un documento distinto y la
--    persona tiene que firmar TODOS. Una sola firma copiada en los tres no es
--    consentimiento de nada.
--  · El número de legajo viene escrito en cada archivo y los PDF salen en
--    carpetas separadas por empresa.
--
-- Esta migración arregla las dos cosas que eso rompe:
--
-- ① El legajo NO identifica a nadie por sí solo. En Jaque el legajo 1 de ADC y
--    el legajo 1 de Tecnophos son dos personas distintas, y una misma persona
--    es legajo 2 en una base y legajo 1 en la otra. La identidad es el par
--    (base de liquidación, legajo) — que es justo lo que da la carpeta de donde
--    salió el PDF más el número escrito adentro.
--
--    Ojo: la base NO es la empresa de Gestión. La base 1 (Tecnophos) son TRES
--    empresas acá (Bahía Blanca, Rosario, Necochea) y un solo juego de legajos.
--    Por eso el índice único es (base_sueldos, legajo) y no (empresa_id, legajo):
--    con el segundo, el legajo 5 podría existir en Bahía Blanca y en Rosario
--    siendo en Jaque una sola persona.
--
-- ② `recibos_sueldo` tenía "un comprobante por empleado, período y tipo". Con
--    dos premios en el mismo mes el segundo no entraba. Se reemplaza por
--    (empleado, período, tipo, secuencia): la carga manual del legajo sigue
--    usando la secuencia 1 y por lo tanto sigue avisando "ya cargaste este
--    comprobante" igual que hoy, y el proceso automático puede sumar el
--    segundo y el tercer PDF del mes.
--
-- Se puede correr más de una vez.
-- ============================================================

begin;

-- ------------------------------------------------------------
-- 1. Base de liquidación y legajo del empleado
-- ------------------------------------------------------------
alter table public.empleados
  add column if not exists base_sueldos text,
  add column if not exists legajo       int;

comment on column public.empleados.base_sueldos is
  'Base de Jaque donde se liquida: ''1'' (Tecnophos, las tres sedes) o ''3-ADC''. '
  'NO es la empresa de Gestión: una base puede ser varias empresas.';
comment on column public.empleados.legajo is
  'Número de legajo DENTRO de esa base. Único junto con base_sueldos, nunca solo.';

-- Los dos juntos o ninguno: un legajo sin base no identifica a nadie, y una
-- base sin legajo no sirve para buscar.
alter table public.empleados drop constraint if exists empleados_legajo_completo;
alter table public.empleados add constraint empleados_legajo_completo
  check (
    (base_sueldos is null and legajo is null)
    or (base_sueldos is not null and btrim(base_sueldos) <> '' and legajo is not null and legajo > 0)
  );

-- ★ La garantía de que un PDF no se le pueda mandar a la persona equivocada.
create unique index if not exists empleados_base_legajo_idx
  on public.empleados (base_sueldos, legajo) where legajo is not null;

-- Buscar por legajo es lo que hace el proceso de carga por cada PDF.
create index if not exists empleados_legajo_idx
  on public.empleados (legajo) where legajo is not null;

-- ------------------------------------------------------------
-- 2. Varias liquidaciones del mismo tipo en el mismo mes
-- ------------------------------------------------------------
alter table public.recibos_sueldo
  add column if not exists secuencia int not null default 1;

comment on column public.recibos_sueldo.secuencia is
  'Cuál de los comprobantes de ese período y tipo es. La carga manual usa '
  'siempre 1; el proceso automático numera el 2.º y 3.º PDF del mes.';

alter table public.recibos_sueldo drop constraint if exists recibos_secuencia_check;
alter table public.recibos_sueldo add constraint recibos_secuencia_check
  check (secuencia > 0);

-- Se va la clave vieja (empleado, período, tipo). Se busca por columnas y no
-- por nombre: si alguna vez se recreó con otro nombre, igual se encuentra.
do $$
declare c text;
begin
  for c in
    select con.conname
      from pg_constraint con
      join pg_class t on t.oid = con.conrelid
      join pg_namespace n on n.oid = t.relnamespace
     where n.nspname = 'public' and t.relname = 'recibos_sueldo' and con.contype = 'u'
       and (select array_agg(a.attname::text order by a.attname)
              from unnest(con.conkey) k
              join pg_attribute a on a.attrelid = con.conrelid and a.attnum = k)
           = array['empleado_id', 'periodo', 'tipo']
  loop
    execute format('alter table public.recibos_sueldo drop constraint %I', c);
  end loop;
end $$;

-- La nueva, con la secuencia adentro. Nombre explícito: el mensaje "ya hay un
-- comprobante de ese período y tipo" de /api/recibos lo busca por este nombre.
create unique index if not exists recibos_sueldo_empleado_periodo_tipo_seq_key
  on public.recibos_sueldo (empleado_id, periodo, tipo, secuencia);

-- ------------------------------------------------------------
-- 3. Mail por un documento que llegó fuera de la ventana del 2 al 5
-- ------------------------------------------------------------
-- Si después del día 5 aparece una corrección o un premio liquidado tarde, a la
-- persona se le avisa en el momento (decisión de Agustín, 04/11/2026): el link
-- que ya tiene sigue sirviendo, pero sin un mail no se entera de que le quedó
-- algo sin firmar.
alter table public.recibo_mails drop constraint if exists recibo_mails_tipo_check;
alter table public.recibo_mails add constraint recibo_mails_tipo_check
  check (tipo in ('aviso', 'recordatorio', 'adicional', 'copia_firmada', 'alerta'));

-- 'adicional' entra al tope de uno por día: si en la misma tarde aparecen dos
-- PDF sueltos, va UN mail con los dos, no dos mails.
drop index if exists recibo_mails_uno_por_dia;
create unique index if not exists recibo_mails_uno_por_dia
  on public.recibo_mails (empleado_id, dia, tipo)
  where tipo in ('aviso', 'recordatorio', 'adicional') and estado = 'enviado';

commit;

-- ============================================================
-- Comprobar después de aplicar:
--
--   select count(*) from empleados where legajo is not null;   -- 0 todavía
--   select conname from pg_constraint
--    where conrelid = 'recibos_sueldo'::regclass and contype = 'u';
--   -- NO tiene que aparecer recibos_sueldo_empleado_id_periodo_tipo_key
-- ============================================================
