# 0004 · Base de datos y ORM

- **Estado:** Propuesta
- **Fecha:** 23-10-2026

## Contexto

Hace falta una base de datos gratis, con migraciones versionadas (RNF-15), que funcione desde un Worker y que se pueda separar por entorno.

## Decisión

- **Neon Postgres, plan Free**, en la región `aws-sa-east-1` (São Paulo), la más cercana a Santiago.
- **Ramas de Neon por entorno:** `production` (la rama por defecto), `preview` y `dev`. `dev` es para probar contra Neon desde el Mac; el día a día y el CI usan Postgres local en Docker.
- **Drizzle ORM 0.45 + drizzle-kit 0.31.** El esquema está en TypeScript en `apps/api/src/db/schema/`. Las migraciones se generan como SQL con `drizzle-kit generate` y se versionan en `apps/api/drizzle/`. Nunca se usa `drizzle-kit push` contra Neon.
- **Driver `@neondatabase/serverless` por WebSockets (`Pool`)**, creado y cerrado dentro de cada petición. Necesitamos transacciones interactivas por dos motivos: Better Auth las usa con `transaction: true`, y el *push* de la sincronización tiene que ser atómico. El modo HTTP solo permite transacciones no interactivas.
- **Cada migración va en su propio commit**, con su reversa escrita en el mensaje. Las migraciones a `preview` y a `production` corren desde un workflow manual de GitHub Actions con *environments*; `production` exige tu aprobación.
- **Aislamiento por usuario:** todas las tablas de datos tienen `user_id`, y todas las consultas filtran por el usuario de la sesión, nunca por un valor que mande el cliente. Hay tests de integración que comprueban que un usuario no ve ni modifica datos de otro. *Row Level Security* de Postgres queda como defensa extra, a evaluar en la fase 6.

## Límites del plan Free (consultados el 23-10-2026)

| Recurso | Límite | Qué pasa al llegar |
| --- | --- | --- |
| Cómputo | 100 CU-horas por proyecto al mes | Se suspende el cómputo hasta el mes siguiente. Los datos no se borran |
| Escala a cero | Tras 5 minutos sin actividad (no se puede desactivar) | La primera consulta despierta la base en unos cientos de milisegundos |
| Almacenamiento | 1 GB por proyecto | Se bloquean las escrituras |
| Ramas | 10 por proyecto | No se pueden crear más |
| Historial (restauración) | 6 horas | — |
| Snapshots manuales | 1 | — |
| Transferencia de salida | 5 GB por proyecto | Se suspende el cómputo |

**Cálculo del cómputo.** Con 0,25 CU de tamaño, la base encendida las 24 horas gastaría unas 182 CU-horas al mes, casi el doble del límite. Por eso la sincronización **no consulta Neon para saber si hay cambios** (ver ADR 0006). La base solo despierta cuando hay algo que subir o bajar, y vuelve a dormir 5 minutos después. Con unas 20 sincronizaciones al día, el gasto estimado es de 15 CU-horas al mes. Además, el tamaño máximo del cómputo queda fijado en 0,25 CU para que el gasto no se dispare.

## Alternativas

- **Cloudflare D1 (SQLite).** También es gratis y está más cerca del Worker, pero el documento maestro pide Postgres. Además, Better Auth no puede usar transacciones con D1.
- **Driver HTTP de Neon (`neon-http`).** Es más rápido por consulta, pero no tiene transacciones interactivas.
- **Prisma.** Es más pesado en un Worker, y Drizzle encaja mejor con Zod y con Better Auth.

## Consecuencias

- En las pruebas locales y en el CI se usa Postgres normal por TCP, con el driver `pg` de Drizzle, y en el Worker se usa el driver de Neon. Las consultas son las mismas porque el esquema y Drizzle son los mismos. Si aparece alguna diferencia, en la fase 2 se evalúa el proxy de WebSockets de Neon para pruebas.
- **Respaldo:** la exportación JSON de la app (RF-5.1) más el snapshot manual de Neon antes de cada migración a producción.

## Fuentes (consultadas el 23-10-2026)

- Planes y precios de Neon: https://neon.com/pricing
- Escala a cero: https://neon.com/docs/introduction/scale-to-zero
- Driver serverless: https://neon.com/docs/serverless/serverless-driver
- Regiones: https://neon.com/docs/introduction/regions
- Drizzle con Neon: https://orm.drizzle.team/docs/get-started/neon-new
- Better Auth, transacciones en el reinicio de contraseña: https://better-auth.com/docs/authentication/email-password
