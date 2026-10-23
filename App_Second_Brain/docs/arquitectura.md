# Arquitectura (borrador, fase 0)

> Estado: **borrador**. Las partes marcadas como *hipótesis* se deciden con los spikes de la fase 0 (`docs/spikes/`) y quedan como ADR en `docs/decisions/`. Formato de nota: `formato-de-nota.md`. Sincronización: `protocolo-sincronizacion.md`. Amenazas: `amenazas.md`.

## Vista general

```
 iPhone (captura)                 Cloudflare (buzón)                 Mac (cerebro)
┌──────────────────┐   blob    ┌────────────────────┐   blob    ┌────────────────────────────────┐
│ PWA o Atajo      │ cifrado   │ Worker relay       │ cifrado   │ sync: descifra → inbox/        │
│ graba / escribe  ├──────────►│ guarda blobs       ├──────────►│ ingest: transcribe, MarkItDown │
│ cola sin red     │           │ opacos con TTL     │  confirma │ core: bóveda + índice + búsq.  │
└──────────────────┘           └────────────────────┘◄──────────┤ app Electron (UI)              │
                                                                 │ servidor MCP (stdio) ◄─ Claude │
                                                                 └────────────────────────────────┘
```

- La **bóveda** (carpeta de Markdown) es la fuente de verdad. El **índice** (SQLite) es derivado.
- La nube solo hace de **buzón cifrado**. No guarda notas ni índices, y no ve contenido en claro.
- **Claude** (Claude Code o Claude Desktop) lanza el servidor MCP como proceso hijo por stdio. No hay API de pago ni puertos de red.

## Componentes

| Componente | Carpeta | Responsabilidad | Fase |
| --- | --- | --- | --- |
| Núcleo | `packages/core` | Leer y escribir la bóveda (atómico), parsear frontmatter, índice FTS5 y vectorial, búsqueda híbrida, propuestas, cola de trabajos | 1–2 |
| Esquemas | `packages/shared` | Zod para el frontmatter, las propuestas, los contratos MCP y el sobre de sincronización. Sin dependencias de Node ni del navegador | 1 |
| Servidor MCP | `apps/mcp` | Herramientas de lectura (y de propuestas, apagadas por defecto) sobre el núcleo; marca el texto de notas como no confiable | 1, 4 |
| CLI | `apps/mcp` o `packages/core` | `capture`, `reindex`, `verify`, `export`, `proposals approve` | 1 |
| Ingesta | `services/ingest` | MarkItDown (Python) y transcripción, como procesos hijos aislados con límites | 2, 4 |
| App de escritorio | `apps/desktop` | Bandeja, notas, búsqueda, propuestas, dispositivos y ajustes | 3 |
| Captura iPhone | `apps/capture-web` | Grabar, escribir, cifrar y encolar sin red | 5 |
| Relay | `apps/relay` | Buzón de blobs cifrados: subir, listar, bajar, confirmar y caducar | 5 |
| Cripto | `packages/crypto` | Emparejamiento, derivación de claves y sobres AES-GCM con WebCrypto (igual en Node, navegador y Workers) | 5 |
| Evaluación | `eval/` | Preguntas de oro, notas sintéticas, recall@5, MRR y latencia | 1–2 |

## Procesos en el Mac

Tu Mac tiene **8 GB de RAM** (M1). Eso manda: los modelos (embeddings y Whisper) no pueden estar cargados dos veces, ni todo el tiempo.

**Hipótesis a confirmar con los spikes B y D**, en dos etapas:

1. **Fases 1–2: núcleo como librería.** El CLI y el servidor MCP usan `packages/core` dentro de su propio proceso. SQLite en modo WAL permite varios lectores y un escritor a la vez, que basta mientras solo escriban el CLI y el MCP (este último, solo propuestas y capturas).
2. **Desde la fase 3–4: núcleo como servicio local** (`sb-core`), cuando lleguen la app y la transcripción. Un solo proceso es dueño del índice, de los modelos y de la cola. La app y el servidor MCP son clientes delgados y le hablan por un **socket Unix** con permisos `0600` y token, sin puerto TCP. Arranca a pedido y se apaga tras unos minutos sin uso para liberar RAM.

Alternativas descartadas por ahora:

- **Todo embebido en cada proceso.** Es simple, pero duplica los modelos en RAM y obliga a compilar los módulos nativos para dos runtimes distintos (el Node del sistema y el de Electron).
- **La app como centro.** El MCP dependería de que la app esté abierta, y sin ella perdería la búsqueda semántica.

Por qué un servicio separado de Electron: la guía de seguridad de Electron recomienda desactivar el fusible `runAsNode`, y entonces Electron no sirve para ejecutar el servidor MCP como Node. Con el núcleo en el Node del sistema, Electron no carga módulos nativos y el MCP es un proceso pequeño.

**SQLite sin módulos nativos (hipótesis, spike B).** `node:sqlite`, que viene con Node 24, ya trae FTS5 y la opción `remove_diacritics`; lo probé en Node 24.22.1. Si alcanza, evitamos `better-sqlite3` y sus binarios. Los vectores pueden guardarse como BLOB y compararse por fuerza bruta en JS: con 10.000 notas y unos 30.000 fragmentos de 384 dimensiones son unos 46 MB en RAM. El spike mide si eso cumple la meta de 300 ms antes de depender de una extensión como `sqlite-vec`, que todavía no llega a la versión 1.0.

## Flujos principales

