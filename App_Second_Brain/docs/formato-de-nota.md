# Formato de la bóveda y de las notas (borrador, fase 0)

> Estado: **propuesta** para revisar en la PR. Se vuelve ADR cuando la apruebes. Versión del formato: `1`.

La bóveda es la fuente de verdad. Todo lo demás (índice, embeddings, cola de trabajos) se puede borrar y reconstruir desde ella.

## Estructura de carpetas

```
<bóveda>/                      # carpeta configurable, fuera del repo del código
├─ inbox/                      # capturas sin procesar: <id>.md
├─ notes/AAAA/MM/              # notas procesadas: <slug>-<sufijo>.md
├─ attachments/AAAA/MM/        # audios, PDFs originales, imágenes y transcripciones crudas
├─ .second-brain/              # metadatos de la bóveda (sí van en tus respaldos)
│  ├─ vault.json               # { "schema": 1, "created_at": ... }
│  └─ proposals/               # propuestas de Claude pendientes: <id>.json
└─ .index/                     # índice derivado (SQLite). Fuera de respaldos y de git
```

- `AAAA/MM` sale de `captured_at` en `America/Santiago`.
- Las propuestas viven en la bóveda, no en el índice: son estado tuyo (pendiente de aprobar) y deben sobrevivir a una reconstrucción del índice.
- **No pongas la bóveda en una carpeta sincronizada** (iCloud Drive, Dropbox): SQLite en modo WAL se puede corromper si otro proceso copia `.index/` a mitad de una escritura. El respaldo se hace con Time Machine o con la exportación (HU-16).

## Nombres de archivo

- **Bandeja:** `inbox/<id>.md`. El nombre no depende del contenido, así que capturar es instantáneo.
- **Procesada:** al salir de la bandeja se mueve a `notes/AAAA/MM/<slug>-<sufijo>.md`. `slug` sale del título (minúsculas, sin tildes, máximo 60 caracteres) y `sufijo` son los últimos 6 caracteres del `id`, para que dos títulos iguales no choquen.
- **El archivo no se renombra solo** si después cambia el título; así no se rompen los enlaces de otros editores. Renombrar es una acción explícita.
- El `id` es la identidad real; el nombre de archivo es solo para humanos.

## Identificadores

- `id`: **ULID** (26 caracteres, ordenable por tiempo, generado con `crypto.getRandomValues`). Se genera una vez y no cambia nunca, aunque la nota se mueva.
- `capture_id`: 16 bytes aleatorios (en hexadecimal) generados **en el dispositivo que capturó** (iPhone o Mac). Permite que una captura reintentada no se duplique (RF-8.4): si llega una captura con un `capture_id` que ya existe en la bóveda, se confirma y se descarta. No es un ULID, para no revelarle al relay la hora de la captura (ver `protocolo-sincronizacion.md`).

## Frontmatter (YAML)

```yaml
---
schema: 1
id: 01K8ZQ3M5V7X9B1D3F5H7K9M2P
title: Idea para el stand de la feria
type: voice            # idea | voice | link | document | import | note
status: inbox          # inbox | processed | archived
tags: [feria, proyecto]
summary: ''
source:
  kind: device         # device | url | file | import | manual
  device: iphone-1     # nombre corto del dispositivo emparejado (kind: device)
  capture_id: 3f9a1c0e7b2d4e6f8a1b3c5d7e9f0a2b
  # url: https://...   # kind: url
  # file: informe.pdf  # kind: file | import (nombre original, sin la ruta)
language: es-CL
created_at: 2026-10-23T08:15:02-03:00
captured_at: 2026-10-23T08:14:30-03:00
updated_at: 2026-10-23T08:20:11-03:00
links: []              # ids de notas relacionadas
audio: attachments/2026/10/01K8ZQ3M5V7X9B1D3F5H7K9M2P.m4a
transcript: attachments/2026/10/01K8ZQ3M5V7X9B1D3F5H7K9M2P.transcript.json
processed_by: rules    # manual | claude | rules
checksum: sha256:9f2c...   # del cuerpo, calculado la última vez que la app escribió la nota
---
```

Reglas:

- **Fechas** en RFC 3339 con el desfase de `America/Santiago` (horario de verano incluido). En pantalla se muestran como `dd-mm-aaaa`.
- **Campos desconocidos se conservan.** Si otro editor (por ejemplo Obsidian) agrega campos, la app no los borra al reescribir.
- `schema` permite migrar el formato. Cada migración es versionada, reversible y va en su propio commit (RNF-13).
- `audio` y `transcript` son opcionales y relativos a la bóveda. Una ruta que intente salir de la bóveda (`..`, absoluta, enlace simbólico) se rechaza.
- `checksum` sirve para detectar ediciones externas (HU-8). La app solo lo actualiza cuando **ella** escribe. Si el hash real del cuerpo no coincide, la nota fue editada por fuera: se reindexa y nada la pisa sin aviso.

## Cuerpo

- Markdown plano. La app lo muestra **sin HTML crudo ni scripts** (se sanitiza al renderizar; RNF-5).
- **Voz:** la transcripción ya limpia (puntuación y párrafos). La cruda, con segmentos y marcas de tiempo, queda en `transcript` (JSON) y nunca se borra sin que lo decidas (RF-3.3).
- **Enlace:** la URL, el título y, solo si lo apruebas, el contenido extraído en texto (nunca ejecutando scripts de la página).
- **Documento:** el Markdown que produce MarkItDown, con los títulos de sección originales. El archivo original queda en `attachments/`.

## Propuestas de Claude

`.second-brain/proposals/<id>.json`:

```json
{
  "schema": 1,
  "id": "01K8ZR...",
  "note_id": "01K8ZQ3M5V7X9B1D3F5H7K9M2P",
  "base_checksum": "sha256:9f2c...",
  "created_at": "2026-10-23T09:02:11-03:00",
  "created_by": "claude",
  "changes": {
    "title": "Stand de la feria: ideas de diseño",
    "tags": { "add": ["diseño"], "remove": [] },
    "summary": "...",
    "links": { "add": ["01K8..."], "remove": [] },
    "status": "processed"
  },
  "state": "pending"
}
```

- En la v1, **Claude solo propone cambios de metadatos** (título, etiquetas, resumen, enlaces y estado). No reescribe el cuerpo de tus notas. Así una nota con instrucciones maliciosas no puede usar a Claude para alterar el contenido de otras.
- `state`: `pending` → `approved` (lo apruebas tú en la app o con un comando local) → `applied`, o bien `rejected`.
- Al aplicar, si el `checksum` actual de la nota no es `base_checksum`, la propuesta queda en **conflicto** y se te muestra la diferencia. Nunca se aplica a ciegas.

## Archivar y borrar

- **Archivar** = `status: archived`. La nota no se mueve, sigue buscable con un filtro y se recupera cambiando el estado (HU-9).
- No hay borrado definitivo desde la app ni desde el MCP en la v1. Si quieres borrar algo para siempre, lo borras tú en Finder y el índice se actualiza solo.

## Escrituras seguras

- Toda escritura es **atómica**: se escribe un archivo temporal en la misma carpeta, se hace `fsync` y luego `rename`. Un corte de luz deja el archivo viejo o el nuevo, nunca uno a medias.
- Antes de reescribir una nota, la app compara el `checksum` con el que leyó (concurrencia optimista). Si alguien la cambió entretanto, no la pisa.
- Un vigilante de archivos detecta ediciones externas y reindexa de forma incremental. `reindex --full` reconstruye todo (RF-1.4).
