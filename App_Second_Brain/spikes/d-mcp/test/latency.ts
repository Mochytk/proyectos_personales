// Latency through the real MCP round trip with N synthetic notes (default 10,000).
// Usage: node test/latency.ts [notes]
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { Client } from '@modelcontextprotocol/client';
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';

const WORDS = (
  'idea proyecto feria titulo ramo redes certamen bus gimnasio receta compras lectura enlace ' +
  'búsqueda híbrida embeddings índice sqlite markdown claude reunión equipo deploy merge frontend ' +
  'backend tarea pendiente viaje valparaíso película libro práctica magíster reflexión semana'
).split(' ');

function sentence(seed: number, length: number): string {
  let state = seed;
  const words: string[] = [];
  for (let i = 0; i < length; i += 1) {
    state = (state * 1103515245 + 12345) % 2 ** 31; // deterministic LCG
    words.push(WORDS[state % WORDS.length] ?? 'nota');
  }
  return words.join(' ');
}

function percentile(values: number[], p: number): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))] ?? Number.NaN;
}

const count = Number(process.argv[2] ?? 10_000);
const dir = mkdtempSync(join(tmpdir(), 'sb-spike-d-'));
try {
  for (let i = 0; i < count; i += 1) {
    const id = `01SYN${String(i).padStart(21, '0')}`;
    const body = `${sentence(i + 1, 60)}\n\n${sentence(i + 7, 60)}`;
    writeFileSync(
      join(dir, `${id}.md`),
      `---\nid: ${id}\ntitle: ${sentence(i + 3, 5)}\ntype: note\nstatus: ${i % 10 === 0 ? 'inbox' : 'processed'}\n` +
        `tags: [sintetica]\ncreated_at: 2026-10-01T10:00:00-03:00\n---\n\n${body}\n`,
    );
  }

  const serverPath = fileURLToPath(new URL('../server.ts', import.meta.url));
  const client = new Client({ name: 'latency', version: '0.0.0' });
  const started = performance.now();
  await client.connect(
    new StdioClientTransport({
      command: process.execPath,
      args: [serverPath],
      env: { SB_VAULT_DIR: dir, PATH: process.env.PATH ?? '' },
      stderr: 'ignore',
    }),
  );
  const startupMs = performance.now() - started;

  const queries = ['feria proyecto', 'búsqueda híbrida', 'certamen redes', 'receta compras', 'viaje valparaíso'];
  const searchMs: number[] = [];
  let maxChars = 0;
  for (let i = 0; i < 50; i += 1) {
    const t0 = performance.now();
    const result = await client.callTool({
      name: 'search_notes',
      arguments: { query: queries[i % queries.length] ?? 'idea', k: 5 },
    });
    searchMs.push(performance.now() - t0);
    const [block] = result.content as { text: string }[];
    maxChars = Math.max(maxChars, block?.text.length ?? 0);
  }
  const getMs: number[] = [];
  for (let i = 0; i < 20; i += 1) {
    const t0 = performance.now();
    await client.callTool({ name: 'get_note', arguments: { id: `01SYN${String(i * 7).padStart(21, '0')}` } });
    getMs.push(performance.now() - t0);
  }
  await client.close();

  const round = (value: number): number => Math.round(value * 10) / 10;
  console.log(
    JSON.stringify(
      {
        notes: count,
        node: process.version,
        startup_ms: round(startupMs),
        search_p50_ms: round(percentile(searchMs, 50)),
        search_p95_ms: round(percentile(searchMs, 95)),
        get_note_p50_ms: round(percentile(getMs, 50)),
        max_search_response_chars: maxChars,
      },
      null,
      2,
    ),
  );
} finally {
  rmSync(dir, { recursive: true, force: true });
}