**Captura de texto (fase 1).** `sb capture "texto"` → nota en `inbox/` (escritura atómica) → índice FTS → embeddings en segundo plano.

**Nota de voz desde el iPhone (fase 5).**

1. El iPhone graba, cifra con la clave del emparejamiento y guarda en su cola local.
2. Cuando hay red, sube el blob al relay con su `capture_id`.
3. El Mac consulta el relay, baja el blob y lo descifra.
4. Guarda el audio en `attachments/` y crea la nota en `inbox/`.
5. Encola la transcripción y, cuando termina, escribe la nota y la indexa.
6. Recién entonces confirma al relay, que borra el blob.

Si el Mac está apagado, el blob espera en el relay hasta su caducidad.

**Consulta desde Claude (fase 1).**

1. Claude llama `search_notes(query)` y recibe ids, títulos, fragmentos cortos y puntuaciones, todo dentro de un sobre que dice que es contenido no confiable.
2. Si necesita más, llama `get_note(id)`.
3. Claude responde citando la nota de origen.

**Procesar la bandeja (fase 4).**

1. Claude llama `list_inbox`, lee las notas y llama `propose_changes`, que deja propuestas en `.second-brain/proposals/`.
2. Tú las apruebas o rechazas en la app (o con el CLI).
3. Las aprobadas se aplican, verificando que la nota no cambió entretanto.

## Búsqueda

- **Texto completo:** SQLite FTS5 con `unicode61 remove_diacritics 2` para ignorar tildes. Plurales simples y errores típicos de transcripción se tratan normalizando el texto antes de indexar y antes de buscar (spike B).
- **Vectorial:** modelo de embeddings multilingüe local, elegido por el conjunto de oro y no por popularidad (spike B).
- **Híbrida:** Reciprocal Rank Fusion de ambas listas, con filtros por etiqueta, tipo, estado y fechas.
- **Fragmentos:** los documentos largos se dividen con solapamiento y conservan el título de sección. Los resultados devuelven el fragmento y la nota de origen.
- **Medición:** `eval/` corre recall@5, MRR y latencia en el CI con notas sintéticas, y en tu Mac con tu bóveda real (solo local). Un cambio que empeore las métricas no entra sin tu aprobación y un ADR.

## Servidor MCP

- **Transporte stdio** con el SDK oficial de TypeScript. Sin puerto de red.
- **Lectura** (activas por defecto): `search_notes`, `get_note`, `list_inbox`, `list_recent`, `get_related`, `list_tags`, `vault_stats`, todas con `readOnlyHint: true` y `openWorldHint: false`. Las anotaciones son pistas para Claude, no una barrera de seguridad; la barrera es que esas herramientas **no pueden** escribir.
- **Escritura** (apagadas por defecto; se activan con un interruptor local que Claude no puede tocar): `propose_changes`, `add_note` y `apply_proposal`, esta última solo para propuestas ya aprobadas por ti.
- **No existen** herramientas de borrado definitivo, red, shell ni acceso a archivos fuera de la bóveda.
- **Económico en tokens:** la búsqueda devuelve fragmentos de unos 300 caracteres y como máximo `k` resultados, con un tope total configurable. La nota completa solo llega con `get_note`.
- **Contenido no confiable:** todo texto de notas va dentro de un sobre que lo marca como datos del usuario, con la instrucción de no seguir órdenes que aparezcan dentro.
- **Registro local** de cada llamada (herramienta, parámetros sin texto libre, duración y tamaño de la respuesta), sin contenido de notas.

## Ingesta y transcripción

- **Transcripción local** con Whisper. La implementación y el modelo los decide el spike A. Corre con prioridad baja (QoS de segundo plano de macOS) y de a un audio a la vez, para no dejar el Mac inutilizable.
- **MarkItDown** corre en un proceso hijo de Python (gestionado con `uv` y dependencias fijadas con hash). Tiene límite de tamaño y de tiempo, no tiene red, y escribe solo en una carpeta temporal. Si falla, la captura queda marcada con error y no tumba nada.
- **Cola persistente:** los trabajos (transcribir, extraer, indexar) se guardan en SQLite, se reintentan con espera creciente y se retoman tras un cierre inesperado.

## Qué no hay, a propósito

- Telemetría, analítica o reportes de errores a terceros.
- Puertos TCP abiertos en el Mac. Si alguno llega a ser inevitable, irá solo en `127.0.0.1` y con token.
- Un LLM propio dentro de la app: la parte inteligente la hace Claude a pedido, por MCP.
- Notas, índices o embeddings en la nube.

## Decisiones que dependen de los spikes

| Decisión | Spike | Qué se mide |
| --- | --- | --- |
| `whisper.cpp` o `faster-whisper`, y qué modelo | A | Errores por palabra en español de Chile, velocidad real en tu M1, RAM máxima, empaquetado |
| Modelo de embeddings, runtime y SQLite (`node:sqlite`, vectores en JS o `sqlite-vec`) | B | recall@5, MRR, latencia, RAM y tamaño |
| Captura en el iPhone: PWA o Atajo de iOS | C | Toques, formato de audio, permisos, almacenamiento y trabajo sin red |
| SDK de MCP (v1 o v2), registro en Claude Code y Desktop, y opción remota | D | Que funcione de punta a punta y qué exigiría la opción remota |
| Almacenamiento del relay (KV, D1, Durable Objects o R2) y protocolo | E | Límites gratuitos, tamaño de blob, caducidad y si piden tarjeta |
