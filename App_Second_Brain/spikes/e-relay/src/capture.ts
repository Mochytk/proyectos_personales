// Capture envelope: "SB" || version || iv || AES-256-GCM(plaintext, aad).
// plaintext = u32 header length || header JSON || body || zero padding to a size bucket.
import { concat, fromUtf8, randomBytes, utf8 } from './bytes.ts';

export interface CaptureHeader {
  v: 1;
  type: string;
  mime: string;
  captured_at: string;
  [key: string]: unknown;
}

const MAGIC = utf8('SB');
const VERSION = 1;
const IV_BYTES = 12;
const TAG_BYTES = 16;
const PREFIX_BYTES = MAGIC.length + 1 + IV_BYTES;
const SMALL_BUCKET = 4 * 1024;
const LARGE_BUCKET = 64 * 1024;

/** Rounds up so the relay only learns a coarse size: 4 KiB steps below 64 KiB, then 64 KiB steps. */
export function paddedLength(length: number): number {
  const bucket = length < LARGE_BUCKET ? SMALL_BUCKET : LARGE_BUCKET;
  return Math.ceil(length / bucket) * bucket;
}

/** Blob size the relay sees for a body of this length (assuming a header under `headerLength` bytes). */
export function blobSize(bodyLength: number, headerLength = 160): number {
  return PREFIX_BYTES + paddedLength(4 + headerLength + bodyLength) + TAG_BYTES;
}

function aad(deviceId: Uint8Array, captureId: Uint8Array): Uint8Array<ArrayBuffer> {
  return concat(utf8('sb-capture-v1'), deviceId, captureId);
}

export async function sealCapture(
  kEnc: CryptoKey,
  deviceId: Uint8Array,
  captureId: Uint8Array,
  header: CaptureHeader,
  body: Uint8Array,
): Promise<Uint8Array<ArrayBuffer>> {
  const headerBytes = utf8(JSON.stringify({ ...header, body_len: body.length }));
  const length = new Uint8Array(4);
  new DataView(length.buffer).setUint32(0, headerBytes.length);
  const content = concat(length, headerBytes, body);
  const plaintext = new Uint8Array(paddedLength(content.length));
  plaintext.set(content);
  const iv = randomBytes(IV_BYTES);
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv, additionalData: aad(deviceId, captureId), tagLength: TAG_BYTES * 8 },
    kEnc,
    plaintext,
  );
  return concat(MAGIC, Uint8Array.of(VERSION), iv, new Uint8Array(ciphertext));
}

export async function openCapture(
  kEnc: CryptoKey,
  deviceId: Uint8Array,
  captureId: Uint8Array,
  blob: Uint8Array<ArrayBuffer>,
): Promise<{ header: CaptureHeader; body: Uint8Array<ArrayBuffer> }> {
  if (blob.length < PREFIX_BYTES + TAG_BYTES || blob[0] !== MAGIC[0] || blob[1] !== MAGIC[1] || blob[2] !== VERSION) {
    throw new Error('not a capture blob');
  }
  const iv = blob.slice(MAGIC.length + 1, PREFIX_BYTES);
  // Throws if the key, the aad (device or capture id) or any byte does not match.
  const plaintext = new Uint8Array(
    await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv, additionalData: aad(deviceId, captureId), tagLength: TAG_BYTES * 8 },
      kEnc,
      blob.slice(PREFIX_BYTES),
    ),
  );
  const headerLength = new DataView(plaintext.buffer).getUint32(0);
  const header = JSON.parse(fromUtf8(plaintext.slice(4, 4 + headerLength))) as CaptureHeader & { body_len: unknown };
  const start = 4 + headerLength;
  if (typeof header.body_len !== 'number' || start + header.body_len > plaintext.length) {
    throw new Error('corrupt capture');
  }
  return { header, body: plaintext.slice(start, start + header.body_len) };
}
