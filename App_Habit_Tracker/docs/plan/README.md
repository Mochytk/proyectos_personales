# Plan de implementación

Plan general por fases, ramas y PRs. Cada fase tiene su plan detallado con tareas TDD (prueba que falla, código mínimo, prueba que pasa, commit). El de la fase 1 ya está escrito: [`fase-1-nucleo-de-habitos.md`](fase-1-nucleo-de-habitos.md). Los demás se escriben al comenzar cada fase, cuando la anterior ya está fusionada y su contexto está claro.

## Orden acordado (respuesta 16 de la fase 0)

1. **Antes de diciembre:** fases 0, 1, 2 y lo básico de la 4. La meta es usar los hábitos en el iPhone, sincronizados.
2. **Después:** fase 3 (gimnasio) y fase 6 (endurecimiento y publicación).
3. **Al final:** el resto de la fase 4, la fase 5 (Electron) y la fase 7 (pulido).

Cada PR sale de `app/habit_tracker` y vuelve a ella. Cada fase termina con PRs fusionadas por ti, el CI en verde y la etiqueta `phase-N-ok`.

**Ejecución (decidida el 23-10-2026):** nativa. Implemento cada tarea yo mismo en la sesión, con TDD. Al cierre de cada fase, un revisor independiente (un subagente que no vio cómo se escribió el código) revisa la rama completa, y te aviso cuando lo lance.

## Fase 0 · Descubrimiento y base

