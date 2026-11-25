# 0001 · Reescritura, estructura del repositorio y herramientas base

- **Estado:** Propuesto
- **Fecha:** 25-11-2026

## Contexto

- La app actual (`App_Media_Tracker/MediaTracker/`) usa Expo 57 y React Native Web dentro de Electron. Guarda los datos con Zustand en un archivo del Mac y sincroniza entre Macs con una carpeta compartida. No funciona en el iPhone.
- El objetivo nuevo es tener el iPhone y el Mac con los mismos datos, una identidad visual nueva y el método por fases de Constancia (documento maestro, sección 1).
- Constancia ya resolvió este mismo problema con React, Vite, una PWA, Electron, Dexie, un Worker de Cloudflare y Neon. Sus decisiones están aceptadas y probadas en uso diario.
- Respuesta 1 de la fase 0: reescribir con el stack de Constancia y trasladar la lógica pura de `store/*.ts`.

## Decisión

- **Reescritura en un monorepo nuevo** dentro de `App_Media_Tracker/`, junto a la app actual, que queda congelada en `MediaTracker/`. No se borra hasta la fase 7, cuando la nueva tenga paridad y ya hayas importado tus datos.
- **Estructura** (igual que Constancia, ADR 0001):

  ```
  App_Media_Tracker/
    apps/web/        React + Vite (PWA), la interfaz
    apps/server/     Worker de Cloudflare (Hono), API y archivos estáticos
    apps/desktop/    Electron, que carga el build de apps/web
    packages/shared/ tipos, esquemas Zod y lógica pura (progreso, temporadas, sagas, duplicados, importador)
    docs/            documento maestro, ADRs, plan, amenazas, arquitectura
    MediaTracker/    app actual, congelada (no la toca la CI nueva)
  ```

- **Herramientas** con las mismas versiones fijadas que Constancia: pnpm 10 con `packageManager`, Node 24 (`.nvmrc`), TypeScript estricto con `noUncheckedIndexedAccess`, ESLint con reglas tipadas, Prettier y Vitest. Se agregan scripts `test:tz` (`TZ=Asia/Tokyo`) y `audit` (falla con hallazgos altos o críticos). El monorepo vacío llega en la PR #51.
- **Lógica que se traslada.** Las funciones puras de la app actual pasan a `packages/shared` con sus pruebas: progreso, temporadas, completado, fechas, planificador, listas inteligentes, estadísticas, sagas, papeleras (*tombstones*), barra de menú y respaldo. Se adaptan al modelo nuevo (ADR 0006), pero las pruebas actuales sirven de especificación: un caso que pasaba en la app actual tiene que pasar en la nueva.
- **Convenciones:** Conventional Commits en inglés y ramas `feat/`, `fix/`, `chore/`, `docs/`, `test/`, `refactor/`, `ci/` y `spike/` desde `app/Media_Tracker` (respuesta 14). Se documentan en `CONTRIBUTING.md` y en `App_Media_Tracker/CLAUDE.md`.

## Alternativas

- **Evolucionar la app de Expo** y publicarla en el iPhone con React Native. Exige una cuenta de desarrollador de Apple (99 USD al año) o reinstalar cada 7 días. Además, la web de Expo dentro de Electron no aprovecha bien el escritorio. Descartada.
- **Expo Web como PWA.** Daría una sola base de código, pero la PWA de React Native Web pesa más, su accesibilidad web es más pobre (`div` con roles, foco irregular) y no comparte nada con Constancia. Descartada.
- **Reescribir desde cero sin trasladar lógica.** Se perderían los casos límite que ya cubren 236 pruebas (temporadas, respaldos, fechas). Descartada.

## Consecuencias

- Durante la reescritura hay dos apps en el mismo directorio. La CI nueva ignora `MediaTracker/`, y la CI de la app actual sigue igual hasta su retiro.
- No hay uso diario hasta tener paridad (respuesta 5), así que el orden de las fases prioriza lo que más usas.
- Lo que se aprenda aquí sirve a las dos apps, y lo de Constancia sirve aquí.

## Fuentes

- ADR 0001 de Constancia, `App_Habit_Tracker/docs/decisions/0001-estructura-del-repositorio.md` (rama `app/habit_tracker`), consultado el 25-11-2026.
- `App_Media_Tracker/MediaTracker/README.md` y `store/*.ts`, consultados el 25-11-2026.
