# Contexto del proyecto — leer ANTES de tocar código

> Este documento es el onboarding del proyecto. Si sos un agente de IA (Claude Code,
> Cursor, etc.) se carga automáticamente: seguí sus reglas. Si sos humano, leelo
> entero una vez — está escrito para que puedas trabajar con independencia.

---

## ⚠️ 1. Este NO es el Next.js que conocés

Next.js **16.2.1** tiene breaking changes respecto de lo que probablemente aprendiste:
- `params` y `searchParams` son **Promise** (hay que `await`).
- El middleware se llama **`src/proxy.ts`** (export `proxy`), no `middleware.ts`.
- Ante cualquier duda de API, leé la doc local: `node_modules/next/dist/docs/`.

---

## 2. Qué es este sistema (negocio)

**"Gestión"** es la plataforma interna del grupo de empresas de Brandon:
**Tecnophos** (fumigación, 3 sedes: Bahía Blanca / Rosario / Necochea), **ADC S.R.L.**
(fumigación y servicio de limpieza) y **Serviwhite**. Es un **sistema REAL en
producción, usado a diario** por ~5 usuarios (administración de las empresas) para
gestionar ~110 empleados.

Un solo login con **módulos** (registro en `src/config/modules.ts`):

| Módulo | Ruta | Qué hace | Quién lo usa |
|---|---|---|---|
| **RRHH** | `/(protected)` → `/dashboard`, `/empleados`, `/empresa/[slug]`, `/legajo/[id]`, `/vencimientos`, `/documentos`, `/stock`, `/admin/*` | Carpeta documental: empleados, certificados con vencimiento, vehículos, equipos/activos (matafuegos, Draeger), habilitaciones de empresa, archivos adjuntos, comprobantes de sueldo. **Documentación mensual** (`/documentos?empresa=slug&anio=`): AÑO → MES → carpetas fijas (F931, ART, SVO…) con archivos. **Stock por empresa** (`/stock?empresa=slug`): catálogo de ítems + compras/consumos/ajustes | Administración (desktop) |
| ~~Operaciones~~ | — | **Eliminado (2026-09)**: reemplazado por el sistema externo unipar-app.vercel.app (repo aparte). Las tablas `limpieza_*` y los usuarios con roles de limpieza siguen en la DB como legacy. | — |
| **Gestión Comercial** | `/comercial` | CRM: clientes, proyectos (pipeline), tareas, agenda, viajes, equipo, reportes. Workspace estilo Notion con kanban | Equipo comercial (MUY mobile) |
| **Tecnophos - ARCOR** | `/(protected)/arcor` (+ `/actividad`, `/alertas`, `/contenedores`) | **Observabilidad** del sistema externo de certificados de fumigación de contenedores (repo `C:\Dev\Arcor`: FastAPI + n8n en un droplet). Espejo de la planilla de contenedores, feed de actividad, estado de WhatsApp/crédito Claude/cola Colabora y alertas con historial. Solo lectura: los datos entran por `POST /api/arcor/ingest` | Admin + usuarios RRHH que ven todas las empresas |
| Mantenimiento | — | `enabled: false`, futuro | — |

**Regla de arquitectura (decisión de Brandon):** los módulos son contextos
**independientes**. Operaciones NO usa las tablas de RRHH (tiene `limpieza_personal`
propio); Comercial tiene sus tablas `comercial_*`. No crear FKs cruzadas entre módulos.

**Importante:** el módulo RRHH es **de escritorio** (no invertir en mobile ahí).
Comercial y Operaciones **sí son mobile-first**.

---

## 3. Stack y servicios

- **Next.js 16.2.1** (App Router, Turbopack) + **React 19** + **TypeScript** + **Tailwind v4** (tokens en `src/app/globals.css`, sin config JS).
- **Supabase** (Postgres 17, región São Paulo, ref `feccpqcmwtsnbhnnhqwg`): DB + Auth (`@supabase/ssr`). **RLS estricta es la seguridad real** (ver §5).
- **Cloudflare R2** (bucket `brandon4320`): archivos adjuntos, vía presigned URLs con `@aws-sdk/client-s3` (`src/lib/r2/`).
- **Vercel**: proyecto `rrhh-tecnophos` (team `brandon4320s-projects`). **Push a `main` = deploy automático a producción.** URL: `gestion-tecnophos.vercel.app`.
- UI: componentes shadcn/ui parciales en `src/components/ui/`, íconos **lucide-react** (nunca emojis como íconos), toasts **sonner** (ya montado en el root layout: `import { toast } from 'sonner'`).
- Tests: vitest (`src/modules/*/reglas.test.ts` — lógica pura).

### Setup local
```bash
cd rrhh-app
npm install
# Pedile a Brandon el .env.local por un canal seguro (NUNCA está en el repo):
# NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY,
# CLOUDFLARE_ACCOUNT_ID, R2_BUCKET_NAME, R2_ACCESS_KEY_ID*, R2_SECRET_ACCESS_KEY*
#   (*las claves R2 pueden faltar en local: solo hacen falta para subir archivos)
npm run dev
```

---

## 4. Mapa del repo (lo que importa)

