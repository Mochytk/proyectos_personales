# 0005 · Metadatos a través del servidor

- **Estado:** Propuesto
- **Fecha:** 25-11-2026

## Contexto

- Hoy la app llama directo a TMDB, RAWG y Open Library desde el dispositivo, con las claves guardadas en sus ajustes (`tmdbApiKey`, `rawgApiKey`). En una PWA, cualquier clave que llegue al navegador es pública.
- Respuesta 3: las claves pasan por el Worker como secretos, con "todo lo que nos mantenga seguros".
- Las sugerencias de saga necesitan Wikidata (ADR 0007, spike A).
- Cada servicio tiene condiciones de uso, y la app actual no cumple la atribución que piden TMDB y RAWG.

| Servicio | Condiciones relevantes |
| --- | --- |
| TMDB | Uso gratis no comercial con atribución: logo de TMDB, menos prominente que el de la app, y el aviso "This product uses the TMDB API but is not endorsed or certified by TMDB". No guardar en caché más de 6 meses. Unas 40 peticiones por segundo. |
| RAWG | Gratis para uso personal no comercial, hasta 20.000 peticiones al mes. Exige un enlace activo a RAWG en cada página que muestre sus datos. |
| Open Library | Sin clave. 1 petición por segundo, o 3 si el User-Agent identifica la app e incluye un correo de contacto. Pide usar caché y no descargar en masa. Las portadas por claves que no son ID tienen un límite de 100 cada 5 minutos por IP. |
| Wikidata (SPARQL) | Sin clave, datos CC0. Exige un User-Agent descriptivo. Las consultas tienen tiempo de cómputo limitado por IP. |

## Decisión

### Rutas

El cliente solo habla con el Worker:

- `GET /api/meta/search?kind=movie|tv|book|game&q=…&lang=es-CL`
- `GET /api/meta/details?source=tmdb|openlibrary|rawg&kind=…&id=…`
- `GET /api/meta/saga?source=…&id=…` (sugerencias de Wikidata, ADR 0007)
- `GET /api/meta/next-episode?tmdbId=…` (planificador)

El Worker normaliza las respuestas a un solo esquema Zod (`MetaResult` en `packages/shared`) con título, subtítulo, año, sinopsis, portada, totales (episodios por temporada, páginas, etc.), fuente e ID externo.

### Seguridad

- **No es un proxy abierto.** Cada ruta exige sesión. El host, la ruta y los parámetros de destino los arma el Worker con una lista fija (`api.themoviedb.org`, `api.rawg.io`, `openlibrary.org`, `query.wikidata.org`). El cliente nunca manda una URL, así que no puede haber SSRF.
- **Validación:** `q` tiene un máximo de 120 caracteres, `id` sigue el formato de cada fuente y `kind` y `source` son enumeraciones. Las consultas SPARQL son plantillas fijas, y el ID entra validado con una expresión regular estricta (por ejemplo `^OL\d+W$`), nunca como texto libre.
- **Límite por usuario:** 60 búsquedas por minuto y 2.000 al día, con un contador en el Durable Object del usuario. Sobra para una persona y frena un abuso si la sesión se filtrara.
- **Respuestas externas como datos no confiables:** se validan con Zod. Los campos que no se esperan se descartan, el texto se recorta y queda sin HTML (las sinopsis de Open Library vienen a veces con Markdown o HTML, que se quita en el servidor), y solo se aceptan URLs de portada de los hosts conocidos.
- **Secretos:** `TMDB_API_KEY` y `RAWG_API_KEY` viven solo como secretos del Worker. Los registros nunca incluyen la URL de destino con la clave ni la consulta del usuario.
- **Tiempo máximo** de 8 s por llamada externa. Si se acaba, la app ofrece "Añadir a mano".

### Caché

Hay dos niveles:

1. **En el servidor (KV `META_CACHE`).** La clave es un *hash* de la fuente, el tipo, la consulta y el idioma. Las búsquedas duran 7 días, las fichas 30 días, las sagas de Wikidata 30 días y el próximo episodio 12 horas. Siempre queda muy por debajo de los 6 meses de TMDB. La API de caché de Workers no sirve porque no funciona en `*.workers.dev`, que es donde corre el Worker gratis.
2. **En el dispositivo.** Al añadir un elemento, sus datos se guardan en el propio elemento. "Actualizar datos" los vuelve a pedir a mano, como hoy.

### Atribución

Es un requisito de interfaz que se revisa en los E2E:

- **TMDB:** el logo oficial va en Ajustes → Acerca de, con el aviso en inglés y su traducción. En la búsqueda y en el detalle de películas y series va el texto "Datos de TMDB", con su logo pequeño y menos prominente que la marca de la app.
- **RAWG:** "Datos de RAWG" con un enlace activo a `rawg.io` en cada pantalla que muestre datos de juegos (búsqueda y detalle).
- **Open Library y Wikidata:** crédito en Acerca de, aunque no es obligatorio.

### User-Agent

`MediaTracker/1.0 (uso personal)` en Open Library y Wikidata, sin datos personales. Con ese User-Agent, Open Library permite 1 petición por segundo, que alcanza para una persona. Para subir a 3 hay que incluir un correo de contacto. Eso queda como pregunta: solo se haría con tu permiso, y el correo iría como secreto del Worker (`OPENLIBRARY_CONTACT`), nunca en el repo.

La política de User-Agent de Wikimedia pide un contacto, y los Workers salen por IPs compartidas, así que sin contacto existe el riesgo de recibir 403. Si pasa, la opción es añadir una URL de contacto sin correo (por ejemplo, una página del proyecto). Queda como pregunta de la fase 3.

## Alternativas

- **Mantener las claves en el dispositivo**, como hoy. En una PWA quedan expuestas a cualquiera que abra las herramientas del navegador. Descartada.
- **Proxy genérico (`/api/proxy?url=…`).** Es más simple, pero es una puerta a SSRF y al abuso. Descartada.
- **Pasar las portadas por el Worker.** Ocultaría la IP del dispositivo a las CDN, pero cada portada gastaría peticiones del Worker y del límite de RAWG. Las portadas se cargan directo con una CSP restringida (ADR 0002). Descartada.

## Consecuencias

- Sin conexión no se puede buscar, pero "Añadir a mano" sigue disponible y se puede completar después.
- La app depende de que el Worker esté disponible para buscar. Si se pasa el límite diario, se busca al día siguiente.
- Wikidata puede limitar por IP a los Workers, porque comparten IP de salida. En ese caso solo se pierde la sugerencia de saga, nunca un dato.

## Fuentes

- TMDB, términos de uso de la API: https://www.themoviedb.org/api-terms-of-use, y página de atribución: https://www.themoviedb.org/about/logos-attribution, consultados el 25-11-2026.
- RAWG, documentación y términos de la API: https://rawg.io/apidocs, consultados el 25-11-2026.
- Open Library, documentación de la API y límites: https://openlibrary.org/developers/api, consultada el 25-11-2026.
- Wikidata Query Service, User-Agent y límites: https://www.wikidata.org/wiki/Wikidata:SPARQL_query_service, consultado el 25-11-2026.
- Cloudflare, Cache API (solo en dominios propios): https://developers.cloudflare.com/workers/runtime-apis/cache/, y límites de KV: https://developers.cloudflare.com/kv/platform/limits/, consultados el 25-11-2026 (vía Context7).
