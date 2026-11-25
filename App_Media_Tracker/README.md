# Media Tracker

Esta carpeta contiene la reescritura de Media Tracker: una PWA para el iPhone, una app de Electron para el Mac y un Worker de Cloudflare que las sincroniza. Hoy es solo el andamiaje de un monorepo pnpm vacío (`packages/shared`); las apps llegan por fases.

- `MediaTracker/` es la app antigua (Expo). Queda congelada, fuera del workspace y sin cambios, hasta que la nueva alcance paridad.
- `Referencias/` es material de referencia.

## Comandos (desde `App_Media_Tracker/`)

| Para      | Comando                                                          |
| --------- | ---------------------------------------------------------------- |
| Instalar  | `corepack enable && pnpm install`                                |
| Formato   | `pnpm format` / `pnpm format:check`                              |
| Lint      | `pnpm lint`                                                      |
| Tipos     | `pnpm typecheck`                                                 |
| Pruebas   | `pnpm test` y `pnpm test:tz` (las mismas con `TZ=Asia/Tokyo`)    |
| Auditoría | `pnpm run audit` (falla con vulnerabilidades altas o críticas)   |

Requiere Node 24 (`.nvmrc`) y pnpm 10 (fijado en `packageManager`). Las instrucciones de trabajo están en `CLAUDE.md`.
