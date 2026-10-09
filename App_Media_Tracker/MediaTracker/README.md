# Media Tracker

App para llevar el control de lo que ves, lees, juegas y escuchas: listas, progreso por episodio o página, planificador con recordatorios, bitácora y metadatos de TMDB. Se usa como reemplazo de Sofa.

Es una app Expo (React Native Web) empaquetada con Electron para macOS. Los datos viven en tu equipo, en un archivo dentro de la carpeta de datos de la app.

## Desarrollo

```bash
npm install
npm run web          # versión web con recarga (expo start --web)
npm run electron:build   # genera el .dmg en release/ (arm64, sin firmar)
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
| `services/` | Clientes de APIs externas (TMDB) |
| `hooks/` | Hooks (`useColorScheme`, `useReminders`) |
| `electron-*.js` | Proceso principal de Electron, preload y almacenamiento en archivo |
| `tests/` | Pruebas unitarias |

## Datos y respaldo

- En Electron se guardan en `userData/data/media-tracker-storage.json` con copia `.bak`. Fuera de Electron se usa `AsyncStorage`.
- **Ajustes Globales → Respaldo** exporta e importa un JSON. Importar fusiona (gana lo más reciente) y nunca borra.
- Si cambias la forma de los datos, sube `STORE_VERSION` en `store/useStore.ts` y añade el paso en `migrate`.

## TMDB

Para buscar películas y series necesitas una clave gratuita de [themoviedb.org](https://www.themoviedb.org) (Ajustes → API). Pégala en Ajustes Globales; queda solo en el dispositivo y no se incluye en los respaldos.

## Recordatorios

Las notificaciones de escritorio suenan solo con la app abierta. Sin hora, avisan a las 9:00 del día.
