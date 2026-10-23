# Flujo de trabajo con Git

Politica para todos los cambios en este repo (decidida por la autora/autor del proyecto, 2026-10-15).

## Proceso para cualquier cambio

1. Parte siempre de `develop` actualizado.
2. Crea una rama por cambio: `feature/<tema>` (ejemplo: `feature/portadas-en-todas-partes`).
3. Haz los commits en esa rama y subela con push.
4. Abre un Pull Request con destino **`develop`** cuando el cambio este terminado o cuando se pida.
5. Nunca hagas commit directo en `develop`.

## Apps con rama base propia

Una app grande puede tener su propia rama base, creada desde `develop` (por ejemplo `app/habit_tracker` para el tracker de habitos y gym). Mientras esa app esta en desarrollo, sus cambios siguen este flujo en vez del anterior:

1. Actualiza la base: `git switch app/<app> && git pull --ff-only`.
2. Crea una rama por cambio desde ahi, en ingles y en minusculas, con prefijo segun el tipo: `feat/`, `fix/`, `chore/`, `docs/`, `test/`, `refactor/` o `ci/` (ejemplo: `feat/habits-core`).
3. Haz commits pequenos en ingles con Conventional Commits (`feat:`, `fix:`, `docs:`...), uno por cambio logico, y sube cada uno con push.
4. Abre el Pull Request con destino **`app/<app>`**. Lo revisa y lo fusiona la autora/autor del proyecto; nada de auto-merge.
5. Nunca hagas commit directo en `app/<app>`, `develop` ni `main`, ni reescribas historia ya subida (`push --force`, `rebase` o `commit --amend` sobre commits publicados).
6. La rama base vuelve a `develop` por PR cuando la autora/autor lo decida.

Los detalles de cada app (comandos, convenciones, reglas de seguridad) estan en el `CLAUDE.md` de su carpeta.

## Politica de subida a `main`

- `main` solo se actualiza cuando una **app completa** esta terminada, no por cada funcion.
- No se abren PRs a `main` para cambios normales.
- Resumen: rama por cambio -> PR a `develop` -> (app completa terminada) -> `main`.

## Historial de referencia

- Los PRs a `develop` desde ramas `feature/*` son la norma (ejemplo: PR #12, portadas en todas partes).
- El commit `5c3469d` (pulido de interfaz) se hizo directo en `develop` por error y motivo esta regla.
