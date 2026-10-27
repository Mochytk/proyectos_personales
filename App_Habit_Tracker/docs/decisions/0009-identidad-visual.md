# 0009 · Nombre e identidad visual: tres estilos intercambiables

- **Estado:** Aceptada (23-10-2026, PR #23)
- **Fecha:** 23-10-2026

## Contexto

En la fase 0 te mostré tres direcciones visuales en una página privada de diseño:

- **Cuaderno:** papel cuadriculado, azul lápiz pasta y la línea roja del margen.
- **Línea:** el día como una línea de metro, con cada ancla como una estación.
- **Disco:** discos de pesas en colores olímpicos y tipografía condensada.

Te gustaron las tres y pediste poder rotar entre ellas. El nombre elegido es **Constancia**. HU-17 pide modo claro y oscuro según el sistema.

## Decisión

- **Nombre visible: Constancia.** Va en el título de la web, el manifest de la PWA (fase 4) y el `productName` de Electron (fase 5). Las carpetas y los paquetes del código siguen como `habit-tracker`.
- **Tres estilos:** `cuaderno`, `linea` y `disco`, más la opción `rotate`.
  - `rotate` cambia de estilo cada lunes, en ese orden. La semana del 19-10-2026 es Cuaderno.
  - Se elige en Ajustes y se guarda en `user_settings.style`, así que se sincroniza entre dispositivos.
  - Por defecto: `cuaderno`, porque Atkinson Hyperlegible Next es la tipografía más legible de las tres.
- **Modo claro u oscuro:** lo decide `prefers-color-scheme` (HU-17), en los tres estilos.
- **Cómo se implementa:**
  - El atributo `data-style` en `<html>` elige el estilo. Cada uno define sus variables CSS (colores, tipografía, radios y forma del control de marcado) para claro y para oscuro.
  - Las pantallas y los componentes son **los mismos** en los tres estilos: misma estructura, mismos textos, misma accesibilidad. Solo cambian las variables.
  - Cada estilo tiene **un solo elemento propio**, en un componente `StyleSignature`:
    - Cuaderno: la línea del margen y los cuadritos de la semana.
    - Línea: el riel con una estación por ancla.
    - Disco: la barra con los discos del día y, en el gimnasio (fase 3), cuántos discos van por lado.
  - En Línea y Disco, el color de cada ancla sale de una paleta fija del estilo, según el orden del ancla. No se guarda en la base.
- **Fuentes autoalojadas con Fontsource** (licencia OFL-1.1), sin Google Fonts en ejecución:
  - Así la CSP queda estricta (`font-src 'self'`), tu IP no se envía a un tercero y las fuentes funcionan sin conexión.
  - Se carga solo la fuente del estilo activo. En la fase 4, el service worker guarda las tres para poder cambiar de estilo sin red.
- **Contraste verificado en las 6 combinaciones** (3 estilos × 2 modos), con un mínimo de 4,5:1 en el texto, en las capturas E2E de la fase 1.

## Alternativas

- **Un solo estilo.** Es menos trabajo, pero no es lo que pediste.
- **Estilos que solo cambian la paleta.** Se perdería lo que distingue a cada uno: el margen, el riel y los discos.
- **Componentes distintos por estilo.** Triplicaría el código y las pruebas de interfaz.
- **Google Fonts desde su CDN.** Choca con la CSP estricta y con la privacidad, y no funciona sin conexión.

## Consecuencias

- Revisar la interfaz cuesta más: cada pantalla se mira en 6 combinaciones. Lo mitigan las pruebas parametrizadas por estilo y las capturas automáticas.
- Hay tres familias tipográficas, pero cada visita solo descarga la del estilo activo. El peso se mide en la fase 1.
- `user_settings` gana la columna `style` (`cuaderno`, `linea`, `disco` o `rotate`).

## Fuentes (consultadas el 23-10-2026)

- Registro npm: `@fontsource-variable/atkinson-hyperlegible-next`, `@fontsource-variable/overpass`, `@fontsource/barlow-condensed` y `@fontsource/barlow`, todas en la versión 5.3.0 con licencia OFL-1.1.
