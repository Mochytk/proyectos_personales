# Habit tracker: instrucciones para trabajar aquí

App personal de hábitos y gimnasio, offline-first. Es una PWA para el iPhone y una app de Electron para el Mac, que se sincronizan con un Worker de Cloudflare y Neon Postgres. Arquitectura: `docs/arquitectura.md`. Decisiones: `docs/decisions/`. Plan: `docs/plan/`.

## Estructura

- `apps/web`: React + Vite + Dexie, PWA (fase 1).
- `apps/api`: Worker con Hono, Better Auth y Drizzle (fase 2).
- `apps/desktop`: Electron (fase 5).
- `packages/shared`: esquemas Zod, tipos y lógica pura. Sin dependencias de navegador ni de Cloudflare.

## Comandos (desde `App_Habit_Tracker/`)

| Para | Comando |
| --- | --- |
| Instalar | `corepack enable && pnpm install` |
| Formato | `pnpm format` / `pnpm format:check` |
| Lint (con tipos) | `pnpm lint` |
| Tipos | `pnpm typecheck` |
| Pruebas | `pnpm test` y `pnpm test:tz` (las mismas pruebas con `TZ=Asia/Tokyo`) |
| Auditoría | `pnpm run audit` (falla con vulnerabilidades altas o críticas; `pnpm audit` a secas falla con cualquiera) |
| App web en desarrollo | `pnpm --filter @habit-tracker/web dev` |
| *Build* de la app web | `pnpm --filter @habit-tracker/web build` |
| E2E (Playwright, Chromium) | `pnpm --filter @habit-tracker/web e2e`. La primera vez: `pnpm --filter @habit-tracker/web exec playwright install chromium`. Con un Chromium propio: `PLAYWRIGHT_CHROMIUM_EXECUTABLE=/ruta/a/chromium` |

Los comandos para desplegar y migrar se agregan aquí cuando existan (fase 2).

## Convenciones

- Código, nombres y comentarios en inglés. Interfaz y documentación en español de Chile.
- Fechas visibles en DD-MM-AAAA. Internamente, `LocalDate` en `AAAA-MM-DD` según el ADR 0007.
- TypeScript estricto, con `noUncheckedIndexedAccess`. Node 24 y pnpm 10 (fijado en `packageManager`).
- TDD para la lógica pura: primero la prueba que falla.
- Documentación con `docs/decisions/NNNN-titulo.md` para cada decisión importante, más una línea en el `docs/decisiones.md` de la raíz del repo.

## Flujo de Git (resumen de `CONTRIBUTING.md`)

- Base: `app/habit_tracker`. Antes de crear una rama: `git switch app/habit_tracker && git pull --ff-only`.
- Ramas `feat/`, `fix/`, `chore/`, `docs/`, `test/`, `refactor/` y `ci/`, en inglés y en minúsculas.
- Nunca hacer commit directo en `app/habit_tracker`, `develop` ni `main`.
- Un commit por cambio lógico, con Conventional Commits en inglés (asunto de menos de 72 caracteres) y `git push` después de cada uno. Las migraciones van en su propio commit, con su reversa.
- Nunca `push --force`, ni `rebase` de ramas publicadas, ni `commit --amend` de commits subidos. Para corregir: un commit nuevo o `git revert`.
- PR hacia `app/habit_tracker`, con descripción en español: qué cambia, por qué, cómo se probó, riesgos y rollback. **La fusiona la dueña o dueño del repo; nunca auto-merge ni merge local.** El CI tiene que estar en verde antes de pedir revisión.
- Si una skill (por ejemplo, de Superpowers) propone fusionar en local, borrar ramas o hacer preguntas de a una, mandan estas reglas: solo PR, y las preguntas van todas juntas.

## Seguridad (no negociable)

- Ningún secreto en el repo, en el frontend ni en los logs. Solo en los secretos de Cloudflare o GitHub y en `.env.local`, que git ignora. `.env.example` va sin valores reales.
- Antes de cada commit, revisar `git status` y `git diff --staged`: nada de `.env`, de datos personales ni de *builds*.
- Toda consulta filtra por el `user_id` de la sesión, con tests de aislamiento. Toda entrada se valida en el servidor con los esquemas de `packages/shared`.
- No inventar criptografía ni sesiones: se usa Better Auth (ADR 0005).
- Nada de despliegues a producción ni de acciones irreversibles (borrar bases, rotar claves, borrar ramas remotas) sin confirmación explícita.
- No agregar dependencias, plugins, MCP ni skills sin preguntar. Antes, revisar su mantenimiento y sus scripts de instalación. pnpm 10 bloquea los scripts de instalación de las dependencias; para permitir uno se agrega a `onlyBuiltDependencies` en `pnpm-workspace.yaml`, después de revisarlo.
- Antes de usar una API, consultar su documentación oficial vigente; no confiar en la memoria.
- Si algo puede generar costos, avisar antes.
