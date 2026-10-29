# 0010 · Uso diario antes de la fase 6

- **Estado:** Propuesta
- **Fecha:** 29-10-2026

## Contexto

La meta es usar los hábitos en el iPhone, sincronizados, antes de diciembre (respuesta 16 de la fase 0). El endurecimiento completo es de la fase 6. Cada rama tiene su propia URL de Preview, y una PWA instalada queda atada a la URL desde la que se instaló. Además:

- El ADR 0003 dejaba el despliegue a producción desactivado hasta la fase 6.
- El ADR 0004 dejaba abierto cómo probar localmente con el driver de Neon.
- El ADR 0005 dejaba la duración de la sesión para la fase 2.

El 29-10-2026 respondiste las preguntas de la fase 2: rama de *release*, `pg` aprobado y sesión de 30 días.

## Decisión

- **Producción desde una rama de *release*.**
  - El Worker de producción se despliega solo desde la rama `release/habit-tracker`, con la rama `production` de Neon. Su URL estable es `constancia.<tu-subdominio>.workers.dev`.
  - La rama avanza solo con una PR de `app/habit_tracker` hacia `release/habit-tracker`, que fusionas tú. Fusionar esa PR es tu confirmación de cada despliegue.
  - Todas las demás ramas, `app/habit_tracker` incluida, generan Previews con la rama `preview` de Neon y datos de prueba. Así una PR con un error nunca toca tus datos reales.
  - Esto reemplaza, en el ADR 0003, la regla de "producción desactivada hasta la fase 6". Lo demás de ese ADR sigue igual.
- **Lo que protege los datos reales antes de la fase 6** (todo en la fase 2):
  - registro cerrado (`AUTH_SIGNUP_ENABLED=false`) y límite de intentos de login;
  - cabeceras de seguridad, con una CSP estricta para la web;
  - tests de aislamiento entre usuarios en cada consulta;
  - una revisión de seguridad independiente antes del primer *release*;
  - el historial de 6 horas de Neon y un *snapshot* manual antes de cada migración a producción.
- **Driver de base de datos por entorno.**
  - En Cloudflare se usa `@neondatabase/serverless` (`Pool` por WebSockets), como dice el ADR 0004 y como recomienda Neon para Workers sin Hyperdrive.
  - En desarrollo, en las pruebas y en el CI se usa `pg` (node-postgres) por TCP contra Postgres local. Cloudflare documenta que `pg` funciona en un Worker con `nodejs_compat`.
  - La variable `DATABASE_DRIVER` (`neon` o `pg`) elige uno u otro. El esquema y las consultas de Drizzle son los mismos.
- **Sesión de 30 días, renovable** (`expiresIn` de 30 días y `updateAge` de 1 día). Desde Ajustes se puede cerrar la sesión en todos los dispositivos.
- **URL base dinámica en Better Auth** (`baseURL.allowedHosts`), para que el login funcione en la URL de producción y en la de cada Preview sin tocar la configuración. `AUTH_ALLOWED_HOSTS` se configura en el panel de Cloudflare, para que tu subdominio no quede en el repo.

## Alternativas

- **Una Preview fija para el uso diario.** Comparte la base `preview` con las Previews de todas las PRs, así que una PR con un error podría tocar tus datos reales.
- **Esperar a la fase 6.** Es lo más seguro, pero no usarías la app sincronizada antes de diciembre.
- **El proxy de WebSockets de Neon en local.** Es una imagen de Docker de terceros que habría que revisar, y sumaría una pieza más en desarrollo y en el CI.
- **Hyperdrive con `pg` también en producción.** Neon lo recomienda para Workers, pero agrega otro servicio que configurar. Queda como mejora si la latencia lo pide.

## Consecuencias

- Hay que crear la rama `release/habit-tracker` y configurar Workers Builds con ella como rama de producción (PR 2.7).
- Antes de la fase 6, la app no tiene exportación propia (RF-5.1). El respaldo es el historial y el *snapshot* de Neon.
- El *bundle* del Worker incluye los dos drivers. Se mide en la PR 2.1; si molesta, el de desarrollo se excluye del *build* de producción.

## Fuentes (consultadas el 29-10-2026)

- Neon, cómo elegir la conexión: https://neon.com/docs/connect/choose-connection
- Neon, escala a cero: https://neon.com/docs/introduction/compute-lifecycle
- Cloudflare, Postgres desde un Worker: https://developers.cloudflare.com/workers/tutorials/postgres/
- Cloudflare, Previews y su configuración: https://developers.cloudflare.com/workers/previews/configuration/
- Cloudflare, ramas en Workers Builds: https://developers.cloudflare.com/workers/ci-cd/builds/build-branches/
- Cloudflare, cabeceras de los archivos estáticos: https://developers.cloudflare.com/workers/static-assets/headers/
- Better Auth, URL base dinámica: https://better-auth.com/docs/reference/options
- Better Auth, límite de intentos: https://better-auth.com/docs/concepts/rate-limit
- Registro npm (29-10-2026): `hono` 4.13.14, `wrangler` 4.155.0, `better-auth` 1.7.14, `drizzle-orm` 0.45.4, `drizzle-kit` 0.31.11, `@neondatabase/serverless` 1.2.0, `pg` 8.23.1.
