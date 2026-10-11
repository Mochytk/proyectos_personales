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

export interface TvDetails {
  /** Episodes per season, in order, specials excluded. */
  seasons?: number[];
  totalEpisodes?: number;
}

/**
 * Builds the episodes-per-season list from TMDB's `seasons` array. Season 0 (specials) is skipped,
 * and the list stops at the first season without a known episode count so later seasons cannot
 * shift the numbering of earlier ones.
 */
export function seasonsFromTmdb(list: unknown): number[] | undefined {
  if (!Array.isArray(list)) return undefined;
  const sorted = list
    .filter((s) => s && Number.isInteger(s.season_number) && s.season_number >= 1)
    .sort((a, b) => a.season_number - b.season_number);
  const seasons: number[] = [];
  for (const season of sorted) {
    if (!(Number.isInteger(season.episode_count) && season.episode_count > 0)) break;
    seasons.push(season.episode_count);
  }
  return seasons.length > 0 ? seasons : undefined;
}

/** Seasons and total episodes of a TV show, used to pre-fill progress tracking. */
export async function getTvDetails(externalId: string, apiKey: string, signal?: AbortSignal): Promise<TvDetails> {
  const id = externalId.split(':')[2];
  if (!/^\d+$/.test(id ?? '')) return {};
  const data = await request(`/tv/${id}`, {}, apiKey, signal);
  const seasons = seasonsFromTmdb(data.seasons);
  if (seasons) return { seasons, totalEpisodes: seasons.reduce((sum, n) => sum + n, 0) };
  // Some shows list no seasons; fall back to the overall count.
  const total = typeof data.number_of_episodes === 'number' && data.number_of_episodes > 0 ? data.number_of_episodes : undefined;
  return { totalEpisodes: total };
}
