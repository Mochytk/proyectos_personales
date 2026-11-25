# 0009 · App de escritorio para Mac

- **Estado:** Propuesto
- **Fecha:** 25-11-2026

## Contexto

- La app actual ya funciona en el Mac con Electron:
  - protocolo `app://media-tracker`;
  - datos en `userData`;
  - menú nativo y atajos;
  - estado de la ventana;
  - icono en la barra de menú para avanzar sin abrir la ventana (PR #31).
- Constancia tiene una app de escritorio endurecida que carga su *build* web (su ADR 0008).
- No hay cuenta de desarrollador de Apple, así que la app no se firma ni se notariza.

## Decisión

Igual que el ADR 0008 de Constancia:

- **Electron** con la versión fijada de Constancia en el momento de la fase 5.
- **Carga el *build* de `apps/web`** desde el protocolo propio `app://media-tracker` y habla con el Worker por HTTPS.
- **Endurecimiento:**
  - `contextIsolation: true`, `sandbox: true` y `nodeIntegration: false`;
  - CSP estricta y navegación externa bloqueada (los enlaces se abren en el navegador);
  - permisos denegados por omisión;
  - *preload* mínimo con `contextBridge`, y cada mensaje IPC se valida con Zod.
- **Token de sesión** en `safeStorage`, con la API asíncrona.
- **Firma *ad hoc*** con la guía de instalación que ya existe en la app actual (quitar la cuarentena).

**Lo que se traslada de la app actual:**

- el menú nativo y los atajos de hoy (⌘N / ⇧⌘N, ⌘F, ⌘,, ⌘1 a ⌘4, ⇧⌘E / ⇧⌘I), más los de las pantallas nuevas;
- el estado de la ventana;
- el icono de la barra de menú, con la lista de lo que estás disfrutando y su avance (la lógica de `store/tray.ts` pasa a `packages/shared`).

**Datos:** en Electron, Dexie vive en el IndexedDB de la sesión de Electron, igual que en el navegador. Ya no se escriben archivos en `userData`. El importador lee los archivos de la app actual cuando le das la ruta.

## Alternativas

- **Solo la PWA instalada desde Safari en el Mac.** No tiene menú en la barra ni atajos globales. Descartada, porque la PR #31 mostró que el icono en la barra de menú te sirve.
- **Tauri.** Es más liviano, pero usa WebKit en el Mac (otro motor que probar) y no comparte nada con Constancia. Descartada.

## Consecuencias

- Hay un solo código de interfaz para el iPhone y el Mac. Electron solo agrega el menú, los atajos, la barra de menú y el almacenamiento seguro del token.
- Sin firma, macOS muestra el aviso de Gatekeeper la primera vez. Es lo mismo que hoy.

## Fuentes

- ADR 0008 de Constancia (rama `app/habit_tracker`), consultado el 25-11-2026.
- Electron, lista de seguridad: https://www.electronjs.org/docs/latest/tutorial/security, consultada el 25-11-2026.
- `App_Media_Tracker/MediaTracker/electron-*.js`, `README.md` (sección Atajos) y `store/tray.ts`, consultados el 25-11-2026.
