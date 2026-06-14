# Módulos

Cada módulo de negocio vive acá como un **contexto independiente**:

```
src/modules/<modulo>/
  reglas.ts        # reglas de negocio puras (testeables, sin I/O)
  queries.ts       # lectura de datos (Supabase) — server
  actions.ts       # mutaciones (server actions)
  components/       # UI propia del módulo
  tipos.ts         # tipos del dominio (derivados de @/types/database)
```

Reglas:

- **No cruzar datos entre módulos.** RRHH y Limpieza no comparten tablas ni FKs (decisión de arquitectura). Si algún día se conectan, se hace explícito.
- El acceso por módulo se define en `src/config/modules.ts` y se exige con `requireModulo()` de `@/lib/auth/session`.
- Las reglas críticas van en `reglas.ts` como funciones puras y se testean (ver `*.test.ts`).
