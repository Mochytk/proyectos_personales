# Arquitectura · Media Tracker

Resumen del 25-11-2026. Las razones de cada pieza están en `docs/decisions/`.

```
 iPhone (PWA)            Mac (Electron)
 ┌──────────────┐        ┌──────────────────────────┐
 │ apps/web     │        │ apps/desktop             │
 │ React + Vite │        │  main: menú, atajos,     │
 │ Dexie        │        │  barra de menú, ventana, │
 │ service      │        │  safeStorage (token)     │
 │ worker       │        │  renderer: apps/web      │
 └──────┬───────┘        └────────────┬─────────────┘
        │ PWA: HTTPS, mismo origen, cookie de sesión
        │ Electron: HTTPS desde app://media-tracker, token en safeStorage (ADR 0009)
        ▼                             ▼
 ┌─────────────────────────────────────────────────┐
 │ Worker de Cloudflare "media-tracker" (Hono)      │
 │  /            archivos estáticos de apps/web     │
 │  /api/auth/*  Better Auth                        │
 │  /api/sync/*  push, pull, version                │
 │  /api/meta/*  search, details, saga,             │
 │               next-episode                       │
 │  KV META_CACHE · DO SyncNotifier (por usuario)   │
 └───────┬────────────────────────┬────────────────┘
         │ TLS                    │ HTTPS, hosts fijos, claves como secretos
         ▼                        ▼
   Neon Postgres         TMDB · RAWG · Open Library · Wikidata
   (proyecto propio)

 Las portadas se cargan directo desde las CDN (image.tmdb.org,
 covers.openlibrary.org, media.rawg.io), con CSP y caché del service worker.
```

## Paquetes

| Paquete | Contiene | Depende de |
| --- | --- | --- |
| `packages/shared` | Esquemas Zod; tipos; lógica pura de progreso, temporadas, completado, fechas, planificador, listas inteligentes, estadísticas, sagas (árbol y orden completo), duplicados (normalización y emparejamiento), barra de menú, importador y migraciones de respaldo | Zod |
| `apps/web` | Interfaz, Dexie, *outbox*, cliente de sincronización y de metadatos, estilos | `shared` |
| `apps/api` | Worker: rutas, Drizzle, Better Auth, proxy de metadatos, `SyncNotifier` | `shared` |
| `apps/desktop` | Proceso principal de Electron y *preload* | `shared` (validación de IPC) |

## Flujos clave

1. **Añadir por tipo:** + → menú de tipos → búsqueda del tipo (`/api/meta/search`) → elegir → comprobar duplicados en Dexie (ADR 0008) → guardar en Dexie junto con la *outbox* → pedir sugerencia de saga en segundo plano (`/api/meta/saga`, ADR 0007).
2. **Avanzar un episodio:** un toque en Disfrutando → se actualiza el elemento en Dexie (y la *outbox*) → la interfaz se redibuja (< 100 ms) → un *push* en segundo plano.
3. **Sincronizar:** cada 15 s, con la app visible, se consulta `version`; si es mayor que el cursor, se hace *pull*; los pendientes se envían con *push* (ADR 0004).
4. **Importar la app actual:** elegir el archivo → `shared/import/legacy` → plan (añadir, actualizar, omitir, duplicados) → confirmar → transacción de Dexie → *push*.

## Lo que no hace

- No guarda claves de API en el cliente.
- No sincroniza en segundo plano en iOS (limitación de las PWA). Se sincroniza al abrir la app.
- No hace búsquedas sin conexión. "Añadir a mano" funciona siempre.
