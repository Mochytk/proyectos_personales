// Phone → relay → Mac, with the relay and the network simulated in memory.
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { base64url, randomBytes, sha256Hex, utf8 } from '../src/bytes.ts';
import { Device } from '../src/device.ts';
import { Hub } from '../src/hub.ts';
import { MemoryKV } from '../src/memory-kv.ts';
import { createRelay } from '../src/relay.ts';

const MARKER = 'MARCADOR-SECRETO-7f3a';

async function world() {
  const hubToken = base64url(randomBytes(32));
  const kv = new MemoryKV();
  const relay = createRelay({ HUB_TOKEN_SHA256: await sha256Hex(hubToken), store: kv });
  let online = true;
  const fetcher = (request: Request) => (online ? relay.fetch(request) : Promise.reject(new Error('offline')));
  const hub = new Hub('https://relay.example.com', hubToken, fetcher);
  const code = await hub.pairDevice('iphone');
  const device = await Device.fromPairingCode(code, fetcher);
  await device.activate();
  return { kv, hub, device, setOnline: (value: boolean) => (online = value) };
}

test('captures made offline arrive once each and the phone forgets them only after a valid receipt', async () => {
  const w = await world();
  w.setOnline(false);
  await w.device.captureText(`idea 1 ${MARKER}`);
  await w.device.captureText('idea 2');
  await w.device.captureAudio(randomBytes(80_000), 'audio/mp4');
  assert.equal(await w.device.flush(), 0);
  assert.equal(w.device.pending(), 3);

  w.setOnline(true);
  assert.equal(await w.device.flush(), 3);
  assert.equal(await w.hub.syncOnce(), 3);
  assert.equal(w.hub.vault.size, 3);
  assert.equal(await w.device.collectReceipts(), 3);
  assert.equal(w.device.pending(), 0);
});

test('a crash between writing the note and the ack does not duplicate it', async () => {
  const w = await world();
  await w.device.captureText('una sola vez');
  await w.device.flush();
  w.hub.failAckOnce = true;
  await assert.rejects(w.hub.syncOnce());
  assert.equal(w.hub.vault.size, 1);
  assert.equal(await w.hub.syncOnce(), 0); // already in the vault: only acked
  assert.equal(w.hub.vault.size, 1);
  assert.equal(await w.device.collectReceipts(), 1);
});

test('the relay never stores plaintext', async () => {
  const w = await world();
  await w.device.captureText(`texto privado ${MARKER}`);
  await w.device.flush();
  const needle = utf8(MARKER);
  for (const bytes of w.kv.allBytes()) {
    assert.equal(Buffer.from(bytes).indexOf(Buffer.from(needle)), -1);
  }
});

test('a hostile relay cannot make the phone drop an undelivered capture', async () => {
  const w = await world();
  await w.device.captureText('no la pierdas');
  await w.device.flush();
  const [captureId] = w.device.pendingIds();
  assert.ok(captureId);
  // The relay forges a receipt without the Mac ever downloading the capture.
  await w.kv.put(`rcpt:${captureId}`, JSON.stringify({ receipt: base64url(randomBytes(32)), device_id: w.device.deviceIdHex }));
  assert.equal(await w.device.collectReceipts(), 0);
  assert.equal(w.device.pending(), 1);
});

test('after revocation the hub ignores captures from that device', async () => {
  const w = await world();
  await w.device.captureText('antes de revocar');
  await w.device.flush();
  await w.hub.revoke(w.device.deviceIdHex);
  assert.equal(await w.hub.syncOnce(), 0);
  assert.equal(w.hub.vault.size, 0);
});
