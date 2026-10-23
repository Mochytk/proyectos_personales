// Pairing material shown as a QR on the Mac; it never goes through the relay.
import { base64url, fromBase64url, fromUtf8, randomBytes, utf8 } from './bytes.ts';

export interface Pairing {
  v: 1;
  relay: string;
  deviceId: Uint8Array<ArrayBuffer>; // 16 random bytes
  deviceToken: string; // base64url of 32 random bytes; authenticates uploads only
  kDev: Uint8Array<ArrayBuffer>; // 32 random bytes; root of this device's keys
}

export interface DeviceKeys {
  kEnc: CryptoKey; // AES-256-GCM for captures
  kAck: CryptoKey; // HMAC-SHA-256 for delivery receipts
}

const PREFIX = 'sb1:';

export function newPairing(relay: string): Pairing {
  return { v: 1, relay, deviceId: randomBytes(16), deviceToken: base64url(randomBytes(32)), kDev: randomBytes(32) };
}

export function encodePairingCode(pairing: Pairing): string {
  const json = JSON.stringify({
    v: pairing.v,
    relay: pairing.relay,
    device_id: base64url(pairing.deviceId),
    device_token: pairing.deviceToken,
    k_dev: base64url(pairing.kDev),
  });
  return PREFIX + base64url(utf8(json));
}

export function decodePairingCode(code: string): Pairing {
  if (!code.startsWith(PREFIX)) throw new Error('not a pairing code');
  const raw = JSON.parse(fromUtf8(fromBase64url(code.slice(PREFIX.length)))) as Record<string, unknown>;
  const { v, relay, device_id, device_token, k_dev } = raw;
  if (v !== 1 || typeof relay !== 'string' || !relay.startsWith('https://')) throw new Error('bad pairing code');
  if (typeof device_id !== 'string' || typeof device_token !== 'string' || typeof k_dev !== 'string') {
    throw new Error('bad pairing code');
  }
  const deviceId = fromBase64url(device_id);
  const kDev = fromBase64url(k_dev);
  if (deviceId.length !== 16 || kDev.length !== 32 || fromBase64url(device_token).length !== 32) {
    throw new Error('bad pairing code');
  }
  return { v: 1, relay, deviceId, deviceToken: device_token, kDev };
}

/** HKDF-SHA-256 with the device id as salt; one label per purpose. Keys are not extractable. */
export async function deriveKeys(kDev: Uint8Array<ArrayBuffer>, deviceId: Uint8Array<ArrayBuffer>): Promise<DeviceKeys> {
  const root = await crypto.subtle.importKey('raw', kDev, 'HKDF', false, ['deriveKey']);
  const hkdf = (info: string) => ({ name: 'HKDF', hash: 'SHA-256', salt: deviceId, info: utf8(info) });
  const kEnc = await crypto.subtle.deriveKey(hkdf('sb/v1/capture'), root, { name: 'AES-GCM', length: 256 }, false, [
    'encrypt',
    'decrypt',
  ]);
  const kAck = await crypto.subtle.deriveKey(
    hkdf('sb/v1/receipt'),
    root,
    { name: 'HMAC', hash: 'SHA-256', length: 256 },
    false,
    ['sign', 'verify'],
  );
  return { kEnc, kAck };
}
