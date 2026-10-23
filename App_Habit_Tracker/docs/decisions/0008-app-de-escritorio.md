# 0008 · App de escritorio para Mac

- **Estado:** Propuesta
- **Fecha:** 23-10-2026

## Contexto

Quieres una app de escritorio en el Mac (HU-15) con el mismo código que la PWA. No tienes cuenta de desarrollador de Apple, así que no hay firma ni notarización. Electron tiene que quedar endurecido (RNF-8) y el token de sesión tiene que estar en el almacén seguro del sistema (RNF-6).

## Decisión

- **Electron 45 + electron-builder 26**, en `apps/desktop`. La app empaqueta el mismo *build* de `apps/web`.
- **Protocolo propio** (`app://habit-tracker`) para servir el *build*, igual que Media Tracker. Así no hay un puerto local que otro proceso pueda tomar, el origen es estable y se bloquean las rutas que se salen de `dist/`.
- **Endurecimiento:**
  - `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true` y `webSecurity` activo;
  - CSP en el *renderer*;
  - `setWindowOpenHandler` que niega todo, y `will-navigate` que bloquea la navegación fuera del protocolo propio;
  - nada de `remote`;
  - un *preload* mínimo con una API explícita.
- **Sesión:** se usa la integración de Better Auth con Electron, que inicia sesión en el navegador del sistema y vuelve por un *deep link* con un esquema propio, registrado en `trustedOrigins`. El token:
  - se guarda en el proceso principal con **`safeStorage`, usando su API asíncrona** (`encryptStringAsync` y `decryptStringAsync`). La API síncrona está obsoleta y se elimina en Electron 46;
  - nunca pasa al *renderer*. Las llamadas a la API desde Electron salen del proceso principal: el *preload* expone solo `sync.push`, `sync.pull`, `sync.version` y `auth.*`.
- **Firma:** firma *ad hoc* con `mac.identity: "-"`. electron-builder no la aplica por defecto: si no encuentra certificado, deja la app sin firmar.
- **Dónde se construye:** en tu Mac, con `pnpm --filter desktop build:mac`. Una app construida en tu propio equipo no se marca como descargada de internet.

## Qué implica no firmar ni notarizar

1. **Gatekeeper.** Si descargas el `.dmg` (por ejemplo, desde un artefacto de GitHub), macOS lo bloquea la primera vez. Se abre igual desde Ajustes del Sistema → Privacidad y seguridad → "Abrir igualmente". Los pasos exactos para tu versión de macOS se verifican en la fase 5.
2. **Llavero.** La documentación de Electron advierte que sin una firma válida y estable, macOS puede no reconocer dos *builds* como la misma app. Entonces el Llavero vuelve a pedir permiso en cada actualización.
   - **Mitigación:** crear un certificado de firma autofirmado en "Acceso a Llaveros" (gratis, no requiere cuenta de Apple) y usarlo como `mac.identity`, para que la identidad sea estable. Se prueba en la fase 5.
   - Si no funciona, aceptas "Permitir siempre" una vez por actualización.
3. **Actualizaciones:** son manuales. Construyes la versión nueva y reemplazas la app en `/Aplicaciones`. Los datos no se pierden: viven en el servidor y en el perfil de la app.

## Alternativas

- **Tauri.** Es más liviano, pero usa WebKit en el Mac y su modelo de seguridad y su toolchain (Rust) son otros. El documento maestro pide Electron, y Media Tracker ya tiene un patrón probado.
- **Instalar la PWA desde Safari en el Dock.** Funciona sin construir nada, y queda como plan B si Electron se atrasa. No permite guardar el token en el Llavero ni tener menús propios.
- **Almacenamiento por defecto de la integración de Better Auth (`conf`).** Guarda en un archivo y no en el Llavero. No cumple RNF-6.

## Fuentes (consultadas el 23-10-2026)

- `safeStorage`: https://www.electronjs.org/docs/latest/api/safe-storage
- Firma en macOS con electron-builder 26: https://www.electron.build/v26/docs/features/code-signing/code-signing-mac
- Better Auth con Electron: https://better-auth.com/docs/integrations/electron
- Registro npm: `electron` 45.0.0, `electron-builder` 26.15.3.
