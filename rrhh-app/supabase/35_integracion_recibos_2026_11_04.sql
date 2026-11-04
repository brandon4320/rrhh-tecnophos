-- ============================================================
-- 35 — Token del proceso que lee las liquidaciones del NAS (04/11/2026)
--
-- El lector corre en la PC de la oficina (es lo único que está adentro: Gestión
-- vive en internet y no ve el NAS) y le manda a `POST /api/externo/recibos/lote`
-- lo que encontró. Gestión decide de quién es cada liquidación — el lector no
-- asigna nada, porque la nómina está acá.
--
-- Mismo molde que la integración con el Comercial (migración 27): de la clave
-- se guarda SOLO su sha256, la tabla no tiene políticas y la lee únicamente la
-- service role.
--
-- ⚠ EL HASH NO SE COMMITEA. Este repo es público. Lo que va acá es un
-- placeholder: el INSERT de verdad se corre a mano en el SQL editor.
--
-- Para generar la clave y su hash, en una terminal:
--
--     node -e "const c=require('crypto');const t=c.randomBytes(32).toString('base64url');console.log('CLAVE:',t);console.log('HASH :',c.createHash('sha256').update(t).digest('hex'))"
--
-- La CLAVE va en el archivo de configuración del lector, en la PC de la
-- oficina, y en Bitwarden. El HASH va en el update de abajo. La clave en claro
-- no queda en ningún otro lado: si se pierde, se rota.
--
-- Rotar: generar otra, actualizar token_hash y cargar la nueva en el lector.
-- Se puede correr más de una vez: el insert no pisa un hash ya cargado.
-- ============================================================

begin;

insert into public.integraciones (clave, token_hash, notas)
values (
  'recibos',
  'PENDIENTE-cargar-a-mano-el-sha256-real',
  'Lector de liquidaciones del NAS -> POST /api/externo/recibos/lote. '
  'Solo decide: no carga recibos ni manda mails.'
)
on conflict (clave) do nothing;

commit;

-- ============================================================
-- Y DESPUÉS, a mano y una sola vez (no commitear esta línea con el hash real):
--
--   update public.integraciones
--      set token_hash = '<el sha256 de la clave>'
--    where clave = 'recibos';
--
-- Comprobar:
--
--   select clave, left(token_hash, 8) || '…' as hash, notas
--     from integraciones order by clave;
--   -- 'recibos' NO tiene que seguir diciendo PENDIENTE
-- ============================================================
