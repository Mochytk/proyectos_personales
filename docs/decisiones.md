# Registro de decisiones

Una linea por decision: `AAAA-MM-DD | decision | por que`.

- 2026-10-15 | Una rama por cambio con PR a `develop`; `main` solo al terminar una app completa | Evitar commits directos en `develop` y mantener `main` estable (ver CONTRIBUTING.md)
- 2026-10-23 | Habit tracker: rama base `app/habit_tracker`, ramas `feat/`, `fix/`, `chore/`... y PR hacia ella | Fases pequenas y revisables sin tocar `develop` (ver CONTRIBUTING.md)
- 2026-10-23 | Habit tracker en `App_Habit_Tracker/`, monorepo pnpm, TypeScript 6.0 y Node 24 | `typescript-eslint` aun no soporta TS 7 (ADR 0001)
- 2026-10-23 | Habit tracker: React + Vite + Dexie (IndexedDB) como fuente de verdad del cliente | Offline-first y escrituras locales en menos de 100 ms (ADR 0002)
- 2026-10-23 | Habit tracker: un Worker de Cloudflare sirve web y API en el mismo origen, con Previews por rama | Gratis, cookies del mismo sitio y secretos por entorno (ADR 0003)
- 2026-10-23 | Habit tracker: Neon Postgres + Drizzle con migraciones SQL versionadas | Postgres gratis con ramas por entorno; la base no se consulta para saber si hay cambios (ADR 0004)
- 2026-10-23 | Habit tracker: Better Auth con registro cerrado por variable de entorno | Libreria mantenida, sin criptografia propia; proveedor de correo pendiente (ADR 0005)
- 2026-10-23 | Habit tracker: sync push/pull propio, ultimo en escribir por registro, aviso de cambios por Durable Object | Simple para un usuario y sin gastar el computo de Neon (ADR 0006)
- 2026-10-23 | Habit tracker: dias como fecha local con corte a las 04:00; DD-MM-AAAA en pantalla | Rachas estables ante horario de verano y trasnoches (ADR 0007)
- 2026-10-23 | Habit tracker: Electron con firma ad hoc y token en safeStorage asincrono | Sin cuenta de Apple; la API sincrona se elimina en Electron 46 (ADR 0008)
