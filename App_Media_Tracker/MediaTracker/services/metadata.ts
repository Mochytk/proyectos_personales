import type { MediaType } from '@/store/useStore';
import { getTvEpisodeCount, searchTmdb } from './tmdb';

/** One search hit from any provider, in the shape the add-item form needs. */
export interface MetadataResult {
  externalId: string; // "tmdb:movie:603"
  title: string;
  subtitle?: string; // year, author...
  releaseDate?: string;
  overview?: string;
  posterUrl?: string;
  /** Pre-fills progress tracking; `total` may arrive later through `details`. */
  progress?: { type: 'episodes' | 'pages'; total?: number };
}

export interface MetadataProvider {
  id: string;
  /** Name shown in the form, e.g. "TMDB". */
  label: string;
  placeholder: string;
  /** Setting that holds the provider's API key; omitted when no key is needed. */
  keySetting?: 'tmdbApiKey';
  keyHelp?: string;
  search(query: string, apiKey: string, signal?: AbortSignal): Promise<MetadataResult[]>;
  /** Optional second request made after the user picks a result (e.g. episode count). */
  details?(result: MetadataResult, apiKey: string, signal?: AbortSignal): Promise<Partial<MetadataResult>>;
}

const tmdbProvider = (kind: 'movie' | 'tv'): MetadataProvider => ({
  id: `tmdb-${kind}`,
  label: 'TMDB',
  placeholder: kind === 'movie' ? 'Busca una película...' : 'Busca una serie...',
  keySetting: 'tmdbApiKey',
  keyHelp: 'Añade tu clave gratuita de TMDB en Ajustes Globales para rellenar título, portada y episodios automáticamente.',
  async search(query, apiKey, signal) {
    const results = await searchTmdb(kind, query, apiKey, signal);
    return results.map((r) => ({
      externalId: r.externalId,
      title: r.title,
      subtitle: r.year,
      releaseDate: r.releaseDate,
      overview: r.overview,
      posterUrl: r.posterUrl,
      progress: kind === 'tv' ? { type: 'episodes' as const } : undefined,
    }));
  },
  details:
    kind === 'tv'
      ? async (result, apiKey, signal) => {
          const total = await getTvEpisodeCount(result.externalId, apiKey, signal);
          return total ? { progress: { type: 'episodes', total } } : {};
        }
      : undefined,
});

const PROVIDERS: Partial<Record<MediaType, MetadataProvider>> = {
  movie: tmdbProvider('movie'),
  tv_show: tmdbProvider('tv'),
};

/** The metadata source for a media type, or undefined when it has none. */
export const providerFor = (type: MediaType): MetadataProvider | undefined => PROVIDERS[type];
