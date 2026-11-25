-- ============================================================
-- 37 — Token del Portal de Trazabilidad (25/11/2026)
--
-- El portal (trazabilidad.tecnophos.com.ar, Cloudflare) lee los carnets de
-- aplicador desde acá para armar la cuadrilla de cada fumigación, sin cargarlos
-- dos veces: GET /api/externo/trazabilidad/aplicadores y /carnet. Solo lectura.
-- El recorte (nombre, sede, nº y vencimiento del carnet y su imagen; nada más
-- del legajo) está en src/modules/integracion-trazabilidad/reglas.ts.
--
-- Mismo molde que las integraciones 27 y 35: de la clave se guarda SOLO su
-- sha256, la tabla no tiene políticas y la lee únicamente la service role.
--
-- ⚠ EL HASH NO SE COMMITEA. Este repo es público. Lo que va acá es un
-- placeholder: el UPDATE con el hash real se corre a mano en el SQL editor.
-- La clave en claro está cargada como secreto del Worker del portal
-- (GESTION_TOKEN) y en Bitwarden; si se pierde, se rota.
-- ============================================================

begin;

insert into public.integraciones (clave, token_hash, notas)
values (
  'trazabilidad',
  'PENDIENTE-cargar-a-mano-el-sha256-real',
  'Portal de Trazabilidad -> GET /api/externo/trazabilidad/aplicadores y /carnet. '
  'Solo lectura de carnets de aplicador.'
)
on conflict (clave) do nothing;

commit;
