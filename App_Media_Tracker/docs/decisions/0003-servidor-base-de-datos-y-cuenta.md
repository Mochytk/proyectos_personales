# 0003 · Servidor, base de datos y cuenta

- **Estado:** Propuesto
- **Fecha:** 25-11-2026

## Contexto

- Hacen falta una cuenta, la sincronización entre el iPhone y el Mac y un lugar seguro para las claves de TMDB y RAWG (respuestas 2 y 3).
- Todo tiene que ser gratis y sin tarjeta.
- Constancia ya usa Cloudflare Workers, Neon, Drizzle y Better Auth en la misma cuenta de Cloudflare (sus ADRs 0003, 0004 y 0005).

## Decisión

Igual que Constancia, con un **Worker y una base propios** de Media Tracker:

- **Worker de Cloudflare `media-tracker`** con Hono 4. Sirve los archivos estáticos de `apps/web` y la API `/api/*` en el mismo origen, así que la PWA no necesita CORS con credenciales ni cookies de terceros. Electron carga desde `app://media-tracker`, que es otro origen, y usa un token guardado en `safeStorage` (ADR 0009). Tiene entornos `dev`, `preview` (por rama) y `production`, y producción se despliega desde la rama de *release* (como el ADR 0010 de Constancia).
- **Neon: un proyecto aparte, `media-tracker`**, en `aws-sa-east-1`. El plan Free permite 100 proyectos, cada uno con 100 CU-horas de cómputo al mes, 1 GB de almacenamiento y 10 ramas. Un proyecto propio no le quita cómputo a Constancia. Dentro del proyecto, la rama `production` es para producción y las ramas de *preview* son para las Previews.
- **Drizzle** para el esquema y las migraciones, con una migración por commit y revisada en la PR.
- **Better Auth 1.7**, con correo y contraseña (scrypt), sesión en una cookie `HttpOnly`, `Secure` y `SameSite=Lax`, y límite de intentos. El registro queda cerrado con `AUTH_SIGNUP_ENABLED=false` después de crear tu cuenta.
- **Durable Object `SyncNotifier`**, como en Constancia, para avisar de cambios sin despertar Neon (ADR 0004).
- **KV `META_CACHE`** para la caché de metadatos (ADR 0005).
- **Secretos** con `wrangler secret`: `TMDB_API_KEY`, `RAWG_API_KEY`, `DATABASE_URL` y `BETTER_AUTH_SECRET`. Nunca van en el repo ni en el frontend. `.env.example` solo lista los nombres.

### Límites del plan gratis que importan

| Recurso | Límite gratis | Uso esperado |
| --- | --- | --- |
| Peticiones al Worker | 100.000 al día | Unas 6.000 de sincronización en un día largo, más las búsquedas |
| Archivos estáticos | Gratis e ilimitados | No cuentan en el límite anterior |
| Durable Objects | 100.000 peticiones al día, con SQLite | Una consulta de versión cada 15 s con la app abierta |
| KV | 100.000 lecturas y 1.000 escrituras al día | Una escritura por búsqueda o ficha nueva; decenas al día |
| Neon (por proyecto) | 100 CU-horas al mes, 1 GB | Despierta solo con *push* o *pull*; se suspende a los 5 min |

Si se pasa algún límite, la app sigue funcionando en el dispositivo y sincroniza después.

## Alternativas

- **Compartir el Worker o la base de Constancia.** Mezcla los datos y los secretos de dos apps, y un fallo o una migración en una afecta a la otra. Descartada.
- **Una rama de Neon dentro del proyecto de Constancia.** Las ramas de un proyecto comparten las 100 CU-horas y las 10 ramas, y desordena las Previews de las dos apps. Descartada, porque el plan Free permite proyectos separados.
- **Cloudflare D1 en vez de Neon.** También es gratis, pero tendríamos dos bases de datos distintas entre las dos apps, y el código de sincronización de Constancia está escrito para Postgres. Descartada.

## Consecuencias

- Hay que crear en tu cuenta de Cloudflare el Worker, el KV y los secretos, y en Neon el proyecto. Se hará en la fase 2 con una guía paso a paso. Nada de eso cuesta dinero, y se te avisará antes de cada paso.
- Las claves de TMDB y RAWG que hoy están en la app actual pasan a ser secretos del Worker. Te conviene generar claves nuevas para no reutilizar las que estuvieron en el dispositivo; eso queda como pregunta para la fase 2.

## Fuentes

- ADRs 0003, 0004, 0005 y 0010 de Constancia (rama `app/habit_tracker`), consultados el 25-11-2026.
- Neon, planes y límites del Free: https://neon.com/docs/introduction/plans, consultado el 25-11-2026 (vía Context7).
- Cloudflare, límites de Workers KV: https://developers.cloudflare.com/kv/platform/limits/, consultado el 25-11-2026 (vía Context7).
- Cloudflare, límites de Workers: https://developers.cloudflare.com/workers/platform/limits/, consultado el 25-11-2026.
