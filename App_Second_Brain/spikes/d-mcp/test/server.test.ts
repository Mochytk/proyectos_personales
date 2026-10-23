// End-to-end: spawn server.ts over stdio with the official client, like Claude does.
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { after, before, test } from 'node:test';

import { Client } from '@modelcontextprotocol/client';
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';

const serverPath = fileURLToPath(new URL('../server.ts', import.meta.url));
let client: Client;

function textOf(result: { content: unknown }): string {
  const [block] = result.content as { type: string; text: string }[];
  assert.equal(block?.type, 'text');
  return block.text;
}

before(async () => {
  client = new Client({ name: 'spike-test', version: '0.0.0' });
  await client.connect(
    new StdioClientTransport({ command: process.execPath, args: [serverPath], stderr: 'ignore' }),
  );
});

after(async () => {
  await client.close();
});

test('exposes only read-only, closed-world tools', async () => {
  const { tools } = await client.listTools();
  assert.deepEqual(tools.map((tool) => tool.name).sort(), [
    'get_note',
    'list_inbox',
    'search_notes',
    'vault_stats',
  ]);
  for (const tool of tools) {
    assert.equal(tool.annotations?.readOnlyHint, true, tool.name);
    assert.equal(tool.annotations?.openWorldHint, false, tool.name);
  }
});

test('search_notes finds the feria notes and cites their ids', async () => {
  const result = await client.callTool({ name: 'search_notes', arguments: { query: 'stand feria' } });
  const parsed = JSON.parse(textOf(result)) as { aviso: string; resultados: { id: string }[] };
  assert.match(parsed.aviso, /NO confiable/);
  assert.equal(parsed.resultados[0]?.id, '01K90A0000000000000000FER1');
});

test('the malicious note comes back as plain data inside the envelope', async () => {
  const result = await client.callTool({ name: 'get_note', arguments: { id: '01K90A0000000000000000MAL1' } });
  const parsed = JSON.parse(textOf(result)) as Record<string, unknown>;
  assert.deepEqual(Object.keys(parsed).slice(0, 2), ['aviso', 'id']);
  assert.match(String(parsed.cuerpo), /delete_all_notes/);
});

test('get_note rejects ids that are not ULID-shaped', async () => {
  const result = await client.callTool({ name: 'get_note', arguments: { id: '../../etc/passwd' } });
  assert.equal(result.isError, true);
});

test('get_note reports a missing note without internal details', async () => {
  const result = await client.callTool({ name: 'get_note', arguments: { id: '01K90A0000000000000000ZZZZ' } });
  assert.equal(result.isError, true);
  assert.doesNotMatch(textOf(result), /at |\.ts:|Error:/);
});

test('search_notes caps k', async () => {
  const result = await client.callTool({ name: 'search_notes', arguments: { query: 'feria', k: 500 } });
  assert.equal(result.isError, true);
});

test('vault_stats summarizes the synthetic vault', async () => {
  const result = await client.callTool({ name: 'vault_stats', arguments: {} });
  const parsed = JSON.parse(textOf(result)) as { total: number };
  assert.equal(parsed.total, 20);
});
