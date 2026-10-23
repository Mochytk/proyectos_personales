// Delivery receipts: only someone holding k_ack (the Mac and the phone) can produce one.
import { concat, utf8 } from './bytes.ts';

function message(captureId: Uint8Array): Uint8Array<ArrayBuffer> {
  return concat(utf8('sb-ack-v1'), captureId);
}

export async function makeReceipt(kAck: CryptoKey, captureId: Uint8Array): Promise<Uint8Array<ArrayBuffer>> {
  return new Uint8Array(await crypto.subtle.sign('HMAC', kAck, message(captureId)));
}

export async function verifyReceipt(kAck: CryptoKey, captureId: Uint8Array, receipt: Uint8Array<ArrayBuffer>): Promise<boolean> {
  // subtle.verify compares in constant time.
  return crypto.subtle.verify('HMAC', kAck, receipt, message(captureId));
}
