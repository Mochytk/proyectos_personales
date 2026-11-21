import {
  pullResponseSchema,
  pushResponseSchema,
  versionResponseSchema,
  type PullResponse,
  type PushRequest,
  type PushResponse,
} from '@habit-tracker/shared';

const TIMEOUT_MS = 15_000;

export type ApiResult<T> =
  | { status: 'ok'; data: T }
  | { status: 'offline' }
  | { status: 'unauthenticated' }
  | { status: 'error'; message: string };

// The sync endpoints, behind an interface so the engine can be tested without a server.
export interface SyncApi {
  push(request: PushRequest): Promise<ApiResult<PushResponse>>;
  pull(cursor: number): Promise<ApiResult<PullResponse>>;
  version(): Promise<ApiResult<number>>;
}

// Any of the shared response schemas.
interface Schema<T> {
  safeParse(data: unknown): { success: true; data: T } | { success: false };
}

async function call<T>(path: string, schema: Schema<T>, init?: RequestInit) {
  let response: Response;
  try {
    response = await fetch(path, {
      ...init,
      credentials: 'same-origin',
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch {
    // No network, or no answer within 15 s: try again later.
    return { status: 'offline' } as const;
  }
  if (response.status === 401) return { status: 'unauthenticated' } as const;
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const code = (body as { error?: unknown } | null)?.error;
    return {
      status: 'error',
      message: typeof code === 'string' ? code : `HTTP ${String(response.status)}`,
    } as const;
  }
  const parsed = schema.safeParse(body);
  return parsed.success
    ? ({ status: 'ok', data: parsed.data } as const)
    : ({ status: 'error', message: 'invalid_response' } as const);
}

export const httpSyncApi: SyncApi = {
  push: (request) =>
    call('/api/sync/push', pushResponseSchema, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(request),
    }),
  pull: (cursor) => call(`/api/sync/pull?cursor=${String(cursor)}`, pullResponseSchema),
  version: async () => {
    const result = await call('/api/sync/version', versionResponseSchema);
    return result.status === 'ok' ? { status: 'ok', data: result.data.version } : result;
  },
};
