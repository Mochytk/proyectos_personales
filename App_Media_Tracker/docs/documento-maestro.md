# Documento maestro · Media Tracker (reescritura)

Este documento manda sobre el desarrollo de Media Tracker desde la fase 0 (25-11-2026). Se basa en el prompt maestro del segundo cerebro, adaptado a esta app y a las respuestas de la fase 0 (sección 13). Si algo aquí choca con un ADR aceptado, manda el ADR más reciente; si choca con la conversación, se pregunta.

## 0. Cómo se trabaja

- **Por fases** (sección 10). Al cerrar cada una: qué quedó funcionando, cómo se probó (con evidencia), qué se decidió y cómo se revierte. No se pasa a la siguiente sin tu aprobación y tu "ok".
- **Preguntas juntas**, cada una con una opción recomendada, antes de escribir código de producto.
- **Documentación vigente, no memoria:** antes de usar una librería o API se consulta su documentación actual (Context7 o el sitio oficial) y se cita la fuente con fecha en el ADR.
- **Nada nuevo sin preguntar:** ni dependencias, ni plugins, skills, MCP o servicios. Antes se revisa qué ejecuta, de dónde viene, su licencia, sus scripts de instalación y sus permisos.
- **Seguridad no negociable** (secciones 6 y 8): sin secretos en el repo, el frontend, los logs ni los commits; datos de prueba siempre sintéticos; nada irreversible ni despliegues a producción sin tu confirmación.
- **Costo cero:** si algo cuesta dinero, pide tarjeta o tiene un límite que te afecta, se avisa antes y se proponen alternativas.
- **Idiomas:** código, nombres y comentarios en inglés; interfaz y documentación en español de Chile. Fechas visibles en DD-MM-AAAA.
- **Honestidad:** lo que no se pudo verificar se dice. Nada se declara funcionando sin haberlo ejecutado.
- **Ejecución:** la codificación la hacen subagentes Sonnet 5.5 con esfuerzo medio y la skill *ponytail* (el cambio más pequeño que resuelve la tarea). Al cierre de cada fase, un revisor independiente (Opus) revisa la rama completa sin haber visto cómo se escribió. Se te avisa cuando se lanza.
- **Flujo de Git:** `CONTRIBUTING.md` y `App_Media_Tracker/CLAUDE.md`. Resumen: rama por cambio desde `app/Media_Tracker` (`feat/`, `fix/`, `chore/`, `docs/`, `test/`, `refactor/`, `ci/`, `spike/`), Conventional Commits en inglés, `push` tras cada commit, PR con descripción en español que fusionas tú, CI en verde, cada PR deja su documentación al día, etiqueta `media-tracker/phase-N-ok` al cerrar cada fase.

## 1. Contexto y objetivo

**Qué es:** una app personal para llevar el control de lo que ves, lees, juegas y escuchas: películas, series, libros, videojuegos, juegos de mesa, música y más. Registra progreso exacto (episodio, temporada, página), sagas, listas, un planificador con estrenos y recordatorios, una bitácora y estadísticas.

**Por qué se reescribe:** la versión actual (Expo / React Native Web + Electron, en `App_Media_Tracker/MediaTracker/`) solo corre en el Mac y sincroniza entre Macs por una carpeta compartida. Ahora se quiere:

- usarla **en el iPhone y en el Mac**, con los mismos datos;
- una **identidad visual nueva**, con tres estilos que se pueden rotar;
- **sagas conjuntas** para cualquier tipo de medio, **avisos de duplicados** y **añadir por tipo**;
- el **mismo método de trabajo** de Constancia: fases, ADRs, modelo de amenazas, TDD y revisión independiente.

La versión actual queda congelada y **no se usa** hasta que la nueva tenga paridad (respuesta 5). Tus datos pasan a la nueva con el importador de respaldos (respuesta 4).

**Criterios de éxito (medibles):**

