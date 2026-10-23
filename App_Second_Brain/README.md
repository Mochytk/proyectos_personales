# Segundo Cerebro

Un lugar para capturar ideas rápido y encontrarlas después. Grabas una nota de voz en el iPhone, escribes algo o pegas un enlace, y la app lo transcribe, lo guarda como Markdown y lo deja listo para buscar. Claude puede consultar tus notas desde Claude Code o Claude Desktop por un servidor MCP local, sin API de pago.

> Estado: **fase 0** (descubrimiento, modelo de amenazas y spikes). Todavía no hay una app que usar.

## Principios

- **Los archivos Markdown son la fuente de verdad.** La bóveda es una carpeta de `.md` con metadatos YAML, compatible con editores como Obsidian. El índice de búsqueda se puede borrar y reconstruir.
- **Local-first.** La transcripción y la búsqueda corren en el Mac, sin red.
- **Cifrado de extremo a extremo.** Entre el iPhone y el Mac solo viajan blobs cifrados; el servidor intermedio nunca ve audio ni texto.
- **Claude por MCP.** El servidor MCP es local (stdio). Las notas son contenido no confiable y Claude solo puede proponer cambios, que tú apruebas.
- **Búsqueda medible.** Un conjunto de preguntas de oro mide la calidad (recall@5 y MRR) en cada cambio.

## Estructura prevista

| Carpeta | Qué es |
| --- | --- |
| `apps/mcp` | Servidor MCP local (stdio) |
| `apps/desktop` | App de escritorio (Electron + React) |
| `apps/capture-web` | Captura desde el iPhone (PWA) |
| `apps/relay` | Buzón cifrado en Cloudflare |
| `packages/core` | Bóveda, índice y búsqueda |
| `packages/crypto` | Cifrado y emparejamiento |
| `packages/shared` | Esquemas, tipos y utilidades |
| `services/ingest` | Transcripción e importación de documentos |
| `eval/` | Evaluación de la búsqueda |

## Desarrollo

Requisitos: Node 24 y pnpm 10 (vía `corepack`).

```sh
cd App_Second_Brain
corepack enable
pnpm install
pnpm lint && pnpm typecheck && pnpm test
```

Escaneo de secretos antes de cada commit (una vez por clon, desde la raíz del repo):

```sh
brew install gitleaks
ln -s ../../App_Second_Brain/scripts/pre-commit .git/hooks/pre-commit
```

## Documentación

- `CLAUDE.md`: reglas para trabajar en el proyecto (stack, comandos, Git y seguridad).
- `docs/`: arquitectura, modelo de amenazas, decisiones (ADR), spikes y runbook, a medida que existan.

## Privacidad

Este repositorio es público y nunca contiene notas, audios, modelos ni claves. Los datos de prueba son sintéticos.
