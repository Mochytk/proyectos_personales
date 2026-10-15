# Flujo de trabajo con Git

Politica para todos los cambios en este repo (decidida por la autora/autor del proyecto, 2026-10-15).

## Proceso para cualquier cambio

1. Parte siempre de `develop` actualizado.
2. Crea una rama por cambio: `feature/<tema>` (ejemplo: `feature/portadas-en-todas-partes`).
3. Haz los commits en esa rama y subela con push.
4. Abre un Pull Request con destino **`develop`** cuando el cambio este terminado o cuando se pida.
5. Nunca hagas commit directo en `develop`.

## Politica de subida a `main`

- `main` solo se actualiza cuando una **app completa** esta terminada, no por cada funcion.
- No se abren PRs a `main` para cambios normales.
- Resumen: rama por cambio -> PR a `develop` -> (app completa terminada) -> `main`.

## Historial de referencia

- Los PRs a `develop` desde ramas `feature/*` son la norma (ejemplo: PR #12, portadas en todas partes).
- El commit `5c3469d` (pulido de interfaz) se hizo directo en `develop` por error y motivo esta regla.
