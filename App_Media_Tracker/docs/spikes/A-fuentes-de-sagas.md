# Spike A · Fuentes de sagas

- **Fecha:** 25-11-2026
- **Pregunta:** ¿se pueden sugerir sagas, y sagas conjuntas con su orden, a partir de datos públicos, para libros, películas, series y juegos?
- **Respuesta corta:** sí para libros y películas, con confirmación obligatoria; poco para juegos. Wikidata es la fuente principal (ADR 0007).
- **Código:** `A-fuentes-de-sagas/`. Son scripts desechables en Python, sin dependencias, que no se usan en producción. Las salidas están en los `.txt` del mismo directorio.

## Método

1. **Por obra (`pipeline.py`).** Para 30 libros conocidos se siguen tres pasos:
   - se busca la obra en Open Library (`search.json`, primer resultado);
   - con su ID de obra (`OL…W`) se busca el elemento de Wikidata que tiene ese valor en `P648`;
   - se leen sus series (`P179`), la posición en cada una (calificador `P1545`) y la serie padre de cada serie (`P179` de la serie).
2. **Por saga (`coverage.py`).** Para 26 sagas de libros, películas, series y juegos se busca la saga por su etiqueta en inglés y se cuentan:
   - sus miembros;
   - cuántos tienen ID de Open Library (`P648`), de TMDB (`P4947` o `P4983`) y de RAWG (`P9968`);
   - si tienen saga padre y etiqueta en español.

Las peticiones salieron con un User-Agent sin datos personales, con pausas de 0,6 a 1,5 s entre ellas.

## Resultados por obra (30 libros)

| Resultado | Cantidad |
| --- | --- |
| Enlazados con Wikidata por el ID de Open Library | 26 de 30 |
| Con saga y posición | 22 de 30 (20 con la posición correcta: 20 de 26 enlazados, 77 %) |
| Con saga padre explícita (saga conjunta) | 5 de 30 |
| En Wikidata pero sin saga (obras sueltas, o una edición en vez de la obra) | 3 |
| Sin enlazar | 4 |

Ejemplos:

- **Sagas conjuntas bien descritas:**
  - *Red Rising* → "Red Rising Saga #1" y "Red Rising Trilogy #1 ⊂ Red Rising Saga".
  - *Iron Gold* → "Iron Gold Tetralogy #1 ⊂ Red Rising Saga" y "Red Rising Saga #4".
  - *Dark Age* → "Red Rising Saga #5".

  Con esto sale la posición «libro 5» sin escribir nada a mano. El total («de 7») no sale solo: Wikidata cuenta 9 miembros en *Red Rising Saga* (`coverage.txt`), así que la saga guarda un total que propone Wikidata y tú corriges (ADR 0007).
- **Doble pertenencia:**
  - *Mort* → "Death #1 ⊂ Discworld" y "Discworld #4".
  - *Guards! Guards!* → "Ankh-Morpork City Watch #1" y "Discworld #8".
  - *Foundation and Empire* → "Foundation Trilogy #2" y "Foundation series #4".
- **Saga sin posición:** *The Well of Ascension* → "Cosmere #?" y "Mistborn #2".
- **Errores de datos:**
  - *Dune Messiah* figura como "Dune #1" (debería ser #2).
  - *The Two Towers* figura como #2 y #3 de *The Lord of the Rings*.
- **Sin enlazar:**
  - *The Last Wish*, *The Sea of Monsters* y *The Fellowship of the Ring*: el primer resultado de Open Library no coincide con el ID que tiene Wikidata.
  - *El nombre del viento*: la edición en español tiene otro ID de obra.

## Resultados por saga (26 sagas)

| Tipo | Saga | Miembros | Con ID de la fuente |
| --- | --- | --- | --- |
| Libro | Discworld | 64 | 53 de Open Library |
| Libro | A Song of Ice and Fire | 15 | 10 de Open Library |
| Libro | Red Rising Saga | 9 | 6 de Open Library |
| Película | Marvel Cinematic Universe | 49 | 48 de TMDB |
| Película | John Wick | 5 | 5 de TMDB |
| Serie | Star Trek | 265 | 193 de Open Library (son las novelas; las series de TV están en otras entradas) |
| Juego | The Legend of Zelda | 56 | 15 de RAWG |
| Juego | Dark Souls | 3 | 3 de RAWG |

Casi todas las sagas de libros tienen etiqueta en español: "Mundodisco", "Nacidos de la bruma", "Canción de hielo y fuego".

**Límites del método:** buscar una saga por su etiqueta en inglés es ambiguo. Por ejemplo, "Harry Potter" encontró la serie de videojuegos, y "Final Fantasy" un elemento con 1 miembro. Tres sagas no se encontraron con la etiqueta usada. Además, la columna "ordered" de `coverage.txt` sale en 0 por un error de la consulta, así que la posición se midió solo con `pipeline.py`. Por eso la app **nunca** busca sagas por nombre: siempre parte del ID externo de la obra.

## Conclusiones para el diseño

1. **Libros:** Open Library → `P648` → `P179`/`P1545` → serie padre. Cubre la mayoría de los libros conocidos, con la posición correcta en 20 de los 26 libros enlazados (77 %); otros 2 traían una posición equivocada. Para no fallar por el primer resultado de búsqueda, la app usa el ID de la obra que elegiste.
2. **Películas y series:** los ID de TMDB (`P4947`/`P4983`) están casi completos en sagas grandes. Las colecciones de TMDB sirven como pista adicional para películas.
3. **Juegos:** la cobertura de ID de RAWG es baja. Lo normal será armar la saga a mano.
4. **Siempre se confirma:** hay errores de datos (Dune, El Señor de los Anillos), así que las sugerencias nunca se aplican solas.
5. **Siempre a mano:** las obras que no se enlazan, como las ediciones en español, necesitan crear o editar la saga a mano.
6. **Siguiente paso (fase 3):** una evaluación reproducible con 60 obras públicas y la respuesta esperada (documento maestro, sección 7), para medir cobertura y precisión con las consultas reales del Worker.

## Fuentes

- Wikidata Query Service: https://query.wikidata.org/, y su política de User-Agent: https://www.wikidata.org/wiki/Wikidata:SPARQL_query_service, consultados el 25-11-2026.
- Propiedades P179, P1545, P648, P4947, P4983 y P9968 de Wikidata, consultadas el 25-11-2026.
- Open Library, búsqueda: https://openlibrary.org/dev/docs/api/search, consultada el 25-11-2026.
