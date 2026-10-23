// The Mac side: pairs devices, downloads and opens captures, writes them, then acks.
import { base64url, fromHex, hex, sha256Hex } from './bytes.ts';
import { type CaptureHeader, openCapture } from './capture.ts';
import { deriveKeys, type DeviceKeys, encodePairingCode, newPairing } from './pairing.ts';
import { makeReceipt } from './receipt.ts';

type Fetcher = (request: Request) => Promise<Response>;

export interface StoredCapture {
  deviceId: string;
  header: CaptureHeader;
  body: Uint8Array<ArrayBuffer>;
}

export class Hub {
  private readonly relay: string;
  private readonly hubToken: string;
  private readonly fetcher: Fetcher;
  private readonly devices = new Map<string, DeviceKeys>(); // macOS Keychain in production
  readonly vault = new Map<string, StoredCapture>(); // keyed by capture id, like the note frontmatter
  failAckOnce = false; // test hook: simulates a crash after writing and before acking

  constructor(relay: string, hubToken: string, fetcher: Fetcher) {
    this.relay = relay;
    this.hubToken = hubToken;
    this.fetcher = fetcher;
  }

  private request(method: string, path: string, body?: string): Request {
    return new Request(`${this.relay}${path}`, {
      method,
      headers: { authorization: `Bearer ${this.hubToken}` },
      body: body ?? null,
    });
  }

  async pairDevice(name: string): Promise<string> {
    const pairing = newPairing(this.relay);
    const deviceId = hex(pairing.deviceId);
    const response = await this.fetcher(
      this.request(
        'POST',
        '/v1/devices',
        JSON.stringify({ device_id: deviceId, token_sha256: await sha256Hex(pairing.deviceToken), name }),
      ),
    );
    if (response.status !== 201) throw new Error(`register failed: ${String(response.status)}`);
    this.devices.set(deviceId, await deriveKeys(pairing.kDev, pairing.deviceId));
    return encodePairingCode(pairing);
  }

  async revoke(deviceId: string): Promise<void> {
    await this.fetcher(this.request('DELETE', `/v1/devices/${deviceId}?purge=1`));
    this.devices.delete(deviceId);
  }

  /** One polling round. Returns how many new captures were written to the vault. */
  async syncOnce(): Promise<number> {
    const listing = await this.fetcher(this.request('GET', '/v1/captures'));
    const { captures } = (await listing.json()) as { captures: { capture_id: string; device_id: string }[] };
    let written = 0;
    for (const { capture_id: captureId, device_id: deviceId } of captures) {
      const keys = this.devices.get(deviceId);
      if (!keys) continue; // unknown or revoked device: never opened
      if (!this.vault.has(captureId)) {
        const response = await this.fetcher(this.request('GET', `/v1/captures/${captureId}`));
        if (!response.ok) continue;
        const blob = new Uint8Array(await response.arrayBuffer());
        let opened: { header: CaptureHeader; body: Uint8Array<ArrayBuffer> };
        try {
          opened = await openCapture(keys.kEnc, fromHex(deviceId), fromHex(captureId), blob);
        } catch {
          continue; // tampered or foreign blob: logged without content in production, never acked
        }
        this.vault.set(captureId, { deviceId, ...opened }); // atomic write + fsync in production
        written += 1;
      }
      if (this.failAckOnce) {
        this.failAckOnce = false;
        throw new Error('simulated crash before ack');
      }
      const receipt = base64url(await makeReceipt(keys.kAck, fromHex(captureId)));
      await this.fetcher(this.request('POST', `/v1/captures/${captureId}/ack`, JSON.stringify({ receipt })));
    }
    return written;
  }
}
