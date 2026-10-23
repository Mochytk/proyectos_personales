import assert from 'node:assert/strict';
import { test } from 'node:test';

import { blobSize, type CaptureHeader, openCapture, sealCapture } from '../src/capture.ts';
import { decodePairingCode, deriveKeys, encodePairingCode, newPairing } from '../src/pairing.ts';
import { makeReceipt, verifyReceipt } from '../src/receipt.ts';
import { randomBytes, utf8 } from '../src/bytes.ts';

const header: CaptureHeader = { v: 1, type: 'text', mime: 'text/plain', captured_at: '2026-10-23T08:00:00-03:00' };

async function setup() {
  const pairing = newPairing('https://relay.example.com');
  const keys = await deriveKeys(pairing.kDev, pairing.deviceId);
  return { pairing, keys, captureId: randomBytes(16) };
}

test('the pairing code round-trips and carries everything the phone needs', () => {
  const pairing = newPairing('https://relay.example.com');
  const code = encodePairingCode(pairing);
  assert.match(code, /^sb1:[A-Za-z0-9_-]+$/);
  assert.deepEqual(decodePairingCode(code), pairing);
});

test('a malformed pairing code is rejected', () => {
  assert.throws(() => decodePairingCode('sb1:not-json'));
  assert.throws(() => decodePairingCode('otra-cosa'));
});

test('derived keys are not extractable', async () => {
  const { keys } = await setup();
  assert.equal(keys.kEnc.extractable, false);
  assert.equal(keys.kAck.extractable, false);
  await assert.rejects(crypto.subtle.exportKey('raw', keys.kEnc));
});

test('seal and open round-trip a capture with an audio body', async () => {
  const { pairing, keys, captureId } = await setup();
  const body = randomBytes(70_000);
  const blob = await sealCapture(keys.kEnc, pairing.deviceId, captureId, { ...header, type: 'voice' }, body);
  const opened = await openCapture(keys.kEnc, pairing.deviceId, captureId, blob);
  assert.equal(opened.header.type, 'voice');
  assert.deepEqual(opened.body, body);
});

test('random bytes can exceed the 64 KiB WebCrypto limit per call', () => {
  const bytes = randomBytes(200_000);
  assert.equal(bytes.length, 200_000);
  assert.notDeepEqual(bytes.subarray(150_000, 150_032), new Uint8Array(32));
});

test('a single flipped byte makes opening fail', async () => {
  const { pairing, keys, captureId } = await setup();
  const blob = await sealCapture(keys.kEnc, pairing.deviceId, captureId, header, utf8('hola'));
  blob[blob.length - 20] = (blob[blob.length - 20] ?? 0) ^ 0x01;
  await assert.rejects(openCapture(keys.kEnc, pairing.deviceId, captureId, blob));
});

test('a blob moved to another capture id or device id does not open', async () => {
  const { pairing, keys, captureId } = await setup();
  const blob = await sealCapture(keys.kEnc, pairing.deviceId, captureId, header, utf8('hola'));
  await assert.rejects(openCapture(keys.kEnc, pairing.deviceId, randomBytes(16), blob));
  await assert.rejects(openCapture(keys.kEnc, randomBytes(16), captureId, blob));
});

test('a blob sealed with another device key does not open', async () => {
  const a = await setup();
  const b = await setup();
  const blob = await sealCapture(a.keys.kEnc, a.pairing.deviceId, a.captureId, header, utf8('hola'));
  await assert.rejects(openCapture(b.keys.kEnc, a.pairing.deviceId, a.captureId, blob));
});

test('padding hides the exact length of short texts and of audio', async () => {
  const { pairing, keys } = await setup();
  const short = await sealCapture(keys.kEnc, pairing.deviceId, randomBytes(16), header, utf8('ok'));
  const longer = await sealCapture(keys.kEnc, pairing.deviceId, randomBytes(16), header, utf8('x'.repeat(3000)));
  assert.equal(short.length, longer.length);
  assert.equal(blobSize(70_000), blobSize(100_000));
  assert.notEqual(blobSize(70_000), blobSize(140_000));
});

test('a receipt verifies only for its own capture and key', async () => {
  const { keys, captureId } = await setup();
  const other = await setup();
  const receipt = await makeReceipt(keys.kAck, captureId);
  assert.equal(await verifyReceipt(keys.kAck, captureId, receipt), true);
  assert.equal(await verifyReceipt(keys.kAck, randomBytes(16), receipt), false);
  assert.equal(await verifyReceipt(other.keys.kAck, captureId, receipt), false);
  assert.equal(await verifyReceipt(keys.kAck, captureId, randomBytes(32)), false);
});
