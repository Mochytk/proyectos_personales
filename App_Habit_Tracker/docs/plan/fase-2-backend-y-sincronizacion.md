# Fase 2 · Backend, cuenta y sincronización: plan de implementación

> **Para agentes:** usar `superpowers:executing-plans` (ejecución nativa, decidida el 23-10-2026) para implementar este plan tarea por tarea. Los pasos usan casillas (`- [ ]`) para marcar el avance.

**Objetivo:** que la app de la fase 1 se sincronice entre dispositivos a través de un Worker de Cloudflare con Neon Postgres, detrás de un login con Better Auth, y que puedas usarla a diario con tus datos reales desde una URL estable.

**Arquitectura:** un solo Worker (`apps/api`) sirve la web y la API `/api/*` en el mismo origen (ADR 0003). Hono enruta; Better Auth maneja la cuenta (ADR 0005); Drizzle habla con Postgres (ADR 0004); la sincronización es *push*/*pull* por lotes con la última escritura ganadora por registro, y un Durable Object por usuario responde "¿hay cambios?" sin despertar Neon (ADR 0006). La lógica pura del protocolo vive en `packages/shared`.

**Stack:** Hono 4.13, Better Auth 1.7, Drizzle ORM 0.45 + drizzle-kit 0.31, `@neondatabase/serverless` 1.2, `pg` 8.23 (aprobado el 29-10-2026), Wrangler 4, Vitest 5, Playwright. Las versiones exactas se fijan al instalar, con al menos una semana de publicadas.

**Especificación:**

- Documento maestro: RF-3 (cuenta), RF-4 (sincronización), RNF-4, RNF-6 y RNF-20.
- [ADR 0003](../decisions/0003-servidor-y-hosting.md), [ADR 0004](../decisions/0004-base-de-datos-y-orm.md), [ADR 0005](../decisions/0005-autenticacion.md), [ADR 0006](../decisions/0006-sincronizacion.md) y [ADR 0010](../decisions/0010-uso-diario-antes-de-la-fase-6.md).
- [`../modelo-de-datos.md`](../modelo-de-datos.md) y [`../cuentas.md`](../cuentas.md).

**Depende de:** la fase 1 fusionada (`phase-1-ok`).

## Restricciones globales

- Las de la fase 1 siguen valiendo: TypeScript estricto, código y comentarios en inglés, interfaz en español de Chile, fechas en DD-MM-AAAA, un commit por cambio lógico, una PR por rama hacia `app/habit_tracker`.
- Paquetes nuevos: `@habit-tracker/api` (`apps/api`).
- **Ningún secreto en el repo.** `DATABASE_URL`, `BETTER_AUTH_SECRET` y `BREVO_API_KEY` viven solo en Cloudflare, en los secretos de GitHub o en `apps/api/.dev.vars` (ignorado por git; se versiona `.dev.vars.example` sin valores).
- **Toda consulta de datos filtra por el `user_id` de la sesión**, nunca por un valor que mande el cliente. Toda entrada se valida con los esquemas de `packages/shared`.
- **Migraciones:** una por commit, generadas con `drizzle-kit generate`, con la reversa en el mensaje del commit. Nunca `drizzle-kit push`.
- **Errores de la API:** siempre JSON `{ "error": "<código>" }` con el estado HTTP correcto, sin trazas ni detalles internos.
- **Cookies de sesión:** `HttpOnly`, `Secure` (salvo `http://localhost`) y `SameSite=Lax`. Sesión de 30 días que se renueva con el uso.
- **Driver de base de datos:** `DATABASE_DRIVER=neon` en Cloudflare y `pg` en desarrollo, pruebas y CI (ADR 0010).
- **Pruebas de integración** contra Postgres real (16 o más): `TEST_DATABASE_URL`, por defecto `postgres://postgres:postgres@localhost:5432/postgres`. En el CI, Postgres como servicio del job.
- **Nada se despliega a producción** salvo cuando fusionas una PR de *release* (ADR 0010).

## Foco de revisión

Las cinco situaciones que la especificación no prueba y que más probablemente te afecten:

1. **Respuesta perdida después del *commit*.** El teléfono sube un lote, el servidor lo guarda y la conexión se corta antes de la respuesta. El reintento no debe duplicar ni pisar nada (tareas 7 y 10).
2. **Reloj del dispositivo adelantado.** Un dispositivo con la hora una hora adelante no debe ganar todos los conflictos para siempre: `updated_at` se recorta a 5 minutos en el futuro (tareas 6 y 7).
3. **Sesión vencida o cerrada desde otro dispositivo mientras hay cambios pendientes.** La *outbox* se conserva, el estado dice "Inicia sesión para sincronizar" y al volver a entrar se sube todo (tareas 10 y 11).
4. **Neon dormido o lento en la primera consulta.** La primera sincronización del día puede tardar; no debe quedar un spinner infinito ni marcarse como error si responde dentro de 15 s (tareas 3 y 10).
5. **Primera sincronización de un dispositivo nuevo con mucho historial.** El *pull* va por páginas de 500 hasta `hasMore = false`, sin perder filas entre páginas (tareas 7 y 10).

---

## PR 2.0 · `docs/phase-2-plan`

Este plan, el ADR 0010, la tabla de la fase 2 en [`README.md`](README.md) y las líneas de `docs/decisiones.md`. Sin código.

## PR 2.1 · `feat/api-skeleton`

### Tarea 1: Worker con Hono, archivos de la web y salud

**Archivos:** crear `apps/api/package.json`, `apps/api/tsconfig.json`, `apps/api/wrangler.jsonc`, `apps/api/worker-configuration.d.ts` (generado con `wrangler types`, versionado), `apps/api/.dev.vars.example`, `apps/api/src/index.ts`, `apps/api/src/app.ts`, `apps/api/src/app.test.ts`, `apps/api/vitest.config.ts`, `apps/web/public/_headers`.

**Interfaces:**
- Produce `createApp(deps: AppDeps): Hono<AppEnv>` en `src/app.ts`. `AppDeps` crece en tareas siguientes (`db`, `auth`, `notifier`); aquí está vacío. Las pruebas usan `app.request()` en Node, sin `workerd`.
- Produce el `default export` de `src/index.ts`: `{ fetch(request, env, ctx) }`, que arma las dependencias desde `env` y llama a `createApp`.
- `wrangler.jsonc`: `name: "constancia"`, `main: "src/index.ts"`, `compatibility_flags: ["nodejs_compat"]`, `assets: { directory: "../web/dist", not_found_handling: "single-page-application", binding: "ASSETS", run_worker_first: ["/api/*"] }`, `observability.logs.enabled: true`, `vars.DATABASE_DRIVER: "neon"` y un bloque `previews` con las mismas variables (ADR 0010).

- [ ] **Paso 1: tests.**
  - `GET /api/health` responde `200` con `{ "status": "ok" }`.
  - `GET /api/no-existe` responde `404` con `{ "error": "not_found" }`.
  - Una ruta que lanza un error responde `500` con `{ "error": "internal" }`, sin traza.
  - Toda respuesta de `/api/*` trae `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`, `X-Frame-Options: DENY` y `Cache-Control: no-store` (con `hono/secure-headers` y un *middleware* propio para `Cache-Control`).
- [ ] **Pasos 2 a 4:** ver que fallan, implementar y ver que pasan.
- [ ] **Paso 5: `_headers` de la web.** Para `/*`: `Content-Security-Policy: default-src 'self'; img-src 'self' data:; style-src 'self'; font-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'`, más `X-Content-Type-Options`, `Referrer-Policy` y `Permissions-Policy: camera=(), microphone=(), geolocation=()`. Verificar con `pnpm --filter @habit-tracker/api exec wrangler dev` que la web carga sin errores de CSP en la consola (Playwright, como en la fase 1).
- [ ] **Paso 6: commit.** `feat(api): add the Worker with Hono, web assets and health check`.

## PR 2.2 · `feat/db-schema`

### Tarea 2: esquema Drizzle y migraciones

**Archivos:** crear `apps/api/drizzle.config.ts`, `apps/api/src/db/schema/auth.ts`, `apps/api/src/db/schema/sync.ts`, `apps/api/src/db/schema/index.ts`, `apps/api/drizzle/` (migraciones generadas), `apps/api/src/test/db.ts` y `apps/api/src/db/schema.test.ts`.

**Interfaces:**
- `schema/auth.ts`: las tablas `user`, `session`, `account`, `verification` y `rateLimit` exactamente como las pide el adaptador de Drizzle de Better Auth 1.7 (página "Database → Core Schema" de su documentación). Se escriben a mano, sin correr su CLI.
- `schema/sync.ts`: `userSettings`, `anchors`, `habits`, `checkIns`, `weeklyQuotaOverrides` y `weeklyReviews`, con los campos de `packages/shared/src/schemas/habits.ts`, más `userId` (`text`, no nulo) y `serverSeq` (`bigint`, no nulo). Clave primaria `(user_id, id)`, índice `(user_id, server_seq)` y la secuencia `sync_seq`. Columnas en `snake_case` con `casing: "snake_case"` de Drizzle. Sin claves foráneas entre tablas sincronizables (modelo de datos).
- `src/test/db.ts` produce `createTestDatabase(): Promise<{ url: string; drop(): Promise<void> }>`: crea una base vacía con nombre al azar, le aplica las migraciones con el *migrator* de `drizzle-orm/node-postgres` y la borra al final.

- [ ] **Paso 1: test.** `schema.test.ts`: después de migrar, existen las 11 tablas y la secuencia; la PK de `check_ins` es `(user_id, id)`; insertar dos filas con el mismo `id` y distinto `user_id` funciona.
- [ ] **Pasos 2 a 4:** ver que falla, escribir el esquema, `drizzle-kit generate` y ver que pasa.
- [ ] **Paso 5: commits.** Uno por migración:
  - `feat(api): add the Better Auth tables` (reversa: `DROP TABLE` de las 5 tablas);
  - `feat(api): add the synced tables` (reversa: `DROP TABLE` de las 6 tablas y `DROP SEQUENCE sync_seq`).

### Tarea 3: conexión por petición

**Archivos:** crear `apps/api/src/db/client.ts` y `apps/api/src/db/client.test.ts`.

**Interfaces:**
- Produce `type Db = PgDatabase<...>` (el tipo común de `drizzle-orm/neon-serverless` y `drizzle-orm/node-postgres`) y `openDb(env: { DATABASE_URL: string; DATABASE_DRIVER: 'neon' | 'pg' }): { db: Db; close(): Promise<void> }`.
- Con `neon`, un `Pool` de `@neondatabase/serverless` creado dentro de la petición; con `pg`, un `Pool` de `pg` con `connectionTimeoutMillis: 15_000`. `src/index.ts` cierra con `ctx.waitUntil(close())`.

- [ ] **Paso 1: tests** (driver `pg` contra la base de prueba): `select 1` funciona; una transacción que lanza no deja filas; `DATABASE_DRIVER` desconocido lanza al arrancar.
- [ ] **Pasos 2 a 4** y **paso 5: commit.** `feat(api): open the database per request`.

## PR 2.3 · `feat/auth`

### Tarea 4: Better Auth en el Worker

**Archivos:** crear `apps/api/src/auth/auth.ts`, `apps/api/src/auth/session.ts` y `apps/api/src/auth/auth.test.ts`.

**Interfaces:**
- Produce `createAuth(env: AuthEnv, db: Db)` con:
  - `emailAndPassword: { enabled: true, minPasswordLength: 12, disableSignUp: env.AUTH_SIGNUP_ENABLED !== 'true' }`;
  - `session: { expiresIn: 60 * 60 * 24 * 30, updateAge: 60 * 60 * 24 }`;
  - `rateLimit: { enabled: true, storage: 'database' }` (por defecto, `/sign-in/email` permite 3 intentos cada 10 s);
  - `advanced.ipAddress.ipAddressHeaders: ['cf-connecting-ip']`;
  - `baseURL: { allowedHosts: env.AUTH_ALLOWED_HOSTS.split(',') }` (URL dinámica para las Previews, ADR 0010). `AUTH_ALLOWED_HOSTS` es `localhost:*` en `.dev.vars` y en Cloudflare se configura en el panel, para que tu subdominio no quede en el repo;
  - `database: drizzleAdapter(db, { provider: 'pg', transaction: true, schema })` y `secret: env.BETTER_AUTH_SECRET`.
- Monta `app.all('/api/auth/*', ...)`.
- Produce `requireSession`, un *middleware* que deja `c.var.userId` o responde `401 { "error": "unauthenticated" }`.

- [ ] **Paso 1: tests** (contra la base de prueba):
  - Con `AUTH_SIGNUP_ENABLED` distinto de `true`, `POST /api/auth/sign-up/email` no crea usuario.
  - Con `true`, sí lo crea. Una contraseña de 11 caracteres se rechaza.
  - El login correcto deja una cookie `HttpOnly` y `SameSite=Lax`.
  - El cuarto intento fallido en 10 s responde `429`.
  - `sign-out` invalida la sesión.
  - `revoke-sessions` cierra las otras sesiones del usuario.
  - `change-password` con `revokeOtherSessions: true` cierra las otras sesiones.
  - Una ruta protegida sin sesión responde `401`.
- [ ] **Pasos 2 a 4** y **paso 5: commit.** `feat(api): add Better Auth with closed sign-up and rate limits`.

## PR 2.4 · `feat/auth-reset`

### Tarea 5: recuperar la contraseña por correo

**Archivos:** crear `apps/api/src/email/sender.ts`, `apps/api/src/email/brevo.ts`, `apps/api/src/email/brevo.test.ts` y `apps/api/src/auth/reset.test.ts`. Modificar `auth.ts`.

**Interfaces:**
- Produce `interface EmailSender { send(message: { to: string; subject: string; text: string }): Promise<void> }`.
- Produce `brevoSender(env: { BREVO_API_KEY: string; EMAIL_FROM: string }, fetchImpl = fetch): EmailSender`, que hace `POST https://api.brevo.com/v3/smtp/email` con la cabecera `api-key`. Antes de escribirlo se revisa la documentación vigente de la API. `EMAIL_FROM` es tu correo y va como secreto, no en el repo.
- `createAuth` recibe un `EmailSender`. `sendResetPassword` manda el asunto "Restablecer tu contraseña de Constancia" y un texto con el enlace, que vence en 1 hora. `revokeSessionsOnPasswordReset: true`.

- [ ] **Paso 1: tests.**
  - `brevoSender` arma la petición esperada (con un `fetch` falso) y lanza si Brevo no responde `2xx`, sin incluir la clave en el error.
  - `reset.test.ts`, con un `EmailSender` falso: pedir el enlace, restablecer con el token, la contraseña vieja falla, la nueva funciona y las otras sesiones quedan cerradas. Un token usado no sirve dos veces.
- [ ] **Pasos 2 a 4** y **paso 5: commit.** `feat(api): reset passwords by email through Brevo`.

## PR 2.5 · `feat/sync-server`

### Tarea 6: contrato de sincronización compartido

**Archivos:** crear `packages/shared/src/sync/contract.ts`, `packages/shared/src/sync/conflict.ts` y sus tests. Modificar `packages/shared/src/index.ts`.

**Interfaces:**
- Produce `SYNC_TABLES = ['userSettings', 'anchors', 'habits', 'checkIns', 'weeklyQuotaOverrides', 'weeklyReviews'] as const` (padres primero) y `type SyncTable`.
- Produce `pushRequestSchema`: `{ rows: SyncRow[] }`, de 1 a 200 filas, donde `SyncRow = { table: SyncTable; row: <el esquema de esa tabla> }` (unión discriminada por `table`).
- Produce `pushResponseSchema`: `{ accepted: { table; id; serverSeq }[]; stale: { table; id }[]; version: number }`, y `pullResponseSchema`: `{ rows: (SyncRow & { serverSeq: number })[]; cursor: number; hasMore: boolean }`.
- Produce `wins(incoming: { updatedAt: string }, existing: { updatedAt: string } | undefined): boolean`. Gana el más nuevo; en empate gana el entrante, que llega último (ADR 0006).
- Produce `clampUpdatedAt(updatedAt: string, now: Date): string`, que recorta a `now + 5 min`.

- [ ] **Paso 1: tests.** Más nuevo gana, más viejo pierde, empate gana el entrante, sin fila existente gana. El recorte a 5 min en el futuro deja intactas las fechas pasadas. Un lote de 201 filas o con una tabla desconocida se rechaza.
- [ ] **Pasos 2 a 4** y **paso 5: commit.** `feat(shared): add the sync contract and conflict rule`.

### Tarea 7: *push* y *pull*

**Archivos:** crear `apps/api/src/sync/routes.ts`, `apps/api/src/sync/push.ts`, `apps/api/src/sync/pull.ts` y `apps/api/src/sync/sync.test.ts`.

**Interfaces:**
- `POST /api/sync/push` (con `requireSession`), en una transacción:
  - `select pg_advisory_xact_lock(hashtext(user_id))`;
  - por cada fila: `clampUpdatedAt`, leer la existente por `(user_id, id)`, `wins`, y un *upsert* con `server_seq = nextval('sync_seq')`. El `user_id` sale siempre de la sesión.
  - Responde con `pushResponseSchema`. Un lote inválido responde `400 { "error": "invalid_batch" }` sin escribir nada.
- `GET /api/sync/pull?cursor=N`: filas del usuario con `server_seq > N`, borrados lógicos incluidos, ordenadas, hasta 500, con `pullResponseSchema`.

- [ ] **Paso 1: tests** (contra la base de prueba, con dos usuarios):
  - Repetir el mismo *push* no cambia nada (idempotencia).
  - Gana la última escritura; en empate gana la que llega después.
  - Un `updated_at` del año 2100 se guarda recortado.
  - El usuario B no ve en el *pull* las filas de A, y un *push* de B con un `id` de A crea la fila de B sin tocar la de A.
  - Dos *push* simultáneos del mismo usuario reciben `server_seq` distintos y no pierden filas.
  - 1.200 filas salen en 3 páginas sin repetir ni saltar ninguna.
  - Una fila inválida en un lote no escribe nada.
  - Sin sesión responde `401`.
- [ ] **Pasos 2 a 4** y **paso 5: commit.** `feat(api): push and pull synced rows`.

### Tarea 8: `SyncNotifier` y versión

**Archivos:** crear `apps/api/src/sync/notifier.ts`, `apps/api/src/sync/notifier.test.ts`. Modificar `wrangler.jsonc` (binding `SYNC_NOTIFIER`, migración `new_sqlite_classes: ["SyncNotifier"]`, también en `previews`), `src/index.ts` y `routes.ts`.

**Interfaces:**
- Produce `class SyncNotifier extends DurableObject`, con los métodos RPC `bump(seq: number): Promise<void>` (guarda el máximo) y `version(): Promise<number>`. Antes de escribirla se revisa en la documentación vigente la API de almacenamiento de los Durable Objects con SQLite.
- Produce `interface ChangeNotifier { bump(userId: string, seq: number): Promise<void>; version(userId: string): Promise<number> }`, con `durableNotifier(ns)` (un objeto por usuario, `idFromName(userId)`) y `memoryNotifier()` para las pruebas.
- Después del *commit* del *push*: `bump`, con un reintento si falla, sin hacer fallar el *push*. `GET /api/sync/version` responde `{ "version": n }` sin tocar Postgres.

- [ ] **Paso 1: tests.** `bump` guarda el máximo, y no baja con un valor menor. `/version` refleja el último *push*. Un `bump` que falla dos veces no hace fallar el *push*. `/version` no abre la base (se prueba con un `Db` que lanza si se usa).
- [ ] **Pasos 2 a 4** y **paso 5: commit.** `feat(api): announce changes through a Durable Object`.

## PR 2.6 · `feat/sync-client`

### Tarea 9: cuenta en la web

**Archivos:** crear `apps/web/src/account/auth-api.ts`, `src/account/AccountScreen.tsx`, `src/account/ResetPasswordScreen.tsx` y sus tests. Modificar `App.tsx` (rutas `/cuenta` y `/restablecer`) y `SettingsScreen.tsx` (enlace "Cuenta").

**Interfaces:**
- `auth-api.ts`, con `fetch` directo a los *endpoints* de Better Auth (sin su cliente, para no sumar peso): `signIn`, `signOut`, `revokeAllSessions`, `changePassword`, `requestReset`, `resetPassword` y `getSession`.
- Textos: "Iniciar sesión", "Cerrar sesión", "Cerrar sesión en todos los dispositivos", "Cambiar contraseña", "¿Olvidaste tu contraseña?". Para el 429: "Demasiados intentos. Espera unos segundos." Para un error de red: "Sin conexión. Inténtalo de nuevo cuando vuelva la señal."
- La app sigue funcionando sin sesión: solo la sincronización la necesita.

- [ ] **Paso 1: tests** (con `fetch` falso): el login correcto lleva a "Sesión iniciada como …"; el 429 y el error de red muestran su texto; cerrar sesión en todos los dispositivos pide confirmación; restablecer con un token vencido muestra "El enlace venció. Pide uno nuevo."
- [ ] **Pasos 2 a 4** y **paso 5: commit.** `feat(web): sign in, sign out and reset the password`.

### Tarea 10: motor de sincronización

**Archivos:** crear `apps/web/src/sync/sync-api.ts`, `src/sync/engine.ts` y `src/sync/engine.test.ts`.

**Interfaces:**
- Produce `syncOnce(db: HabitDb, api: SyncApi): Promise<SyncResult>`.
  - ***Push*:** sube la *outbox* en lotes de 200, en el orden de `SYNC_TABLES`. Saca de la *outbox* solo las filas cuyo `updatedAt` local no cambió mientras viajaban.
  - ***Pull*:** desde `syncState.cursor`, hasta `hasMore = false`. Aplica cada fila con `wins`, sin pasar por `writeRows` (no encola), y guarda el cursor.
- `SyncResult = { status: 'synced' | 'offline' | 'unauthenticated' | 'error'; message?: string }`. Cada `fetch` tiene un tiempo máximo de 15 s.

- [ ] **Paso 1: tests** (Dexie con `fake-indexeddb` y una `SyncApi` falsa):
  - Las filas subidas salen de la *outbox*; una fila editada mientras viajaba se queda.
  - Una fila remota más nueva pisa la local; una más vieja no.
  - Tres páginas de *pull* dejan el cursor en la última.
  - Un `401` da `unauthenticated` y conserva la *outbox*; un corte de red da `offline`.
  - Un `push` repetido tras perder la respuesta deja todo igual.
- [ ] **Pasos 2 a 4** y **paso 5: commit.** `feat(web): sync the outbox with the server`.

### Tarea 11: cuándo sincronizar y estado visible

**Archivos:** crear `apps/web/src/sync/useSync.ts`, `src/sync/SyncStatus.tsx` y sus tests. Modificar `App.tsx`.

**Interfaces:**
- `useSync()` sincroniza:
  - al iniciar sesión, al abrir la app, al volver a ella (`visibilitychange`) y al recuperar la conexión (`online`);
  - 2 s después de la última escritura local;
  - si `/api/sync/version` supera el cursor, consultado cada 15 s con la app visible.
- Reintenta con espera creciente: 1 s, 2 s, 4 s… hasta 5 min, con ±20 % de azar.
- `SyncStatus`, con `role="status"`, muestra "Sincronizado", "Pendiente", "Sin conexión", "Inicia sesión para sincronizar" o "Error: …".

- [ ] **Paso 1: tests** (con *fake timers*): una escritura sincroniza a los 2 s; tres fallos esperan 1, 2 y 4 s; con la app oculta no se consulta `/version`; el estado cambia de "Pendiente" a "Sincronizado".
- [ ] **Pasos 2 a 4** y **paso 5: commit.** `feat(web): schedule sync and show its status`.

## PR 2.7 · `ci/preview-deploy`

### Tarea 12: despliegue y migraciones

**Archivos:** crear `.github/workflows/habit-tracker-migrate.yml`. Modificar `docs/cuentas.md`, `.github/workflows/habit-tracker-ci.yml` (Postgres como servicio y pruebas de `apps/api`) y `App_Habit_Tracker/CLAUDE.md` (comandos).

- [ ] **Paso 1: CI.** Agregar Postgres 17 como servicio del job de pruebas y `TEST_DATABASE_URL`, para que las pruebas de `apps/api` corran en cada PR.
- [ ] **Paso 2: workflow de migraciones.** `workflow_dispatch` con la entrada `environment` (`preview` o `production`). Corre `drizzle-kit migrate` con el secreto `DATABASE_URL` de ese *environment* de GitHub; `production` exige tu aprobación.
- [ ] **Paso 3: guía paso a paso en `cuentas.md`**, que sigues tú en los paneles:
  - **Neon:** el proyecto y las ramas `production` y `preview`; la URL *pooled* para el Worker y la directa para migrar.
  - **Cloudflare:** Workers Builds con la carpeta raíz `App_Habit_Tracker`, el comando de *build* y la rama de producción `release/habit-tracker` (ADR 0010); los secretos de Production y de Previews.
  - **GitHub:** los *environments* y sus secretos.
- [ ] **Paso 4: crear la rama `release/habit-tracker`** desde `app/habit_tracker`. Es un `git push` normal de una rama nueva.
- [ ] **Paso 5: medir el CPU de `scrypt`** en una Preview: con Workers Logs, el `cpuTime` de 10 logins. Anotarlo en una actualización fechada del ADR 0005 y, si se pasa de 10 ms de forma sostenida, seguir su plan B.
- [ ] **Paso 6: commits.** `ci: run the api tests against Postgres`, `ci: add a manual migration workflow`, `docs: add the phase 2 account steps`.

## PR 2.8 · `test/sync-e2e`

### Tarea 13: E2E de sincronización

**Archivos:** crear `apps/web/e2e/sync.spec.ts` y `apps/web/playwright.sync.config.ts` (un `webServer` con `wrangler dev`, `DATABASE_DRIVER=pg` y la base de prueba ya migrada). Modificar el job de E2E del CI.

- [ ] **Paso 1: E2E.**
  - Dos contextos con el mismo usuario: marcar un hábito en uno y verlo en el otro en menos de 30 s.
  - Cortar la red (`page.route` que aborta) a mitad de un *push*; al volver, todo llega una sola vez.
  - Un segundo usuario no ve nada del primero.
  - Cerrar sesión en todos los dispositivos deja al otro contexto en "Inicia sesión para sincronizar", sin perder sus pendientes.
- [ ] **Paso 2: correrlos** local y en el CI.
- [ ] **Paso 3: commit.** `test(web): add end-to-end sync tests`.

## Cierre de la fase

- **Revisión de seguridad independiente** de la rama completa, por un subagente que no vio el código. Te aviso al lanzarla.
- **Primer *release*:** una PR de `app/habit_tracker` hacia `release/habit-tracker`, que fusionas tú (ADR 0010).
- **Tu cuenta:** creas la cuenta en producción con `AUTH_SIGNUP_ENABLED=true` y lo vuelves a `false`. Luego instalas la app en el iPhone (la guía de la PWA es de la fase 4 básica).
- **Resumen para ti** y la etiqueta `phase-2-ok` cuando lo apruebes.
