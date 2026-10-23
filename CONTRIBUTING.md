# Flujo de trabajo con Git

Politica para todos los cambios en este repo (decidida por la autora/autor del proyecto; actualizada 2026-10-23).

## Ramas

| Rama | Para que sirve |
| --- | --- |
| `app/<App>` (ej. `app/Media_Tracker`) | Rama de integracion de cada app: ahi se juntan los cambios nuevos |
| `develop` | Pruebas: aqui se prueba la app antes de darla por buena |
| `main` | Solo apps completas y probadas |

## Proceso para cualquier cambio

1. Parte siempre de la rama de la app actualizada (ej. `app/Media_Tracker`).
2. Crea una rama por cambio: `feature/<tema>`, `fix/<tema>`, `chore/<tema>`... (ejemplo: `feature/portadas-en-todas-partes`).
3. Haz los commits en esa rama, agrupados por lo que hacen, y subela con push.
4. Abre un Pull Request con destino la **rama de la app** (ej. `app/Media_Tracker`) cuando el cambio este terminado o cuando se pida.
5. Nunca hagas commit directo en `app/<App>`, `develop` ni `main`.

## Del trabajo a `main`

1. Los cambios se juntan en `app/<App>` mediante PRs.
2. Cuando hay algo para probar, se abre un PR de `app/<App>` a **`develop`**.
3. En `develop` se prueba la app (compilarla y usarla en local).
4. Si todo pasa, y solo cuando la **app completa** esta terminada, se pasa a **`main`**.

- `main` no se actualiza por cada funcion, ni se abren PRs a `main` para cambios normales.
- Resumen: rama por cambio -> PR a `app/<App>` -> PR a `develop` (pruebas) -> `main` (app completa y probada).

## Historial de referencia

- Hasta 2026-10-23 las ramas por cambio se fusionaban directamente en `develop` (ejemplo: PR #12, portadas en todas partes); desde esa fecha pasan primero por `app/<App>`.
- El commit `5c3469d` (pulido de interfaz) se hizo directo en `develop` por error y motivo la regla de no commitear directo.
