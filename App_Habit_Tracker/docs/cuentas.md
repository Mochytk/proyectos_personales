# Cuentas y despliegue: paso a paso

Esta guía pone Constancia en Cloudflare con tus cuentas. La sigues tú en los paneles; yo no tengo acceso a ninguno. Todo es gratis: Neon indica que su plan Free no pide tarjeta, y los planes gratis de Cloudflare, GitHub y Brevo tampoco deberían pedirla. **Si algún servicio te pide una tarjeta, detente y avísame antes de ingresarla.**

Los nombres de los menús pueden cambiar un poco. Los pasos se escribieron el 21-11-2026 con la documentación vigente de cada servicio. Si algo no calza, dime qué ves y lo ajustamos.

**Regla fija:** las claves y las URLs con contraseña se pegan solo en los paneles de cada servicio, en los secretos de GitHub o en un *prompt* de la terminal. Nunca en el chat, en un commit, en una issue ni en una PR.

Hazlos en este orden: cada paso usa algo del anterior.

## 1. Neon: la base de datos

1. Crea una cuenta gratis en neon.com (puedes entrar con GitHub).
2. Crea un proyecto `habit-tracker` en la región **AWS São Paulo (`aws-sa-east-1`)**, con Postgres en su última versión.
3. En la rama por defecto (renómbrala `production`), deja el tamaño de cómputo en **0,25 CU** como mínimo y como máximo.
4. Crea la rama `preview` desde `production`. Ahí van los datos de prueba de las Previews.
5. De cada rama vas a necesitar **dos URLs**, que salen del botón **Connect**:
   - **Pooled** (el host termina en `-pooler`, con el interruptor *Connection pooling* encendido): la usa el Worker.
   - **Directa** (sin `-pooler`): la usan las migraciones. Neon advierte que migrar por la URL *pooled* puede fallar.

   No las copies a ningún archivo: las pegas directo en los pasos 2 y 5.

## 2. GitHub: entornos y migraciones

En el repo `proyectos_personales`:

1. **Settings → Code security** (en algunas cuentas, "Advanced Security"): activa **Secret scanning**, **Push protection** y **Dependabot alerts**. Son gratis en repos públicos.
2. **Settings → Environments:** crea los entornos `preview` y `production`.
   - A `production` agrégale **Required reviewers** contigo, para que ninguna migración a producción corra sin tu aprobación.
   - En `production`, en **Deployment branches and tags**, elige **Selected branches and tags** y agrega solo `app/habit_tracker` y `release/habit-tracker`. El workflow también lo revisa, pero ese chequeo vive en el archivo de cada rama y una rama lo puede borrar; este no.
   - Al aprobar una migración a producción, mira en la pantalla de aprobación que la rama sea una de esas dos.
   - En cada uno, agrega el secreto **`DATABASE_URL`** con la URL **directa** de la rama de Neon del mismo nombre.
3. **Recomendado:** en **Settings → Branches**, una regla para `app/habit_tracker` y otra para `release/habit-tracker` que exijan PR y CI en verde antes de fusionar.

## 3. Primera migración

Crea las tablas en las dos bases:

1. En **Actions → Habit tracker migrations → Run workflow**, elige la rama `app/habit_tracker` y el entorno `preview`. Debe terminar en verde.
2. Repite con la rama **`release/habit-tracker`** y el entorno `production`. GitHub te pide aprobarlo. El workflow se niega a migrar producción desde una rama de trabajo: solo acepta `release/habit-tracker` o `app/habit_tracker`.

Más adelante, cada vez que una PR traiga una migración nueva, se repite: `preview` al fusionarla y `production` justo antes de cada *release* (paso 8).

## 4. Brevo: el correo para recuperar la contraseña

Ver el [ADR 0005](decisions/0005-autenticacion.md), sección "Actualización 23-10-2026".

1. Crea una cuenta gratis en brevo.com. Brevo revisa la cuenta antes de habilitar los envíos.
2. En **Senders, Domains & Dedicated IPs**, agrega tu correo como remitente y confírmalo con el correo de verificación que te llega.
3. Crea una clave de API. Si Brevo permite limitar sus permisos, déjala solo para correos transaccionales. La pegas en el paso 5.

Si algún día compras un dominio, conviene autenticarlo en Brevo (SPF y DKIM) para que los correos no caigan en spam.

## 5. Cloudflare: el Worker

1. Crea una cuenta gratis en cloudflare.com. No necesitas dominio.
2. En **Workers & Pages**, elige un subdominio de `workers.dev`. Aparece en la URL de la app, así que conviene que no tenga tu nombre real. En esta guía lo llamo `<sub>`.
3. **Workers & Pages → Create → Import a repository.** Se instala la app de Cloudflare en GitHub: dale acceso **solo** a `proyectos_personales`. Configura:

   | Campo | Valor |
   | --- | --- |
   | Nombre del Worker | `constancia` (tiene que coincidir con `wrangler.jsonc`) |
   | Rama de producción | `release/habit-tracker` ([ADR 0010](decisions/0010-uso-diario-antes-de-la-fase-6.md)) |
   | Carpeta raíz | `App_Habit_Tracker` |
   | Comando de *build* | `pnpm --filter @habit-tracker/web build` |
   | Comando de *deploy* | `pnpm --filter @habit-tracker/api run deploy` |
   | Previews / builds de otras ramas | Activadas |
   | Comando de Preview | `pnpm --filter @habit-tracker/api run deploy:preview` |

   No hace falta crear un token de API: Workers Builds lo genera solo.

