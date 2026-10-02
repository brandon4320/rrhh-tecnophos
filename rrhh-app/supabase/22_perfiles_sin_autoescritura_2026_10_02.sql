-- 22 · SEGURIDAD: un usuario no puede modificar su propio perfil.
--
-- `write_perfiles` (FOR ALL, id = auth.uid()) dejaba que cualquier usuario logueado hiciera
-- PATCH /rest/v1/perfiles?id=eq.<su id> con {"rol":"admin","empresa_acceso":null}: el de
-- una sola sede pasaba a ver todas y cualquiera pasaba a admin.
-- La app escribe `perfiles` SOLO con el cliente admin (service role) desde
-- admin/usuarios y comercial/configuracion/equipo, que no pasan por RLS ni por estos grants.
-- La lectura de la propia fila (read_perfiles) queda igual.

begin;
drop policy if exists write_perfiles on public.perfiles;
revoke insert, update, delete, truncate on public.perfiles from anon, authenticated;
commit;
