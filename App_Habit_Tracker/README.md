# Constancia

App personal para llevar hábitos y entrenamiento de gimnasio, pensada para el iPhone (como app web instalada) y el Mac (como app de escritorio). Funciona sin conexión: todo se guarda primero en el dispositivo y se sincroniza cuando hay red. Tiene tres estilos visuales que se pueden cambiar o rotar cada semana: Cuaderno, Línea y Disco.

Es mi primer proyecto de punta a punta: construirlo, publicarlo gratis, revisarlo contra los errores típicos de las apps hechas con IA y usarlo de verdad.

> **Estado (04-11-2026):** la fase 1 está completa: la app de hábitos funciona en el navegador, guardando todo en el dispositivo. La fase 2 (cuenta y sincronización) está en curso: el servidor ya tiene la base de datos, el login, la recuperación de contraseña y la sincronización; falta conectar la app web y desplegar. El avance de cada fase está en [`docs/plan/`](docs/plan/README.md).

## Qué va a hacer

- Hábitos diarios o con cuota semanal ("3 veces por semana"), agrupados por momento del día ("al despertar", "antes de dormir") en vez de horas fijas.
- Días saltados con motivo (un certamen, una enfermedad) que no cortan la racha.
- Revisión los domingos para fijar las metas de la semana siguiente.
- Rutinas de gimnasio, series con peso y repeticiones, lo que levantaste la última vez y gráficos de progreso.
- Peso y medidas corporales.
- Exportar e importar los datos en JSON y CSV.

## Cómo está hecho

| Parte | Tecnología |
| --- | --- |
| Web / PWA | React, Vite, Dexie (IndexedDB), `vite-plugin-pwa` |
| API | Cloudflare Workers, Hono, Better Auth, Drizzle |
| Base de datos | Neon Postgres |
| Escritorio | Electron, electron-builder |
| Compartido | TypeScript estricto, Zod |
| Calidad | ESLint, Prettier, Vitest, Playwright, GitHub Actions |

Todo corre en planes gratuitos. El porqué de cada elección está en [`docs/decisions/`](docs/decisions/README.md), y la vista general en [`docs/arquitectura.md`](docs/arquitectura.md).

## Correrlo

Necesitas Node 24 y corepack (viene con Node).

```sh
cd App_Habit_Tracker
corepack enable
pnpm install
pnpm lint && pnpm typecheck && pnpm test
pnpm --filter @habit-tracker/web dev   # la app web en desarrollo
```

Las pruebas de la API necesitan un Postgres 16 o más. Los demás comandos (E2E, API en local, migraciones) están en [`CLAUDE.md`](CLAUDE.md).

## Documentación

- [`docs/arquitectura.md`](docs/arquitectura.md): cómo encajan las piezas y los límites de los planes gratis.
- [`docs/modelo-de-datos.md`](docs/modelo-de-datos.md): tablas y reglas (rachas, cuotas, 1RM).
- [`docs/plan/`](docs/plan/README.md): plan por fases y su avance.
- [`docs/decisions/`](docs/decisions/README.md): por qué se eligió cada cosa (ADR).
- [`docs/cuentas.md`](docs/cuentas.md): las cuentas gratis que hacen falta y cómo configurarlas.
- [`CLAUDE.md`](CLAUDE.md): reglas para trabajar en el código.
