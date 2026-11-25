import { vi } from 'vitest';

type Handler = (init: RequestInit | undefined) => Response | Promise<Response>;

// Replaces fetch with handlers by "METHOD /path". Anything unhandled fails loudly, and
// `calls` records what the app sent.
export function fakeFetch(handlers: Record<string, Handler>) {
  const calls: { key: string; search: string; body: unknown }[] = [];
  const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(input instanceof Request ? input.url : input.toString(), 'http://app');
    const key = `${init?.method ?? 'GET'} ${url.pathname}`;
    calls.push({
      key,
      search: url.search,
      body: typeof init?.body === 'string' ? JSON.parse(init.body) : undefined,
    });
    const handler = handlers[key];
    if (!handler) return Promise.reject(new Error(`Unexpected request: ${key}`));
    return Promise.resolve(handler(init));
  });
  vi.stubGlobal('fetch', fetchMock);
  return { calls, fetchMock };
}

export const offline = (): never => {
  throw new TypeError('Failed to fetch');
};

export function json(body: unknown, status = 200): Response {
  return Response.json(body, { status });
}
