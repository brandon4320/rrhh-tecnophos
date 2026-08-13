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
| **RRHH** | `/(protected)` → `/dashboard`, `/empleados`, `/empresa/[slug]`, `/legajo/[id]`, `/vencimientos`, `/admin/*` | Carpeta documental: empleados, certificados con vencimiento, vehículos, equipos/activos (matafuegos, Draeger), habilitaciones de empresa, archivos adjuntos | Administración (desktop) |
| **Operaciones** | `/operaciones` | Servicio de limpieza de ADC en planta UNIPAR: asistencia, tareas, cronograma, reportes diarios, stock, feedback del cliente | Supervisores/operarios ADC + cliente UNIPAR (mobile) |
| **Gestión Comercial** | `/comercial` | CRM: clientes, proyectos (pipeline), tareas, agenda, viajes, equipo, reportes. Workspace estilo Notion con kanban | Equipo comercial (MUY mobile) |
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
│   ├── operaciones/                # ═══ MÓDULO OPERACIONES ═══
│   ├── comercial/                  # ═══ MÓDULO COMERCIAL ═══
│   └── api/
│       ├── upload-url/             # firma URL para PUT directo a R2
│       ├── upload/                 # registra fila archivo (+fallback multipart)
│       ├── archivo/                # GET url firmada (valida RLS) / DELETE
│       └── comercial/{tarea,proyecto,tags,tarea-rapida}/
├── components/
│   ├── layout/AppShell.tsx         # Sidebar única RRHH (empresa activa)
│   ├── ui/                         # sistema de diseño (ver §7)
│   ├── comercial/  operaciones/  brand/
├── config/modules.ts               # registro de módulos + acceso por rol
├── lib/
│   ├── auth/{roles,session}.ts     # ★ autorización central
│   ├── supabase/{server,client,admin}.ts
│   ├── r2/{client,operations}.ts
│   └── upload-client.ts            # helper de subida (browser)
├── modules/comercial/              # queries/actions/tipos/reglas del CRM
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
  `getUser()` + query a `perfiles` a mano.
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
- Modelo RRHH clave: `certificados` tiene dueño **excluyente** (constraint
  `check_owner`): empleado_id | empresa_id | vehiculo_id | equipo_id.
  `tipos_certificado` tiene flags `aplica_personal/empresa/vehiculo/equipo`.
  `equipos` tiene `categoria` (texto) y las secciones viven en `activo_secciones`
  (pueden existir vacías; matchean por nombre).
- **En los `<select>` de tipo de certificado, la opción "Otro" usa el valor
  `'otro'`, que NO es un UUID**: al guardar va `tipo_id: null` +
  `tipo_nombre_custom`. Ese bug ya se arregló una vez — no lo reintroduzcas.

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
- **AppShell** (`components/layout/AppShell.tsx`): sidebar única clara con selector
  de **Empresa activa** (persistida en `localStorage.empresa_activa`). Sin rail de
  módulos (decisión explícita de Brandon: no mezclar módulos).
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
fallback multipart para archivos ≤4MB si el PUT directo falla.

- `GET /api/archivo` verifica que el archivo exista **vía RLS antes de firmar** la
  URL de descarga (fix de un IDOR real). `DELETE` borra la fila primero y R2 después.
  **No cambiar ese orden ni saltear la verificación.**
- ⚠️ **CORS del bucket:** el PUT directo requiere CORS en el bucket `brandon4320`
  (AllowedOrigins: dominios de la app; Methods PUT/GET/HEAD). Al momento de escribir
  esto estaba **pendiente de configurar en el dashboard de Cloudflare** — si los
  archivos grandes fallan, verificá eso primero.

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
  **toast siempre**, y jamás tragarse un error de Supabase en silencio.
- Español rioplatense en la UI (vos/agregá/podés).

---

## 11. Estado actual y pendientes (a la fecha de este documento)

**Hecho y estable:** los 3 módulos completos en producción; rediseño RRHH completo
(F1–F4); subida directa a R2; secciones dinámicas de activos; workspace comercial
(tabs Hoy/Por proyecto/Por comercial/Tablero, kanban, métricas por comercial).

**Pendientes conocidos (prioridad aproximada):**
1. **CORS del bucket R2** (§8) — bloquea subidas > 4MB. Config manual en Cloudflare.
2. **F5 diseño**: llevar tokens/EstadoPill a Comercial y Operaciones.
3. **Performance RRHH**: `/vencimientos` y `/dashboard` traen TODA la tabla
   `certificados` y filtran en JS — empujar filtros a la DB cuando crezca
   (hay plan detallado: filtro grueso por rango de fecha + refinado en JS).
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
