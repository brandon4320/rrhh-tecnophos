-- ============================================================
-- Verificación de la RLS del circuito de firma — se puede correr cuando sea
-- ============================================================
--
-- Para qué: comprobar, sin entrar con la cuenta de nadie, que
-- `firmas_empleado`, `recibo_mails` y `recibo_tokens` solo las ve quien tiene
-- `perfiles.ve_recibos` (migración 23 + policies de la migración 31), y que
-- quien está limitado a una empresa (`empresa_acceso`) ve solo la suya.
--
-- Cómo funciona: por cada perfil, se cambia el rol de la sesión a
-- `authenticated` y se finge su JWT con `request.jwt.claims`, que es de donde
-- sale `auth.uid()`. Es la misma puerta que atraviesa la app.
--
-- NO escribe nada: todo pasa dentro de un `begin … rollback`.
--
-- Qué tiene que dar:
--
--   · ve_recibos = true   → firmas y mails > 0 en cuanto haya datos cargados
--   · ve_recibos = false  → firmas = 0 y mails = 0, SIEMPRE, aunque sea admin
--   · empresa_acceso ≠ null → empleados = solo los de esa empresa
--
-- El caso de `anon` no está acá porque no se puede fingir con un JWT: se
-- prueba pegándole a la API con la clave anónima (AGENTS.md §5). Al
-- 24/11/2026 contesta `permission denied for function app_ve_recibos` en las
-- tres tablas y `new row violates row-level security policy` al intentar
-- escribir, que es lo que se espera.
-- ============================================================

begin;

-- Dónde se juntan los resultados. Es TEMPORAL: vive solo en esta sesión, se
-- destruye al terminar la transacción (`on commit drop`) y además todo el
-- script termina en `rollback`. Adentro no hay más que conteos.
create temp table rls_check (
  quien      text,
  rol        text,
  ve_recibos boolean,
  empresa    text,
  firmas     int,
  mails      int,
  tokens     int,
  empleados  int,
  recibos    int
) on commit drop;

-- El rol `authenticated` tiene que poder escribir el resultado: la tabla la
-- crea el rol de ahora (dueño) y el bloque de abajo corre como authenticated.
grant insert on rls_check to authenticated;

-- ⚠ Esto está solo para que el editor de Supabase no corte el script con
-- "esta consulta crea una tabla sin RLS". La advertencia no aplica a una tabla
-- temporal —no existe fuera de esta sesión y nadie se puede conectar a ella—,
-- pero si se acepta la corrección que ofrece (prender RLS sin policy), el
-- bloque de abajo no puede ni escribir sus propios conteos y el script falla
-- sin explicación. Así que se prende la RLS y se deja pasar, que es lo mismo
-- que no tenerla pero sin el cartel.
alter table rls_check enable row level security;
create policy rls_check_abierta on rls_check for all using (true) with check (true);

do $$
declare
  usuarios jsonb;
  u jsonb;
  n_firmas int; n_mails int; n_tokens int; n_emp int; n_rec int;
begin
  -- La lista se arma ANTES de cambiar de rol: como authenticated, `perfiles`
  -- solo deja leer la fila propia (migración 22).
  select jsonb_agg(
           jsonb_build_object('id', p.id, 'nombre', p.nombre, 'rol', p.rol,
                              've', p.ve_recibos, 'empresa', e.nombre)
           order by p.nombre)
    into usuarios
    from perfiles p
    left join empresas e on e.id = p.empresa_acceso;

  perform set_config('role', 'authenticated', true);

  for u in select * from jsonb_array_elements(usuarios) loop
    perform set_config('request.jwt.claims',
                       jsonb_build_object('sub', u->>'id', 'role', 'authenticated')::text,
                       true);

    select count(*) into n_firmas from firmas_empleado;
    select count(*) into n_mails  from recibo_mails;
    select count(*) into n_tokens from recibo_tokens;
    select count(*) into n_emp    from empleados where activo;
    select count(*) into n_rec    from recibos_sueldo;

    insert into rls_check values (
      u->>'nombre', u->>'rol', (u->>'ve')::boolean, coalesce(u->>'empresa', 'todas'),
      n_firmas, n_mails, n_tokens, n_emp, n_rec
    );
  end loop;
exception
  -- Si una de las tablas le niega el permiso de la FUNCIÓN (en vez de
  -- devolver cero filas) el bloque se corta. Eso también es un resultado
  -- válido y hay que poder verlo, no que parezca que el script está roto.
  when insufficient_privilege then
    raise notice 'Cortado por permiso denegado: %', sqlerrm;
end $$;

reset role;

select * from rls_check order by ve_recibos desc, quien;

rollback;
