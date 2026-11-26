# 0008 · Duplicados: aviso, lista y fusión asistida

- **Estado:** Propuesto
- **Fecha:** 25-11-2026

## Contexto

- Hoy la app no avisa si añades algo que ya tienes.
- Respuesta 7: hay que avisar al añadir y al importar, y tener además una lista de posibles duplicados. Nunca se fusiona nada sin tu intervención.
- Hay casos legítimos que se parecen a un duplicado:
  - un remake (*Dune* de 1984 y de 2021);
  - ediciones distintas del mismo libro;
  - un libro y su película, que tienen el mismo título pero otro tipo;
  - homónimos.

## Decisión

### Cuándo dos elementos son posibles duplicados

Lo decide una función pura de `packages/shared`, con dos niveles:

1. **Seguro:** comparten una clave externa (`externalKeys`, por ejemplo `tmdb:movie:603`).
2. **Probable:** son del **mismo tipo**, tienen el mismo `normalizedTitle` y el **mismo año**, o a alguno le falta el año. El título se normaliza así:
   - se quitan las tildes, las mayúsculas, la puntuación y los espacios repetidos;
   - se quitan los artículos iniciales en español e inglés (*el, la, los, las, un, una, the, a, an*);
   - se quitan los subtítulos tras ":" solo si el resto coincide exactamente.

   Dos elementos con años distintos **no** son duplicados, así que los remakes quedan fuera. Tampoco lo son dos elementos de tipos distintos.

Los pares marcados como "no son duplicados" (`duplicate_dismissals`) no vuelven a aparecer.

### Al añadir

Antes de guardar, se buscan coincidencias en Dexie por los índices `externalKeys` y `normalizedTitle`, en menos de 10 ms. Si hay alguna, aparece un aviso:

> **Ya tienes «Dune» (película, 2021, en curso).**
> [Abrir el existente] [Añadir igual]

**Abrir el existente** es la acción principal y recibe el foco. **Añadir igual** guarda el nuevo elemento y además lo marca como "no son duplicados" con el existente.

### Al importar

El plan de importación (ADR 0006) muestra "N posibles duplicados" con su lista. Para cada par puedes elegir **Saltar** (que es lo predeterminado para los seguros), **Añadir igual** o **Fusionar**. Si importas el mismo respaldo dos veces, el elemento conserva su ID y no cuenta como duplicado: es una actualización.

### Lista "Posibles duplicados"

Está en Biblioteca y muestra un contador cuando hay pares. Por cada par puedes elegir:

- **Fusionar:** se muestran los dos elementos lado a lado y eliges, campo por campo, qué valor queda. Por omisión queda el elemento con más progreso, y de cada campo el valor no vacío más reciente. Las etiquetas, las listas y las sagas se unen. El elemento que sobra pasa a borrado lógico, y se puede deshacer durante 10 s y desde la papelera.
- **No son duplicados.**

Las sagas también entran en esta lista, con la misma regla de nombre normalizado y tipo.

## Alternativas

- **Bloquear el duplicado.** Impide los casos legítimos (dos ediciones). Descartada.
- **Fusionar solo.** Respuesta 7: nunca. Descartada.
- **Comparación difusa (Levenshtein, trigramas).** Encuentra más casos, pero también más falsos positivos ("Dune" y "Dunk"). Se evaluará con el conjunto de la sección 7 antes de adoptarla. Por ahora queda descartada.

## Consecuencias

- Hay cero falsos negativos para lo que se añade desde una búsqueda (siempre trae clave externa), y pocos para lo que se añade a mano.
- Un elemento añadido a mano sin año puede emparejarse con un remake. El aviso lo dice ("¿es el mismo?") y no bloquea nada.

## Fuentes

- Respuesta 7 de la fase 0 (25-11-2026).
- Dexie, índices multientrada: https://dexie.org/docs/MultiEntry-Index, consultado el 25-11-2026.
