# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Hoy, una sola persona (la autora/autor del proyecto) que usa la app a diario en macOS para llevar el control de lo que ve, lee, juega y escucha. A futuro podría compartirse con otras personas; esa audiencia no está confirmada ni definida todavía.

## Product Purpose

Media Tracker es una app para llevar el control de películas, series, libros, videojuegos y música: listas, progreso, planificador con recordatorios, bitácora y metadatos externos. Existe para reemplazar Sofa. Las funciones de pago de Sofa se replicaron para tenerlas gratis. El éxito es que sea el único lugar donde se registra todo el consumo de medios, sin depender de una suscripción.

## Positioning

Todo el consumo de medios en un solo lugar, con progreso detallado (por episodio, temporada o página) y datos locales y privados. No requiere cuenta ni nube, y ofrece gratis lo que Sofa cobra.

## Operating Context

- App Expo (React Native Web) empaquetada con Electron para macOS; también hay versión web de desarrollo.
- Los datos viven en un archivo local (`userData/data/media-tracker-storage.json` con copia `.bak`); fuera de Electron se usa AsyncStorage.
- Respaldo por exportación/importación de JSON; importar fusiona y nunca borra.
- Metadatos y portadas desde TMDB (películas, series), Open Library (libros) y RAWG (videojuegos); las claves de API se guardan solo en el dispositivo.
- Sin conexión se ven los iconos de tipo en lugar de portadas.

## Capabilities and Constraints

- Listas por tipo de medio, La Pila, Disfrutando, Bitácora, Buscar y Planificador con recordatorios.
- Progreso por episodio/temporada (series) o por página (libros).
- Idioma de la interfaz: español.
- Sin sincronización en la nube ni cuentas.
- Soporte de música como tipo de medio: sin fuente de metadatos confirmada en esta fase.
- Público objetivo más allá del uso personal: sin decidir.

## Brand Commitments

Ninguna confirmada. El nombre de trabajo es "Media Tracker". No hay identidad visual ni de voz declarada como vinculante.

## Evidence on Hand

- `App_Media_Tracker/MediaTracker/README.md` describe funciones, datos y fuentes de metadatos.
- `App_Media_Tracker/Referencias/` contiene material de referencia (no revisado en esta fase).
- No hay testimonios, métricas de uso, clientes ni precios; no deben inventarse.

## Product Principles

1. **Tus datos son tuyos.** Todo vive en el equipo, es exportable y nunca se pierde por una importación.
2. **Un solo lugar para todo.** Cada tipo de medio comparte el mismo modelo mental, sin apps separadas.
3. **Progreso exacto, sin fricción.** Registrar el avance por episodio o página debe ser rápido y preciso.
4. **Paridad gratuita.** Lo que Sofa cobra se ofrece sin suscripción ni cuenta.
5. **Uso diario primero.** Se optimiza para quien abre la app a diario, antes que para la primera impresión.
