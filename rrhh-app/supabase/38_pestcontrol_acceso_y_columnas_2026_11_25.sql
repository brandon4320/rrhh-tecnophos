-- 38 · Pestcontrol: acceso solo para Brandon y Nicole, y sin motores ni caños.
--
-- Pedido de Agustín (25/11/2026):
--  1. La 37 le daba el permiso a todo admin que ve todas las empresas (le tocó también a
--     Marcelo Arias). Queda SOLO en estas dos personas, por id:
--       a5b527a3-… = Administrador (Brandon) · bdf6a9ee-… = Nicole Vallejos
--  2. Se sacan las columnas "Motores AD3" y "Caños PVC". Se ARCHIVAN (activo = false), no
--     se borran: sus movimientos viejos quedan en la base y la pantalla deja de mostrarlos
--     (la página filtra activo = true; al editar un movimiento esas líneas se conservan).

begin;

update public.perfiles
   set ve_pestcontrol = id in ('a5b527a3-847b-4c4d-9be7-58c8533fafba', 'bdf6a9ee-d3e7-4336-bff6-5477a1fb8309');

update public.pest_insumos set activo = false where codigo in ('mot', 'pvc');

commit;

-- Control: tienen que quedar Administrador y Nicole Vallejos, y 5 insumos activos.
select nombre, ve_pestcontrol from public.perfiles where ve_pestcontrol order by nombre;
select nombre, activo from public.pest_insumos order by orden;
