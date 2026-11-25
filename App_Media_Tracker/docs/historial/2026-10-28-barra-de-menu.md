# Icono en la barra de menú — Plan de implementación

> **Para quien ejecute:** SUB-SKILL REQUERIDA: usar superpowers:subagent-driven-development (recomendado) o superpowers:executing-plans para implementarlo tarea por tarea. Los pasos usan casillas (`- [ ]`).

**Objetivo:** un icono en la barra de menú de macOS que muestra lo que se está disfrutando y permite avanzar el progreso sin abrir la ventana, con la app viva al cerrar la ventana.

**Arquitectura:** el renderer (ventana oculta pero viva) calcula una instantánea de texto con funciones puras y la envía por IPC; el proceso principal la sanea y construye un menú nativo; las acciones del menú vuelven al renderer, que las valida y las aplica con `updateItem`. Cerrar la ventana la oculta en macOS.

**Tech Stack:** Electron (`Tray`, `Menu`, `nativeImage`), TypeScript/React Native Web, Vitest, Pillow (solo para generar los iconos).

**Spec:** `docs/superpowers/specs/2026-10-28-barra-de-menu-design.md`

## Global Constraints

- Solo macOS (`process.platform === 'darwin'`); en otros sistemas el comportamiento actual no cambia.
- El menú muestra como máximo **8** elementos (los de la pestaña Disfrutando, por `updatedAt` descendente) y los textos se recortan a **80** caracteres.
- Pasos de avance: series con temporadas **+1 episodio**; episodios/capítulos/niveles **+1**; páginas **+10** (tope: el total); porcentaje **+10** (tope: 100). Sin contador: sin acción de avanzar.
- Avanzar **nunca** marca como terminado; si ya está al final, la acción de avanzar no aparece.
- Acciones que vuelven del menú, lista fija: `advance`, `open`, `open-enjoying`. El renderer valida el `id`.
- El proceso principal recibe solo texto ya preparado; nunca rutas ni código.
- Archivos de icono: `build/trayTemplate.png` (22×22) y `build/trayTemplate@2x.png` (44×44), monocromos con transparencia, incluidos en `build.files`.
- Textos de interfaz en español. Cada commit pasa `npm run typecheck`, `npm run lint` y `npm test` (en `App_Media_Tracker/MediaTracker`).

## Review Focus

1. **Título enorme, con emojis o vacío** → se recorta a 80 caracteres sin partir un emoji; un título vacío muestra "Sin título". (Task 1 y Task 2)
2. **El renderer envía una instantánea mal formada** (no es objeto, `entries` no es arreglo, ids o textos que no son cadenas, más de 8) → el proceso principal la limpia o la ignora sin lanzar. (Task 2)
3. **Menú desactualizado: acción sobre un elemento ya eliminado** → se ignora sin error. (Task 1)
4. **Menú desactualizado: avanzar un elemento que ya llegó al final** → se ignora, no pasa del total ni lo marca terminado. (Task 1)
5. **Clic en el Dock o "Abrir" con la ventana destruida, y ⌘Q con la ventana oculta** → la ventana se recrea / la app sale de verdad. (Task 2 y Task 4)

---

### Task 1: Lógica pura del avance y de la instantánea

**Files:**
- Create: `store/tray.ts`, `tests/tray.test.ts`
- Modify: `store/progress.ts`, `tests/progress.test.ts`, `app/(tabs)/enjoying.tsx`, `app/item/[id].tsx`

**Interfaces:**
- Produces (`store/progress.ts`):
  - `export const PAGE_STEP = 10; export const PERCENT_STEP = 10;`
  - `export function progressText(item: MediaItem): string | undefined` — texto de progreso sin el subtítulo: `"45%"`, `"T2 · E3 · 13 de 30"` (vía `describeProgress`), `"Episodio 5 de 12"` / `"Página 212 de 476"` / `"Capítulo…"` / `"Nivel…"`; `undefined` si no hay contador. Debe reproducir exactamente lo que hoy arma `getSubtitle` en `enjoying.tsx`.