```
rrhh-app/src/
├── app/
│   ├── page.tsx                    # Hub de módulos (post-login)
│   ├── login/
│   ├── (protected)/                # ═══ MÓDULO RRHH ═══ (layout exige rol RRHH)
│   │   ├── layout.tsx              # auth + datos del sidebar (AppShell)
│   │   ├── dashboard/              # Dashboard general (todas las empresas)
│   │   ├── empresa/[slug]/         # Resumen por empresa + ?vista=documentacion
│   │   │   ├── EmpresaCertsClient  #   habilitaciones de empresa
│   │   │   ├── VehiculosClient     #   vehículos + certificados
│   │   │   └── EquiposClient       #   activos por sección (Matafuegos, Draeger…)
│   │   ├── empleados/  legajo/[id]/  vencimientos/  admin/
│   │   ├── documentos/             # Documentación mensual por empresa: DocumentosClient (año → mes → carpetas)
│   │   ├── stock/                  # Stock por empresa: StockClient (CRUD ítems + movimientos)
│   │   ├── flota/                  # Flota: semáforo, ficha del vehículo, QR imprimibles (ver §6)
│   │   └── arcor/                  # ═══ TECNOPHOS - ARCOR (observabilidad) ═══ ver §8b
│   ├── operaciones/                # ═══ MÓDULO OPERACIONES ═══
│   ├── comercial/                  # ═══ MÓDULO COMERCIAL ═══
│   └── api/
│       ├── upload-url/             # firma URL para PUT directo a R2
│       ├── upload/                 # registra fila archivo (+fallback multipart)
│       ├── archivo/                # GET url firmada (valida RLS) / DELETE
│       ├── recibos/  documentos/   # registran filas de recibos_sueldo / documentos_mensuales (+fallback, DELETE)
│       ├── arcor/ingest/           # ★ entrada de datos del sistema ARCOR (token, service role)
│       └── comercial/{tarea,proyecto,tags,tarea-rapida}/
├── components/
│   ├── layout/AppShell.tsx         # Sidebar única RRHH (selector "Viendo": todas / empresa / ARCOR)
│   ├── ui/                         # sistema de diseño (ver §7)
│   ├── comercial/  arcor/  brand/
├── config/modules.ts               # registro de módulos + acceso por rol
├── lib/
│   ├── auth/{roles,session}.ts     # ★ autorización central
│   ├── supabase/{server,client,admin}.ts
│   ├── r2/{client,operations}.ts
│   └── upload-client.ts            # helper de subida (browser)
├── modules/comercial/              # queries/actions/tipos/reglas del CRM
├── modules/arcor/                  # reglas (puras, con tests) / queries / acceso / tipos del módulo ARCOR
├── modules/stock/reglas.ts         # stock = suma de movimientos; estado por mínimo; compras del mes (con tests)
├── modules/documentos/reglas.ts    # carpetas fijas del mes, completitud, estado del mes, claves R2 (con tests)
├── types/{index,database}.ts       # dominio + tipos generados de la DB
supabase/                           # schema.sql + migraciones numeradas (ver §6)
```

---

## 5. Autenticación, roles y RLS — ★ LA REGLA DE ORO

- Login por **username** (se convierte a email interno `nombre@users.internal`,
  helpers en `src/lib/auth-helpers.ts`). Los usuarios se crean desde
  `/admin/usuarios` (RRHH) o `/comercial/configuracion` con el **admin client**
  (service role, solo server).
- **`src/lib/auth/session.ts`**: usar SIEMPRE `getSesion()` (cacheada por request) /
  `requireSesion()` / `requireRol()` / `requireModulo()`. NO hacer
  `getUser()` + query a `perfiles` a mano. En **route handlers** (JSON) usar
  `sesionApi(roles, mensaje403)`: devuelve `{ error: NextResponse }` o `{ supabase, sesion }`
  en vez de redirigir (lo usan `/api/recibos` y `/api/documentos`).
- **`src/lib/auth/roles.ts`**: roles y grupos (`RRHH_ROLES`, `LEGAJO_ESCRITURA`,
  `COMERCIAL_GESTION`, etc.).

**La seguridad REAL es la RLS de Postgres**, no los guards de UI. Helpers SQL
`app_rol()`, `app_es_rrhh()` (= admin|usuario), `app_ve_empresa(id)`,
`app_empresa_acceso()` (`perfiles.empresa_acceso`: `null` = ve todas las empresas;
seteado = solo esa — ej. Soledad solo ve Tecnophos Rosario).

> ★ **Regla de oro:** cualquier guard de UI debe ESPEJAR la policy de RLS.
> Si la UI permite algo que la RLS rechaza, el usuario ve un formulario que
> falla en silencio. Si agregás una tabla nueva: RLS desde el día uno
> (mirá migraciones 02/05/08/12 como patrón). Si agregás una entidad colgada de
> `certificados` o `archivos`, actualizá también esas policies (nos pasó con
> `equipos`: migración 10).

