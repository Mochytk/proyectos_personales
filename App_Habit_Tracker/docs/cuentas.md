# Cuentas y permisos que necesitas

Nada de esto hace falta antes de la **fase 2**. La fase 1 corre 100 % en local. Todo es gratis: Neon indica que su plan Free no pide tarjeta, y los planes gratis de Cloudflare y GitHub tampoco deberían pedirla. Si algún servicio te pide una tarjeta, avísame antes de ingresarla.

Los nombres de los menús pueden cambiar un poco. En la fase 2 te guío con capturas de cada paso.

**Regla fija:** las claves y las URLs con contraseña se pegan solo en los paneles de cada servicio, en los secretos de GitHub o en tu `.env.local`. Nunca en el chat, en un commit, en una issue ni en una PR.

## 1. GitHub (ya la tienes)

En **Settings → Code security** del repo `proyectos_personales` (en algunas cuentas aparece como "Advanced Security"):

1. Activa **Secret scanning** y **Push protection**. Son gratis en repos públicos: GitHub bloquea un push si detecta una clave conocida.
2. Activa las **Dependabot alerts**.

En **Settings → Environments**:

3. Crea dos entornos: `preview` y `production`.
4. A `production` agrégale una regla **Required reviewers** contigo. Así ninguna migración a producción corre sin tu aprobación.

En la fase 2 te pido que agregues estos secretos de entorno, uno por entorno:

5. `DATABASE_URL`, con la URL de la rama de Neon correspondiente. La usa el workflow manual de migraciones.

Opcional pero recomendado: en **Settings → Branches**, una regla para `app/habit_tracker` que exija PR y CI en verde antes de fusionar.

## 2. Cloudflare

1. Crea una cuenta gratis en cloudflare.com. No necesitas dominio.
2. En **Workers & Pages**, elige un subdominio de `workers.dev`. Aparece en la URL de la app, así que conviene que no tenga tu nombre real.
3. En la fase 2 creas el Worker conectando el repo con **Workers Builds** ("Import a repository"):
   - Se instala la app de Cloudflare en GitHub. Dale acceso **solo** a `proyectos_personales`.
   - Carpeta raíz: `App_Habit_Tracker`. Los comandos de build te los doy en ese momento.
   - Rama de producción: `app/habit_tracker`, con el despliegue a producción **desactivado** hasta la fase 6.
4. Secretos del Worker (en el panel, separados para Production y para Previews):
   - `DATABASE_URL`: la URL de la rama de Neon de ese entorno.
   - `BETTER_AUTH_SECRET`: genéralo en tu Mac con `openssl rand -base64 32`.
   - `AUTH_SIGNUP_ENABLED`: `true` solo mientras creas tu cuenta; después, `false`.

No hace falta crear ningún token de API de Cloudflare: Workers Builds despliega sin que el repo guarde credenciales.

## 3. Neon

1. Crea una cuenta gratis en neon.com (puedes entrar con GitHub).
2. Crea un proyecto `habit-tracker` en la región **AWS São Paulo (`aws-sa-east-1`)**, con Postgres en su última versión.
3. En la rama por defecto (renómbrala `production`), deja el tamaño de cómputo en **0,25 CU** como mínimo y como máximo.
4. Crea dos ramas desde `production`: `preview` y `dev`.
5. Copia la *connection string* de cada rama (la "pooled" o la directa, como te indique en la fase 2) y pégala solo en Cloudflare, en GitHub o en tu `.env.local`.

## 4. Correo para recuperar la contraseña (pendiente)

Ver el [ADR 0005](decisions/0005-autenticacion.md). Antes de la fase 2 hay que confirmar si Brevo permite enviar gratis sin dominio propio. Para eso:

- agrega `www.brevo.com` y `help.brevo.com` a los dominios permitidos del entorno, o
- revisa tú su plan gratis.

Resend es la alternativa si en algún momento compras un dominio.

## 5. En tu Mac

- Node 24 (LTS) y pnpm. Puedes usar `corepack enable`, que lee la versión fijada en `package.json`.
- Docker Desktop (u OrbStack), para el Postgres local de las pruebas.
- Un archivo `App_Habit_Tracker/.env.local`, copiado de `.env.example`, con tus valores de desarrollo. Git lo ignora.

## Lo que no necesitas

- Cuenta de desarrollador de Apple: no hay firma ni notarización (ADR 0008).
- Dominio propio: alcanza con `*.workers.dev`.
- Tarjeta de crédito, en ningún servicio.
