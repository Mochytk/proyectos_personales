import { afterEach, describe, expect, it, vi } from 'vitest';
import { providerFor } from '../services/metadata';

const respond = (body: unknown, status = 200) => ({ ok: status < 400, status, json: async () => body });
const mockFetch = (impl: (url: string) => unknown) => vi.stubGlobal('fetch', vi.fn(async (url: string) => impl(url)));
afterEach(() => vi.unstubAllGlobals());

describe('providerFor', () => {
  it('has no provider for types without a metadata source', () => {
    expect(providerFor('task')).toBeUndefined();
    expect(providerFor('software')).toBeUndefined();
  });

  it('uses TMDB for movies and series, and TMDB needs a key', () => {
    expect(providerFor('movie')?.label).toBe('TMDB');
    expect(providerFor('tv_show')?.label).toBe('TMDB');
    expect(providerFor('movie')?.keySetting).toBe('tmdbApiKey');
  });
});

describe('TMDB provider', () => {
  it('maps a movie result without progress tracking', async () => {
    mockFetch(() => respond({ results: [{ id: 603, title: 'Matrix', release_date: '1999-03-30', poster_path: '/p.jpg' }] }));
    const [r] = await providerFor('movie')!.search('matrix', 'key');
    expect(r).toMatchObject({ externalId: 'tmdb:movie:603', title: 'Matrix', subtitle: '1999' });
    expect(r.progress).toBeUndefined();
    expect(providerFor('movie')!.details).toBeUndefined();
  });

  it('marks series for episode tracking and fetches the total afterwards', async () => {
    mockFetch((url) => (url.includes('/search/tv') ? respond({ results: [{ id: 42, name: 'Show', first_air_date: '2020-01-01' }] }) : respond({ number_of_episodes: 62 })));
    const provider = providerFor('tv_show')!;
    const [r] = await provider.search('show', 'key');
    expect(r.progress).toEqual({ type: 'episodes' });
    expect(await provider.details!(r, 'key')).toEqual({ progress: { type: 'episodes', total: 62 } });
  });
});
