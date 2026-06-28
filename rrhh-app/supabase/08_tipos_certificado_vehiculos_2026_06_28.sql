-- Agrega Drager como tipo de certificado de vehículos.
-- Matafuegos ya existía en la DB (orden 42); solo se agrega Drager.
insert into tipos_certificado (nombre, aplica_personal, aplica_empresa, aplica_vehiculo, orden)
values ('Drager', false, false, true, 42)
on conflict do nothing;
