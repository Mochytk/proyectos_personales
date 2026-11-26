# 0004 · Sincronización offline-first

- **Estado:** Propuesto
- **Fecha:** 25-11-2026

## Contexto

- Un cambio en un dispositivo tiene que aparecer en el otro en menos de 30 s, con ambos abiertos y con red (documento maestro, sección 1).
- Hoy la sincronización se hace con un archivo por dispositivo en una carpeta compartida, y gana el último en escribir por registro (`store/sync.ts`), con papeleras para lo borrado.
- Constancia ya tiene un protocolo *push/pull* probado (su ADR 0006).

## Decisión

Igual que el ADR 0006 de Constancia: *outbox* en Dexie, `POST /api/sync/push` en lotes de 200 con candado por usuario, `GET /api/sync/pull?cursor=N` por `server_seq`, `GET /api/sync/version` respondido por el Durable Object `SyncNotifier` (consulta cada 15 s con la app visible) y reintentos con espera creciente. Gana el último en escribir por registro según `updated_at`; si empatan, gana el mayor `server_seq`. Se recorta cualquier `updated_at` que venga más de 5 minutos en el futuro. Los borrados son lógicos (`deleted_at`).

Diferencias propias de Media Tracker:

- **Tablas sincronizadas:** `items`, `lists`, `list_entries`, `collections` (sagas), `collection_entries`, `duplicate_dismissals` y `settings` (una fila por usuario, sin secretos). El modelo completo está en el ADR 0006.
- **IDs deterministas (UUID v5)** donde un mismo registro puede nacer en dos dispositivos:
  - entrada de saga: `(collectionId, childId)`;
  - entrada de lista: `(listId, itemId)`;
  - descarte de duplicado: el par de IDs ordenado;
  - ajustes: un id fijo, UUID v5 de `'settings'`, que existe antes de tener cuenta; en el servidor la clave es `(userId, id)`;
  - lo importado de la app actual: elementos, listas y sagas (las reglas están en el ADR 0006).

  El resto usa `crypto.randomUUID()`. Como lo importado tiene IDs deterministas, importar el mismo respaldo en el iPhone y en el Mac no duplica nada.
- **Progreso:** se sincroniza el elemento completo. Si avanzas un episodio en el iPhone sin señal y otro en el Mac, gana la última edición, como hoy. Un registro de eventos de progreso que se pueda fusionar se evalúa en la fase 6, con las relecturas.
- **La sincronización por carpeta desaparece** en la app nueva. El importador lee esos archivos con su propio analizador, porque su formato no es el de los respaldos (ADR 0006).

## Alternativas

- **CRDT (Automerge, Yjs).** Es más robusto ante ediciones concurrentes del mismo campo, pero añade una dependencia grande y un formato opaco en la base. Para una sola persona con dos dispositivos, gana-el-último por registro basta, y es lo que ya usas hoy. Descartada.
- **Mantener la carpeta compartida.** No llega al iPhone. Descartada.

## Consecuencias

- El código de sincronización se puede trasladar casi tal cual desde Constancia, cambiando solo las tablas.
- Editar el mismo elemento en dos dispositivos sin conexión conserva la última edición completa, no una mezcla campo por campo. Es el mismo comportamiento que hoy.

## Fuentes

- ADR 0006 de Constancia (rama `app/habit_tracker`), consultado el 25-11-2026.
- `App_Media_Tracker/MediaTracker/store/sync.ts` y `store/tombstones.ts`, consultados el 25-11-2026.
