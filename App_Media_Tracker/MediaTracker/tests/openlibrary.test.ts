import { afterEach, describe, expect, it, vi } from 'vitest';
import { providerFor } from '../services/metadata';
import { searchOpenLibrary } from '../services/openlibrary';

const respond = (body: unknown, status = 200) => ({ ok: status < 400, status, json: async () => body });
const mockFetch = (impl: (url: string) => unknown) => {
  const fn = vi.fn(async (url: string) => impl(url));
  vi.stubGlobal('fetch', fn);
  return fn;
};
afterEach(() => vi.unstubAllGlobals());

const doc = { key: '/works/OL21745884W', title: 'Project Hail Mary', author_name: ['Andy Weir'], first_publish_year: 2021, cover_i: 10389354, number_of_pages_median: 476 };

describe('searchOpenLibrary', () => {
  it('maps works to results', async () => {
    mockFetch(() => respond({ docs: [doc] }));
    const [r] = await searchOpenLibrary('hail mary');
    expect(r).toEqual({
      externalId: 'openlibrary:OL21745884W',
      title: 'Project Hail Mary',
      authors: 'Andy Weir',
      year: '2021',
      posterUrl: 'https://covers.openlibrary.org/b/id/10389354-M.jpg',
      pages: 476,
    });
  });

  it('sends the query with a result limit and only the needed fields', async () => {
    const fetchMock = mockFetch(() => respond({ docs: [] }));
    await searchOpenLibrary('dune & más');
    const url = new URL(fetchMock.mock.calls[0][0] as string);
    expect(url.searchParams.get('q')).toBe('dune & más');
    expect(url.searchParams.get('limit')).toBe('8');
    expect(url.searchParams.get('fields')).toContain('cover_i');
  });

  it('copes with missing optional fields and drops entries without a title', async () => {
    mockFetch(() => respond({ docs: [{ key: '/works/OL1W', title: 'Sin datos' }, { key: '/works/OL2W' }, { title: 'Sin clave' }] }));
    const results = await searchOpenLibrary('x');
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({ title: 'Sin datos', authors: undefined, year: undefined, posterUrl: undefined, pages: undefined });
  });

  it('keeps at most two authors', async () => {
    mockFetch(() => respond({ docs: [{ ...doc, author_name: ['A', 'B', 'C'] }] }));
    expect((await searchOpenLibrary('x'))[0].authors).toBe('A, B');
  });

  it('reports server and network errors in Spanish', async () => {
    mockFetch(() => respond({}, 503));
    await expect(searchOpenLibrary('x')).rejects.toThrow(/Open Library respondió/);
    mockFetch(() => { throw new TypeError('network'); });
    await expect(searchOpenLibrary('x')).rejects.toThrow(/No se pudo conectar/);
  });
});

describe('book provider', () => {
  it('needs no key and pre-fills page tracking', async () => {
    mockFetch(() => respond({ docs: [doc] }));
    const provider = providerFor('book')!;
    expect(provider.keySetting).toBeUndefined();
    const [r] = await provider.search('hail mary', '');
    expect(r.subtitle).toBe('Andy Weir');
    expect(r.hint).toBe('Andy Weir · 2021');
    expect(r.progress).toEqual({ type: 'pages', total: 476 });
  });

  it('leaves progress alone when the page count is unknown', async () => {
    mockFetch(() => respond({ docs: [{ key: '/works/OL1W', title: 'T' }] }));
    const [r] = await providerFor('book')!.search('t', '');
    expect(r.progress).toBeUndefined();
    expect(r.hint).toBeUndefined();
  });
});
