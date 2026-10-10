const SEARCH_URL = 'https://openlibrary.org/search.json';
const COVER_URL = 'https://covers.openlibrary.org/b';

export interface OpenLibraryResult {
  externalId: string; // "openlibrary:OL45804W"
  title: string;
  authors?: string;
  year?: string;
  posterUrl?: string;
  pages?: number;
}

/** Searches books by title or author. Open Library needs no API key. */
export async function searchOpenLibrary(query: string, signal?: AbortSignal): Promise<OpenLibraryResult[]> {
  const url = new URL(SEARCH_URL);
  url.searchParams.set('q', query);
  url.searchParams.set('limit', '8');
  url.searchParams.set('fields', 'key,title,author_name,first_publish_year,cover_i,number_of_pages_median');

  const res = await fetch(url.toString(), { headers: { accept: 'application/json' }, signal }).catch((e) => {
    if (e?.name === 'AbortError') throw e;
    throw new Error('No se pudo conectar con Open Library. Revisa tu conexión.');
  });
  if (!res.ok) throw new Error(`Open Library respondió con un error (${res.status}).`);

  const data = await res.json();
  return (data.docs ?? [])
    .filter((d: any) => typeof d.key === 'string' && typeof d.title === 'string' && d.title)
    .map((d: any): OpenLibraryResult => ({
      externalId: `openlibrary:${d.key.split('/').pop()}`,
      title: d.title,
      authors: Array.isArray(d.author_name) && d.author_name.length ? d.author_name.slice(0, 2).join(', ') : undefined,
      year: typeof d.first_publish_year === 'number' ? String(d.first_publish_year) : undefined,
      posterUrl: typeof d.cover_i === 'number' ? `${COVER_URL}/id/${d.cover_i}-M.jpg` : undefined,
      pages: typeof d.number_of_pages_median === 'number' && d.number_of_pages_median > 0 ? d.number_of_pages_median : undefined,
    }));
}
