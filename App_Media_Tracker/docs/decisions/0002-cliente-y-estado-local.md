# 0002 · Cliente web y estado local

- **Estado:** Propuesto
- **Fecha:** 25-11-2026

## Contexto

- La misma interfaz tiene que funcionar como PWA en el iPhone y dentro de Electron en el Mac (HU-10).
- Todo el uso diario tiene que funcionar sin conexión (HU-11), y una interacción local tiene que tardar menos de 100 ms (RNF-9).
- Una biblioteca grande puede tener unos 2.000 elementos con portadas, temporadas y notas.
- Constancia resolvió lo mismo en su ADR 0002, con las limitaciones de las PWA en iOS ya documentadas: no hay sincronización en segundo plano, las notificaciones push solo funcionan con la app instalada, y Safari puede borrar los datos si no se usa la app en 7 días, salvo que esté instalada.

## Decisión

Igual que Constancia (ADR 0002), con estas diferencias:

- **React 19 + Vite 8 + TypeScript**, con `vite-plugin-pwa` 2 para el *service worker* y el manifiesto.
- **Dexie 4 + `dexie-react-hooks`** sobre IndexedDB. Dexie es la fuente de la interfaz, y las consultas reactivas (`useLiveQuery`) redibujan al cambiar los datos. Se pide almacenamiento persistente (`navigator.storage.persist()`).
- **Índices pensados para las pantallas:**
  - Disfrutando: `[status+updatedAt]`.
  - Búsqueda de duplicados: `normalizedTitle` y `externalKeys` (multientrada).
  - Sagas: `collectionId`.
  - Planificador: `dueDate`.
- **Listas largas virtualizadas** a partir de 200 filas.
- **Portadas:** se cargan directo desde las CDN de TMDB, Open Library y RAWG (no consumen cuota del Worker). El *service worker* guarda hasta 500 portadas *cache-first* durante 30 días, para tenerlas sin conexión. Así se respeta el máximo de caché de TMDB (6 meses). La CSP solo permite imágenes de esos hosts.
- **Rutas:** React Router en modo *data*. Las pantallas son Disfrutando, Biblioteca, Listas, Planificador, Bitácora, Estadísticas, Buscar, Ajustes y el detalle de cada elemento o saga.
- **Estilos:** CSS con variables por estilo (`data-style` en `<html>`) y modo claro u oscuro según `prefers-color-scheme`. No se usa una librería de componentes. Las fuentes se autoalojan con Fontsource. El ADR de identidad visual define los tres estilos.

## Alternativas

- **Zustand persistido, como hoy.** Guarda todo el estado en un solo JSON. Con miles de elementos, cada cambio reescribe todo el archivo, y no tiene índices ni transacciones. Descartada.
- **SQLite en WASM (OPFS).** Es más potente, pero OPFS en Safari es más frágil y el paquete pesa más. No hace falta para este volumen. Descartada.
- **Tailwind o una librería de componentes.** Los tres estilos cambian tipografía, forma y ritmo, no solo colores. Con variables CSS propias es más fácil mantener el mismo HTML para los tres. Descartada.

## Consecuencias

- La app arranca y funciona sin red. La red solo trae metadatos y sincroniza.
- Para que Safari no borre los datos, hay que instalar la PWA en la pantalla de inicio. La app lo explica la primera vez que se abre en Safari sin instalar.
- Las portadas que no se han visto nunca no aparecen sin conexión, y se muestra el marcador del tipo de medio.

## Fuentes

- ADR 0002 de Constancia (rama `app/habit_tracker`), consultado el 25-11-2026.
- Dexie, documentación de `useLiveQuery` e índices compuestos y multientrada: https://dexie.org/docs/, consultada el 25-11-2026.
- TMDB, términos de uso de la API (caché máxima de 6 meses): https://www.themoviedb.org/api-terms-of-use, consultados el 25-11-2026.
