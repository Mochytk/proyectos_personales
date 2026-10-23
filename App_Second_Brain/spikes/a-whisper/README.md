# Spike A · Transcripción local en tu Mac

> Código desechable: vive solo en la rama `spike/whisper-benchmark` y no se fusiona. El informe con la recomendación irá a `docs/spikes/`.

**Pregunta:** ¿qué combinación de motor y modelo transcribe mejor tu español de Chile (con inglés técnico) en tu M1 de 8 GB, rápido y sin dejar el Mac inutilizable?

**Qué se compara:**

| Corrida | Motor | Modelo | Qué mide |
| --- | --- | --- | --- |
| `wcpp-small` | whisper.cpp (GPU Metal) | small (466 MiB) | Base liviana |
| `wcpp-turbo-q5` | whisper.cpp (GPU Metal) | large-v3-turbo cuantizado q5_0 (547 MiB) | Candidato principal |
| `wcpp-turbo-q5-prompt` | whisper.cpp | el mismo, con una pista de vocabulario | Si una lista de términos ayuda |
| `wcpp-turbo-q5-background` | whisper.cpp con `taskpolicy -b` | el mismo, en prioridad baja | Cuánto se frena si no molesta al resto del Mac |
| `fw-small-int8` | faster-whisper (solo CPU) | small, int8 | La alternativa en Python |
| `fw-turbo-int8` | faster-whisper (solo CPU) | large-v3-turbo, int8 | La alternativa en Python, modelo grande |
| `wcpp-turbo-f16` (opcional, `--full`) | whisper.cpp | large-v3-turbo sin cuantizar (1,5 GiB) | Cuánta calidad se pierde al cuantizar |

**Métricas:** WER (porcentaje de palabras mal transcritas), WER sin contar tildes (lo que importa para buscar), términos clave bien escritos (chilenismos e inglés técnico), velocidad (cuántas veces más rápido que el tiempo real) y RAM máxima.

## Qué necesitas

- Unos 40 minutos, el Mac enchufado y unos 4 GB libres (tienes de sobra).
- [Homebrew](https://brew.sh). Revisa si lo tienes con `brew --version`.

## Paso 1 · Grabar los 3 audios (en el iPhone)

1. Abre la app **Notas de Voz** y deja la calidad en *Comprimido*, que es lo más parecido a lo que usará la captura real.
2. Lee cada guion a tu ritmo normal, como si fuera una nota tuya. Si te equivocas, sigue, porque eso también es realista:
   - [`refs/guion-1.txt`](refs/guion-1.txt): en una pieza tranquila.
   - [`refs/guion-2.txt`](refs/guion-2.txt): caminando en la calle o en un paradero, con ruido de verdad.
   - [`refs/guion-3.txt`](refs/guion-3.txt): un poco más rápido de lo normal.
3. Renombra las grabaciones a `guion-1`, `guion-2` y `guion-3`, y pásalas al Mac por AirDrop.
4. En el Mac, muévelas a esta carpeta (fuera del repo):

```sh
mkdir -p ~/SegundoCerebro-spikes/a/audio
mv ~/Downloads/guion-*.m4a ~/SegundoCerebro-spikes/a/audio/
```

Los audios nunca se suben al repo, ni a ningún otro lado.

## Paso 2 · Instalar las herramientas

```sh
brew install whisper.cpp uv
```

Qué instala y qué revisé:

- **whisper.cpp 1.9.5** (licencia MIT, de `ggml-org`). Es la fórmula oficial de Homebrew, que antes se llamaba `whisper-cpp`. Homebrew la compila en su CI sin acceso a red y fija el SHA-256 de cada binario. Trae como dependencias `ggml`, `llama.cpp` y `sdl2-compat`. Instala el comando `whisper-cli`. No descarga modelos.
- **uv** (de Astral, licencias MIT y Apache-2.0): gestiona Python y sus paquetes. Si no tienes Python 3.12, uv descarga su propia copia (de `python-build-standalone`, también de Astral).
- Con `uv sync --locked` se instalan 26 paquetes de Python **con versiones y hashes fijados** en `uv.lock`, todos publicados antes del 22-10-2026. Los principales: `faster-whisper 1.2.1` (MIT), `ctranslate2 4.8.3` (MIT), `onnxruntime` (MIT), `av` (BSD; trae bibliotecas de FFmpeg) y `huggingface-hub` (Apache-2.0).
- **Modelos** (unos 3,2 GB, desde Hugging Face). Los de whisper.cpp se comparan con el SHA-1 publicado en el repo oficial; los de faster-whisper, con el SHA-256 que publica Hugging Face para esa revisión. Si alguno no calza, el script lo borra y se detiene.

## Paso 3 · Bajar el código del spike

En tu clon del repo (no cambia la rama en la que estés trabajando):

```sh
git fetch origin spike/whisper-benchmark
git worktree add ~/SegundoCerebro-spikes/repo-a origin/spike/whisper-benchmark
cd ~/SegundoCerebro-spikes/repo-a/App_Second_Brain/spikes/a-whisper
```

## Paso 4 · Correr el benchmark

Cierra las apps pesadas (para que la RAM medida sea la del modelo) y corre:

```sh
uv sync --locked
uv run python bench.py --audio-dir ~/SegundoCerebro-spikes/a/audio
```

Tarda entre 15 y 30 minutos, la mayor parte en las corridas de faster-whisper, que no usan la GPU. Al final imprime una tabla.

## Paso 5 · Mandarme el resultado

Copia y pégame la tabla completa, que también queda en `~/SegundoCerebro-spikes/a/results.md`. Solo trae números, tu chip y versiones, y la lista de términos clave de los guiones sintéticos que fallaron. **No trae tus audios ni las transcripciones completas**, que quedan en `~/SegundoCerebro-spikes/a/transcripciones/` por si quieres mirarlas.

Si en la columna **Metal** sale "no" para las corridas `wcpp-*`, avísame: significa que whisper.cpp no está usando la GPU, y eso se corrige antes de sacar conclusiones.

## Limpieza (cuando cerremos la fase 0)

```sh
rm -rf ~/SegundoCerebro-spikes/a/models     # unos 3,2 GB de modelos
git worktree remove ~/SegundoCerebro-spikes/repo-a
```

Los audios conviene guardarlos hasta cerrar la fase 0, por si hay que repetir una medición.

## Pruebas del script

```sh
uv run python -m unittest
```

Prueban el cálculo de WER y de términos clave, la lectura de RAM de `/usr/bin/time -l` y el armado del informe.
