// Spike D: minimal read-only MCP server over stdio (throwaway code, never merged).
// Run with Node 24: `node server.ts`. Logs go to stderr only; stdout belongs to the protocol.
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { McpServer } from '@modelcontextprotocol/server';
import { StdioServerTransport } from '@modelcontextprotocol/server/stdio';
import * as z from 'zod/v4';

import { errorResult, untrustedResult } from './src/envelope.ts';
import { SearchIndex } from './src/search-index.ts';
import { loadVault } from './src/vault.ts';

const MAX_BODY_CHARS = 5000;
const ULID_LIKE = /^[0-9A-Z]{26}$/;
const READ_ONLY = { readOnlyHint: true, openWorldHint: false } as const;

const here = dirname(fileURLToPath(import.meta.url));
const vaultDir = resolve(process.env.SB_VAULT_DIR ?? join(here, 'vault-sintetico'));

function log(event: Record<string, unknown>): void {
  // One JSON line per event, never with note content or query text (RF-6.7).
  process.stderr.write(`${JSON.stringify({ ts: new Date().toISOString(), ...event })}\n`);
}

async function timed<T>(tool: string, args: Record<string, unknown>, run: () => T): Promise<T> {
  const started = performance.now();
  const result = run();
  const text = (result as { content?: { text?: string }[] }).content?.[0]?.text ?? '';
  log({ tool, args, ms: Math.round((performance.now() - started) * 10) / 10, out_chars: text.length });
  return Promise.resolve(result);
}

const loadStarted = performance.now();
const { notes, skipped } = loadVault(vaultDir);
const index = SearchIndex.build(notes);
log({ event: 'ready', notes: notes.length, skipped, ms: Math.round(performance.now() - loadStarted) });

const server = new McpServer({ name: 'segundo-cerebro-spike', version: '0.0.0' });

server.registerTool(
  'search_notes',
  {
    title: 'Buscar notas',
    description:
      'Busca en la bóveda por palabras (sin importar tildes). Devuelve ids, títulos y fragmentos ' +
      'cortos; usa get_note para leer una nota completa.',
    annotations: READ_ONLY,
    inputSchema: z.object({
      query: z.string().min(1).max(200),
      k: z.number().int().min(1).max(20).default(5),
    }),
  },
  ({ query, k }) =>
    timed('search_notes', { query_chars: query.length, k }, () =>
      untrustedResult({
        resultados: index.search(query, k).map((hit) => ({
          id: hit.id,
          titulo: hit.title,
          tipo: hit.type,
          estado: hit.status,
          fecha: hit.createdAt,
          fragmento: hit.snippet,
          puntaje: hit.score,
        })),
      }),
    ),
);

server.registerTool(
  'get_note',
  {
    title: 'Leer una nota',
    description: 'Devuelve una nota completa por su id (hasta 5000 caracteres del cuerpo).',
    annotations: READ_ONLY,
    inputSchema: z.object({ id: z.string().regex(ULID_LIKE, 'id con formato ULID') }),
  },
  ({ id }) =>
    timed('get_note', {}, () => {
      const note = index.get(id);
      if (!note) return errorResult('No existe una nota con ese id.');
      return untrustedResult({
        id: note.id,
        titulo: note.title,
        tipo: note.type,
        estado: note.status,
        etiquetas: note.tags,
        fecha: note.createdAt,
        cuerpo: note.body.slice(0, MAX_BODY_CHARS),
        ...(note.body.length > MAX_BODY_CHARS ? { truncado: true } : {}),
      });
    }),
);

server.registerTool(
  'list_inbox',
  {
    title: 'Ver la bandeja',
    description: 'Lista las notas sin procesar (bandeja de entrada), de la más nueva a la más antigua.',
    annotations: READ_ONLY,
    inputSchema: z.object({ limit: z.number().int().min(1).max(50).default(20) }),
  },
  ({ limit }) =>
    timed('list_inbox', { limit }, () =>
      untrustedResult({
        resultados: index.inbox(limit).map((note) => ({
          id: note.id,
          titulo: note.title,
          tipo: note.type,
          fecha: note.createdAt,
        })),
      }),
    ),
);

server.registerTool(
  'vault_stats',
  {
    title: 'Resumen de la bóveda',
    description: 'Cuenta las notas por tipo y estado, y las etiquetas distintas.',
    annotations: READ_ONLY,
  },
  () =>
    timed('vault_stats', {}, () => ({
      content: [{ type: 'text' as const, text: JSON.stringify(index.stats()) }],
    })),
);

await server.connect(new StdioServerTransport());
