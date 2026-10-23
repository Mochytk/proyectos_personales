// The relay as a Workers-style fetch handler over a KV namespace. It stores opaque blobs
// and token hashes only; it never sees keys or plaintext.
import { constantTimeEqual, sha256Hex } from './bytes.ts';
import type { KVLike } from './memory-kv.ts';

export interface RelayEnv {
  HUB_TOKEN_SHA256: string;
  store: KVLike;
}

export const MAX_BLOB_BYTES = 20 * 1024 * 1024; // under the 25 MiB KV value limit
const PENDING_TTL_S = 10 * 60;
const CAPTURE_TTL_S = 30 * 24 * 60 * 60;
const ID = /^[0-9a-f]{32}$/;

interface DeviceRecord {
  token_sha256: string;
  name: string;
  state: 'pending' | 'active';
}

const json = (status: number, body: unknown): Response =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
const fail = (status: number, error: string): Response => json(status, { error });

function bearer(request: Request): string | null {
  const header = request.headers.get('authorization') ?? '';
  return header.startsWith('Bearer ') ? header.slice('Bearer '.length) : null;
}

export function createRelay(env: RelayEnv) {
  const { store } = env;

  async function isHub(request: Request): Promise<boolean> {
    const token = bearer(request);
    return token !== null && constantTimeEqual(await sha256Hex(token), env.HUB_TOKEN_SHA256);
  }

  /** Returns the device id if the request carries a valid token for an existing device. */
  async function deviceOf(request: Request, states: DeviceRecord['state'][]): Promise<string | null> {
    const token = bearer(request);
    const deviceId = request.headers.get('x-device-id') ?? '';
    if (token === null || !ID.test(deviceId)) return null;
    const raw = await store.get(`dev:${deviceId}`);
    if (raw === null) return null;
    const record = JSON.parse(raw) as DeviceRecord;
    const ok = states.includes(record.state) && constantTimeEqual(await sha256Hex(token), record.token_sha256);
    return ok ? deviceId : null;
  }

  async function registerDevice(request: Request): Promise<Response> {
    if (!(await isHub(request))) return fail(401, 'unauthorized');
    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    const deviceId = body?.device_id;
    const tokenHash = body?.token_sha256;
    const name = body?.name;
    if (typeof deviceId !== 'string' || !ID.test(deviceId)) return fail(400, 'bad_request');
    if (typeof tokenHash !== 'string' || !/^[0-9a-f]{64}$/.test(tokenHash)) return fail(400, 'bad_request');
    if (typeof name !== 'string' || name.length === 0 || name.length > 40) return fail(400, 'bad_request');
    const record: DeviceRecord = { token_sha256: tokenHash, name, state: 'pending' };
    await store.put(`dev:${deviceId}`, JSON.stringify(record), { expirationTtl: PENDING_TTL_S });
    return json(201, { ok: true });
  }

  async function activateDevice(request: Request): Promise<Response> {
    const deviceId = await deviceOf(request, ['pending', 'active']);
    if (deviceId === null) return fail(401, 'unauthorized');
    const raw = await store.get(`dev:${deviceId}`);
    if (raw === null) return fail(401, 'unauthorized');
    const record = JSON.parse(raw) as DeviceRecord;
    if (record.state === 'pending') {
      await store.put(`dev:${deviceId}`, JSON.stringify({ ...record, state: 'active' }));
    }
    return json(200, { ok: true });
  }

  async function revokeDevice(request: Request, deviceId: string, purge: boolean): Promise<Response> {
    if (!(await isHub(request))) return fail(401, 'unauthorized');
    await store.delete(`dev:${deviceId}`);
    if (purge) {
      for (const entry of await store.list('cap:')) {
        if (entry.metadata?.device_id === deviceId) await store.delete(entry.name);
      }
    }
    return json(200, { ok: true });
  }

  async function putCapture(request: Request, captureId: string): Promise<Response> {
    const deviceId = await deviceOf(request, ['active']);
    if (deviceId === null) return fail(401, 'unauthorized');
    const declared = Number(request.headers.get('content-length') ?? '0');
    if (declared > MAX_BLOB_BYTES) return fail(413, 'too_large');
    const blob = new Uint8Array(await request.arrayBuffer());
    if (blob.length === 0) return fail(400, 'bad_request');
    if (blob.length > MAX_BLOB_BYTES) return fail(413, 'too_large');
    const digest = await sha256Hex(blob);
    const existing = await store.getBytes(`cap:${captureId}`);
    if (existing) {
      const same = existing.metadata?.device_id === deviceId && existing.metadata.sha256 === digest;
      return same ? json(200, { ok: true }) : fail(409, 'conflict');
    }
    await store.put(`cap:${captureId}`, blob, {
      expirationTtl: CAPTURE_TTL_S,
      metadata: { device_id: deviceId, size: blob.length, sha256: digest, uploaded_at: new Date().toISOString() },
    });
    return json(201, { ok: true });
  }

  async function listCaptures(request: Request): Promise<Response> {
    if (!(await isHub(request))) return fail(401, 'unauthorized');
    const captures = (await store.list('cap:')).map((entry) => ({
      capture_id: entry.name.slice('cap:'.length),
      device_id: entry.metadata?.device_id,
      size: entry.metadata?.size,
      uploaded_at: entry.metadata?.uploaded_at,
    }));
    return json(200, { captures });
  }

  async function getCapture(request: Request, captureId: string): Promise<Response> {
    if (!(await isHub(request))) return fail(401, 'unauthorized');
    const entry = await store.getBytes(`cap:${captureId}`);
    if (!entry) return fail(404, 'not_found');
    return new Response(entry.value, { headers: { 'content-type': 'application/octet-stream' } });
  }

  async function ackCapture(request: Request, captureId: string): Promise<Response> {
    if (!(await isHub(request))) return fail(401, 'unauthorized');
    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    const receipt = body?.receipt;
    if (typeof receipt !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(receipt)) return fail(400, 'bad_request');
    const entry = await store.getBytes(`cap:${captureId}`);
    const deviceId = entry?.metadata?.device_id;
    if (typeof deviceId !== 'string') return fail(404, 'not_found');
    await store.put(`rcpt:${captureId}`, JSON.stringify({ receipt, device_id: deviceId }), {
      expirationTtl: CAPTURE_TTL_S,
    });
    await store.delete(`cap:${captureId}`);
    return json(200, { ok: true });
  }

  async function getReceipt(request: Request, captureId: string): Promise<Response> {
    const deviceId = await deviceOf(request, ['active']);
    if (deviceId === null) return fail(401, 'unauthorized');
    const raw = await store.get(`rcpt:${captureId}`);
    if (raw === null) return fail(404, 'not_found');
    const record = JSON.parse(raw) as { receipt: string; device_id: string };
    if (record.device_id !== deviceId) return fail(404, 'not_found');
    return json(200, { receipt: record.receipt });
  }

  async function route(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const [, version, collection, id, action] = url.pathname.split('/');
    if (version !== 'v1') return fail(404, 'not_found');
    const { method } = request;

    if (collection === 'devices') {
      if (method === 'POST' && id === undefined) return registerDevice(request);
      if (method === 'POST' && id === 'activate' && action === undefined) return activateDevice(request);
      if (method === 'DELETE' && id !== undefined && ID.test(id) && action === undefined) {
        return revokeDevice(request, id, url.searchParams.get('purge') === '1');
      }
    }
    if (collection === 'captures') {
      if (method === 'GET' && id === undefined) return listCaptures(request);
      if (id === undefined || !ID.test(id)) return fail(400, 'bad_request');
      if (method === 'PUT' && action === undefined) return putCapture(request, id);
      if (method === 'GET' && action === undefined) return getCapture(request, id);
      if (method === 'POST' && action === 'ack') return ackCapture(request, id);
      if (method === 'GET' && action === 'receipt') return getReceipt(request, id);
    }
    return fail(404, 'not_found');
  }

  return {
    async fetch(request: Request): Promise<Response> {
      try {
        return await route(request);
      } catch {
        return fail(500, 'internal'); // no stack traces or messages leave the relay
      }
    },
  };
}