- Produces (`store/tray.ts`):
  - `export const TRAY_MAX_ENTRIES = 8; export const TRAY_TEXT_MAX = 80;`
  - `export interface Advance { updates: { currentCheckpoint: number; status: 'in_progress' }; label: string }`
  - `export function advanceProgress(item: MediaItem): Advance | null`
  - `export function selectEnjoying(items: MediaItem[]): MediaItem[]` — la regla actual de Disfrutando (no terminado y (`in_progress` o `currentCheckpoint > 0` o `progress > 0`)).
  - `export interface TrayEntry { id: string; title: string; label: string; advanceLabel?: string }`
  - `export interface TraySnapshot { entries: TrayEntry[]; hasMore: boolean }`
  - `export function buildTraySnapshot(items: MediaItem[]): TraySnapshot`
  - `export type TrayAction = { kind: 'advance' | 'open'; id: string } | { kind: 'open-enjoying' }`
  - `export type ResolvedTrayAction = { type: 'advance'; id: string; updates: Advance['updates'] } | { type: 'open'; id: string } | { type: 'open-enjoying' }`
  - `export function resolveTrayAction(action: unknown, items: MediaItem[]): ResolvedTrayAction | null`

- [ ] **Step 1: Tests que fallan** en `tests/tray.test.ts` y `tests/progress.test.ts`:
  - `advanceProgress`: serie con `seasons:[10,8]`, `currentCheckpoint:10` → `updates.currentCheckpoint 11`, `label "Visto T2 · E1"`; serie al final (`18`) → `null`; capítulos `5/12` → `6`, `"+1 capítulo"`; páginas `212/476` → `222`, `"+10 páginas"`; páginas `470/476` → `476`; páginas `476/476` → `null`; porcentaje `95/100` → `100`, `"+10 %"`; porcentaje `100` → `null`; sin `totalCheckpoints` → `null`; tipo personalizado (`checkpointType:'jefes'`) → `"+1 paso"`.
  - `selectEnjoying`: igual que la regla actual (terminado fuera; `in_progress` dentro; con avance dentro; sin nada fuera).
  - `buildTraySnapshot`: 10 en curso → 8 entradas y `hasMore:true`; orden por `updatedAt` desc; título de 200 caracteres → 80 con "…" (sin partir un emoji: probar con `'🎬'.repeat(60)` y comprobar que no termina en un sustituto suelto); título vacío → `"Sin título"`; elemento sin contador → `label "En curso"` y sin `advanceLabel`.
  - `resolveTrayAction`: `advance` sobre un elemento válido → `{type:'advance', updates}`; id inexistente → `null`; elemento ya al final → `null`; `kind` desconocido, `null`, cadena, id no cadena → `null`; `open` con id existente → `{type:'open', id}`; `open-enjoying` → `{type:'open-enjoying'}`.
  - `progressText`: casos de los tres formatos y `undefined` sin contador.
- [ ] **Step 2: Ejecutar** `npx vitest run tests/tray.test.ts tests/progress.test.ts` → FALLA (funciones no definidas).
- [ ] **Step 3: Implementar** las funciones en `store/progress.ts` y `store/tray.ts` con las firmas de arriba. `advanceProgress` reutiliza `hasSeasonSplit`, `nextToWatch` y `formatPosition` de `store/seasons.ts`; el recorte usa `Array.from(text)` para no partir emojis. Unidades en español: episodes→"episodio", chapters→"capítulo", levels→"nivel", otro→"paso".
- [ ] **Step 4: Compartir con las pantallas.** En `enjoying.tsx`: filtrar con `selectEnjoying` y que `getSubtitle` use `progressText` (el texto mostrado no cambia). En `app/item/[id].tsx`: usar `PERCENT_STEP` y `PAGE_STEP` donde hoy están los `10` fijos (botones de porcentaje y fila `[-PAGE_STEP, -1, 1, PAGE_STEP]`).
- [ ] **Step 5: Ejecutar** `npm run typecheck && npm run lint && npm test` → todo pasa (los tests de Disfrutando existentes no cambian).
- [ ] **Step 6: Commit** `"Agrega la logica de avance e instantanea de la barra de menu"`.

---

### Task 2: Menú nativo y reglas de la ventana (puras)

**Files:**
- Create: `electron-tray.js`, `tests/electron-tray.test.ts`

**Interfaces:**
- Consumes: la forma `TraySnapshot` de Task 1 (el módulo es CommonJS y no la importa; la valida).
- Produces (CommonJS, `module.exports`):
  - `sanitizeSnapshot(raw: unknown): { entries: { id: string; title: string; label: string; advanceLabel?: string }[]; hasMore: boolean }` — descarta lo que no sea objeto/arreglo, entradas sin `id`/`title`/`label` cadenas, recorta ids a 100 y textos a 80 caracteres, y se queda con 8 como máximo.
  - `buildTrayTemplate(snapshot, handlers): Electron.MenuItemConstructorOptions[]` con `handlers = { onAdvance(id), onOpen(id), onOpenEnjoying(), onShow(), onQuit() }`.
  - `shouldHideOnClose({ platform: string, quitting: boolean }): boolean` — `true` solo en `darwin` y sin `quitting`.

