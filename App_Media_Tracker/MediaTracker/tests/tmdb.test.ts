import { afterEach, describe, expect, it, vi } from 'vitest';
import { getTvEpisodeCount, searchTmdb } from '../services/tmdb';

const respond = (body: unknown, status = 200) => ({ ok: status < 400, status, json: async () => body });
const mockFetch = (impl: (url: string) => unknown) => {
  const fn = vi.fn(async (url: string) => impl(url));
  vi.stubGlobal('fetch', fn);
  return fn;
};
afterEach(() => vi.unstubAllGlobals());

describe('searchTmdb', () => {
  it('maps results, including ones without poster or date', async () => {
    mockFetch(() => respond({ results: [
      { id: 603, title: 'Matrix', release_date: '1999-03-30', overview: 'x', poster_path: '/p.jpg' },
      { id: 1, title: 'Sin portada', release_date: '' },
    ] }));
    const [full, bare] = await searchTmdb('movie', 'matrix', 'key');
    expect(full).toMatchObject({ externalId: 'tmdb:movie:603', year: '1999' });
    expect(full.posterUrl).toMatch(/\/w342\/p\.jpg$/);
    expect(bare.posterUrl).toBeUndefined();
    expect(bare.year).toBeUndefined();
  });

  it('authenticates with a v3 key in the query and a token in the header', async () => {
    const fetchMock = mockFetch(() => respond({ results: [] }));
    await searchTmdb('movie', 'a', 'abc123');
    await searchTmdb('movie', 'a', 'eyJtoken');
    const [url1, opts1] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    const [url2, opts2] = fetchMock.mock.calls[1] as unknown as [string, RequestInit];
    expect(url1).toContain('api_key=abc123');
    expect((opts1.headers as Record<string, string>).Authorization).toBeUndefined();
    expect(url2).not.toContain('api_key');
    expect((opts2.headers as Record<string, string>).Authorization).toBe('Bearer eyJtoken');
  });

  it('reports an invalid key and a network failure in Spanish', async () => {
    mockFetch(() => respond({}, 401));
    await expect(searchTmdb('tv', 'q', 'bad')).rejects.toThrow(/no es válida/);
    mockFetch(() => { throw new TypeError('network'); });
    await expect(searchTmdb('tv', 'q', 'k')).rejects.toThrow(/No se pudo conectar/);
  });
});

describe('getTvEpisodeCount', () => {
  it('returns the number of episodes', async () => {
    mockFetch(() => respond({ number_of_episodes: 62 }));
    expect(await getTvEpisodeCount('tmdb:tv:42', 'k')).toBe(62);
  });

  it('ignores malformed ids without calling the API', async () => {
    const fetchMock = mockFetch(() => respond({}));
    expect(await getTvEpisodeCount('tmdb:tv:x', 'k')).toBeUndefined();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
