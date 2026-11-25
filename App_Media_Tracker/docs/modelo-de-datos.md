# Modelo de datos · Media Tracker

Propuesta del 25-11-2026 (ADR 0006). La fuente de verdad será el esquema Zod de `packages/shared`. Si este documento y el código difieren, manda el código, y este documento se corrige en la misma PR.

Todas las tablas sincronizadas tienen las columnas comunes `id` (UUID), `createdAt`, `updatedAt` y `deletedAt`. En el servidor tienen además `userId` y `serverSeq` (ADR 0004). Las fechas son milisegundos UTC, salvo `releaseDate`, que es `AAAA-MM-DD` tal como lo da la fuente.

## `items`

| Campo | Tipo | Notas |
| --- | --- | --- |
| `title`, `subtitle?` | texto | El título tiene un máximo de 300 caracteres. |
| `normalizedTitle` | texto | Lo calcula `shared` (ADR 0008) e indexado. |
| `type` | enumeración | `movie`, `tv_show`, `book`, `video_game`, `audiobook`, `board_game`, `music_album`, `software`, `app`, `event`, `task`, `note`; los mismos de hoy. |
| `status` | enumeración | `unstarted`, `in_progress`, `completed`, `abandoned`. |
| `progress` | 0 a 100 | Se deriva de `currentCheckpoint` y `totalCheckpoints` cuando existen. |
| `checkpointType?`, `currentCheckpoint?`, `totalCheckpoints?` | | Iguales que hoy. |
| `seasons?` | número[] | Episodios por temporada. |
| `nextEpisode?` | `{ date, season, episode }` | Desde TMDB. |
| `rating?` | 1 a 5 | Las medias estrellas llegan con las reseñas avanzadas (fase 6). |
| `tags`, `notes?` | | Las notas tienen un máximo de 10.000 caracteres. |
| `dueDate?`, `dueHasTime?`, `remind?`, `notifiedAt?` | | Planificador y recordatorios. |
| `completedAt?` | | Se fija al pasar a `completed`. |
| `externalKeys` | texto[] | Con el formato de la app actual: `tmdb:movie:603`, `tmdb:tv:1399`, `openlibrary:OL45883W`, `rawg:3498`, y además `wikidata:Q83495`. Indexado (multientrada). |
| `posterUrl?`, `overview?`, `releaseDate?`, `year?` | | La portada solo puede venir de los hosts permitidos. |
| `sagaSuggestionDismissed?` | texto[] | IDs de Wikidata ignorados para este elemento. |

## `lists` y `list_entries`

- `lists`: `name`, `isPinned`, `type` (`todo` o `collection`), `layoutStyle?`, `itemShape?`, `sortOrder?`, `isSmartList?` y `smartFilters?`; los mismos de hoy.
- `list_entries`: `listId`, `itemId` y `position?`. El `id` es un UUID v5 de `(listId, itemId)`.

## `collections` y `collection_entries` (sagas)

- `collections`: `name`, `normalizedName`, `kind` (un tipo de `items` o `mixed`), `description?` y `externalKeys` (`wikidata:Q…`).
- `collection_entries`: `collectionId`, `childKind` (`item` o `collection`), `childId` y `position` (decimal, opcional). El `id` es un UUID v5 de `(collectionId, childId)`. `shared` impide ciclos y una profundidad mayor que 4.

## `duplicate_dismissals`

- `entityKind` (`item` o `collection`), `aId` y `bId`, con `aId < bId`. El `id` es un UUID v5 del par.

## `settings` (una fila por usuario)

- `style` (`a`, `b` o `c`, según el ADR de identidad), `styleRotation` (`off` o `weekly`), `showEnjoying`, `showPlanner`, `showLogbook`, `pileLayoutStyle?` y `pileItemShape?`.
- Ya **no** guarda `tmdbApiKey` ni `rawgApiKey`.

## Correspondencia con la app actual

| App actual | Nueva |
| --- | --- |
| `item.listId` | `list_entries` |
| `item.saga = { name, number }` | `collections` (por nombre normalizado) + `collection_entries.position = number` |
| `item.externalId` (`tmdb:movie:603`, `openlibrary:OL45804W`, `rawg:…`) | Primer valor de `externalKeys`, tal cual |
| `deleted` (papeleras) | `deletedAt` en cada fila |
| `settings.tmdbApiKey`, `rawgApiKey` | Se descartan al importar (ahora son secretos del Worker). |
| Respaldo v1 a v5 | Lo lee el importador; el formato nuevo es v6 (ADR 0006). |