- [ ] **Step 1: Tests que fallan** en `tests/electron-tray.test.ts` (patrón de `tests/electron-menu.test.ts`):
  - `sanitizeSnapshot`: `undefined`, `"x"`, `{}`, `{entries:"no"}` → `{entries:[], hasMore:false}`; entradas con campos no cadena descartadas; 20 entradas válidas → 8; `hasMore` solo si es `true`; texto de 500 caracteres → 80.
  - `buildTrayTemplate` con 2 entradas: primer elemento "Disfrutando" deshabilitado; cada entrada es un submenú; la entrada con `advanceLabel` tiene dos subitems (avanzar, "Abrir detalle") y la que no, solo "Abrir detalle"; los `click` llaman a `onAdvance(id)` / `onOpen(id)` con el id correcto; al final hay "Abrir Media Tracker" y "Salir de Media Tracker" que llaman a `onShow` / `onQuit`.
  - Menú vacío → un ítem "Nada en curso" deshabilitado y las dos acciones fijas.
  - `hasMore:true` → aparece "Ver todo…" que llama a `onOpenEnjoying`; con `false` no aparece.
  - `shouldHideOnClose`: `darwin`+`quitting:false` → `true`; `darwin`+`quitting:true` → `false`; `linux`/`win32` → `false`.
- [ ] **Step 2: Ejecutar** `npx vitest run tests/electron-tray.test.ts` → FALLA.
- [ ] **Step 3: Implementar** `electron-tray.js` con las tres funciones. Etiquetas de entrada: `` `${title} — ${label}` ``.
- [ ] **Step 4: Ejecutar** `npm run typecheck && npm run lint && npm test` → pasa.
- [ ] **Step 5: Commit** `"Agrega el menu nativo del icono y las reglas de la ventana"`.

---

### Task 3: Iconos de plantilla y empaquetado

**Files:**
- Create: `build/trayTemplate.png`, `build/trayTemplate@2x.png`, `tests/tray-icons.test.ts`
- Modify: `package.json` (`build.files`: añadir `"electron-tray.js"`, `"build/trayTemplate.png"`, `"build/trayTemplate@2x.png"`)

**Interfaces:**
- Produces: las dos imágenes; Task 4 las carga con `path.join(__dirname, 'build', 'trayTemplate.png')`.

- [ ] **Step 1: Test que falla** `tests/tray-icons.test.ts`: lee la cabecera PNG de cada archivo y comprueba `22×22` y `44×44`, que tiene canal alfa (tipo de color 6) y que **todos los píxeles opacos son negros** (decodificar con `zlib` o comprobar con una dependencia ya presente; si no hay decodificador PNG disponible, comprobar solo dimensiones y tipo de color y verificar la monocromía en el script generador). Además, que `package.json` lista los tres archivos en `build.files`.
- [ ] **Step 2: Ejecutar** el test → FALLA (archivos inexistentes).
- [ ] **Step 3: Generar los iconos** con Pillow (script temporal fuera del repo): la misma figura de las dos tarjetas superpuestas de `build/icon.png` (tarjeta trasera con contorno, delantera rellena), en negro sobre fondo transparente, 22×22 y 44×44 (dibujar a 4× y reducir con LANCZOS). Mirar el resultado ampliado antes de guardar.
- [ ] **Step 4: Ejecutar** `npm run typecheck && npm run lint && npm test` → pasa.
- [ ] **Step 5: Commit** `"Agrega los iconos de plantilla de la barra de menu"`.

---

### Task 4: Proceso principal y preload

**Files:**
- Modify: `electron-main.js`, `electron-preload.js`
- Create: `scratchpad` (fuera del repo) script de verificación en Electron

**Interfaces:**
- Consumes: `sanitizeSnapshot`, `buildTrayTemplate`, `shouldHideOnClose` (Task 2); iconos (Task 3).
- Produces (preload): `window.mediaTrackerTray = { update(snapshot: TraySnapshot): void; onAction(cb: (action: unknown) => void): () => void }`. Canales IPC: `tray:update` (renderer → main) y `tray:action` (main → renderer, payload `TrayAction` de Task 1).

