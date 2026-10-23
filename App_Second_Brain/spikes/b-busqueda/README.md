# Spike B · Búsqueda: texto completo, embeddings e híbrida

> Código desechable: vive solo en la rama `spike/search-eval` y no se fusiona. El conjunto de oro (`eval/`) sí es útil para la fase 1, y se llevará al producto por una PR propia. El informe irá a `docs/spikes/`.

**Pregunta:** ¿qué combinación de búsqueda llega a **recall@5 ≥ 80 %** en español de Chile, en menos de 300 ms con 10.000 notas, cabe en un M1 de 8 GB y se usa bien desde Node?

## El conjunto de oro inicial

- `eval/notas/`: **57 notas sintéticas** (ficticias) con ideas, ramos, trabajo, compras, notas de voz con errores de transcripción, notas en inglés, notas muy cortas y **distractores** (otra "feria", otro "deploy", otro "merge").
- `eval/preguntas.json`: **33 preguntas** con la nota que debe aparecer, por categoría: sinónimos (15), errores de transcripción (5), notas cortas (3), fechas relativas (3), jerga en inglés (2), tildes (2), pregunta en español sobre nota en inglés (2) y general (1). Cubren los casos especiales de la sección 7.
- Limitación: con 57 notas, el top 5 ya es casi el 9 % del corpus, así que recall@5 es generoso. El MRR discrimina mejor. El conjunto crece hasta 100 preguntas y más notas en las fases 1 y 2.

## Resultados ya medidos (contenedor Linux, Node 24.22.1)

| Método | recall@5 | MRR | p50 | Falló en |
| --- | --- | --- | --- | --- |
| FTS5 (`unicode61 remove_diacritics`, prefijos) | **72,7 %** | 0,60 | 0,3 ms | Q04 Q05 Q09 Q14 Q19 Q20 Q25 Q27 Q28 |
| FTS5 + palabras vacías | 69,7 % | 0,51 | 0,1 ms | lo mismo + Q33 |
| FTS5 + palabras vacías + fechas relativas | 72,7 % | 0,56 | 0,1 ms | Q04 Q05 Q09 Q14 Q19 Q20 Q25 Q27 Q28 |

Por categoría, FTS5 solo: jerga en inglés 100 %, tildes 100 %, fechas 100 %, general 100 %, transcripción 80 %, notas cortas 66,7 %, **sinónimos 60 %** y **español sobre nota en inglés 50 %**.

**Lectura:** el texto completo resuelve bien tildes, jerga y palabras exactas, pero **no llega al 80 %**. Falla justo donde el significado importa: "tesis" frente a "trabajo de título", "nevera" frente a "refri", "respaldo del computador" frente a "copia de seguridad del Mac", y preguntas en español sobre notas en inglés. Eso es lo que deben aportar los embeddings.

**Escala (10.000 notas):**

- FTS5: p50 de **7,9 ms**.
- Vectorial por fuerza bruta en JS (384 dimensiones): p50 de **7,1 ms**.

Las dos quedan muy por debajo de los 300 ms, **sin `sqlite-vec`** ni otra extensión nativa. Falta sumar lo que tarda en calcularse el embedding de la pregunta, que se mide en tu Mac.

## Lo que falta: los embeddings (bloqueado aquí, se corre en tu Mac)

Este contenedor no puede descargar modelos: la política de red rechaza `huggingface.co`. El código está listo y probado (13 pruebas, tipos limpios) y se puede correr en tu Mac. Así además medimos la latencia real en tu M1:

```sh
git fetch origin spike/search-eval
git worktree add ~/SegundoCerebro-spikes/repo-b origin/spike/search-eval
cd ~/SegundoCerebro-spikes/repo-b/App_Second_Brain/spikes/b-busqueda
corepack enable && pnpm install --frozen-lockfile
pnpm eval
```

Descarga unos 250 MB en `~/SegundoCerebro-spikes/b/models`, verifica cada archivo y compara:

| Modelo | Repo | Notas |
| --- | --- | --- |
| `e5-small` | `Xenova/multilingual-e5-small` | 118M parámetros, 384 dimensiones; ONNX de `intfloat/multilingual-e5-small` (MIT); usa prefijos `query:` y `passage:` |
| `minilm-l12` | `Xenova/paraphrase-multilingual-MiniLM-L12-v2` | 118M parámetros, 384 dimensiones |
| *(opcional, `pnpm eval -- --extra`)* `bge-m3` | `Xenova/bge-m3` | 568M parámetros: más pesado para 8 GB |
| *(opcional)* `embeddinggemma` | `onnx-community/embeddinggemma-300m-ONNX` | Licencia propia de Google (términos de Gemma): **revisarla antes de adoptarlo** |

Para cada modelo mide: solo embeddings, **híbrida (RRF de FTS5 y embeddings)** e híbrida con fechas relativas, además de RAM, tiempo de carga, tiempo por nota y tamaño en disco. Pégame lo que imprime: son solo números y los ids de las preguntas sintéticas que fallaron.

**Integridad de los modelos:** se descargan en una revisión fija. Los archivos grandes se comparan con el SHA-256 que publica Hugging Face y los pequeños con su hash de git. En tiempo de ejecución, transformers.js tiene prohibido descargar nada (`allowRemoteModels = false`).

## Dependencias (lo que revisé)

| Paquete | Licencia | Peso | Scripts de instalación |
| --- | --- | --- | --- |
| `@huggingface/transformers` 4.3.1 | Apache-2.0 | pequeño | no |
| ↳ `onnxruntime-node` 1.30.0 (Microsoft) | MIT | **288 MB** (trae los binarios de macOS, Linux y Windows) | sí: solo descarga extras de CUDA para Linux. pnpm lo bloqueó y en el Mac no hace falta |
| ↳ `onnxruntime-web` 1.31.0-**dev** | MIT | 140 MB | no. **Ojo:** transformers.js fija una versión de desarrollo |
| ↳ `sharp` 0.35 (imágenes, no se usa aquí) | Apache-2.0 | 20 MB con libvips | binarios precompilados; sin scripts |
| ↳ `protobufjs` 7.6 | BSD-3-Clause | pequeño | sí: es solo un aviso de versión; pnpm lo bloqueó |

En total son unos **500 MB** en `node_modules` para correr embeddings en Node. Hay una alternativa a evaluar con los resultados en la mano: **llama.cpp** (ya llega como dependencia de `whisper.cpp` en Homebrew) con modelos GGUF y GPU Metal. Evita los módulos nativos de npm, pero obliga a lanzar un proceso o un servidor local.

## Pruebas

```sh
pnpm test        # 13 pruebas: métricas, RRF, fechas relativas, verificación de hashes y coherencia del conjunto de oro
pnpm typecheck
pnpm eval:fts    # solo texto completo, sin descargar modelos
```
