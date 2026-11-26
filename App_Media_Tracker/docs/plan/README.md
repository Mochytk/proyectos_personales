# Plan por fases · Media Tracker

Plan del 25-11-2026, ordenado según la respuesta 18 de la fase 0. Cada fase termina con:

1. Una PR (o varias) hacia `app/Media_Tracker` con la CI en verde.
2. Una revisión independiente de Opus sobre la rama completa.
3. Un resumen: qué funciona, cómo se probó (con evidencia), qué se decidió y cómo se revierte.
4. **Tu aprobación**, y entonces la etiqueta `media-tracker/phase-N-ok`.

No se empieza la fase siguiente sin tu "ok". `develop` recibe `app/Media_Tracker` cuando tú lo decides, para hacer pruebas. `main` solo recibe la app completa.

**Ejecución:** codifican subagentes Sonnet 5.5 con esfuerzo medio y la skill *ponytail*, en *worktrees* aislados y con TDD. Opus planifica, verifica cada entrega (formato, lint, tipos, pruebas, `test:tz`, auditoría) y abre las PR. Cada fase tiene su plan detallado en `docs/plan/fase-N.md`, escrito antes de empezarla.

## Fase 0 · Descubrimiento

| Entrega | Rama | PR |
| --- | --- | --- |
| Documento maestro, ADRs 0001 a 0009, amenazas, arquitectura, modelo de datos, plan y convenciones | `docs/media-phase-0-adrs` | #52 |
| Monorepo vacío con CI | `chore/media-monorepo-setup` | #51 |
| Spike A: fuentes de sagas (Wikidata) | `spike/saga-sources` | #53 |
| Tres direcciones visuales y nombres (página para elegir) | — | — |
| ADR 0010 de identidad visual («Al día»; Estante, Fotograma y Portada) y página de referencia `docs/diseno/direcciones.html` | `docs/media-phase-0-adrs` | #52 |

## Fase 1 · Núcleo local

Al terminarla, la app funciona en el navegador sin servidor y con tus datos importados.

| Entrega | Rama |
| --- | --- |
| Esquemas Zod y lógica pura trasladada desde `store/*.ts`, con sus pruebas | `feat/media-shared-core` |
| Importador v1 a v5 (respaldos congelados), plan de importación y exportación v6 | `feat/media-legacy-import` |
| Dexie: tablas, índices y transacciones | `feat/media-local-db` |
| Interfaz base con los tres estilos y la rotación; accesibilidad de base (fuentes, contraste, foco, movimiento reducido) | `feat/media-ui-shell` |
| Añadir por tipo (menú y formulario a mano por tipo) | `feat/media-add-by-type` |
| Duplicados: aviso al añadir y al importar, lista de posibles duplicados y fusión | `feat/media-duplicates` |
| Disfrutando, Biblioteca, Listas (normales e inteligentes) y detalle con progreso y temporadas | `feat/media-core-screens` |
| E2E de Playwright en Chromium y WebKit, con tamaño iPhone y Mac | `test/media-e2e-core` |

**Pendientes de la revisión de la fase 0 que se resuelven aquí:** reemplazar el `MEDIA_KINDS` provisional de `packages/shared` por los 12 tipos reales.

**Dependencias que se piden al empezar** (se revisa el origen, la licencia, los scripts y los permisos): react, react-dom, react-router, vite, @vitejs/plugin-react, vite-plugin-pwa, dexie, dexie-react-hooks, zod, uuid (v5), @fontsource-variable/{bricolage-grotesque,literata,archivo,schibsted-grotesk} (ADR 0010), @playwright/test, @axe-core/playwright y un escáner de secretos para la CI.

## Fase 2 · Servidor y metadatos

