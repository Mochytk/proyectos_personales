# 0010 · Identidad visual: nombre «Al día» y tres estilos

- **Estado:** Propuesto
- **Fecha:** 26-11-2026

## Contexto

- Respuestas 10 a 12 de la fase 0: los estilos tienen que ser distintos del actual (crema y azul) y de los de Constancia (Cuaderno, Línea y Disco). Tiene que haber rotación aunque cueste más revisión, y se pidieron nombres nuevos.
- En la fase 0 se mostraron tres direcciones en una página con iPhone y Mac, en claro y oscuro. Teletexto se descartó por feo y se reemplazó por Portada. La tira de Fotograma se corrigió porque se aplastaba en la pantalla de saga.
- La accesibilidad es requisito (respuesta 13): contraste de 4,5:1 o más en las 6 combinaciones.

## Decisión

### Nombre

- La app se llama **Al día**, como en «¿vas al día con la serie?».
- El nombre aparece en lo que ves: título de la ventana, manifiesto de la PWA, ícono, barra lateral, menú de Electron y textos.
- Los nombres internos se mantienen para no romper nada: la carpeta `App_Media_Tracker/`, la rama `app/Media_Tracker`, las etiquetas `media-tracker/phase-N-ok`, el Worker y el proyecto de Neon `media-tracker`, y el formato de respaldo `media-tracker-backup` (ADR 0006), que tiene que seguir leyendo los respaldos de la app actual.

### Tres estilos

Los tres comparten el mismo HTML y los mismos componentes. Cambian las variables CSS (`--p-*`), las fuentes y el componente de progreso.

| Estilo | Idea | Progreso | Fuentes | Acento (claro / oscuro) |
| --- | --- | --- | --- | --- |
| `estante` | Una repisa de libros | Lomos sobre una repisa; el actual se llena de abajo hacia arriba | Bricolage Grotesque condensada (títulos), Literata (texto) | `#A11D4E` / `#F48BB0` |
| `fotograma` | La sala de cine | Tira de película con perforaciones; un fotograma numerado por unidad | Archivo (expandida en títulos) | `#17704D` / `#62D3A0` |
| `portada` | Las portadas, comunes a todos los medios | Portadas en abanico: terminadas a todo color, la actual levantada y llenándose, las que faltan punteadas con su número; los episodios son miniaturas | Schibsted Grotesk | `#5A33D4` / `#B8A3FF` |

- Los colores completos de cada estilo y modo son los de la página de direcciones de la fase 0 (`docs/diseno/direcciones.html`). Esa página es la referencia para la fase 1.
- Contraste medido en esa página con la fórmula de WCAG 2.2. El peor caso de cada estilo: Estante 6,09:1, Fotograma 5,31:1 y Portada 6,33:1. En la fase 1 una prueba unitaria recalcula estos valores desde los tokens, para que un cambio de color no rompa el mínimo sin que se note.
- El componente de progreso dibuja una unidad por paso hasta 40 pasos, como hoy (`MAX_CHECKLIST_STEPS`). Con más pasos, o con páginas o porcentaje, cambia a una barra continua del mismo estilo (el lomo, el fotograma o la portada que se llena), igual que `usesCounter` en la app actual.
- Tiene una sola API (`units: { state: 'done' | 'now' | 'todo', fraction?, color? }[]`) y un `aria-label` con el resumen ("4 terminados, 1 en curso, 2 pendientes"). Cada estilo solo cambia cómo se dibuja.
- Las fuentes se autoalojan con Fontsource (`@fontsource-variable/bricolage-grotesque`, `literata`, `archivo` y `schibsted-grotesk`; licencia OFL-1.1, revisadas el 26-11-2026). Cada estilo carga solo las suyas.

### Elección y rotación

- `settings.style` acepta `estante`, `fotograma`, `portada` o `rotate`. El valor por defecto es `rotate`.
- Con `rotate`, el estilo cambia cada lunes en el orden estante → fotograma → portada. La semana del 23-11-2026 es `estante`. La función `resolveStyle(setting, today)` vive en `packages/shared` y se prueba con fechas fijas, también con `TZ=Asia/Tokyo`.
- El ajuste se sincroniza (ADR 0004), así que el iPhone y el Mac muestran el mismo estilo.
- El modo claro u oscuro sigue al sistema.
- Con «reducir movimiento» se apagan las animaciones del progreso.

## Alternativas

- **Teletexto** (páginas de la tele, azul marino y amarillo, bloques de mosaico). Descartado tras verlo.
- **Un solo estilo.** Menos trabajo de revisión, pero contradice la respuesta 11.
- **Renombrar también carpetas, ramas y formatos.** Rompería enlaces, etiquetas y la lectura de respaldos viejos sin beneficio visible.
- **Otros nombres:** Capítulo, Maratón, Repisa, Separador, Acá voy y Media Tracker.

## Consecuencias

- Cada pantalla se prueba en 3 estilos × 2 modos (RNF-14). Los E2E se parametrizan por estilo.
- Portada depende de los colores de las portadas. Cuando un elemento no tiene portada, usa un color derivado de su ID, así que siempre se ve igual en todos los dispositivos.
- Agregar un cuarto estilo es agregar un archivo de variables y un dibujo del progreso. Ninguna pantalla cambia.

## Fuentes

- Página de direcciones de la fase 0, revisada con capturas de Playwright el 26-11-2026.
- Registro de npm de los cuatro paquetes `@fontsource-variable/*`, consultado el 26-11-2026 (versión 5.3.0, OFL-1.1).
- ADR 0009 de Constancia (identidad visual y rotación), consultado el 25-11-2026.
