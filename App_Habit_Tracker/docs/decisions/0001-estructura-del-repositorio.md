# 0001 · Estructura del repositorio y herramientas base

- **Estado:** Aceptada (23-10-2026, PR #18)
- **Fecha:** 23-10-2026

## Contexto

La app vive en `proyectos_personales`, un repo público que ya tiene otra app (`App_Media_Tracker/`). Tiene tres partes que comparten tipos y lógica: una web/PWA, un servidor y una app de escritorio. El repo es público y sirve de portafolio, así que todo lo que se suba se ve desde afuera.

## Decisión

- La app vive en `App_Habit_Tracker/`, siguiendo el estilo de `App_Media_Tracker/`.
- Dentro hay un monorepo con **pnpm workspaces**:
  - `apps/web`: React + Vite, PWA.
  - `apps/api`: Worker de Cloudflare. Sirve la API y los archivos de la web.
  - `apps/desktop`: Electron.
  - `packages/shared`: esquemas Zod, tipos y lógica pura.
- **Node 24** (LTS) en desarrollo y CI. Node 26 pasa a LTS el 28-10-2026; el cambio queda como tarea `chore/` cuando sea LTS.
- **pnpm 10.x**, fijado con el campo `packageManager` de `package.json`. Vale la versión que ya está instalada (10.28); la 12 recién salió y no hace falta para empezar.
- **TypeScript 6.0** en modo estricto. TypeScript 7 ya salió, pero `typescript-eslint` 8.72 solo soporta `typescript >=4.8.4 <6.1.0`, así que con 7 no tendríamos lint con tipos.
- **ESLint 10 + typescript-eslint** y **Prettier 3** para lint y formato.
- **Vitest 5** para pruebas unitarias y de integración, y **Playwright** para E2E.
- El CI está en `.github/workflows/habit-tracker-ci.yml`, en la raíz del repo (GitHub solo lee workflows ahí). Corre solo cuando cambia `App_Habit_Tracker/**` o el propio workflow. En repos públicos, los runners estándar de GitHub Actions son gratis.
- Las versiones exactas quedan fijadas en `pnpm-lock.yaml`. Cada dependencia nueva se revisa antes de agregarla (mantenimiento y scripts de instalación).

## Alternativas

- **Repo propio para la app.** Queda más limpio como portafolio, pero sale del flujo actual. Se descartó en la fase 0 (respuesta 2).
- **npm workspaces** (lo que usa Media Tracker). pnpm es más estricto con las dependencias fantasma y más rápido; el documento maestro lo pide.
- **TypeScript 7 sin lint con tipos.** Perdemos reglas como `no-floating-promises`, que importan en una app llena de código asíncrono (IndexedDB, sincronización).
- **Biome** en vez de ESLint + Prettier. Es más rápido, pero tiene menos reglas con tipos y es otra herramienta que no está en el documento maestro.

## Consecuencias

- Hay dos `CLAUDE.md`: el de la raíz (reglas del repo) y `App_Habit_Tracker/CLAUDE.md` (reglas de esta app).
- Cloudflare y el CI apuntan a la carpeta `App_Habit_Tracker` como raíz del proyecto.
- Cuando `typescript-eslint` soporte TypeScript 7, el cambio es un `chore/` aparte.

## Fuentes (consultadas el 23-10-2026)

- Registro npm: versiones vigentes y `peerDependencies` de `typescript-eslint`, `vitest`, `vite-plugin-pwa`, `@vitejs/plugin-react`, `better-auth`.
- Calendario de Node.js: https://github.com/nodejs/Release (`schedule.json`).
- Facturación de GitHub Actions: https://docs.github.com/en/billing/concepts/product-billing/github-actions
