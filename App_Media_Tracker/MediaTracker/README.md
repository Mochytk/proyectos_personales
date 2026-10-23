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
- Si cambias la forma de los datos guardados en el equipo, sube `STORE_VERSION` en `store/useStore.ts` y añade el paso en `migrate`.

### Compatibilidad de los respaldos

Todo respaldo exportado por esta app debe poder importarse en cualquier versión posterior. El formato del archivo tiene su propia versión (`BACKUP_SCHEMA_VERSION` en `store/backup.ts`, independiente de `STORE_VERSION`). Al cambiar lo que contiene un respaldo (campo nuevo o renombrado, colección nueva):

1. Sube `BACKUP_SCHEMA_VERSION`.
2. Añade `BACKUP_MIGRATIONS[<versión anterior>]`, que convierte los datos viejos a la forma nueva.
3. Añade `tests/fixtures/backups/v<versión nueva>.json`: un respaldo real exportado con ese formato, que no se vuelve a editar.
4. Cubre el campo en `sanitizeItem` / `sanitizeList` (si se te olvida, `tests/backup-compat.test.ts` no compila).

Los tests importan todos los respaldos congelados, así que romper la compatibilidad hacia atrás hace fallar `npm test`. Un respaldo de una versión más nueva que la de la app se rechaza con un aviso, en lugar de perder datos en silencio.

## Metadatos

Al añadir un elemento, el formulario busca y rellena título, portada y progreso según el tipo:

| Tipo | Fuente | Clave | Rellena |
| --- | --- | --- | --- |
| Película, serie | [TMDB](https://www.themoviedb.org) | Sí (gratis) | Título, año, portada, sinopsis; en series, episodios por temporada y próximo episodio |
| Libro | [Open Library](https://openlibrary.org) | No | Título, autor, año, portada y total de páginas |
| Videojuego | [RAWG](https://rawg.io/apidocs) | Sí (gratis) | Título, año y portada |

Las claves se pegan en Ajustes Globales; quedan solo en el dispositivo y no se incluyen en los respaldos (`SECRET_SETTINGS` en `store/backup.ts`). Para añadir otra fuente, crea un cliente en `services/` y regístralo en `services/metadata.ts`.

## Portadas

Las portadas se guardan como URL (`posterUrl`) al elegir un resultado de TMDB, Open Library o RAWG. `components/ItemCover.tsx` las muestra en La Pila, las listas, Disfrutando, Bitácora, Buscar y Planificador; si un elemento no tiene portada, o la imagen no carga, se ve el icono de su tipo. Las portadas se descargan de la fuente cada vez (no se guardan en el equipo), así que sin conexión se ven los iconos.

## Sagas de libros

Un libro puede pertenecer a una saga: nombre y número dentro de ella (`saga: { name, number? }`). Se escribe en el formulario o en el detalle del libro, con las sagas existentes como sugerencias. La sección **Sagas** de Listas abre la pantalla de cada saga con sus libros en orden de lectura, cuántos llevas leídos y el siguiente pendiente. Dos nombres que solo difieren en mayúsculas, tildes o espacios son la misma saga. La saga es un campo del libro, no una entidad aparte: para renombrarla hay que editar el nombre en cada libro. Open Library no entrega la saga de forma fiable, así que no se rellena sola.

## Series con temporadas

Las series elegidas de TMDB guardan cuántos episodios tiene cada temporada. El detalle muestra "Vas por T2 · E3", un botón para marcar el siguiente episodio y una fila por temporada (tocarla la marca como vista). "Actualizar desde TMDB" trae temporadas nuevas y el próximo estreno sin perder tu progreso, y el Planificador lista los estrenos próximos. El progreso sigue siendo un solo contador de episodios vistos (`currentCheckpoint`); `seasons` solo lo traduce a temporada y episodio.

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
