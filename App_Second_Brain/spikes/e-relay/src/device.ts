// The capture client (the PWA in production): seal first, queue locally, upload when online,
// and forget a capture only after a receipt that verifies with k_ack.
import { fromBase64url, hex, randomBytes, utf8 } from './bytes.ts';
import { sealCapture } from './capture.ts';
import { decodePairingCode, deriveKeys, type DeviceKeys, type Pairing } from './pairing.ts';
import { verifyReceipt } from './receipt.ts';

type Fetcher = (request: Request) => Promise<Response>;

interface Queued {
  captureId: Uint8Array<ArrayBuffer>;
  blob: Uint8Array<ArrayBuffer>;
  uploaded: boolean;
}

export class Device {
  private readonly pairing: Pairing;
  private readonly keys: DeviceKeys;
  private readonly fetcher: Fetcher;
  private readonly queue = new Map<string, Queued>(); // IndexedDB in the real PWA

  private constructor(pairing: Pairing, keys: DeviceKeys, fetcher: Fetcher) {
    this.pairing = pairing;
    this.keys = keys;
    this.fetcher = fetcher;
  }

  static async fromPairingCode(code: string, fetcher: Fetcher): Promise<Device> {
    const pairing = decodePairingCode(code);
    return new Device(pairing, await deriveKeys(pairing.kDev, pairing.deviceId), fetcher);
  }

  get deviceIdHex(): string {
    return hex(this.pairing.deviceId);
  }

  private request(method: string, path: string, body?: Uint8Array<ArrayBuffer>): Request {
    return new Request(`${this.pairing.relay}${path}`, {
      method,
      headers: { authorization: `Bearer ${this.pairing.deviceToken}`, 'x-device-id': this.deviceIdHex },
      body: body ?? null,
    });
  }

  async activate(): Promise<void> {
    const response = await this.fetcher(this.request('POST', '/v1/devices/activate'));
    if (!response.ok) throw new Error(`activation failed: ${String(response.status)}`);
  }

  private async enqueue(type: string, mime: string, body: Uint8Array<ArrayBuffer>): Promise<void> {
    const captureId = randomBytes(16);
    const header = { v: 1 as const, type, mime, captured_at: new Date().toISOString() };
    const blob = await sealCapture(this.keys.kEnc, this.pairing.deviceId, captureId, header, body);
    this.queue.set(hex(captureId), { captureId, blob, uploaded: false });
  }

  captureText(text: string): Promise<void> {
    return this.enqueue('text', 'text/plain; charset=utf-8', utf8(text));
  }

  captureAudio(audio: Uint8Array<ArrayBuffer>, mime: string): Promise<void> {
    return this.enqueue('voice', mime, audio);
  }

  /** Uploads what it can; stops quietly at the first network error. Returns how many went up. */
  async flush(): Promise<number> {
    let sent = 0;
    for (const [id, item] of this.queue) {
      if (item.uploaded) continue;
      try {
        const response = await this.fetcher(this.request('PUT', `/v1/captures/${id}`, item.blob));
        if (response.status === 200 || response.status === 201) {
          item.uploaded = true;
          sent += 1;
        }
      } catch {
        break; // offline: try again later
      }
    }
    return sent;
  }

  /** Drops a capture only when the relay shows a receipt that only the Mac could produce. */
  async collectReceipts(): Promise<number> {
    let confirmed = 0;
    for (const [id, item] of this.queue) {
      if (!item.uploaded) continue;
      const response = await this.fetcher(this.request('GET', `/v1/captures/${id}/receipt`));
      if (!response.ok) continue;
      const { receipt } = (await response.json()) as { receipt: string };
      if (await verifyReceipt(this.keys.kAck, item.captureId, fromBase64url(receipt))) {
        this.queue.delete(id);
        confirmed += 1;
      }
    }
    return confirmed;
  }

  pending(): number {
    return this.queue.size;
  }

  pendingIds(): string[] {
    return [...this.queue.keys()];
  }
}
