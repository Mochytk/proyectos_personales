# 0003 · Servidor y hosting en Cloudflare

- **Estado:** Propuesta
- **Fecha:** 23-10-2026

## Contexto

Todo tiene que correr gratis. Ningún secreto puede quedar en el frontend (RNF-4). Las cookies tienen que ser `HttpOnly`, `Secure` y `SameSite` (RNF-6). Hacen falta los entornos `dev`, `preview` y `production`.

## Decisión

- **Un solo Worker de Cloudflare (`apps/api`)** sirve dos cosas:
  - los archivos de la web (*static assets*), con `not_found_handling = "single-page-application"`;
  - la API bajo `/api/*`, con `run_worker_first = ["/api/*"]`.
- La web y la API quedan en el **mismo origen**, así que las cookies de sesión son del propio sitio y la web no necesita CORS. Electron sí es otro origen y se trata en el ADR 0008.
- **Hono 4** como framework de la API, con validación Zod en cada ruta.
- **Workers, no Pages.** Las peticiones a los archivos estáticos son gratis e ilimitadas, y Workers trae *Previews* por rama.
- **Despliegues con Workers Builds** (la integración de Cloudflare con GitHub), con `App_Habit_Tracker` como carpeta raíz:
  - Cada rama que no es la de producción genera una **Preview** con su propia URL, sus variables, sus secretos y sus *bindings*. Así `preview` usa una rama de Neon distinta a la de producción.
  - La rama de producción es `app/habit_tracker`. El despliegue a producción queda **desactivado** hasta la fase 6 y desde ahí solo se hace con tu confirmación.
- **Observabilidad:** Workers Logs viene activado en `wrangler.jsonc`. Las alertas se configuran en la fase 6.
- Una clase de **Durable Object** (`SyncNotifier`, con SQLite) avisa que hay cambios sin consultar la base de datos (ver ADR 0006).

## Límites del plan gratis que nos afectan

| Recurso | Límite gratis | Uso esperado |
| --- | --- | --- |
| Peticiones al Worker | 100.000 por día (se reinicia a las 00:00 UTC) | Unas 10.000 en un día de uso intenso |
| Peticiones a archivos estáticos | Gratis e ilimitadas | No consumen el límite anterior |
| Tiempo de CPU | **10 ms por petición**, con cierta holgura si se excede de vez en cuando | La mayoría usa ~2 ms. El hash de contraseñas es el riesgo (ADR 0005) |
| Subpeticiones | 50 por invocación | Pocas: Neon y el Durable Object |
| Durable Objects | 100.000 peticiones por día, solo con SQLite | Una consulta de versión cada ~15 s con la app abierta |
| Workers Logs | 200.000 registros por día, retención de 3 días | Suficiente |
| Workers Builds | 3.000 minutos al mes, 1 build a la vez | Unos 2 minutos por build |
| Previews | 100 por Worker (las más antiguas se borran solas) | Una por rama |

Si se pasa el límite de peticiones, Cloudflare responde con el error 1027 hasta las 00:00 UTC. Si se pasa el de CPU de forma sostenida, responde con el error 1102. Como la app es offline-first, en ambos casos la app sigue funcionando en el dispositivo y sincroniza después.

## Alternativas

- **Cloudflare Pages + Pages Functions.** También es gratis, pero Cloudflare recomienda Workers con *static assets* para proyectos nuevos, y las Previews de Workers permiten secretos por rama.
- **API y web en dominios distintos.** Exige CORS con credenciales y cookies de terceros, que Safari bloquea por ITP. Descartado.
- **Desplegar desde GitHub Actions con un token de Cloudflare.** Habría que guardar un token con permisos de despliegue en GitHub. Workers Builds evita ese secreto.

## Consecuencias

- Las URLs de Preview son públicas por defecto. Como el registro está cerrado (ADR 0005), solo verían la pantalla de login. Si quieres cerrarlas del todo, existe Cloudflare Access; se evalúa en la fase 6.
- Workers Builds necesita instalar la app de Cloudflare en GitHub con acceso a este repo. Eso lo haces tú (ver `docs/cuentas.md`).

## Fuentes (consultadas el 23-10-2026)

- Precios de Workers: https://developers.cloudflare.com/workers/platform/pricing/
- Límites de Workers: https://developers.cloudflare.com/workers/platform/limits/
- Static assets: https://developers.cloudflare.com/workers/static-assets/
- Workers Builds: https://developers.cloudflare.com/workers/ci-cd/builds/ y https://developers.cloudflare.com/workers/ci-cd/builds/limits-and-pricing/
- Previews: https://developers.cloudflare.com/workers/previews/
- Registro npm: `hono` 4.13.13, `wrangler` 4.152.0.