> ★ **Velocidad de la RLS (migración 21, 2026-10-02):** las funciones de permisos son
> SECURITY DEFINER y Postgres las evalúa FILA POR FILA si se llaman sueltas. Escribí
> las policies así (se calculan una vez por consulta):
> `(select app_es_rrhh()) and ((select app_ve_todas_empresas()) or empresa_id = (select app_empresa_acceso()))`
> y `id = (select auth.uid())`. NO uses `app_ve_empresa(empresa_id)` en policies nuevas
> (las migraciones 02/05/08/12 tienen la forma lenta: copiá la lógica, no la forma).
> Antes de la 21, certificados tardaba 130-360 ms; después, 4-35 ms.
>
> **`perfiles` es de solo lectura para los usuarios** (migración 22): se escribe SOLO con
> el cliente admin (service role). Antes cualquiera podía hacerse admin con un PATCH.

Roles de Operaciones (`admin_adc`, `supervisor`, `operario`, `admin_unipar`) **no
pueden ver RRHH** (la RLS lo garantiza). El vendedor comercial solo ve/edita lo
propio (`responsable_id = auth.uid()`), gestión ve todo.

---

## 6. Base de datos y migraciones

- **No hay CLI de Supabase configurada.** Las migraciones son archivos SQL numerados
  en `supabase/` (`NN_descripcion_fecha.sql`) que se aplican **a mano** en el SQL
  editor de Supabase (o vía MCP). Flujo: escribir el archivo → aplicarlo en prod →
  commitear el archivo. `schema.sql` es el estado histórico inicial (OJO: sus
  policies viejas ya no existen en prod; las vigentes son las de las migraciones).
- **`src/types/database.ts`**: tipos generados. Tras cambiar el schema, actualizalo
  (regenerando con `supabase gen types` o editando a mano el bloque de la tabla,
  como se vino haciendo).
- Las tablas `comercial_*` **no están** en `database.ts`: el módulo comercial usa
  `cdb()` (cliente casteado a `any`) + casts `rows<T>()`. Es deliberado (MVP).
  Las `arcor_*` siguen el mismo criterio (`modules/arcor/db.ts`).
- Modelo RRHH clave: `certificados` tiene dueño **excluyente** (constraint
  `check_owner`): empleado_id | empresa_id | vehiculo_id | equipo_id.
  `tipos_certificado` tiene flags `aplica_personal/empresa/vehiculo/equipo`.
  `equipos` tiene `categoria` (texto) y las secciones viven en `activo_secciones`
  (pueden existir vacías; matchean por nombre).
- **Comprobantes de sueldo** (migración 15): tabla `recibos_sueldo` colgada de `empleados`
  (período = primer día del mes, tipo mensual/sac/liquidacion_final/otro, archivo en R2,
  `origen` manual|automatico, unique empleado+periodo+tipo). NO son certificados: no vencen
  ni entran en `/vencimientos`. RLS espejo de `empleados`. UI en el legajo
  (`legajo/[id]/RecibosSueldo.tsx`), API `/api/recibos`, reglas puras en `lib/recibos.ts`.
