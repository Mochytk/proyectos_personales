# Habit tracker

App personal para llevar hábitos y entrenamiento de gimnasio, pensada para el iPhone (como app web instalada) y el Mac (como app de escritorio). Funciona sin conexión: todo se guarda primero en el dispositivo y se sincroniza cuando hay red.

Es mi primer proyecto de punta a punta: construirlo, publicarlo gratis, revisarlo contra los errores típicos de las apps hechas con IA y usarlo de verdad.

> **Estado:** fase 0. Por ahora hay documentación y un monorepo vacío; todavía no hay app.

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
```

## Documentación

- [`docs/arquitectura.md`](docs/arquitectura.md): cómo encajan las piezas y los límites de los planes gratis.
- [`docs/modelo-de-datos.md`](docs/modelo-de-datos.md): tablas y reglas (rachas, cuotas, 1RM).
- [`docs/plan/`](docs/plan/README.md): plan por fases.
- [`CLAUDE.md`](CLAUDE.md): reglas para trabajar en el código.