| Criterio | Meta |
| --- | --- |
| Costo mensual | 0 USD (planes gratis de Cloudflare y Neon; sin tarjeta) |
| Migración | Todos los respaldos JSON v1 a v5 de la app actual se importan sin perder un elemento, una lista ni un progreso (pruebas con los respaldos congelados `tests/fixtures/backups/v1.json` a `v5.json`) |
| Registrar un avance | 2 toques o menos desde Disfrutando, en el iPhone y en el Mac |
| Añadir algo nuevo | Tipo → búsqueda → elegir: 3 toques más lo que escribas |
| Respuesta local | Marcar un avance o añadir un elemento tarda menos de 100 ms, sin esperar a la red |
| Sincronización | Un cambio en un dispositivo aparece en el otro en menos de 30 s con ambos abiertos y con red |
| Sin conexión | Todo el uso diario funciona sin red; los metadatos y la sincronización esperan |
| Duplicados | Ningún elemento con el mismo ID de la fuente se añade dos veces sin aviso (prueba automática) |
| Sagas | Para libros enlazados con Wikidata, ≥ 70 % de sugerencias de saga con su posición correcta en el conjunto de evaluación (sección 7) |
| Accesibilidad | Contraste ≥ 4,5:1 en las 6 combinaciones (3 estilos × claro/oscuro); 0 hallazgos graves de axe en los E2E |
| Atribución | Logo y aviso de TMDB y enlace a RAWG visibles donde se usan sus datos (términos de uso) |
| Seguridad | 0 hallazgos críticos o altos pendientes en la revisión final |

**Fuera de alcance (por ahora):** multiusuario y compartir, app nativa de iOS (widgets incluidos: exigen Swift y una cuenta de Apple para no vencer cada 7 días), recomendaciones con IA de pago, streaming o reproducción de contenido.

## 2. Usuarios y contexto de uso

- **Una persona** (la dueña o dueño del repo), con una cuenta.
- **iPhone:** PWA instalada en la pantalla de inicio. Uso rápido: marcar el episodio que terminaste, añadir algo que te recomendaron, mirar qué sigue en una saga. A veces sin señal.
- **Mac:** la misma web dentro de Electron, con menú nativo, atajos, ventana que recuerda su tamaño e icono en la barra de menú. Uso largo: ordenar listas, revisar estadísticas, importar.
- **Contenido:** títulos en español y en inglés; sagas largas (Red Rising, Cosmere, Mundodisco); series con muchas temporadas.
- Zona horaria `America/Santiago`; fechas DD-MM-AAAA.

## 3. Principios de diseño

1. **Tus datos son tuyos.** Viven en el dispositivo (IndexedDB) y en tu cuenta; siempre se pueden exportar, y una importación nunca borra.
2. **Offline-first.** El dispositivo es la fuente para la interfaz; la red solo sincroniza y trae metadatos.
3. **Un solo modelo mental** para todos los tipos de medio: lo que funciona para libros (sagas, progreso) funciona para películas, series y juegos.
4. **Sugerir, no imponer.** Los metadatos, las sagas y los duplicados se proponen; tú confirmas. Nada se fusiona ni se reordena solo.
5. **Los datos externos son texto no confiable.** Títulos, sinopsis y nombres de sagas de TMDB, RAWG, Open Library y Wikidata se muestran como texto, nunca como HTML.
6. **Uso diario primero.** Se optimiza para quien abre la app varias veces al día.
7. **Vertical slice primero:** lo útil de punta a punta antes que lo vistoso.

## 4. Historias de usuario (criterios de aceptación resumidos)

**Biblioteca y progreso**

- HU-1. **Añado por tipo:** el botón + despliega un menú de tipos (Película, Serie, Libro y Videojuego primero; después el resto). Al elegir uno se abre la búsqueda de ese tipo, con "Añadir a mano" como alternativa.
- HU-2. **Aviso de duplicados:** si lo que añado ya existe (mismo ID de la fuente, o mismo título normalizado + tipo + año), veo "Ya tienes «X» (en curso)" con **Abrir el existente** o **Añadir igual**. Lo mismo al importar.
- HU-3. **Posibles duplicados:** una lista con los pares sospechosos de mi biblioteca, donde puedo fusionarlos (eligiendo qué datos quedan) o marcarlos como "no son duplicados". Nada se fusiona solo.
- HU-4. Registro el progreso por episodio y temporada, página, capítulo, nivel o porcentaje, en 2 toques desde Disfrutando.
- HU-5. Califico, escribo notas, pongo etiquetas y fecho cuándo terminé algo.
- HU-6. Organizo en listas normales e inteligentes (tipo, estado, nota mínima, etiquetas, "sin tocar hace…").

**Sagas**

