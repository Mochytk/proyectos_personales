// Smoke test of the spike page in Chromium with a fake microphone. It checks the logic,
// not Safari: the real answers come from the iPhone (see README).
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { after, before, test } from 'node:test';
import { fileURLToPath } from 'node:url';

import { chromium } from 'playwright';

const root = fileURLToPath(new URL('../pwa/', import.meta.url));
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.webmanifest': 'application/manifest+json' };
let server;
let browser;
let origin;

before(async () => {
  server = createServer(async (request, response) => {
    const path = new URL(request.url, 'http://localhost').pathname;
    const file = join(root, path === '/' ? 'index.html' : path.slice(1));
    try {
      const body = await readFile(file);
      response.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' });
      response.end(body);
    } catch {
      response.writeHead(404).end();
    }
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  origin = `http://localhost:${server.address().port}`;
  browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || undefined,
    args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'],
  });
});

after(async () => {
  await browser?.close();
  server?.close();
});

async function readResults(page) {
  await page.waitForFunction(() => document.getElementById('resultados').textContent.startsWith('{'));
  return JSON.parse(await page.locator('#resultados').textContent());
}

test('records, encrypts, queues and keeps a non-extractable key across reloads, all on-device', async () => {
  const context = await browser.newContext();
  const page = await context.newPage();
  const foreign = [];
  page.on('request', (request) => {
    if (!request.url().startsWith(origin) && !request.url().startsWith('blob:')) foreign.push(request.url());
  });

  await page.goto(origin);
  const first = await readResults(page);
  assert.equal(first.key.extractable, false);
  assert.equal(first.key.fromPreviousVisit, false);
  assert.equal(first.randomOver64KiB.startsWith('rechazado'), true);

  await page.getByRole('button', { name: 'Grabar' }).click();
  await page.getByRole('button', { name: 'Detener' }).waitFor();
  await page.waitForTimeout(2000);
  await page.getByRole('button', { name: 'Detener' }).click();
  await page.waitForFunction(() => document.getElementById('rec-estado').textContent.startsWith('Listo:'));
  const recorded = await readResults(page);
  const [attempt] = recorded.attempts;
  assert.ok(attempt.bytes > 0);
  assert.equal(attempt.encryption.ok, true);
  assert.equal(recorded.queue, 1);

  await page.reload();
  const again = await readResults(page);
  assert.equal(again.key.fromPreviousVisit, true);
  assert.equal(again.queue, 1);
  assert.deepEqual(foreign, []);
  await context.close();
});
