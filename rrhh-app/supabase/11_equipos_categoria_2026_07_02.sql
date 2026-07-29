-- ============================================================
-- Secciones dinámicas de activos en la página de empresa:
-- los equipos ganan `categoria` (ej: "Equipos de medición",
-- "Matafuegos", "Herramientas") y la UI arma una sección por
-- categoría, cada ítem con sus certificados/vencimientos.
-- Aplicada en prod el 2026-07-02.
-- ============================================================

alter table equipos add column if not exists categoria text not null default 'Equipos de medición';

-- Tipos de certificado útiles para matafuegos (aplican a equipos)
insert into tipos_certificado (nombre, aplica_personal, aplica_empresa, aplica_vehiculo, aplica_equipo, orden)
values
  ('Recarga de matafuego', false, false, false, true, 51),
  ('Prueba hidráulica',    false, false, false, true, 52)
on conflict do nothing;