4. **Secretos de producción:** en el Worker, **Settings → Variables and Secrets → Add**, cada uno de tipo **Secret**. Van como secretos y no como variables porque cada *deploy* reemplaza las variables con las de `wrangler.jsonc`.

   | Secreto | Valor |
   | --- | --- |
   | `DATABASE_URL` | La URL **pooled** de la rama `production` de Neon |
   | `BETTER_AUTH_SECRET` | Generado en tu Mac con `openssl rand -base64 32` |
   | `AUTH_ALLOWED_HOSTS` | `constancia.<sub>.workers.dev` |
   | `AUTH_SIGNUP_ENABLED` | `true` solo mientras creas tu cuenta (paso 6); después, `false` |
   | `BREVO_API_KEY` | La clave del paso 4 |
   | `EMAIL_FROM` | El correo que verificaste en Brevo |

   El primer *deploy* corre apenas conectas el repo. Hasta que agregues los secretos, la app abre pero el login responde con error.

5. **Secretos de las Previews.** Las Previews no heredan nada de producción. Sus secretos se fijan una vez en la "configuración base", y cada Preview nueva los recibe al crearse. Eso se hace desde la terminal de tu Mac, en una copia del repo con `pnpm install` hecho:

   ```sh
   cd App_Habit_Tracker/apps/api
   pnpm exec wrangler login
   pnpm exec wrangler preview base-config secret put DATABASE_URL
   ```

   Repite el último comando con `BETTER_AUTH_SECRET` (uno distinto del de producción), `AUTH_ALLOWED_HOSTS`, `AUTH_SIGNUP_ENABLED`, `BREVO_API_KEY` y `EMAIL_FROM`. Wrangler te pide cada valor sin mostrarlo ni guardarlo en el historial. Para las Previews:
   - `DATABASE_URL`: la URL **pooled** de la rama `preview` de Neon;
   - `AUTH_ALLOWED_HOSTS`: `*-constancia.<sub>.workers.dev`, porque cada Preview tiene una URL `<rama>-constancia.<sub>.workers.dev`;
   - `AUTH_SIGNUP_ENABLED`: `false`. Cámbialo a `true` solo mientras pruebas el registro en una Preview. Las URL de las Previews son públicas, y con el registro abierto cualquiera que dé con una puede crear cuentas;
   - `BREVO_API_KEY`: vacío (al pedirlo, solo presiona Enter). El restablecimiento igual responde, pero no manda correos. Así nadie puede usar una Preview para mandar correos a terceros desde tu remitente, y el código de una rama nunca ve tu clave. Si algún día quieres probar el correo en una Preview, crea en Brevo una clave aparte y bórrala después.

   La rama `preview` de Neon es solo de prueba: **nunca la restaures desde `production`** cuando ya tengas datos reales, porque copiaría tus sesiones y tu contraseña cifrada a un entorno que corre el código de cualquier rama.

   Los cambios a la configuración base solo llegan a las Previews nuevas.

## 6. Tu cuenta

1. Abre `https://constancia.<sub>.workers.dev/cuenta`, toca **Crear cuenta** y créala con tu correo y una contraseña de 12 caracteres o más.
2. En Cloudflare, cambia `AUTH_SIGNUP_ENABLED` a `false`. Desde ahí, nadie más puede registrarse. Como es un secreto, el panel no muestra su valor: para comprobarlo, cierra sesión e intenta crear otra cuenta con un correo inventado. Tiene que decir "El registro está cerrado.".
3. En el iPhone y en el Mac, inicia sesión en la misma URL. El estado arriba a la derecha pasa a "Sincronizado".

## 7. Medir el login (una vez)

El plan gratis de Workers da 10 ms de CPU por petición, y el *hash* de contraseñas es lo único que puede pasarse (ADR 0005). En producción, después del paso 6 (las Previews tienen el registro cerrado, así que ahí no hay cuenta con la que entrar):

1. Inicia sesión 10 veces. Espera unos segundos entre intentos, porque el límite es de 3 cada 10 s.
2. En el Worker, **Observability → Logs**, filtra las peticiones a `/api/auth/sign-in/email` y anota su `cpuTime`.
3. Pásame los números. Los anoto en el ADR 0005, y si se pasan de 10 ms de forma sostenida, aplicamos su plan B.

## 8. Cada *release* a producción

Producción solo cambia cuando tú lo decides (ADR 0010):

1. Abre (o te abro yo) una PR de `app/habit_tracker` hacia `release/habit-tracker`. Su descripción dice si trae migraciones.
2. Si trae migraciones:
   1. en Neon, crea una rama de respaldo desde `production` (por ejemplo `respaldo-AAAA-MM-DD`; borra las viejas, el plan gratis tiene un máximo de ramas);
   2. corre el workflow de migraciones con `production` desde **`app/habit_tracker`**, antes de fusionar. Las migraciones solo agregan (tablas, columnas con valor por defecto), así que la versión que está en producción sigue funcionando con el esquema nuevo.
3. Fusionar esa PR despliega producción. Workers Builds muestra el resultado en el panel del Worker.

## 9. En tu Mac

- Node 24 (LTS) y pnpm. Puedes usar `corepack enable`, que lee la versión fijada en `package.json`.
- Docker Desktop (u OrbStack), para el Postgres local de las pruebas.
- Un archivo `App_Habit_Tracker/.env.local`, copiado de `.env.example`, con tus valores de desarrollo. Git lo ignora.
- Para la API en local, `App_Habit_Tracker/apps/api/.dev.vars`, copiado de `.dev.vars.example`. Git también lo ignora. Los comandos están en `App_Habit_Tracker/CLAUDE.md`.

## Lo que no necesitas

- Cuenta de desarrollador de Apple: no hay firma ni notarización (ADR 0008).
- Dominio propio: alcanza con `*.workers.dev`.
- Tarjeta de crédito, en ningún servicio.
