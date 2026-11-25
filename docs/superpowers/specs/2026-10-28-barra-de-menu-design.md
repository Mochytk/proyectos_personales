# Icono en la barra de menú de macOS — diseño

Fecha: 2026-10-28 · Rama: `feature/barra-de-menu` · App: Media Tracker (Electron)

## Objetivo

Ver lo que estás disfrutando y sumar un episodio (o páginas) **sin abrir la ventana**, desde un icono en la barra de menú de macOS. Es la idea 8 de la lista de mejoras.

**Éxito:** con la ventana cerrada, el icono sigue en la barra; su menú muestra el progreso actual de cada elemento en curso; hacer clic en la acción de avanzar actualiza el elemento y se refleja al abrir la ventana, en las estadísticas y en la sincronización.

## Decisiones tomadas

- **Al cerrar la ventana, la app sigue en la barra de menú** (decidido por la autora). Se sale de verdad con ⌘Q, "Salir" del menú de la app o "Salir" del icono.
- **Menú nativo** (enfoque A) en lugar de un panel propio con portadas: se ve como una app de Mac, es accesible y ligero, y evita una segunda ventana con su propia copia de los datos.
- Solo macOS. En otros sistemas la app se comporta como hasta ahora.

## Fuera de alcance

Portadas o barras de progreso en el menú, añadir elementos desde el icono, marcar como terminado desde el icono, y una opción en Ajustes para desactivarlo.

## Ciclo de vida de la ventana (solo macOS)

- Cerrar la ventana la **oculta** (`hide`) en vez de destruirla, para que el renderer —que guarda los datos— siga vivo.
- La app guarda una marca `quitting`, que se activa en `before-quit` (⌘Q, Salir del Dock, cierre del sistema). Si `quitting` es verdadera, el cierre procede normalmente.
- `activate` (clic en el Dock) y "Abrir Media Tracker" del icono muestran la ventana oculta; si no existiera, se crea.
- `second-instance` y el resto de lo existente (una sola instancia, estado de ventana) no cambian.

## Qué muestra el menú

Construido en el proceso principal a partir de una **instantánea** que envía la ventana.

```
Disfrutando
  The Expanse — T3 · E4        ▸  Visto T3 · E5
  Project Hail Mary — Página 212 de 476  ▸  +10 páginas
  …(hasta 8)
  Ver todo…                       (solo si hay más de 8)
─────────────
Abrir Media Tracker
Salir de Media Tracker
```

- Elementos: los de la pestaña Disfrutando (en curso, o con avance), los **8** modificados más recientemente (`updatedAt`).
- Cada elemento es un submenú con dos acciones: **avanzar** (si tiene contador) y **Abrir detalle**.
- Sin elementos en curso, el menú muestra "Nada en curso" desactivado, más las dos acciones fijas.
- "Ver todo…" abre la ventana en la pestaña Disfrutando.

## Qué hace "avanzar"

Función pura `advanceProgress(item)` → cambios a aplicar, o `null` si no tiene contador:

| Seguimiento | Paso | Etiqueta de la acción |
| --- | --- | --- |
| Serie con temporadas | +1 episodio | "Visto T3 · E5" |
| Episodios / capítulos / niveles | +1 | "+1 episodio" / "+1 capítulo" / "+1 nivel" |
| Páginas | +10 (tope: el total) | "+10 páginas" |
| Porcentaje | +10 (tope: 100) | "+10 %" |
| Sin contador | — | no hay acción de avanzar |

- Marca el estado `in_progress` si estaba por empezar, como el detalle.
- **Al llegar al final no se marca como terminado**: eso sigue siendo manual, en la ventana. Si ya está al final, la acción de avanzar no aparece.
- Los pasos son los mismos que usan hoy el detalle (`SeasonTracker`, contador de páginas y porcentaje); la función se comparte para que no diverjan.

## Flujo de datos

1. `useTray` (renderer) calcula la instantánea con la función pura `buildTraySnapshot(items)` → `[{ id, title, label, advanceLabel? }]` y la envía por IPC (`tray:update`) al arrancar (tras cargar los datos) y cuando cambian los elementos (con retardo de ~300 ms).
2. El proceso principal guarda la última instantánea, reconstruye el menú con la función pura `buildTrayTemplate(snapshot, handlers)` y lo asigna al icono.
3. Un clic en una acción envía al renderer `tray:action` con `{ kind: 'advance' | 'open' | 'open-enjoying', id? }`. El renderer valida la acción, la ejecuta sobre su estado (`updateItem` con el resultado de `advanceProgress`, o navegación) y, si hace falta, pide mostrar la ventana.
4. Como pasa por `updateItem`, la fecha de modificación se actualiza, y por tanto cuenta para la sincronización y las estadísticas.

No existe una segunda copia de los datos: el proceso principal solo recibe texto ya preparado.

## Seguridad

- El renderer solo envía **texto** para mostrar y el proceso principal nunca recibe rutas ni código.
- Las acciones de vuelta son de una lista fija (`advance`, `open`, `open-enjoying`); el id se valida en el renderer contra los elementos existentes.
- La instantánea se limita a 8 elementos y los textos a una longitud razonable (80 caracteres), para que un título enorme no deforme el menú.

## Icono

Imagen de plantilla de macOS (`setTemplateImage`): monocroma negra con transparencia, que el sistema tiñe según el modo claro u oscuro. Misma figura de tarjetas que el icono de la app. Archivos: `build/trayTemplate.png` (22×22) y `build/trayTemplate@2x.png` (44×44), incluidos en el paquete (`build.files`).

## Archivos

- `store/tray.ts` — `advanceProgress`, `buildTraySnapshot` (puras, con pruebas).
- `electron-tray.js` — `buildTrayTemplate` (pura, con pruebas) y la creación del icono.
- `electron-main.js` — ciclo de vida de la ventana, IPC `tray:update` / `tray:action`.
- `electron-preload.js` — puente `mediaTrackerTray` (`update(snapshot)`, `onAction(cb)`).
- `hooks/useTray.ts` — envía la instantánea y ejecuta las acciones.
- `app/item/[id].tsx` / `components/SeasonTracker.tsx` — usan `advanceProgress` donde corresponda, para compartir los pasos.
- `build/trayTemplate*.png`, `package.json` (`build.files`).

## Pruebas

- **Unitarias:** `advanceProgress` por cada tipo de seguimiento y sus topes; `buildTraySnapshot` (orden, límite de 8, etiquetas, recorte de textos); `buildTrayTemplate` (estructura, elementos sin contador, menú vacío, "Ver todo…").
- **Electron real (Xvfb):** cerrar la ventana la oculta y la app sigue viva; reabrir la muestra; ⌘Q / salir cierra de verdad; con datos de prueba, ejecutar una acción de avanzar actualiza el elemento y el archivo guardado.
- **No verificable aquí:** el aspecto real del icono y del menú en la barra de macOS, y el comportamiento de ⌘Q y del Dock con teclado y ratón físicos.

## Riesgos

- Ocultar en lugar de cerrar cambia lo que el usuario espera de ⌘W / el botón rojo: la app sigue abierta. Se compensa con el icono visible y "Salir" claro.
- Si la ventana se destruyera por otra vía (fallo del renderer), el icono dejaría de actualizarse hasta reabrirla; el proceso principal conserva la última instantánea y "Abrir Media Tracker" crea una ventana nueva.