| Rama | Contenido |
| --- | --- |
| `chore/remove-mempalace` | Quitar MemPalace de `CLAUDE.md` y `.gitignore` (PR #14, fusionada) |
| `docs/phase-0-adrs` | ADRs, arquitectura, modelo de datos, catálogo de gym, cuentas y este plan |
| `chore/monorepo-setup` | Monorepo pnpm vacío: TypeScript estricto, ESLint, Prettier, Vitest, CI, `CLAUDE.md`, `README.md`, `.env.example` |
| (sin rama) | 2–3 direcciones visuales y 3 nombres, en una página privada, para que elijas |

## Fase 1 · Núcleo local de hábitos (sin servidor)

Detalle en [`fase-1-nucleo-de-habitos.md`](fase-1-nucleo-de-habitos.md).

| # | Rama | Contenido |
| --- | --- | --- |
| 1.1 | `feat/shared-dates` | Fecha local con hora de corte, semanas, formato DD-MM-AAAA e IDs deterministas (UUID v5) |
| 1.2 | `feat/shared-habit-rules` | Esquemas Zod de hábitos; si un hábito aplica; racha diaria; progreso, cuota efectiva y racha semanal |
| 1.3 | `feat/web-shell` | App Vite + React con los tres estilos (Cuaderno, Línea, Disco; ADR 0009) y fuentes autoalojadas, navegación, *error boundary* y estados de carga, error y vacío con tiempo máximo |
| 1.4 | `feat/web-local-db` | Esquema Dexie, repositorios, contenido inicial (anclas) y *outbox* lista para la fase 2 |
| 1.5 | `feat/habits-crud` | Crear, editar y archivar hábitos; editar anclas; ajustes de hora de corte, zona horaria y estilo |
| 1.6 | `feat/today-screen` | "Hoy" por ancla: marcar con un toque, saltar con motivo, pausar el día, rachas y progreso |
| 1.7 | `feat/habit-history` | Mapa de calor de 90 días por hábito |
| 1.8 | `feat/weekly-review` | Revisión del domingo y cuota de la semana siguiente |
| 1.9 | `test/phase-1-review` | E2E completos con Playwright, revisión con las Web Interface Guidelines y correcciones |

## Fase 2 · Backend, cuenta y sincronización

| Rama | Contenido |
| --- | --- |
| `feat/api-skeleton` | Worker con Hono, *static assets*, `wrangler.jsonc`, cabeceras de seguridad básicas y salud |
| `feat/db-schema` | Esquema Drizzle de las tablas sincronizables. Una migración por commit, con su reversa |
| `feat/auth` | Better Auth: login, registro cerrado por variable, límite de intentos, logout, cambio de contraseña, cierre en todos los dispositivos. Medición de CPU de `scrypt` |
| `feat/auth-reset` | Recuperación por correo, si el proveedor queda resuelto (ADR 0005) |
| `feat/sync-server` | `push`, `pull` y `version`, con candado por usuario y Durable Object. Tests de aislamiento entre usuarios |
| `feat/sync-client` | *Outbox*, reintentos con espera creciente, indicador de estado, primera sincronización tras el login |
| `ci/preview-deploy` | Workers Builds y Previews conectados (con tu ayuda en el panel), y workflow manual de migraciones |
| `test/sync-e2e` | Dos contextos de Playwright: cambio en uno, visible en el otro en menos de 30 s; corte de red a mitad de un *push* |

Cierre: revisión de seguridad independiente (un subagente que no vio el código; te aviso cuando lo lance).

**Punto abierto:** el uso diario antes de la fase 6 necesita una URL estable, porque cada rama tiene su propia URL de Preview y la PWA instalada queda atada a una. En la fase 2 te propongo cómo resolverlo, por ejemplo con una rama fija de Preview para el uso diario. También cómo acotar el riesgo de usar datos reales antes de la fase 6: registro cerrado, límite de intentos, cabeceras y tests de aislamiento ya en la fase 2, más exportaciones semanales.

## Fase 4 (básica) · PWA instalable

| Rama | Contenido |
| --- | --- |
| `feat/pwa-install` | Manifest, íconos, `apple-touch-icon`, meta tags de iOS, service worker con caché de la app, `navigator.storage.persist()` |
| `docs/pwa-ios-guide` | Guía paso a paso para instalarla en tu iPhone y limitaciones de iOS verificadas en tu versión |

El resto de la fase 4 (actualización de versiones con aviso, pruebas sin conexión más finas) va después de la fase 3.

## Fase 3 · Gimnasio y métricas corporales

| Rama | Contenido |
| --- | --- |
| `feat/shared-gym-rules` | Esquemas Zod de gym; 1RM (Epley), volumen y récords, con TDD |
| `feat/exercise-catalog` | Catálogo inicial (`docs/catalogo-gym.md`), editable |
| `feat/routines` | Rutinas y las dos plantillas A/B |
| `feat/workout-session` | Sesión en curso: series, "la última vez", temporizador de descanso, guardado continuo |
| `feat/body-metrics` | Peso y medidas de ambos lados |
| `feat/progress-charts` | Gráficos (con la librería decidida midiendo el bundle) |
| `test/gym-e2e` | Sesión completa sin conexión que se sincroniza después |

Cierre: revisión de seguridad independiente.

## Fase 6 · Endurecimiento y publicación

Lista de puntos de quiebre (sección 7 del documento maestro), punto por punto con evidencia. Además:

- CSP, CORS y cabeceras.
- Alertas de Cloudflare.
- Exportar e importar JSON y CSV.
- `pnpm audit`.
- Strix contra `preview`, después de revisar qué ejecuta y qué permisos pide.

Producción solo con tu confirmación. Cierre: revisión final independiente.

## Fase 5 · App de escritorio (Mac)

| Rama | Contenido |
| --- | --- |
| `feat/desktop-shell` | Electron endurecido (ADR 0008) que carga el *build* web por `app://` |
| `feat/desktop-auth` | Login por el navegador del sistema y *deep link*; token en `safeStorage` asíncrono; API solo desde el proceso principal |
| `chore/desktop-build` | `electron-builder` para macOS con firma *ad hoc* o autofirmada; guía para abrirla y actualizarla |

## Fase 7 · Pulido y opcionales

Revisión final con las Web Interface Guidelines, rendimiento, README con capturas y ADRs al día. Los opcionales (notificaciones push, atajos, recordatorios, temas, más gráficos) los eliges tú.

## Dependencias nuevas que pediré aprobar

Antes de agregar cada una reviso su mantenimiento, sus scripts de instalación y sus vulnerabilidades conocidas, y te cuento lo que encontré. Las apruebas de a una. La revisión de las de la fase 1 se hizo el 23-10-2026: ninguna tiene vulnerabilidades conocidas (`npm audit`) ni scripts que corran al instalarse desde npm.

| Fase | Paquete | Para qué | Recomendación |
| --- | --- | --- | --- |
| 1 | `react-router` 8 (modo declarativo) | Navegación entre pantallas | Recomendado, sobre TanStack Router (más complejo de lo necesario) y wouter (un solo mantenedor) |
| 1 | `@fontsource-variable/atkinson-hyperlegible-next`, `@fontsource-variable/overpass`, `@fontsource/barlow-condensed`, `@fontsource/barlow` | Fuentes autoalojadas de los tres estilos (ADR 0009) | Recomendado |
| 1 | `fake-indexeddb` (desarrollo) | Probar Dexie en Vitest sin navegador | Recomendado |
| 1 | `@testing-library/react`, `@testing-library/dom` y `@testing-library/user-event` (desarrollo) | Pruebas de componentes con clics realistas | Recomendado |
| 1 | `jsdom` (desarrollo) | DOM simulado para esas pruebas | Recomendado sobre `happy-dom`, que tiene un solo mantenedor |
| 1 | `@axe-core/playwright` (desarrollo) | Revisar contraste y accesibilidad en los E2E de las 6 combinaciones de estilo | Se revisa al llegar a la tarea 21 |
| 2 | `pg` (desarrollo) | Postgres local en tests y CI | — |
| 5 | `@better-auth/electron` | Login de escritorio | — |

Las dependencias del documento maestro (React, Vite, `vite-plugin-pwa`, Dexie, Zod, Drizzle, Hono, Better Auth, Electron, Playwright) no necesitan aprobación, pero igual se revisan al agregarlas.
