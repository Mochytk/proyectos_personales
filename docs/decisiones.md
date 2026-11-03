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
- 2026-10-23 | Habit tracker se llama Constancia; tres estilos (Cuaderno, Linea, Disco) elegibles o rotando cada lunes | Gustaron las tres direcciones de la fase 0 (ADR 0009)
- 2026-10-23 | Habit tracker: recuperacion de contrasena con Brevo gratis y remitente propio, por su API REST sin SDK | Gratis sin dominio; si cae en spam o se bloquea, queda el script de recuperacion (ADR 0005)
- 2026-10-23 | Habit tracker: el contenido inicial (ajustes y anclas) se guarda con fecha 01-01-2000 | Con IDs fijos y gana la ultima escritura; asi una edicion real en cualquier dispositivo gana a la copia sin tocar que crea otro dispositivo despues
- 2026-10-29 | Habit tracker: produccion se despliega solo desde la rama release/habit-tracker, con una PR de release que fusiona el dueno | URL estable para el uso diario sin que las PRs toquen datos reales (ADR 0010)
- 2026-10-29 | Habit tracker: driver de Neon en Cloudflare y pg por TCP en desarrollo, pruebas y CI | Pruebas contra Postgres real sin el proxy de WebSockets de Neon (ADR 0010)
- 2026-10-29 | Habit tracker: sesion de 30 dias renovable y URL base dinamica en Better Auth | Menos logins en el telefono; el login funciona en produccion y en cada Preview (ADR 0010)
- 2026-10-30 | Habit tracker: el Worker abre la base y Better Auth solo en las rutas que los usan (middleware withAuth), no en cada peticion | /api/health y los archivos de la web no abren conexiones a Neon ni lo despiertan
- 2026-10-30 | Habit tracker: la cookie de sesion lleva Secure en todo host salvo localhost, fijado a mano y no por NODE_ENV | En un Worker NODE_ENV no es confiable; asi produccion y Previews nunca mandan la sesion sin HTTPS
