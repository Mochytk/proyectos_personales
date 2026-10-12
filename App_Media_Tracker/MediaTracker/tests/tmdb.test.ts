import { afterEach, describe, expect, it, vi } from 'vitest';
import { getTvDetails, searchTmdb, seasonsFromTmdb } from '../services/tmdb';

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

describe('seasonsFromTmdb', () => {
  it('skips specials and orders by season number', () => {
    const list = [
      { season_number: 2, episode_count: 8 },
      { season_number: 0, episode_count: 5 },
      { season_number: 1, episode_count: 10 },
    ];
    expect(seasonsFromTmdb(list)).toEqual([10, 8]);
  });

  it('stops at the first season without episodes so numbering never shifts', () => {
    const list = [
      { season_number: 1, episode_count: 10 },
      { season_number: 2, episode_count: 0 },
      { season_number: 3, episode_count: 6 },
    ];
    expect(seasonsFromTmdb(list)).toEqual([10]);
  });

  it('returns undefined for missing or empty data', () => {
    expect(seasonsFromTmdb(undefined)).toBeUndefined();
    expect(seasonsFromTmdb([{ season_number: 0, episode_count: 3 }])).toBeUndefined();
  });
});

describe('getTvDetails', () => {
  it('returns the seasons and their total', async () => {
    mockFetch(() => respond({ number_of_episodes: 99, seasons: [{ season_number: 1, episode_count: 10 }, { season_number: 2, episode_count: 8 }] }));
    expect(await getTvDetails('tmdb:tv:42', 'k')).toEqual({ seasons: [10, 8], totalEpisodes: 18 });
  });

  it('includes the next episode to air when the show is still running', async () => {
    mockFetch(() => respond({
      seasons: [{ season_number: 1, episode_count: 10 }],
      next_episode_to_air: { air_date: '2026-10-17', season_number: 1, episode_number: 11 },
    }));
    expect((await getTvDetails('tmdb:tv:42', 'k')).nextEpisode).toEqual({ date: '2026-10-17', season: 1, episode: 11 });
  });

  it('ignores a missing or malformed next episode', async () => {
    mockFetch(() => respond({ seasons: [{ season_number: 1, episode_count: 10 }], next_episode_to_air: null }));
    expect((await getTvDetails('tmdb:tv:42', 'k')).nextEpisode).toBeUndefined();
    mockFetch(() => respond({ seasons: [{ season_number: 1, episode_count: 10 }], next_episode_to_air: { air_date: 'pronto' } }));
    expect((await getTvDetails('tmdb:tv:42', 'k')).nextEpisode).toBeUndefined();
  });

  it('falls back to the overall count when no seasons are listed', async () => {
    mockFetch(() => respond({ number_of_episodes: 62, seasons: [] }));
    expect(await getTvDetails('tmdb:tv:42', 'k')).toEqual({ totalEpisodes: 62 });
  });

  it('ignores malformed ids without calling the API', async () => {
    const fetchMock = mockFetch(() => respond({}));
    expect(await getTvDetails('tmdb:tv:x', 'k')).toEqual({});
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
