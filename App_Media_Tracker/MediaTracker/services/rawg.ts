const API_URL = 'https://api.rawg.io/api/games';

export interface RawgResult {
  externalId: string; // "rawg:326243"
  title: string;
  year?: string;
  releaseDate?: string;
  posterUrl?: string;
}

/** Searches video games by title. RAWG needs a free API key. */
export async function searchRawg(query: string, apiKey: string, signal?: AbortSignal): Promise<RawgResult[]> {
  const url = new URL(API_URL);
  url.searchParams.set('key', apiKey.trim());
  url.searchParams.set('search', query);
  url.searchParams.set('page_size', '8');
  url.searchParams.set('search_precise', 'true');

  const res = await fetch(url.toString(), { headers: { accept: 'application/json' }, signal }).catch((e) => {
    if (e?.name === 'AbortError') throw e;
    throw new Error('No se pudo conectar con RAWG. Revisa tu conexión.');
  });
  if (res.status === 401 || res.status === 403) throw new Error('La clave de RAWG no es válida. Revísala en Ajustes.');
  if (!res.ok) throw new Error(`RAWG respondió con un error (${res.status}).`);

  const data = await res.json();
  return (data.results ?? [])
    .filter((g: any) => typeof g.id === 'number' && typeof g.name === 'string' && g.name)
    .map((g: any): RawgResult => {
      const releaseDate: string | undefined = typeof g.released === 'string' && g.released ? g.released : undefined;
      return {
        externalId: `rawg:${g.id}`,
        title: g.name,
        year: releaseDate?.slice(0, 4),
        releaseDate,
        posterUrl: typeof g.background_image === 'string' && g.background_image ? g.background_image : undefined,
      };
    });
}
