import { afterEach, describe, expect, it, vi } from 'vitest';
import { providerFor } from '../services/metadata';
import { searchRawg } from '../services/rawg';

const respond = (body: unknown, status = 200) => ({ ok: status < 400, status, json: async () => body });
const mockFetch = (impl: (url: string) => unknown) => {
  const fn = vi.fn(async (url: string) => impl(url));
  vi.stubGlobal('fetch', fn);
  return fn;
};
afterEach(() => vi.unstubAllGlobals());

describe('searchRawg', () => {
  it('maps games to results', async () => {
    mockFetch(() => respond({ results: [{ id: 326243, name: 'Elden Ring', released: '2022-02-25', background_image: 'https://media.rawg.io/x.jpg' }] }));
    const [r] = await searchRawg('elden', 'key');
    expect(r).toEqual({ externalId: 'rawg:326243', title: 'Elden Ring', year: '2022', releaseDate: '2022-02-25', posterUrl: 'https://media.rawg.io/x.jpg' });
  });

  it('sends the key, the query and a page size', async () => {
    const fetchMock = mockFetch(() => respond({ results: [] }));
    await searchRawg('hollow knight', ' abc ');
    const url = new URL(fetchMock.mock.calls[0][0] as string);
    expect(url.searchParams.get('key')).toBe('abc');
    expect(url.searchParams.get('search')).toBe('hollow knight');
    expect(url.searchParams.get('page_size')).toBe('8');
  });

  it('copes with unreleased games and missing images, and drops broken entries', async () => {
    mockFetch(() => respond({ results: [{ id: 1, name: 'TBA', released: null, background_image: null }, { id: 2 }, { name: 'sin id' }] }));
    const results = await searchRawg('x', 'k');
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({ title: 'TBA', year: undefined, posterUrl: undefined });
  });

  it('reports a bad key, server errors and network failures in Spanish', async () => {
    mockFetch(() => respond({}, 401));
    await expect(searchRawg('x', 'bad')).rejects.toThrow(/no es válida/);
    mockFetch(() => respond({}, 500));
    await expect(searchRawg('x', 'k')).rejects.toThrow(/RAWG respondió/);
    mockFetch(() => { throw new TypeError('network'); });
    await expect(searchRawg('x', 'k')).rejects.toThrow(/No se pudo conectar/);
  });
});

describe('game provider', () => {
  it('needs the RAWG key and has no progress pre-fill', async () => {
    mockFetch(() => respond({ results: [{ id: 3, name: 'Celeste', released: '2018-01-25' }] }));
    const provider = providerFor('video_game')!;
    expect(provider.keySetting).toBe('rawgApiKey');
    const [r] = await provider.search('celeste', 'k');
    expect(r).toMatchObject({ externalId: 'rawg:3', subtitle: '2018' });
    expect(r.progress).toBeUndefined();
  });
});
