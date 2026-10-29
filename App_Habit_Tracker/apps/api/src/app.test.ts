import { describe, expect, it } from 'vitest';
import { createApp } from './app';

describe('createApp', () => {
  it('answers the health check', async () => {
    const response = await createApp().request('/api/health');
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: 'ok' });
  });

  it('answers unknown API paths with a JSON 404', async () => {
    const response = await createApp().request('/api/no-existe');
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: 'not_found' });
  });

  it('hides internal errors behind a JSON 500', async () => {
    const app = createApp();
    app.get('/api/boom', () => {
      throw new Error('secret detail');
    });
    const response = await app.request('/api/boom');
    expect(response.status).toBe(500);
    const body = await response.text();
    expect(JSON.parse(body)).toEqual({ error: 'internal' });
    expect(body).not.toContain('secret detail');
  });

  it('sends security headers and no caching on API responses', async () => {
    const response = await createApp().request('/api/health');
    expect(response.headers.get('x-content-type-options')).toBe('nosniff');
    expect(response.headers.get('referrer-policy')).toBe('no-referrer');
    expect(response.headers.get('x-frame-options')).toBe('DENY');
    expect(response.headers.get('cache-control')).toBe('no-store');
  });
});