- [ ] **Step 1: Implementar el ciclo de vida** en `electron-main.js`: variable `quitting` puesta a `true` en `app.on('before-quit')`; en `createWindow`, `win.on('close', e => { if (shouldHideOnClose({platform: process.platform, quitting})) { e.preventDefault(); win.hide(); } })` **antes** del manejador existente que guarda el estado; función `showWindow()` (si no hay ventana la crea; si está minimizada la restaura; luego `show()` y `focus()`); `activate` y `second-instance` llaman a `showWindow()`.
- [ ] **Step 2: Implementar `registerTray()`** (solo `darwin`): crea `new Tray(nativeImage)` con `setTemplateImage(true)` y tooltip "Media Tracker"; guarda la última instantánea saneada; `ipcMain.on('tray:update', …)` reconstruye el menú con `Menu.buildFromTemplate(buildTrayTemplate(snapshot, handlers))`. Handlers: `onAdvance(id)` y `onOpen(id)` envían `tray:action` a la ventana (creándola y esperando `did-finish-load` si no existe; `onOpen` además llama a `showWindow()`), `onOpenEnjoying()` igual con `open-enjoying`, `onShow` → `showWindow()`, `onQuit` → `app.quit()`. Llamarla desde `app.whenReady()`.
- [ ] **Step 3: Preload**: exponer `mediaTrackerTray` con `update` (`ipcRenderer.send('tray:update', snapshot)`) y `onAction` (suscripción a `tray:action` que devuelve la función de baja), como `mediaTrackerMenu`.
- [ ] **Step 4: Verificar en Electron real (Xvfb)** con un script en el scratchpad que fije `process.platform='darwin'` y sustituya `Tray` por un doble que registre `setContextMenu`: (a) cerrar la ventana la oculta y `app` sigue viva; (b) `showWindow` la vuelve a mostrar; (c) tras `before-quit` cerrar la destruye; (d) un `tray:update` malformado no lanza y deja el menú vacío; (e) el menú construido tras un `tray:update` válido tiene las entradas esperadas; (f) un clic simulado en "Salir" cierra de verdad.
- [ ] **Step 5: Ejecutar** `npm run typecheck && npm run lint && npm test` → pasa.
- [ ] **Step 6: Commit** `"Mantiene la app en la barra de menu y crea el icono (proceso principal)"`.

---

### Task 5: Renderer, documentación y cierre

**Files:**
- Create: `hooks/useTray.ts`
- Modify: `app/_layout.tsx`, `README.md`, `../../docs/decisiones.md`

**Interfaces:**
- Consumes: `buildTraySnapshot`, `resolveTrayAction` (Task 1), `window.mediaTrackerTray` (Task 4), `useStore`, `router`.

- [ ] **Step 1: Implementar `hooks/useTray.ts`**: solo si `Platform.OS === 'web'` y existe `window.mediaTrackerTray` (declarar el tipo global como en `useSync.ts`). Tras hidratar el store envía `buildTraySnapshot(items)`, y de nuevo (con retardo de 300 ms) cuando cambie `items`. `onAction(action)`: `resolveTrayAction(action, items)`; `advance` → `useStore.getState().updateItem(id, updates)`; `open` → `router.push(`/item/${id}`)`; `open-enjoying` → `router.navigate('/enjoying')`; `null` → ignorar. Registrarlo en `app/_layout.tsx` junto a `useSync`.
- [ ] **Step 2: Verificar en Electron (Xvfb)** con el doble de `Tray`: con datos de prueba (serie con temporadas, libro por páginas, porcentaje, elemento sin contador, 10 en curso) el menú refleja las etiquetas y límites; hacer "clic" en avanzar actualiza el elemento en el archivo guardado (`updatedAt` nuevo, `status in_progress`) y el menú se reconstruye con el nuevo progreso; una acción sobre un id eliminado no cambia nada; "Abrir detalle" navega a `/item/<id>`; sin errores en consola.
- [ ] **Step 3: Documentar**: sección "Barra de menú" en `README.md` (qué muestra, pasos de avance, que cerrar la ventana la oculta y cómo salir, límites) y una línea en `docs/decisiones.md` (`2026-10-28 | La app sigue en la barra de menú al cerrar la ventana (solo macOS) y el menú es nativo, con la ventana oculta como dueña de los datos | …`).
- [ ] **Step 4: Ejecutar** `npm run typecheck && npm run lint && npm test` → pasa.
- [ ] **Step 5: Commit** `"Conecta la barra de menu con la ventana y la documenta"`; push y abrir la PR a `app/Media_Tracker` (base), explicando lo no verificable (aspecto real del icono y comportamiento de ⌘Q/Dock en una Mac).
