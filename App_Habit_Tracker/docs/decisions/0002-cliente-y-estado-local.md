# 0002 · Cliente web y estado local

- **Estado:** Aceptada (23-10-2026, PR #18)
- **Fecha:** 23-10-2026

## Contexto

La app tiene que funcionar sin conexión para todo el uso diario (RNF-2). Marcar un hábito o agregar una serie tiene que tardar menos de 100 ms, sin esperar a la red (RNF-1). El mismo código corre en Safari del iPhone (PWA instalada) y dentro de Electron en el Mac.

## Decisión

- **React 19 + Vite 8 + TypeScript.** Una sola SPA que sirve para la PWA y para Electron.
- **IndexedDB con Dexie 4** como fuente de verdad del cliente. La interfaz lee con `useLiveQuery` (`dexie-react-hooks`), así que cualquier escritura local, sea del usuario o de la sincronización, se refleja sola en pantalla.
- Ningún otro manejo de estado global (sin Redux ni Zustand). Lo persistente está en Dexie, y lo efímero en el estado de React.
- **PWA con `vite-plugin-pwa` 2** (Workbox), que es compatible con Vite 8.
- Al abrir la app se llama a `navigator.storage.persist()`, que pide que iOS no borre los datos (ver "Consecuencias").
- Los esquemas de las tablas del cliente salen de los mismos esquemas Zod de `packages/shared`, que también usa el servidor.
- **Gráficos:** la librería se decide en la fase 3, midiendo el tamaño del bundle. Las candidatas son Recharts 3 y SVG propio.
- **Enrutador:** se decide al comienzo de la fase 1, con su documentación a la vista.

## Alternativas

- **SQLite en WASM (OPFS).** Es más potente para consultas, pero el soporte de OPFS en iOS y la complejidad de los workers no se justifican con este volumen de datos.
- **`localStorage`.** Es síncrono, tiene poco espacio y no tiene índices. No sirve para el historial ni para el gym.
- **Dexie Cloud.** Se evalúa en el ADR 0006 como alternativa de sincronización.

## Consecuencias

- **Límite de iOS: almacenamiento.** WebKit puede borrar los datos de un sitio si no se usa por un tiempo o si el teléfono se queda sin espacio, salvo que el sitio esté en "modo persistente". Ese modo se concede por heurística, por ejemplo cuando la web está instalada en la pantalla de inicio. Lo mitigamos de tres formas: instalar la PWA, pedir `persist()` y tener el servidor como respaldo. Si el teléfono borrara los datos, se recuperan con una sincronización completa; lo único que se perdería es lo que aún no se sincronizó.
- **Límite de iOS: sincronización en segundo plano.** Safari no implementa Background Sync (`SyncManager`). La sincronización corre solo con la app abierta: al abrirla, al volver a ella y al recuperar la conexión.
- Las pruebas de la lógica de datos usan `fake-indexeddb` en Vitest. Esa dependencia de desarrollo se revisa al agregarla en la fase 1.

## Fuentes (consultadas el 23-10-2026)

- Política de almacenamiento de WebKit: https://webkit.org/blog/14403/updates-to-storage-policy/
- Datos de compatibilidad de MDN (`SyncManager`, `PushManager`, `Navigator.vibrate` en Safari iOS): https://github.com/mdn/browser-compat-data
- Registro npm: `dexie` 4.4.6, `dexie-react-hooks` 4.4.0, `vite` 8.3.5, `vite-plugin-pwa` 2.0.0 (`peerDependencies` con `vite ^8.0.0`), `react` 19.3.1.
