# RRHH — Tecnophos / ADC

Sistema de gestión de RRHH y vencimientos para Tecnophos (Bahía Blanca, Rosario, Necochea) y ADC S.R.L.

---

## Stack

- **Next.js 14** (App Router + TypeScript)
- **Supabase** (PostgreSQL + Storage + Auth)
- **Tailwind CSS**
- **date-fns**

---

## Setup local

### 1. Dependencias

```bash
npm install
```

### 2. Variables de entorno

```bash
cp .env.local.example .env.local
# Completar con tus valores de Supabase
```

### 3. Base de datos — ejecutar en Supabase SQL Editor en orden

```
supabase/schema.sql   ← estructura + RLS + Storage bucket
supabase/seed.sql     ← todos los empleados del Excel
```

### 4. Crear usuario admin

1. Ir a Authentication > Users en Supabase dashboard
2. Crear usuario: admin@tecnophos.internal
3. Copiar el UUID y ejecutar:

```sql
insert into perfiles (id, nombre, rol)
values ('<UUID>', 'Administrador', 'admin');
```

### 5. Correr localmente

```bash
npm run dev
```

---

## Deploy en Vercel

```bash
git init && git add . && git commit -m "initial"
git remote add origin https://github.com/USUARIO/REPO.git
git push -u origin main
```

Luego en vercel.com/new importar el repo y agregar las 3 env vars de Supabase.

---

## Estructura

```
src/app/
  login/                   Login
  (protected)/
    dashboard/             Dashboard con alertas
    empleados/             Listado global
    empresa/[slug]/        Vista por empresa + sectores + vehículos
    legajo/[id]/           Legajo individual + archivos
    vencimientos/          Tabla con filtros
supabase/
  schema.sql
  seed.sql
```