- **Stock** (migración 16): `stock_items` (catálogo por empresa, unique empresa+nombre, `activo`
  = archivado conserva historial) + `stock_movimientos` (tipo compra/consumo/ajuste; `empresa_id`
  denormalizado para que la RLS sea la misma de RRHH). **El stock actual nunca se guarda**: es la
  suma de movimientos (`modules/stock/reglas.ts::calcularStock`, en JS — volúmenes chicos; la
  página pagina el libro de a 1000 porque PostgREST corta ahí). El ajuste guarda la DIFERENCIA
  contra el stock contado, con signo, **calculada con una lectura fresca de los movimientos del
  ítem** (no con el estado de la pestaña: otro usuario pudo mover stock) y deja `Conteo: X` en
  notas. Mutaciones directas con el cliente de Supabase desde `StockClient` (RLS decide) + estado
  local + `router.refresh()`; `stock/page.tsx` remonta el client con `key={empresa.id}`.
  Migración 18: FK compuesta `(item_id, empresa_id) → stock_items` (el `empresa_id` denormalizado
  no puede apuntar a un ítem de otra empresa).
  **Organización de la vista (2026-10-02)**: la mitad del catálogo son talles de una misma prenda
  ("Camisa ADC T 36"… "T 54"), así que la ropa se muestra como **matriz prenda × talle** (una fila
  por prenda, una columna por talle, una matriz por sistema letras/números) y el resto como tabla
  plana `Ítem | Stock | Último movimiento` ordenada rojo → naranja → alfabético
  (`agruparPrendas`/`matricesDePrendas`/`ordenarPorUrgencia`, con tests). La categoría es un filtro
  (chips, ocultos si hay una sola). Un talle sin marcador "T" ("BOTINES SEGURIDAD 39") agrupa solo
  si 3+ ítems comparten la base normalizada (sin acentos ni "de"). Las prendas se **rotulan,
  nunca se fusionan**: cada celda es un ítem con su id, porque el ajuste por conteo escribe la
  diferencia contra el stock de UN ítem — una fila-prenda con stock sumado escribiría basura.
  Regla dura: `abrirMovimiento` solo con un id real. Ojo: `calcularStock` recibe SIEMPRE el
  catálogo completo (si se alimenta con la lista filtrada, los ítems ocultos pierden su stock).
  **Uso real**: casi todo son ENTREGAS de EPP/ropa a empleados (en pantalla consumo = "Entrega",
  compra = "Ingreso"). "Registrar entrega" es la acción principal y es de varias líneas (encabezado
  "Entregado a" + fecha, N líneas ítem + cantidad) guardadas en UN insert; el destinatario va en
  `notas` (no hay vínculo con empleados). La pestaña **Movimientos** (`?tab=movimientos`) lista el
  libro entero con filtros y busca también en las notas. `router.refresh()` va UNA vez al cerrar el
  panel de movimientos, no por línea (la pantalla vive de su estado local; el refresh es para la
  caché `staleTimes`).
  El estado `sin_fecha` se rotula **"En cero"**, no "Sin alerta": solo ocurre con stock ≤ 0 y sin
  mínimo, o sea que la fila está vacía aunque nadie pidió que avise (y no entra en "hay que
  comprar", por eso se cuenta aparte en el KPI "Sin stock").
- **Documentación mensual** (migración 17): `documentos_mensuales` colgada de `empresas`
  (`periodo` = primer día del mes, `carpeta` texto con `''` = archivos sueltos del mes, archivo en
  R2, `origen` manual|automatico, `clave_externa` única por empresa para que un proceso automático
  pueda re-correr sin duplicar). **`carpeta` guarda la RUTA, no un solo nombre**
  (`Recibos de sueldos/Limpieza/Aguinaldo`, separador `/`, hasta `MAX_NIVELES_CARPETA` tramos):
  la oficinista divide Recibos de sueldos por sector/planta y adentro por concepto. Solo el PRIMER
  tramo se canoniza contra `CARPETAS_FIJAS`, y todo lo que mira carpetas de primer nivel
  (`carpetasExtra`, `completitudMes`) usa `raizCarpeta()`; la pantalla arma el árbol con
  `arbolCarpetas()`. En la clave de R2 la ruta se aplasta a UN segmento (`slugCarpeta`). Réplica de las carpetas en disco de la oficinista: las **6 carpetas
  fijas** (Aportes sindicales, ART, F931, Pagos, Recibos de sueldos, SVO) viven en código
  (`modules/documentos/reglas.ts::CARPETAS_FIJAS`) y se muestran siempre; se admiten carpetas
  extra escritas a mano. **No todas las empresas llevan las seis**: `CARPETAS_POR_EMPRESA`
  (por slug) define el subconjunto y `carpetasFijasDe(slug)` lo resuelve — hoy solo
  `tecnophos-necochea`, con ART + Recibos de sueldos, porque las otras cuatro quedaban vacías
  para siempre y el mes nunca llegaba a 6/6. Esa lista decide lo que se MUESTRA y lo que CUENTA
  para la completitud (`carpetasDelMes`, `completitudMes` y las rayitas del chip del mes la
  reciben por parámetro). **La canonización sigue usando las seis** (`normalizarCarpeta`,
  `esCarpetaFija`): si no, "F931" en Necochea dejaría de unificarse con "f931". Y
  `carpetasExtra` filtra contra la lista de la empresa, no contra `esCarpetaFija`, para que una
  carpeta con archivos se vea SIEMPRE: sacar una del subconjunto nunca esconde lo ya cargado. Son documentos de la EMPRESA: lo de cada persona sigue en `recibos_sueldo`
  (la carpeta "Recibos de sueldos" muestra cuántos empleados activos ya tienen el suyo y cuenta como
  completa si están todos). UI en `documentos/DocumentosClient.tsx`, API `/api/documentos`.
- **En los `<select>` de tipo de certificado, la opción "Otro" usa el valor
  `'otro'`, que NO es un UUID**: al guardar va `tipo_id: null` +
  `tipo_nombre_custom`. Ese bug ya se arregló una vez — no lo reintroduzcas.
- **Flota** (migración 20, 02/10/2026): checklist quincenal por QR, kilómetros, novedades y
  mantenimiento. Cada vehículo tiene un `checklist_token` (24 hex) y un QR impreso dentro de la
  camioneta que abre **`/v/<token>`: página PÚBLICA, sin login** (la completa quien maneja). Todo lo
  que escribe pasa por `/api/v/<token>` y `/api/v/<token>/foto` con **service role, después de
  validar el token** (`modules/flota/servidor.ts`); las tablas no tienen policies para anon. Las tres
  rutas, más `/api/cron`, están en `PUBLIC_PATHS` del proxy.
  - Tablas: `vehiculo_checklists` (respuestas/notas/fotos en jsonb por id de ítem),
    `vehiculo_novedades` (lo que hay que arreglar: nace de cada ítem "Mal", de un reporte suelto
    por QR o de Gestión), `vehiculo_mantenimiento_plan` + `vehiculo_services` (el próximo service se
    CALCULA: último service del tipo + intervalo, proyectado con los km/día de los checklists),
    `flota_encargados` (celulares que reciben los avisos) y `flota_avisos` (registro; `clave` única
    = no se manda dos veces lo mismo). Todas con `empresa_id` denormalizado y FK compuesta a
    `vehiculos(id, empresa_id)`, como stock.
  - **El contenido del checklist vive en código** (`modules/flota/reglas.ts`: `FOTOS_CHECKLIST`,
    `SECCIONES_CHECKLIST`, con tests). Sumar o sacar un ítem es editar la lista; las respuestas se
    guardan por id, así que **no le cambies el id a un ítem existente**. "Mal" en un ítem `critico`
    abre una novedad grave y avisa al instante. **"No apta" = tiene novedades graves ABIERTAS**
    (`resumen.ts::noApta`), no "el último checklist dio no apto": se limpia cuando la oficina las
    resuelve. Un ítem que ya tiene una novedad abierta no abre otra en el checklist siguiente.
  - **Vencimiento por período de calendario** (`estadoChecklist`, con tests), no "N días desde el
    último": con `checklist_cada_dias` < 28 los períodos son quincenas (1–14 y 15–fin de mes); con
    ≥ 28, el mes. Hecho en cualquier día del período, queda al día; los primeros
    `GRACIA_CHECKLIST_DIAS` (3) de un período sin checklist son "Toca hacerlo" (`vence_pronto`) y
    después "Vencido". Si se salteó un período entero, está vencido aunque el nuevo esté en gracia.
  - **Envío idempotente**: el celular genera un `envioId` (uuid) al empezar el borrador y el server
    lo usa como `id` del checklist / novedad; un reintento con el mismo id (la respuesta se perdió
    por la señal) devuelve lo ya guardado sin duplicar novedades ni avisos. El borrador vive en
    `localStorage` con modo/paso (se retoma si la cámara mata la pestaña) y se descarta a las 12 h o
    al cambiar de período; el server solo acepta fotos del mes actual o el anterior. Las fotos se
    suben de fondo con timeout y reintentos (el blob queda en memoria): se puede avanzar y solo
    Enviar espera a que estén todas arriba.
  - Un km que no cuadra (menor al último, o un salto imposible) **se guarda igual** marcado
    `km_inconsistente`, no pisa `vehiculos.km_actual` y abre una novedad "Revisar el kilometraje":
    quien está en la camioneta no puede corregir el pasado. El formulario avisa con la MISMA regla
    (`evaluarKm`) y pide confirmar una primera lectura > 500.000 km. Un service cargado en Gestión
    que sube el km pone `km_actualizado_at` = fecha del service, no "ahora".
  - Fotos: se comprimen en el celular (1600 px, JPEG) y suben por el server, así que **no dependen
    del CORS de R2**. Viven en `flota/<vehiculo_id>/<mes>/…` y `/api/archivo` las autoriza por la
    visibilidad del vehículo. `flota` es slug de empresa reservado.
  - Avisos: cron de Vercel (`vercel.json`, lunes a viernes 11:00 UTC = 08:00 AR) en
    `/api/cron/flota`, firmado con `CRON_SECRET`. Arma el resumen del día por empresa
    (`mensajeResumenDiario`, la misma cuenta que ve `/flota`) y lo manda por WhatsApp
    (`lib/whatsapp.ts`, WAHA). **Sin las variables `WHATSAPP_WAHA_*` no se manda nada**: el aviso
    queda registrado como "sin canal" en `flota_avisos`. **Por decisión de Brandon (02/10/2026) el
    WhatsApp queda "en desarrollo"**: `/flota` muestra un cartel en vez de la gestión de encargados
    (`EncargadosClient.tsx` existe pero no se usa). Para habilitarlo: decidir el número, cargar las
    variables y volver a montar `EncargadosClient` en `flota/page.tsx`.
  - Pantallas: `/flota?empresa=slug` (semáforo por vehículo con patente/marca/modelo/año y
    botón "QR" por fila que abre la hoja de esa camioneta con `imprimir=1` y lanza la impresión),
    `/flota/<id>` (ficha: checklists con fotos y comparación con el anterior, novedades,
    mantenimiento, datos, QR y rotación del token), `/flota/qr` (hoja imprimible, 4 por A4) y
    `/flota/datos` (marca/modelo/año de toda la flota en una grilla).
  - La etiqueta impresa dice "Checklist obligatorio" sin frecuencia: se hace los días 1 y 15 y
    puede pasar a mensual sin reimprimir.

---

## 7. Sistema de diseño (rediseño 2026-07 — respetarlo)

Brandon rechazó explícitamente la estética anterior ("infantil, muchos colores").
El sistema actual es **minimal empresa-céntrico**:

- **UN solo acento**: índigo (`--primary`). **PROHIBIDO** reintroducir colores por
  empresa (se eliminaron todos los mapas `EMPRESA_*`).
- **El color solo comunica estado**: tokens `--success` (teal) / `--warning`
  (naranja) / `--danger` (rojo) + variantes `-subtle`. Nada más lleva color.
- Tema **claro por defecto** (toggle oscuro disponible) · radius 12px · cards
  `rounded-2xl` · tipografía: h1 `text-2xl font-semibold tracking-tight`.
- **Componentes obligatorios** (`src/components/ui/`):
  - `EstadoPill` / `EstadoBadgeSuave` — ÚNICO encoding de estado de vencimiento.
  - `Monograma` — avatares de iniciales (nada de tiles de colores).
  - `BarraVencimiento`, `Donut` (SVG puro), `Segmented` (tabs).
- **AppShell** (`components/layout/AppShell.tsx`): sidebar única clara. Arriba, el
  selector **"Viendo"** (persistido en `localStorage.empresa_activa`) con **Todas las
  empresas** como primera opción (solo si el usuario ve más de una), cada empresa y ARCOR.
  Debajo, las vistas de lo elegido, con ícono y agrupadas: sin título (Resumen, Empleados,
  Vencimientos), **Documentación** (Habilitaciones = `?vista=documentacion`, Mensual =
  `/documentos`), **Recursos** (Flota, Stock) y **Administración**. Con "Todas" solo aparecen
  las que existen para el grupo (Resumen general = `/dashboard`, Empleados, Vencimientos,
  Flota). Cambiar de empresa te deja en la MISMA pantalla (`destino()`), no en el Resumen.
  El usuario es un solo botón que abre Inicio, tema y cerrar sesión. Sin rail de módulos
  (decisión explícita de Brandon: no mezclar módulos). Se sacaron los "Sectores": eran
  links que llevaban todos a la misma página.
- Botones primarios: `bg-primary hover:bg-primary/90 text-primary-foreground`
  (nunca `hover:brightness-*` ni `text-white` hardcodeado).
- **Pendiente (F5)**: extender estos tokens a Comercial (EtapaBadge tiene 11 colores)
  y Operaciones (`SectionHeader` con naranja hardcodeado). Si tocás esas pantallas,
  acercalas al sistema.

---

## 8. Archivos adjuntos (R2) — no romper esto

Vercel corta cualquier request > 4.5MB con 413 **antes** de llegar a la app.
Por eso la subida es **directa a R2 con URL prefirmada**:

1. `POST /api/upload-url` → valida sesión + rol + que el certificado sea **visible
   por RLS** → devuelve `{ url, path }`.
2. El browser hace `PUT` directo a R2 (sin límite).
3. `POST /api/upload` (JSON) registra la fila en `archivos` (gated por RLS).

El helper es `src/lib/upload-client.ts` (`subirArchivo`) — usalo siempre; tiene
fallback multipart para archivos ≤4MB si el PUT directo falla. Los comprobantes de sueldo
usan el mismo circuito con `subirRecibo` (`/api/upload-url` con `recurso: 'recibo'`, fila en
`recibos_sueldo` vía `/api/recibos`) y la documentación mensual con `subirDocumento` (`recurso:
'documento'`, fila en `documentos_mensuales` vía `/api/documentos`, path `documentos/<empresaId>/…`
que el registro valida); `GET /api/archivo` elige la tabla dueña por el **prefijo del path**
(`recibos/` → `recibos_sueldo`, `documentos/` → `documentos_mensuales`, resto → `archivos`) y
valida vía RLS antes de firmar. Por eso `recibos` y `documentos` son slugs de empresa reservados.

- `GET /api/archivo` verifica que el archivo exista **vía RLS antes de firmar** la
  URL de descarga (fix de un IDOR real). `DELETE` borra la fila primero y R2 después.
  **No cambiar ese orden ni saltear la verificación.**
- ⚠️ **CORS del bucket:** el PUT directo requiere CORS en el bucket `brandon4320`
  (AllowedOrigins: dominios de la app; Methods PUT/GET/HEAD). Al momento de escribir
  esto estaba **pendiente de configurar en el dashboard de Cloudflare** — si los
  archivos grandes fallan, verificá eso primero.

---

## 8b. Sección Tecnophos - ARCOR (observabilidad del sistema externo)

El sistema de certificados de fumigación de contenedores para ARCOR es **otro proyecto**
(`C:\Dev\Arcor`, repo privado `AgusAlvarez3/tecnophos-arcor`): FastAPI + n8n + Evolution
(WhatsApp) en un droplet, con Google Sheets como fuente de verdad. Gestión **no lo opera**:
solo muestra lo que ese sistema le reporta.

- **Modelo push.** El servicio (`servicio/gestion.py`) y tres workflows de n8n (WF0 fallos,
  WF10 crédito Claude, WF12 guardia WhatsApp) hacen `POST /api/arcor/ingest` con items
  `contenedor` / `evento` / `estado`. n8n no toca Supabase ni conoce el token: llama a
  `POST servicio:8077/gestion/notificar` y el servicio reenvía.
- **Auth del ingest:** `Authorization: Bearer <token>`; sha256 del token en
  `arcor_config.ingest_token_hash` (el route handler usa service role). El token en claro vive
  en el `.env` del droplet y en Bitwarden. **No hay env var nueva en Vercel** a propósito.
  La ruta está en `PUBLIC_PATHS` del proxy. **El hash NO se commitea** (el repo es público):
  la migración 14 lleva un placeholder y el INSERT real se corre solo en el SQL editor. Si la DB
  falla o falta el hash el ingest responde **503**, no 401: un 401 es token equivocado de verdad.
- **Tablas `arcor_*`** (migración 14): `arcor_contenedores` (unique `(contenedor, mes)`, misma
  clave que el appendOrUpdate del Sheets), `arcor_eventos` (log; las alertas con estado usan
  `clave_alerta` + `resuelto_en`: una abierta por clave), `arcor_estado` (clave → último valor:
  whatsapp, claude, heartbeat, publicaciones), `arcor_config`. RLS de lectura
  `app_es_rrhh() and app_ve_todas_empresas()` = `puedeVerArcor()`; **sin policies de
  escritura** para authenticated. No están en `database.ts`: `modules/arcor/db.ts` castea.
- **Silencio del sistema** no vive en la DB: `evaluarSilencio()` compara el heartbeat con
  la hora AR al renderizar (3 h de día, 11 h de noche, y hasta las 08:30 sigue valiendo el umbral
  nocturno porque la guardia de las 08:00 puede demorar). El heartbeat se toca **solo si la request
  procesó al menos un item** (una request que falla entera no es "el sistema está vivo") y guarda
  `procesados`/`errores`.
- **Reglas del ingest para contenedores:** un reporte posterior con MENOS datos no borra lo que
  ya se sabía (booking/OE/hash se conservan si vienen vacíos; observaciones ídem — trampa #17) y
  un contenedor `encontrado` **no vuelve** a `pendiente_arcor`, `revisar_foto` ni `descartado`
  por una foto re-enviada, una fila vieja del NO ENCONTRADOS o una limpieza de la galería. Los `(ilegible)` sin hash se clavean por
  `fecha|lugar|observaciones` (backfill idempotente). Las alertas abiertas se refrescan también en
  `severidad`/`titulo` (warning → critical se ve). Las lecturas (`queries.ts`) **lanzan** si
  Supabase falla y `arcor/error.tsx` lo muestra: en observabilidad, "no pude leer" nunca puede
  parecer "todo en cero". Un contenedor re-enviado sin cambios (mismo estado, publicado, booking,
  OE, lugar y fecha — `fusionarContenedor`) responde `accion: 'sin_cambios'` y **no suma evento**.
- **Lectura del tablero (2026-10-02):** "Pendiente ARCOR" y "Revisar foto" son **colas de todos
  los meses** (`getColasAbiertas`: un pendiente del 30/09 sigue esperando el 1/10) y el tile de
  Revisar foto muestra el mismo número que el botón "Revisar dudosas". El total del mes se compara
  con el mes anterior **hasta el mismo día**. La actividad oculta por defecto `TIPOS_RUIDO`
  (`imagen_ignorada`, `ocr_claude`: eran el 65 % del log; opción "Todo"), cuenta con
  `count: 'exact', head: true` y pagina con cursor `?antes=<ts>,<id>` (el id desempata: un lote
  del ingest graba todos los eventos con el mismo ts). Contenedores: `?q=` busca en todos los
  meses, `?mes=todos` saca el filtro de mes, los descartados solo se ven con su filtro o buscando.
  `AutoRefresh` refresca las pantallas cada 2 min y al volver a la pestaña.
- **Acceso:** `puedeVerArcor(sesion)` (rol RRHH + `empresaAcceso == null`) es el ÚNICO guard
  válido; `puedeAccederModulo(rol, 'arcor')` es más laxo (solo rol) y no alcanza. El hub filtra
  ARCOR con `puedeVerArcor` antes de decidir la redirección directa.
- **Pendiente del lado ARCOR (repo `C:\Dev\Arcor`):** el productor nunca cierra un
  `pendiente_arcor`/`revisar_foto` (WF8, WF11 y la galería no reportan a Gestión), y WF10 ignora
  `sin_credito`. Gestión ya muestra `sin_credito` como crítico; falta que el productor lo alerte.
- Las reglas de negocio espejadas (4 lugares, `mesDeFecha` = pestaña del Sheets, fallback
  BUENOS AIRES) están en `modules/arcor/reglas.ts` **con tests**. Si cambian en el servicio Python,
  cambian acá.
- Fechas en hora AR: `src/lib/fechas-ar.ts` (compartible; comercial tiene su copia histórica).
- **La operación vive en el sistema externo** (páginas `/cargar` y `/cargar/revisar` del droplet):
  Gestión enlaza a ellas desde la sección (`components/arcor/AccionesArcor.tsx`, tile "Revisar
  foto", vista "Carga manual" en la sidebar). URLs centralizadas en `modules/arcor/enlaces.ts`.
  El hub ya no tiene fila externa de ARCOR (se unificó el 2026-09-08).

---

## 9. Fechas — Argentina (UTC-3), fuente de bugs recurrentes

`new Date('2026-08-10')` es medianoche **UTC** = día anterior a las 21:00 en
Argentina. Patrones obligatorios:

- Para `<input type="date">`: `fecha?.slice(0, 10)`.
- Para MOSTRAR una fecha date-only: `new Date(f.slice(0,10) + 'T12:00:00')`.
- Estado/conteo de días: `getEstadoVencimiento(fecha, alerta_dias)` y
  `diasHastaVencimiento(fecha)` de `src/types/index.ts` — **pasá siempre
  `alerta_dias`** (cada certificado define su ventana de alerta).
- En Comercial (timestamps con hora): `src/modules/comercial/fechas.ts`
  (`fmtFechaAR/fmtHoraAR/fmtFechaHoraAR`, formatean en TZ América/Argentina).

---

## 10. Flujo de trabajo y convenciones

- **`npm run build` SIEMPRE antes de pushear** (compila + typecheck). Si no compila,
  no se pushea.
- **Push a `main` deploya DIRECTO a producción** (no hay staging). El sistema se usa
  a diario: pensá dos veces los cambios destructivos y avisá a Brandon ante cambios
  de flujo grandes. Rollback: desde el dashboard de Vercel.
- **NUNCA** commitear `.env.local` ni secretos (el `.gitignore` ya cubre, no lo toques).
- Migraciones: ver §6 (archivo + aplicar a mano + commit).
- Mutaciones desde client components: patrón `fetch` a una API route +
  `router.refresh()` + `toast` de sonner (nada de `window.location.reload()`).
- Errores al usuario: en RRHH conviven `alert()` viejos y toasts; para código nuevo,
  **toast siempre**, y jamás tragarse un error de Supabase en silencio. El texto sale de
  `mensajeError(e, 'guardar')` (`src/lib/errores.ts`), nunca el mensaje crudo de Postgres;
  en lecturas del server usá `leer(res)` para que un fallo lance en vez de mostrar "Todo al día".
- Búsquedas en listas: `coincide(busqueda, ...campos)` de `src/lib/texto.ts` (por palabras,
  sin acentos, en cualquier orden).
- Español rioplatense en la UI (vos/agregá/podés).

---

## 11. Estado actual y pendientes (a la fecha de este documento)

**Hecho y estable:** los 3 módulos completos en producción; rediseño RRHH completo
(F1–F4); subida directa a R2; secciones dinámicas de activos; workspace comercial
(tabs Hoy/Por proyecto/Por comercial/Tablero, kanban, métricas por comercial).

**Pendientes conocidos (prioridad aproximada):**
1. **CORS del bucket R2** (§8) — bloquea subidas > 4MB. Config manual en Cloudflare.
2. **F5 diseño**: llevar tokens/EstadoPill a Comercial y Operaciones.
3. **Performance RRHH — HECHO (2026-09)**, mantener el patrón: funciones Vercel en
   `gru1` (vercel.json, colocadas con la DB São Paulo); `loading.tsx` por segmento
   (sin uno, la navegación queda congelada hasta el payload completo — no borrarlos);
   un solo `Promise.all` por página (nada de lookups seriales: filtrar por
   `empresas!inner(slug)`); filtros gruesos por fecha en la DB con holgura ±1 día y
   refinado exacto en JS (`/vencimientos`, `/dashboard`); tabs con `SegmentedLocal`
   (contenido en el payload, sin round-trip; `Segmented` con Links queda para tabs
   que sí cambian los datos); `staleTimes.dynamic=30` en next.config; auth por
   `getClaims()` (con signing keys asimétricas en Supabase verifica local; NO volver
   a `getUser()` en el camino caliente).
4. RRHH: botón **"Renovar"** certificado en el legajo (copiar cert con fecha +1 año).
5. Comercial: **TagPicker UI** (la DB `comercial_tags` + `etiquetas[]` ya existe),
   posponer/snooze de tareas (el PATCH ya acepta `fecha_vencimiento`), marcar
   "en proceso" de 1 toque, recordatorios (`fecha_recordatorio` existe sin uso;
   no hay web-push), tablas de proyectos/clientes como cards en mobile,
   columna `valor_cierre` en proyectos (hoy "monto ganado" usa `valor_estimado`).
6. Operaciones: dashboard de métricas, export PDF del reporte diario.

---

## 12. Gotchas rápidos (aprendidos a golpes)

- `params`/`searchParams` son Promise (Next 16). `proxy.ts`, no middleware.
- Tipos de Supabase para `comercial_*` no existen → `cdb()`/`rows<T>()`.
- `'otro'` en selects de tipo de certificado NO es UUID (§6).
- Guards de UI ⇄ RLS siempre sincronizados (§5). `LEGAJO_ESCRITURA = [admin, usuario]`
  espeja `app_es_rrhh()`.
- Fechas: §9. Todo bug de "aparece un día menos" viene de ahí.
- Strings con acentos en JSX: cuidado con el encoding (hubo mojibake una vez);
  los archivos son UTF-8, no copiar/pegar desde fuentes raras.
- `.no-scrollbar` es una utility propia (globals.css).
- El RRHH multi-empresa incluye a Serviwhite como EMPRESA, pero el **ERP de
  Serviwhite es OTRO proyecto** (repo `serviwhite`) — no confundirlos.
- Assets de marca en `public/`: `logo-*-iso.png` (isologos selector), versiones
  `-blanco` para fondos oscuros. El logo de ADC es el PNG oficial (no recrear en SVG).
- Usuarios reales: Administrador (Brandon), Nicole, Aylen, Mariano (rol `usuario`,
  ven todo), Soledad (`usuario` scoped a Tecnophos Rosario).
- **"Hoy" siempre en hora AR**: `diaClaveAR(new Date())` / `anioMesAR()` / `hoyClave()` /
  `mesActualInput()`. NUNCA `new Date().toISOString().slice(0,10)` ni `getMonth()` a secas
  para decidir un mes o una fecha por defecto (a las 21:00 AR ya es "mañana" en UTC).
- Slugs de empresa reservados: `recibos`, `documentos`, `docs`, `flota` (migraciones 18 y 20 lo imponen).
- `AppShell` recuerda lo elegido solo entre empresas y "todas"; el portal ARCOR nunca queda
  como preferido (si no, /dashboard mostraba la sidebar de ARCOR). En las pantallas que
  aceptan todas las empresas (`RUTAS_GLOBALES`: /dashboard, /empleados, /vencimientos,
  /flota), **no tener `?empresa=` significa "todas"**, no "la última elegida".
