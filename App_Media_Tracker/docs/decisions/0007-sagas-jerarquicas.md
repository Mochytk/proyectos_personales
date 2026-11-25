# 0007 · Sagas jerárquicas para todos los tipos

- **Estado:** Propuesto
- **Fecha:** 25-11-2026

## Contexto

- Hoy una saga es un texto dentro del libro (`saga: { name, number }`), y solo hay sagas de libros (`SAGA_TYPES = ['book']`).
- Respuesta 9: tiene que haber **sagas conjuntas** para todos los tipos de medio. Por ejemplo, *Red Rising* = trilogía *Red Rising* + tetralogía *Iron Gold*, o el MCU = fases que contienen películas. En Disfrutando se ven libro por libro ("Iron Gold #2 · libro 5 de 7").
- Las sagas se sugieren desde Wikidata, las confirmas tú, y siempre se pueden armar a mano.
- Spike A (`docs/spikes/A-fuentes-de-sagas.md`), con 30 libros:
  - 26 quedaron enlazados con Wikidata mediante su ID de Open Library;
  - 22 tienen saga y posición;
  - en 5 aparece una saga padre explícita.

  También hay errores en los datos: *Dune Messiah* figura como "Dune #1" y *Las dos torres* como #2 y #3. Las películas se enlazan bien por su ID de TMDB (el MCU tiene 48 de 49 con ID). Los juegos tienen poca cobertura: Zelda tiene 15 de 56 con ID de RAWG.

## Decisión

### Modelo

Es un árbol de colecciones (ADR 0006).

- Una `collection` tiene `name`, `kind` (el tipo de medio que domina, o `mixed`), `description` y, si salió de Wikidata, `externalKeys` (`wikidata:Q…`).
- Una `collection_entry` une una saga con un hijo, que puede ser un elemento o **otra saga**, y guarda su `position` (decimal: 0,5, 2,5, etc.). Un mismo elemento puede estar en más de una saga. Por ejemplo, *Mort* está en "Muerte" (#1) y en "Mundodisco" (#4).
- **Reglas que verifica `packages/shared`:**
  - no hay ciclos (una saga no puede contenerse a sí misma, ni directa ni indirectamente);
  - la profundidad máxima es 4;
  - no se repite el mismo hijo en la misma saga.
- **Orden completo:** se recorre el árbol en profundidad, según la posición. Si una saga contiene subsagas y además elementos directos, por ejemplo *Red Rising Saga* con la trilogía en la posición 1 y la tetralogía en la 2, el orden completo es el de las subsagas en su posición. Un elemento que está a la vez en la saga padre (como *Iron Gold*, que es "Red Rising Saga #4") **no se cuenta dos veces**: aparece una sola vez, en la primera posición en que se lo encuentra. Así se obtiene "libro 5 de 7".

### Sugerencias

Las arma `GET /api/meta/saga` (ADR 0005), con una consulta SPARQL de plantilla fija:

1. Busca la obra en Wikidata por su ID externo (`P648` de Open Library, `P4947` o `P4983` de TMDB, `P9968` de RAWG).
2. Lee sus series (`P179`), la posición en cada una (calificador `P1545`) y la serie padre de cada serie (`P179` de la serie), hasta 2 niveles.
3. Lee las etiquetas en español, y si no hay, en inglés.
4. Devuelve las sagas candidatas con sus miembros conocidos y la posición de cada uno. Los miembros son solo IDs externos y títulos; no se añaden a tu biblioteca.

### Interfaz

- **Al añadir algo con ID externo**, la app pide sugerencias en segundo plano. Si hay alguna, el detalle muestra "Parece parte de *Red Rising Saga* (libro 4)" con las opciones **Añadir a la saga**, **Editar** e **Ignorar**. Nada se agrega sin que lo confirmes. Si la saga ya existe en tu biblioteca (por `externalKeys` o nombre normalizado), se propone usar esa.
- **"Ignorar"** se recuerda: el mismo ID de Wikidata no se vuelve a proponer para ese elemento.
- **A mano:** puedes crear una saga, añadir elementos o subsagas, reordenar arrastrando o con botones (accesible con teclado) y escribir posiciones decimales.
- **Disfrutando:** si un elemento en curso pertenece a una saga, se muestra una tarjeta de la saga **raíz** con el elemento actual, su posición en el orden completo ("libro 5 de 7") y una barra con los terminados, los en curso y los que faltan. Al terminar uno, la tarjeta propone el siguiente: "Siguiente: *Dark Age*".
- **Detalle de saga:** el árbol con los elementos que tienes y los que te faltan. Los que te faltan son los miembros que Wikidata conoce, y cada uno tiene un botón **Añadir**.

### Calidad

La evaluación de la sección 7 del documento maestro usa 60 obras públicas, y se repite en cada cambio de las consultas.

## Alternativas

- **Mantener la saga como texto y agrupar por nombre.** No permite sagas conjuntas ni un orden de principio a fin. Descartada.
- **TMDB Collections para películas.** Son de un solo nivel (no conocen el MCU como saga conjunta) y solo cubren películas. Se pueden usar como pista adicional en la fase 3 si Wikidata falla, pero no son la fuente principal. Descartada como fuente única.
- **Aceptar las sugerencias automáticamente.** Los errores de datos del spike lo impiden: siempre se confirman. Descartada.

## Consecuencias

- Las sagas funcionan igual para libros, películas, series, juegos y cualquier otro tipo, incluso mezclados (una saga con libros y su adaptación al cine).
- Los juegos casi no tienen sugerencias. Lo habitual será armarlas a mano.
- Las sagas de la app actual llegan como sagas de un solo nivel. Puedes unirlas en una conjunta, y la app puede sugerir la saga padre.

## Fuentes

- Spike A, `docs/spikes/A-fuentes-de-sagas.md`, ejecutado el 25-11-2026.
- Wikidata, propiedades P179 (*part of the series*), P1545 (*series ordinal*), P648 (Open Library ID), P4947 (TMDB movie ID), P4983 (TMDB TV series ID) y P9968 (RAWG game ID): https://www.wikidata.org/wiki/Property:P179, consultado el 25-11-2026.
- `App_Media_Tracker/MediaTracker/store/sagas.ts`, consultado el 25-11-2026.