| Entrega | Rama |
| --- | --- |
| Worker con Hono, archivos estáticos, cabeceras de seguridad y CSP | `feat/media-worker` |
| Proxy de metadatos (TMDB, RAWG, Open Library) con KV, límite por usuario y validación | `feat/media-meta-proxy` |
| Búsqueda por tipo conectada, portadas y "Actualizar datos" | `feat/media-search` |
| Atribución de TMDB y RAWG | `feat/media-attribution` |
| Guía para crear el Worker, el KV, los secretos y el proyecto de Neon (tú ejecutas los pasos de la cuenta) | `docs/media-cloudflare-setup` |

Hasta la fase 4 (cuenta), el proxy se protege en `preview` con Cloudflare Access o con un token de desarrollo que es secreto del Worker. Si es un token, se escribe en la app al usarla y se guarda solo en ese dispositivo: nunca va dentro del *build* de Vite. Mientras tanto, el límite de peticiones es por token. Se decide en el plan de la fase.

## Fase 3 · Sagas conjuntas

| Entrega | Rama |
| --- | --- |
| Colecciones jerárquicas: árbol, orden completo, ciclos y profundidad | `feat/media-collections` |
| `/api/meta/saga` con Wikidata y sugerencias en el detalle | `feat/media-saga-suggestions` |
| Tarjeta de saga en Disfrutando ("libro 5 de 7") y detalle de saga | `feat/media-saga-ui` |
| Evaluación con 60 obras públicas (sección 7 del documento maestro) | `test/media-saga-eval` |

## Fase 4 · Cuenta, sincronización e iPhone

| Entrega | Rama |
| --- | --- |
| Neon con Drizzle: esquema y migraciones | `feat/media-db-schema` |
| Better Auth con registro cerrado | `feat/media-auth` |
| *Push*, *pull*, `SyncNotifier` y *outbox* | `feat/media-sync` |
| PWA instalable en el iPhone: manifiesto, iconos y guía de instalación | `feat/media-pwa` |
| E2E de sincronización entre dos contextos y pruebas de aislamiento | `test/media-sync-e2e` |

## Fase 5 · Escritorio

| Entrega | Rama |
| --- | --- |
| Electron endurecido que carga `apps/web` | `feat/media-desktop` |
| Menú, atajos, estado de la ventana y barra de menú | `feat/media-desktop-tray` |
| Empaquetado *ad hoc* y guía de instalación | `chore/media-desktop-build` |

## Fase 6 · Paridad restante e ideas pendientes

| Entrega | Rama |
| --- | --- |
| Planificador, recordatorios y próximos episodios | `feat/media-planner` |
| Bitácora, estadísticas y Tu año | `feat/media-stats` |
| Importar desde otras apps (CSV, Letterboxd, Goodreads; Sofa si exporta un formato legible) | `feat/media-import-others` |
| "Qué ver esta noche" y recomendaciones locales | `feat/media-tonight` |
| Reseñas avanzadas: medias estrellas, reseña larga, fechas de inicio y fin, relecturas | `feat/media-reviews` |

## Fase 7 · Endurecimiento y release

- Revisión del modelo de amenazas punto por punto, pruebas de carga del plan gratis y revisión de accesibilidad completa.
- Rama de *release* y despliegue a producción, solo con tu confirmación.
- Importación final de tus datos y retiro de la app actual (`MediaTracker/`), en una PR aparte que tú apruebas.

## Preguntas abiertas para fases futuras

1. **Fase 2:** ¿generamos claves nuevas de TMDB y RAWG para el Worker, en vez de reutilizar las que estuvieron en el dispositivo? (Recomendado: sí.)
2. **Fase 2:** ¿se puede usar tu correo como contacto en el User-Agent de Open Library, guardado como secreto del Worker? Sin él, el límite es de 1 petición por segundo, que alcanza. (Recomendado: no, salvo que se note lento.)
3. **Fase 2:** ¿proteger el `preview` con Cloudflare Access o con un token de desarrollo? (Recomendado: token, porque Access exige configurar una cuenta Zero Trust, aunque sea gratis.)
4. **Fase 3:** si Wikidata responde 403 por falta de contacto en el User-Agent, ¿qué URL de contacto usamos? Nunca tu correo sin permiso.