- HU-7. **Sagas conjuntas para cualquier tipo:** una saga puede contener sagas (Red Rising = trilogía *Red Rising* + tetralogía *Iron Gold*), con un orden de lectura o visionado de principio a fin.
- HU-8. **Sugerencias automáticas si existen:** al añadir algo enlazado con una fuente, la app propone su saga y su posición (Wikidata). Las acepto, las corrijo o las ignoro. Siempre puedo armar una saga a mano.
- HU-9. **Disfrutando muestra la saga libro por libro:** una tarjeta por saga con el elemento en curso ("Iron Gold #2 · libro 5 de 7") y el avance de cada uno.

**Plataformas y datos**

- HU-10. Uso la app en el iPhone (PWA) y en el Mac (Electron), con los mismos datos, sincronizados.
- HU-11. Todo el uso diario funciona sin conexión y se sincroniza después.
- HU-12. Importo mis respaldos de la app actual (v1 a v5) sin perder nada.
- HU-13. Exporto e importo mi biblioteca completa en JSON.
- HU-14. Busco películas, series, libros y juegos con portadas, sinopsis y totales, sin poner claves de API en el dispositivo.
- HU-15. Veo los próximos estrenos en el Planificador y recibo recordatorios.
- HU-16. Veo estadísticas y el resumen de mi año.
- HU-17. Elijo entre tres estilos visuales o los dejo rotar; modo claro u oscuro según el sistema.
- HU-18. En el Mac: menú nativo, atajos, icono en la barra de menú para avanzar sin abrir la ventana.

**Pendientes de la lista de ideas** (se planifican en la fase 6): importar desde otras apps (Sofa, Letterboxd, Goodreads, CSV); "qué ver esta noche" y recomendaciones; reseñas avanzadas (medias estrellas, reseña larga, fechas de inicio y fin, relecturas).

## 5. Requisitos funcionales

**RF-1 · Biblioteca.** Elementos con tipo, estado, progreso, nota, etiquetas, notas, fechas (añadido, terminado, programado), portada y enlaces a fuentes (`tmdb`, `openlibrary`, `rawg`, `wikidata`). Modelo en `docs/modelo-de-datos.md`.

**RF-2 · Añadir por tipo (HU-1).** Menú de tipos como hoja (iPhone) o menú desplegable (Mac), navegable con teclado. Cada tipo abre su búsqueda con el campo enfocado.

**RF-3 · Duplicados (HU-2, HU-3).** Reglas en el ADR 0008: coincidencia exacta de ID de la fuente, o título normalizado (sin tildes, mayúsculas, artículos ni puntuación) + tipo + año. Aviso al añadir y al importar; lista de posibles duplicados con fusión asistida y "no son duplicados" (que se recuerda y se sincroniza).

**RF-4 · Sagas (HU-7 a HU-9).** Una saga es una colección ordenada que puede contener elementos y otras sagas (ADR 0007). Posición con decimales (novelas cortas, 2,5). Sugerencias desde Wikidata con `P179` (parte de la serie), `P1545` (posición) y la serie padre, a través del servidor (ADR 0005). La app actual guarda la saga como texto en el libro; el importador la convierte.

**RF-5 · Progreso.** Episodios con temporadas (y próximo episodio de TMDB), páginas, capítulos, niveles, porcentaje y pasos propios. Las reglas actuales (`store/seasons.ts`, `store/progress.ts`, `store/tray.ts`) se trasladan a `packages/shared` con sus pruebas.

**RF-6 · Metadatos (HU-14).** El cliente llama a `/api/meta/*`; el Worker llama a TMDB, RAWG, Open Library y Wikidata con las claves como secretos de Cloudflare, cachea respuestas y cumple los términos de cada servicio (atribución, límites, caché máxima). Detalle en el ADR 0005.

**RF-7 · Listas, Disfrutando, Bitácora, Planificador, Buscar, Estadísticas.** Paridad con la app actual (ver `MediaTracker/README.md`), más la tarjeta de saga en Disfrutando.

**RF-8 · Cuenta y sincronización (HU-10, HU-11).** Una cuenta con correo y contraseña; sincronización *push/pull* con *outbox*, como Constancia (ADR 0004).

**RF-9 · Respaldo y migración (HU-12, HU-13).** Importador de los formatos v1 a v5 de la app actual y exportación en un formato nuevo versionado, con migraciones por versión y respaldos congelados en las pruebas (la misma regla de compatibilidad de hoy).

