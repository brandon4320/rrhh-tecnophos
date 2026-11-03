-- ============================================================
-- 32 — Dónde va la firma en cada recibo (03/11/2026)
--
-- Para estampar la firma hay que saber dónde está el recuadro "Firma" del PDF.
-- El relevamiento lo midió en una coordenada fija, pero sobre recibos
-- MENSUALES: si el de aguinaldo o el de vacaciones tiene otro formato, la firma
-- cae en cualquier lado y nadie se entera hasta que alguien mira el PDF.
--
-- Así que la posición no se adivina: la BUSCA el proceso que corre en la
-- oficina, que ya abre cada PDF para partirlo por CUIL y tiene una herramienta
-- (pymupdf) que encuentra texto de forma nativa. Guarda acá la posición y el
-- servidor solo estampa donde le dicen. El servidor queda liviano —sin una
-- librería pesada de PDF en Vercel— y deja de importar el formato del recibo.
--
-- ⚠ CONVENCIÓN DE COORDENADAS, que es donde esto se rompe si nadie la escribe:
--   · Unidad: puntos PDF (una hoja A4 son 595 × 842).
--   · Origen: ABAJO a la izquierda, como lo espera pdf-lib al dibujar.
--   · pymupdf devuelve las suyas con el origen ARRIBA a la izquierda, así que
--     el proceso de la oficina tiene que convertir:  y_pdf = alto_pagina - y_py
--   · (x, y) es la esquina inferior izquierda del rectángulo donde entra la
--     firma, y ancho/alto el espacio disponible. La imagen se escala para
--     entrar ahí sin deformarse.
--
-- Se puede correr más de una vez.
-- ============================================================

begin;

alter table public.recibos_sueldo
  add column if not exists firma_pagina int,
  add column if not exists firma_x      numeric,
  add column if not exists firma_y      numeric,
  add column if not exists firma_ancho  numeric,
  add column if not exists firma_alto   numeric;

comment on column public.recibos_sueldo.firma_pagina is
  'Página del PDF donde va la firma, contando desde 1.';
comment on column public.recibos_sueldo.firma_x is
  'Esquina inferior izquierda del recuadro, en puntos PDF con origen abajo-izquierda.';

-- O está toda la posición o no está ninguna. Una posición a medias haría que el
-- servidor estampe con un valor en null y la firma termine en el borde.
alter table public.recibos_sueldo drop constraint if exists recibos_firma_pos_completa;
alter table public.recibos_sueldo add constraint recibos_firma_pos_completa
  check (
    (firma_pagina is null and firma_x is null and firma_y is null and firma_ancho is null and firma_alto is null)
    or (firma_pagina is not null and firma_x is not null and firma_y is not null
        and firma_ancho is not null and firma_alto is not null)
  );

-- Valores imposibles: una página 0, una medida negativa. Si el buscador falla,
-- que falle acá y no dibujando fuera de la hoja.
alter table public.recibos_sueldo drop constraint if exists recibos_firma_pos_valida;
alter table public.recibos_sueldo add constraint recibos_firma_pos_valida
  check (
    firma_pagina is null
    or (firma_pagina >= 1 and firma_x >= 0 and firma_y >= 0 and firma_ancho > 0 and firma_alto > 0)
  );

commit;

-- ============================================================
-- Verificación
-- ============================================================

-- a) Las columnas nuevas.
select column_name, data_type
  from information_schema.columns
 where table_name = 'recibos_sueldo' and column_name like 'firma_%'
 order by column_name;

-- b) Los permisos: NO se verifican con una consulta.
--
--    `information_schema.role_table_grants` y `has_table_privilege` dicen los
--    dos que anon puede leer, insertar, actualizar y borrar estas tablas. Y es
--    cierto a nivel tabla: en Supabase TODAS las tablas tienen permisos para
--    anon, `recibos_sueldo` incluida. Eso no es una falla: en este proyecto la
--    frontera es la RLS (AGENTS.md 5), no los GRANT.
--
--    Verificado el 03/11/2026 contra la API con la clave anonima:
--      · escribir  -> "new row violates row-level security policy"  (la RLS)
--      · leer      -> "permission denied for function app_ve_recibos"
--      · authenticated conserva el SELECT, asi que las policies de lectura si
--        se evaluan y Brandon y Mariano ven lo suyo.
--
--    La unica verificacion que vale es pegarle a la API con la clave anonima.
