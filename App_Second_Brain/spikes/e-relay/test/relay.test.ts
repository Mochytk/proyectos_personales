import assert from 'node:assert/strict';
import { test } from 'node:test';

import { base64url, hex, randomBytes, sha256Hex } from '../src/bytes.ts';
import { MemoryKV } from '../src/memory-kv.ts';
import { createRelay, MAX_BLOB_BYTES } from '../src/relay.ts';

const BASE = 'https://relay.example.com';

async function setup() {
  const hubToken = base64url(randomBytes(32));
  const kv = new MemoryKV();
  const relay = createRelay({ HUB_TOKEN_SHA256: await sha256Hex(hubToken), store: kv });
  const call = (method: string, path: string, init: { token?: string; device?: string; body?: BodyInit } = {}) => {
    const headers = new Headers();
    if (init.token) headers.set('authorization', `Bearer ${init.token}`);
    if (init.device) headers.set('x-device-id', init.device);
    return relay.fetch(new Request(`${BASE}${path}`, { method, headers, body: init.body ?? null }));
  };
  return { hubToken, kv, call };
}

async function pairedDevice(ctx: Awaited<ReturnType<typeof setup>>) {
  const deviceId = hex(randomBytes(16));
  const deviceToken = base64url(randomBytes(32));
  const registered = await ctx.call('POST', '/v1/devices', {
    token: ctx.hubToken,
    body: JSON.stringify({ device_id: deviceId, token_sha256: await sha256Hex(deviceToken), name: 'iphone' }),
  });
  assert.equal(registered.status, 201);
  const activated = await ctx.call('POST', '/v1/devices/activate', { token: deviceToken, device: deviceId });
  assert.equal(activated.status, 200);
  return { deviceId, deviceToken };
}

test('only the hub can register devices', async () => {
  const ctx = await setup();
  const response = await ctx.call('POST', '/v1/devices', {
    token: 'wrong',
    body: JSON.stringify({ device_id: hex(randomBytes(16)), token_sha256: 'a'.repeat(64), name: 'x' }),
  });
  assert.equal(response.status, 401);
});

test('a registered but not activated device expires after 10 minutes', async () => {
  const ctx = await setup();
  const deviceId = hex(randomBytes(16));
  await ctx.call('POST', '/v1/devices', {
    token: ctx.hubToken,
    body: JSON.stringify({ device_id: deviceId, token_sha256: 'a'.repeat(64), name: 'x' }),
  });
  assert.equal(ctx.kv.ttlOf(`dev:${deviceId}`), 600);
});

test('uploads need an activated device and its token', async () => {
  const ctx = await setup();
  const { deviceId, deviceToken } = await pairedDevice(ctx);
  const captureId = hex(randomBytes(16));
  const body = randomBytes(5000);
  assert.equal((await ctx.call('PUT', `/v1/captures/${captureId}`, { body })).status, 401);
  assert.equal(
    (await ctx.call('PUT', `/v1/captures/${captureId}`, { token: 'nope', device: deviceId, body })).status,
    401,
  );
  assert.equal(
    (await ctx.call('PUT', `/v1/captures/${captureId}`, { token: deviceToken, device: deviceId, body })).status,
    201,
  );
});

test('uploading the same capture twice is idempotent; different content is a conflict', async () => {
  const ctx = await setup();
  const { deviceId, deviceToken } = await pairedDevice(ctx);
  const captureId = hex(randomBytes(16));
  const body = randomBytes(5000);
  const put = (data: Uint8Array<ArrayBuffer>) =>
    ctx.call('PUT', `/v1/captures/${captureId}`, { token: deviceToken, device: deviceId, body: data });
  assert.equal((await put(body)).status, 201);
  assert.equal((await put(body)).status, 200);
  assert.equal((await put(randomBytes(5000))).status, 409);
});

test('oversized blobs and malformed ids are rejected without touching storage', async () => {
  const ctx = await setup();
  const { deviceId, deviceToken } = await pairedDevice(ctx);
  const before = ctx.kv.writes;
  const big = await ctx.call('PUT', `/v1/captures/${hex(randomBytes(16))}`, {
    token: deviceToken,
    device: deviceId,
    body: new Uint8Array(MAX_BLOB_BYTES + 1),
  });
  assert.equal(big.status, 413);
  const bad = await ctx.call('PUT', '/v1/captures/..%2Fdev%3Ax', { token: deviceToken, device: deviceId, body: 'x' });
  assert.equal(bad.status, 400);
  assert.equal(ctx.kv.writes, before);
});

test('ack deletes the blob and keeps a receipt the device can read', async () => {
  const ctx = await setup();
  const { deviceId, deviceToken } = await pairedDevice(ctx);
  const captureId = hex(randomBytes(16));
  await ctx.call('PUT', `/v1/captures/${captureId}`, { token: deviceToken, device: deviceId, body: randomBytes(100) });
  const receipt = base64url(randomBytes(32));
  const ack = await ctx.call('POST', `/v1/captures/${captureId}/ack`, {
    token: ctx.hubToken,
    body: JSON.stringify({ receipt }),
  });
  assert.equal(ack.status, 200);
  assert.equal((await ctx.call('GET', `/v1/captures/${captureId}`, { token: ctx.hubToken })).status, 404);
  const read = await ctx.call('GET', `/v1/captures/${captureId}/receipt`, { token: deviceToken, device: deviceId });
  assert.deepEqual(await read.json(), { receipt });
});

test('a revoked device can no longer upload', async () => {
  const ctx = await setup();
  const { deviceId, deviceToken } = await pairedDevice(ctx);
  assert.equal((await ctx.call('DELETE', `/v1/devices/${deviceId}`, { token: ctx.hubToken })).status, 200);
  const put = await ctx.call('PUT', `/v1/captures/${hex(randomBytes(16))}`, {
    token: deviceToken,
    device: deviceId,
    body: randomBytes(10),
  });
  assert.equal(put.status, 401);
});

test('errors never leak internals', async () => {
  const ctx = await setup();
  const response = await ctx.call('GET', '/v1/nada', { token: ctx.hubToken });
  assert.equal(response.status, 404);
  assert.deepEqual(await response.json(), { error: 'not_found' });
});