**RF-10 · Escritorio (HU-18).** Electron endurecido que carga el mismo *build* web; menú, atajos, estado de ventana, icono en la barra de menú (lo hecho en la PR #31, trasladado).

**RF-11 · Estilos (HU-17).** Tres estilos con el mismo HTML y distintas variables, más la opción de rotar (ADR 0009 de identidad visual, cuando elijas).

## 6. Requisitos no funcionales

**Privacidad y seguridad**

- RNF-1 Ninguna clave de API en el frontend ni en el dispositivo: solo como secretos de Cloudflare.
- RNF-2 Toda consulta del servidor filtra por el `user_id` de la sesión, con pruebas de aislamiento entre usuarios.
- RNF-3 Toda entrada se valida en el servidor y en la importación con los esquemas Zod de `packages/shared`.
- RNF-4 El texto externo y el importado se muestran como texto (React escapa por defecto; prohibido `dangerouslySetInnerHTML`). Las URLs de portadas solo se aceptan de dominios conocidos.
- RNF-5 El proxy de metadatos no es un proxy abierto: exige sesión, solo llama a una lista fija de hosts y rutas, y tiene límite de peticiones por usuario.
- RNF-6 CSP estricta, cabeceras de seguridad y CORS con lista explícita.
- RNF-7 Electron endurecido: `contextIsolation`, `sandbox`, sin `nodeIntegration`, protocolo propio, navegación externa bloqueada, *preload* mínimo, validación de cada mensaje IPC, token en `safeStorage`.
- RNF-8 Cadena de suministro: lockfile, `pnpm audit` en CI, scripts de instalación bloqueados salvo los revisados, revisión de cada dependencia nueva.

**Rendimiento**

- RNF-9 Interacción local < 100 ms; apertura de la app < 2 s en el iPhone con 2.000 elementos; listas largas virtualizadas.
- RNF-10 Respuesta de metadatos cacheados < 300 ms; sin caché, lo que tarde la fuente, con indicador y tiempo máximo.

**Fiabilidad y datos**

- RNF-11 Ninguna operación deja los datos a medias (transacciones de Dexie; *push* atómico en el servidor).
- RNF-12 Los formatos de respaldo y de base son versionados, con migraciones probadas y nunca rompen la compatibilidad hacia atrás.

**Calidad**

- RNF-13 TypeScript estricto con `noUncheckedIndexedAccess`; TDD en la lógica pura; pruebas con `TZ=Asia/Tokyo` además de la zona local.
- RNF-14 E2E con Playwright (Chromium y WebKit para la PWA) en tamaño iPhone y Mac, en los 3 estilos × 2 modos.
- RNF-15 CI en verde: formato, lint, tipos, pruebas, auditoría.

**Usabilidad y accesibilidad (requisito, respuesta 13)**

- RNF-16 Fuentes autoalojadas (sin Google Fonts en ejecución), contraste ≥ 4,5:1 en las 6 combinaciones, áreas táctiles ≥ 44 px, `prefers-reduced-motion`, `prefers-color-scheme`, foco visible, revisión con las Web Interface Guidelines al cierre de las fases con interfaz.
- RNF-17 Textos en español de Chile, claros y breves.

## 7. Evaluación de las sugerencias (sagas y duplicados)

Lo que hace útil la parte automática es cuánto acierta. Desde la fase 3 hay una evaluación reproducible con **datos sintéticos y públicos** (nunca tu biblioteca real en el repo):

- **Sagas:** un conjunto de 60 obras (libros, películas, juegos) con su saga, saga padre y posición correctas. Métricas: cobertura (cuántas tienen sugerencia), precisión de saga y precisión de posición. Meta: ≥ 70 % de posición correcta en libros enlazados. Línea base del spike: 22 de 30 libros con saga y posición, y errores de datos como *Dune Messiah* "#1" (`docs/spikes/A-fuentes-de-sagas.md`).
- **Duplicados:** 40 pares (duplicados reales, ediciones distintas, remakes, homónimos). Métricas: falsos positivos y falsos negativos. Ningún cambio de reglas se acepta si empeora la evaluación sin tu aprobación y un ADR.

## 8. Modelo de amenazas

En `docs/amenazas.md` (STRIDE breve). Se verifica punto por punto en la fase 7.

## 9. Arquitectura y herramientas

Arquitectura en `docs/arquitectura.md`. Decisiones en `docs/decisions/`. Herramientas que se usan:

| Herramienta | Para qué |
| --- | --- |
| Superpowers | Brainstorming, planes con tareas TDD, depuración sistemática, verificación antes de dar algo por terminado |
| Context7 | Documentación vigente de cada librería antes de usarla |
| ponytail | Que los subagentes hagan el cambio mínimo |
| Skills de diseño (frontend-design, web-design-guidelines) | Direcciones visuales y revisión de accesibilidad y UX |
| Playwright | E2E y capturas en tamaño iPhone y Mac |
| Revisor independiente (Opus) | Revisión de cada fase sin haber visto el código escribirse |

## 10. Plan por fases

Detalle y ramas en `docs/plan/README.md`. Resumen, en el orden acordado (respuesta 18):

| Fase | Contenido |
| --- | --- |
| 0 | Descubrimiento: este documento, ADRs, amenazas, spike de sagas, monorepo vacío, tres direcciones visuales y nombres |
| 1 | Núcleo local: modelo, Dexie, lógica trasladada con sus pruebas, importador v1–v5, interfaz con los tres estilos, añadir por tipo, duplicados, Disfrutando, detalle, listas |
| 2 | Servidor y metadatos: Worker, proxy de metadatos con atribución, búsqueda por tipo, portadas |
| 3 | Sagas conjuntas: modelo de colecciones, sugerencias de Wikidata, Disfrutando por saga, evaluación |
| 4 | Cuenta y sincronización; PWA instalable en el iPhone |
| 5 | Escritorio: Electron endurecido, menú, atajos, barra de menú |
| 6 | Paridad restante (planificador, recordatorios, estadísticas, Tu año) e ideas pendientes (importar de otras apps, qué ver esta noche, reseñas avanzadas) |
| 7 | Endurecimiento, revisión de amenazas punto por punto, release y retiro de la app actual |

## 11. Definición de terminado

- Pruebas que fallaban antes y pasan ahora; el resto sigue pasando.
- Formato, lint, tipos y *build* limpios; CI en verde.
- Comportamiento real verificado (app, Worker o E2E) con evidencia adjunta.
- Sin secretos, sin datos personales, sin código muerto.
- Commits pequeños subidos, PR abierta hacia `app/Media_Tracker` sin fusionar.
- Documentación y ADRs al día; rollback descrito.

## 12. Supuestos

1. Una sola persona usa la app.
2. Mac con Apple Silicon e iPhone con iOS reciente (se confirma la versión en la fase 4 para la guía de la PWA).
3. Sin cuenta de desarrollador de Apple: sin firma ni notarización.
4. Cuentas gratis de Cloudflare y Neon ya existentes (las de Constancia), sin tarjeta.
5. Tienes claves gratis de TMDB y RAWG (las de la app actual), que pasarán a ser secretos del Worker.
6. El uso de TMDB y RAWG es personal y no comercial (sus planes gratis lo exigen).

## 13. Respuestas de la fase 0 (25-11-2026)

| N.º | Pregunta | Respuesta |
| --- | --- | --- |
| 1 | ¿Reescribir o evolucionar? | Reescribir con el stack de Constancia, trasladando la lógica pura |
| 2 | iPhone y sincronización | Cuenta + Worker de Cloudflare + Neon, propios de Media Tracker |
| 3 | Claves de TMDB y RAWG | A través del Worker, como secretos; "todo lo que nos mantenga seguros" |
| 4 | Datos actuales | Importador v1–v5 obligatorio |
| 5 | Uso mientras se construye | No se usa la app actual hasta tener la nueva |
| 6 | PR #31 | Fusionada |
| 7 | Duplicados | Aviso al añadir e importar, más una lista de posibles duplicados |
| 8 | Añadir por tipo | Sí, con todos los tipos |
| 9 | Sagas conjuntas | Sí, para todos los tipos |
| 10 | Direcciones visuales | Distintas de la actual y de las de Constancia |
| 11 | Estilos | Rotación entre los tres, aunque cueste más revisión |
| 12 | Nombre | Proponer nombres nuevos; "Media Tracker" también gusta |
| 13 | Accesibilidad | Requisito |
| 14 | Convenciones | Las del prompt |
| 15 | Etiquetas | `media-tracker/phase-N-ok` |
| 16 | Ejecución | Codifican subagentes Sonnet 5.5 (esfuerzo medio, *ponytail*); revisa Opus |
| 17 | Documentos | `App_Media_Tracker/docs/` y una línea en `docs/decisiones.md` |
| 18 | Prioridades | Fase 0 → núcleo local → metadatos y sagas → iPhone y sync → Electron → estadísticas e ideas pendientes |
