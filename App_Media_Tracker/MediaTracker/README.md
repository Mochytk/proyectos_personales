# Media Tracker

App para llevar el control de lo que ves, lees, juegas y escuchas: listas, progreso por episodio o página, planificador con recordatorios, bitácora y metadatos de TMDB. Se usa como reemplazo de Sofa.

Es una app Expo (React Native Web) empaquetada con Electron para macOS. Los datos viven en tu equipo, en un archivo dentro de la carpeta de datos de la app.

## Desarrollo

```bash
npm install
npm run web          # versión web con recarga (expo start --web)
npm run electron:build            # .dmg para Apple Silicon (arm64) en release/
npm run electron:build:universal  # .dmg que sirve en Apple Silicon e Intel
```

Antes de abrir una PR:

```bash
npm run typecheck    # tsc --noEmit
npm run lint         # expo lint
npm test             # vitest
```

## Estructura

| Carpeta | Contenido |
| --- | --- |
| `app/` | Pantallas y rutas (Expo Router) |
| `components/` | Componentes compartidos (`DateField`, `AppIcon`, `Themed`) |
| `constants/` | Colores, nombres e iconos de tipos de medio |
| `store/` | Estado (Zustand), respaldo, fechas y almacenamiento |
| `services/` | Clientes de APIs externas (TMDB, Open Library, RAWG) y proveedores de metadatos |
| `hooks/` | Hooks (`useColorScheme`, `useReminders`) |
| `electron-*.js` | Proceso principal de Electron, preload y almacenamiento en archivo |
| `tests/` | Pruebas unitarias |

## Datos y respaldo

- En Electron se guardan en `userData/data/media-tracker-storage.json` con copia `.bak`. Fuera de Electron se usa `AsyncStorage`.
- **Ajustes Globales → Respaldo** exporta e importa un JSON. Importar fusiona (gana lo más reciente) y nunca borra.
- Si cambias la forma de los datos, sube `STORE_VERSION` en `store/useStore.ts` y añade el paso en `migrate`.

## Metadatos

Al añadir un elemento, el formulario busca y rellena título, portada y progreso según el tipo:

| Tipo | Fuente | Clave | Rellena |
| --- | --- | --- | --- |
| Película, serie | [TMDB](https://www.themoviedb.org) | Sí (gratis) | Título, año, portada, sinopsis y total de episodios |
| Libro | [Open Library](https://openlibrary.org) | No | Título, autor, año, portada y total de páginas |
| Videojuego | [RAWG](https://rawg.io/apidocs) | Sí (gratis) | Título, año y portada |

Las claves se pegan en Ajustes Globales; quedan solo en el dispositivo y no se incluyen en los respaldos (`SECRET_SETTINGS` en `store/backup.ts`). Para añadir otra fuente, crea un cliente en `services/` y regístralo en `services/metadata.ts`.

## Recordatorios

Las notificaciones de escritorio suenan solo con la app abierta. Sin hora, avisan a las 9:00 del día.

## Distribución en macOS

- El icono está en `build/icon.png` (1024×1024); electron-builder genera el `.icns`. También se usa para el favicon y la pantalla de arranque.
- El empaquetado solo incluye `dist/` y los `electron-*.js` (unos 8 MB de `app.asar`): las dependencias de Expo ya van dentro del bundle web y se excluyen con `!node_modules` en `build.files`.
- **Sin firmar (por defecto):** funciona en tu Mac. En otro Mac, macOS bloqueará la primera apertura: clic derecho → Abrir, o `xattr -dr com.apple.quarantine "/Applications/Media Tracker V3.app"`.
- **Firmada y notarizada** (necesita cuenta de Apple Developer, 99 USD/año): quita `"identity": null` de `build.mac`, añade `"hardenedRuntime": true` y define `CSC_LINK`, `CSC_KEY_PASSWORD`, `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD` y `APPLE_TEAM_ID` antes de compilar. Detalles: <https://www.electron.build/code-signing-mac>.
- El build universal necesita compilarse en macOS; aquí solo se verificó el empaquetado arm64 sin firmar.

## Atajos

| Atajo | Acción |
| --- | --- |
| ⌘N / ⇧⌘N | Nuevo elemento / nueva lista |
| ⌘F | Buscar |
| ⌘, | Ajustes |
| ⌘1 – ⌘4 | Listas, Disfrutando, Planificador, Bitácora |
| ⇧⌘E / ⇧⌘I | Exportar / importar respaldo |

La ventana recuerda su tamaño y posición, y solo se puede abrir una copia de la app a la vez.
