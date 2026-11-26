# 0006 · Modelo de datos e importación de la app actual

- **Estado:** Propuesto
- **Fecha:** 25-11-2026

## Contexto

- La app actual guarda elementos (`MediaItem`), listas (`MediaList`), ajustes y papeleras. Sus respaldos JSON van de la versión 1 a la 5 (`BACKUP_SCHEMA_VERSION = 5`). Las migraciones están en `BACKUP_MIGRATIONS` y hay respaldos congelados en `tests/fixtures/backups/v1.json` a `v5.json`.
- Respuesta 4: todos esos respaldos se tienen que poder importar en la nueva app. Además, todo respaldo que exporte la nueva app tiene que poder importarse en sus versiones futuras.
- Las sagas nuevas son colecciones jerárquicas (ADR 0007). Hoy la saga es un texto dentro del libro (`saga: { name, number }`).
- Los duplicados necesitan un título normalizado y claves externas indexables (ADR 0008).

## Decisión

### Modelo

El detalle de campos está en `docs/modelo-de-datos.md`. Cada tabla se define una sola vez con Zod en `packages/shared`, y de ahí salen los tipos de Dexie, Drizzle y la API.

- **`items`** es el elemento de la biblioteca, con los campos de hoy menos `saga` y `listId`, que pasan a otras tablas. Se agregan:
  - `externalKeys`: un arreglo como `["tmdb:movie:603", "wikidata:Q83495"]`, para buscar duplicados y sagas;
  - `normalizedTitle`, que calcula `packages/shared`;
  - `year`.
- **`lists`** es igual que hoy, con los filtros de las listas inteligentes.
- **`list_entries`** dice qué elemento está en qué lista. Hoy un elemento solo puede estar en una (`listId`). La tabla permite más de una sin cambiar el formato después, pero la interfaz de la fase 1 mantiene una lista por elemento, para tener paridad.
- **`collections`** son las sagas, de cualquier tipo de medio, con nombre, tipo, descripción y fuente sugerida.
- **`collection_entries`** guarda la posición (decimal) de un elemento **o de otra saga** dentro de una saga.
- **`duplicate_dismissals`** guarda los pares marcados como "no son duplicados".
- **`settings`** guarda las preferencias que se sincronizan: estilo, rotación, pestañas visibles y diseño de la pila. Los secretos ya no existen en el cliente (ADR 0005).

Todas las tablas tienen `id`, `createdAt`, `updatedAt`, `deletedAt` y, en el servidor, `userId` y `serverSeq` (ADR 0004).

### Importador de la app actual

Va en `packages/shared/src/import/legacy.ts` y es una función pura:

1. Lee un respaldo de la app actual (`media-tracker-backup`, v1 a v5) o un archivo de la carpeta de sincronización (`media-tracker-sync`, v1). Son formatos distintos: el de sincronización trae `data: { items, lists, deleted }`, sin ajustes, y su versión 1 no tiene relación con la de los respaldos. Cada uno tiene su analizador y su archivo sintético congelado en `tests/fixtures/` (`backups/v1.json` a `v5.json` y `sync/v1.json`).
2. Lleva el respaldo a v5 con las migraciones trasladadas tal cual desde `store/backup.ts`.
3. Lo convierte al modelo nuevo:
   - **IDs:** los de la app actual no siempre son UUID (los respaldos usan `it-movie` o `list-1`). Si ya es UUID, se conserva; si no, pasa a UUID v5 de `'legacy-item:' + id` o `'legacy-list:' + id`, con un espacio de nombres fijo de `shared`. Los `listId` y las papeleras usan la misma conversión. Así importar el mismo archivo en dos dispositivos da los mismos IDs;
   - `listId` pasa a `list_entries`;
   - `saga: { name, number }` pasa a una `collection` con id UUID v5 de `'legacy-saga:' + sagaKey(name)`, para que la misma saga importada en el iPhone y en el Mac sea una sola, y a su `collection_entry`;
   - `progress` se mantiene como fracción de 0 a 1;
   - `year` se deriva de `releaseDate`, o de un `subtitle` de 4 cifras en las películas;
   - `externalId` pasa a ser el primer valor de `externalKeys`, con el mismo formato (`tmdb:movie:603`, `openlibrary:OL45804W`);
   - **lo borrado:** los respaldos no traen papeleras. Importar es una restauración explícita, como hoy (`importData` con `reviveTombstones`), así que lo que viene en el archivo revive aunque estuviera borrado. Las papeleras de un archivo de sincronización se aplican con la regla de hoy (`store/sync.ts`): un registro sobrevive solo si su `updatedAt` es posterior a su borrado.
4. Devuelve un **plan de importación** con lo que se va a añadir, actualizar y omitir, y con los posibles duplicados (ADR 0008). Ese plan se muestra antes de escribir en Dexie.

Importar un respaldo nunca borra nada. Los IDs son deterministas, de modo que importar dos veces el mismo respaldo no duplica (gana el `updatedAt` más nuevo, como hoy).

### Formato de respaldo nuevo

- `format: "media-tracker-backup"` y `schemaVersion: 6`, que continúa la numeración de la app actual para que un único importador lea todos los respaldos.
- Las migraciones van en `BACKUP_MIGRATIONS`, de N a N+1, sin saltos.
- Cada versión deja un respaldo congelado en `tests/fixtures/backups/vN.json`, y una prueba obliga a que todos se importen. Los v1 a v5 se copian desde la app actual.
- Los respaldos usan datos sintéticos, nunca tu biblioteca real.

## Alternativas

- **Trasladar el modelo tal cual (saga como texto, `listId`).** Impide las sagas conjuntas y obliga a una migración más grande después. Descartada.
- **Un formato de respaldo nuevo que empiece en v1.** Habría dos numeraciones y dos importadores. Descartada.

## Consecuencias

- La fase 1 se puede probar de punta a punta con tus respaldos reales en tu dispositivo, sin subirlos al repo.
- Si los datos de la saga eran texto libre, al convertirlos pueden quedar sagas con nombres casi iguales, por ejemplo "Mistborn" y "Nacidos de la bruma". La lista de posibles duplicados también propone sagas para fusionar.

## Fuentes

- `App_Media_Tracker/MediaTracker/store/backup.ts`, `store/sagas.ts`, `store/useStore.ts` y `tests/fixtures/backups/`, consultados el 25-11-2026.
- ADR 0006 de Constancia (columnas comunes), consultado el 25-11-2026.
