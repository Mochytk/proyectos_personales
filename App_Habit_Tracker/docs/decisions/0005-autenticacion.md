# 0005 · Autenticación

- **Estado:** Aceptada (23-10-2026, PR #18)
- **Fecha:** 23-10-2026

## Contexto

Hay un solo usuario, pero el login tiene que existir. El registro público se cierra por configuración, no por un botón escondido (RF-3.1). Hacen falta logout, cambio de contraseña y cierre de sesión en todos los dispositivos (RF-3.2). En la fase 0 elegiste recuperar la contraseña por correo (respuesta 14). No inventamos criptografía ni manejo de sesiones propio.

## Decisión

- **Better Auth 1.7** con el adaptador de Drizzle (`transaction: true`) y el *handler* montado en Hono bajo `/api/auth/*`. Necesita la bandera `nodejs_compat` en `wrangler.jsonc`, porque usa `AsyncLocalStorage`.
- **Correo y contraseña** (`emailAndPassword.enabled: true`), con un mínimo de 12 caracteres.
- **Registro cerrado por variable de entorno.** `disableSignUp` toma su valor de `AUTH_SIGNUP_ENABLED` (por defecto `false`):
  - Para crear tu cuenta se activa una sola vez en el entorno que corresponda.
  - Después se vuelve a desactivar.
  - Un test verifica que con la variable apagada `/api/auth/sign-up/email` rechaza el registro.
- **Hash de contraseñas: `scrypt`**, el algoritmo por defecto de Better Auth. Better Auth explica que lo eligió porque OWASP recomienda `scrypt` cuando no hay `argon2id`. El ejemplo de argon2 de su documentación usa `@node-rs/argon2`, que es nativo y no corre en un Worker. No reemplazamos el algoritmo.
- **Riesgo de CPU:** el Worker gratis permite 10 ms de CPU por petición, con algo de holgura. `scrypt` está hecho para ser costoso, así que el login podría pasarse. En la fase 2 se mide el tiempo real con el perfilador de Cloudflare. Si se pasa siempre, las salidas son dos, en este orden:
  1. Mover la verificación del hash a un Durable Object.
  2. Si eso no alcanza, conversarlo contigo (el plan pagado de Workers cuesta dinero).
  - En ningún caso se baja la seguridad del hash para que quepa.
- **Sesiones en la web/PWA:** cookies `HttpOnly`, `Secure` y `SameSite=Lax`, del mismo origen (ADR 0003). La expiración por defecto se ajusta en la fase 2.
- **Sesiones en Electron:** se usa la integración oficial de Better Auth con Electron, que abre el navegador del sistema y vuelve a la app por un *deep link*. El token se guarda con un almacenamiento propio sobre `safeStorage`, con su API asíncrona, y no con el almacenamiento por defecto de la integración (basado en `conf`). El token nunca llega al proceso de la interfaz (ver ADR 0008).
- **Límite de intentos:** el limitador de Better Auth con almacenamiento `"database"`, porque en un Worker la memoria no se comparte entre instancias. La IP se lee de la cabecera `cf-connecting-ip`. El límite por defecto de `/sign-in/email` es de 3 intentos cada 10 segundos.
- **Cierre de sesión en todos los dispositivos:** `revokeSessions`. Al cambiar la contraseña se usa `revokeOtherSessions: true`.
- **Recuperación por correo:** el flujo de Better Auth (`sendResetPassword`) detrás de una interfaz `EmailSender`, para poder cambiar de proveedor. El proveedor sigue pendiente; ver la tabla.

## Proveedor de correo (pendiente)

| Opción | Plan gratis | Problema |
| --- | --- | --- |
| Resend | 3.000 correos al mes, 100 al día | Exige un dominio verificado. No tienes dominio, y comprarlo cuesta dinero |
| Cloudflare Email Sending | — | Enviar a cualquier destinatario requiere el plan pagado de Workers |
| Brevo | No verificado | Su API pide un remitente registrado. No pude leer sus límites gratis: `www.brevo.com` y `help.brevo.com` no están en los dominios permitidos |

**Propuesta:** antes de la fase 2 se verifica Brevo. Para eso hay que permitir esos dos dominios, o puedes revisar tú su plan gratis. Si Brevo no sirve sin dominio, la opción gratis es recuperar la contraseña con un script que corres tú contra la base. Si en algún momento compras un dominio, se usa Resend.

### Actualización 23-10-2026: Brevo

Con los dominios ya permitidos, el punto pendiente se cierra así:

- **Plan gratis de Brevo:** gratis para siempre, sin tarjeta, con hasta 300 correos al día una vez que Brevo aprueba la cuenta para enviar. Recuperar la contraseña de un solo usuario usa unos pocos al año.
- **Remitente sin dominio propio:** la API acepta como remitente cualquier dirección que se haya verificado con el correo que Brevo envía a esa dirección. Su documentación advierte que, sin un dominio autenticado (SPF y DKIM), los correos tienen mucha más probabilidad de caer en spam o de ser bloqueados.
- **Decisión:** Brevo, con tu propio correo como remitente y como destinatario.
  - Se llama a su API REST (`POST https://api.brevo.com/v3/smtp/email`) con `fetch` desde el Worker, sin SDK, así que no hay dependencia nueva.
  - La clave va en el secreto `BREVO_API_KEY` de Cloudflare.
  - En la fase 2 se prueba con tu cuenta real. Si el correo llega a spam, lo marcas como deseado y listo. Si Brevo lo bloquea, queda el script de recuperación como salida gratis.
- **Privacidad:** a Brevo solo le llega tu dirección de correo y el enlace de recuperación, que vence en poco tiempo y sirve una sola vez.

`help.brevo.com` responde con un desafío anti-bots, así que la regla sobre remitentes se leyó en la documentación de la API (vía Context7) y en su página de precios.

## Alternativas

- **Sesiones propias.** Van contra el documento maestro (no inventar criptografía ni manejo de sesiones).
- **Auth.js.** No lo evalué a fondo. Better Auth ya cubre todo lo que pide el documento (Drizzle, Hono, Electron, registro cerrado, límite de intentos) y su documentación está al día.
- **Managed Better Auth de Neon.** Es cómodo, pero acopla la autenticación a Neon y aprendemos menos. Queda como plan B si Better Auth en el Worker diera problemas.
- **Passkeys.** Quedan para después; no reemplazan a la contraseña en la v1.

## Consecuencias

- `BETTER_AUTH_SECRET` es un secreto por entorno, generado con `openssl rand -base64 32` y guardado solo en Cloudflare.
- Better Auth agrega sus tablas (`user`, `session`, `account`, `verification`, `rateLimit`), con su propia migración.

## Fuentes (consultadas el 23-10-2026)

- Correo y contraseña, hash: https://better-auth.com/docs/authentication/email-password
- Seguridad: https://better-auth.com/docs/reference/security
- Opciones (`disableSignUp`): https://better-auth.com/docs/reference/options
- Hono y Cloudflare Workers: https://better-auth.com/docs/integrations/hono
- Electron: https://better-auth.com/docs/integrations/electron
- Límite de intentos: https://better-auth.com/docs/concepts/rate-limit
- Sesiones: https://better-auth.com/docs/concepts/session-management
- Límites de CPU: https://developers.cloudflare.com/workers/platform/limits/#cpu-time
- Resend: https://resend.com/pricing y https://resend.com/docs/send-with-cloudflare-workers
- Cloudflare Email Service: https://developers.cloudflare.com/email-service/
- Brevo (API): https://developers.brevo.com/docs/send-a-transactional-email
- Brevo, precios y plan gratis (23-10-2026): https://www.brevo.com/pricing/
- Brevo, remitentes y dominios (23-10-2026): https://developers.brevo.com/reference/create-sender y https://developers.brevo.com/docs/getting-started-with-senders-and-domains
