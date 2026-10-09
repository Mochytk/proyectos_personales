const API_URL = 'https://api.themoviedb.org/3';
const IMAGE_URL = 'https://image.tmdb.org/t/p/w342';

export interface TmdbResult {
  externalId: string; // "tmdb:movie:603"
  kind: 'movie' | 'tv';
  title: string;
  year?: string;
  releaseDate?: string;
  overview?: string;
  posterUrl?: string;
}

function request(path: string, params: Record<string, string>, apiKey: string, signal?: AbortSignal) {
  const key = apiKey.trim();
  const url = new URL(`${API_URL}${path}`);
  Object.entries({ language: 'es-MX', ...params }).forEach(([k, v]) => url.searchParams.set(k, v));
  const headers: Record<string, string> = { accept: 'application/json' };
  // TMDB issues two credentials: a long "Read Access Token" (JWT) and a short v3 "API Key".
  if (key.startsWith('eyJ')) headers.Authorization = `Bearer ${key}`;
  else url.searchParams.set('api_key', key);

  const response = fetch(url.toString(), { headers, signal }).catch((e) => {
    if (e?.name === 'AbortError') throw e;
    throw new Error('No se pudo conectar con TMDB. Revisa tu conexión.');
  });

  return response.then(async (res) => {
    if (res.status === 401) throw new Error('La clave de TMDB no es válida. Revísala en Ajustes.');
    if (!res.ok) throw new Error(`TMDB respondió con un error (${res.status}).`);
    return res.json();
  });
}

/** Searches movies or TV shows by title. */
export async function searchTmdb(kind: 'movie' | 'tv', query: string, apiKey: string, signal?: AbortSignal): Promise<TmdbResult[]> {
  const data = await request(`/search/${kind}`, { query, include_adult: 'false' }, apiKey, signal);
  return (data.results ?? []).slice(0, 8).map((r: any): TmdbResult => {
    const releaseDate: string | undefined = (kind === 'movie' ? r.release_date : r.first_air_date) || undefined;
    return {
      externalId: `tmdb:${kind}:${r.id}`,
      kind,
      title: (kind === 'movie' ? r.title : r.name) ?? '',
      year: releaseDate?.slice(0, 4),
      releaseDate,
      overview: r.overview || undefined,
      posterUrl: r.poster_path ? `${IMAGE_URL}${r.poster_path}` : undefined,
    };
  });
}

/** Total number of episodes of a TV show, used to pre-fill progress tracking. */
export async function getTvEpisodeCount(externalId: string, apiKey: string, signal?: AbortSignal): Promise<number | undefined> {
  const id = externalId.split(':')[2];
  if (!/^\d+$/.test(id ?? '')) return undefined;
  const data = await request(`/tv/${id}`, {}, apiKey, signal);
  return typeof data.number_of_episodes === 'number' && data.number_of_episodes > 0 ? data.number_of_episodes : undefined;
}
