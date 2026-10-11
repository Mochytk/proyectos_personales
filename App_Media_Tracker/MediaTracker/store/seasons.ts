/**
 * Series are tracked with one counter: the number of episodes watched (`currentCheckpoint`).
 * `seasons` lists how many episodes each season has, which turns that counter into a position
 * such as "T3 · E4". Without `seasons` an item keeps the single counter it always had.
 */

export interface EpisodePosition {
  season: number; // 1-based
  episode: number; // 1-based, within the season
}

/** Keeps only positive whole numbers; returns undefined when nothing usable is left. */
export function sanitizeSeasons(raw: unknown): number[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const seasons = raw.filter((n): n is number => typeof n === 'number' && Number.isInteger(n) && n > 0).slice(0, 200);
  return seasons.length > 0 ? seasons : undefined;
}

export const totalEpisodes = (seasons: number[]): number => seasons.reduce((sum, n) => sum + n, 0);

/** Episodes watched once `season` (1-based) is finished; 0 for season 0. */
export function seasonEnd(season: number, seasons: number[]): number {
  return totalEpisodes(seasons.slice(0, Math.max(0, season)));
}

/** Position of the episode with absolute number `n` (1-based), or null if out of range. */
function positionOfEpisode(n: number, seasons: number[]): EpisodePosition | null {
  if (n < 1 || n > totalEpisodes(seasons)) return null;
  let before = 0;
  for (let i = 0; i < seasons.length; i++) {
    if (n <= before + seasons[i]) return { season: i + 1, episode: n - before };
    before += seasons[i];
  }
  return null;
}

/** The last episode watched, or null if none. */
export const lastWatched = (watched: number, seasons: number[]): EpisodePosition | null =>
  positionOfEpisode(Math.min(watched, totalEpisodes(seasons)), seasons);

/** The next episode to watch, or null once the whole show is finished. */
export const nextToWatch = (watched: number, seasons: number[]): EpisodePosition | null =>
  positionOfEpisode(Math.max(0, watched) + 1, seasons);

export const formatPosition = (p: EpisodePosition): string => `T${p.season} · E${p.episode}`;

export interface SeasonProgress {
  season: number;
  total: number;
  watched: number; // episodes of this season watched
}

export function seasonProgress(watched: number, seasons: number[]): SeasonProgress[] {
  let before = 0;
  return seasons.map((total, i) => {
    const row = { season: i + 1, total, watched: Math.min(total, Math.max(0, watched - before)) };
    before += total;
    return row;
  });
}

/**
 * Toggles a whole season: if it is already fully watched, go back to where it started;
 * otherwise jump to its last episode.
 */
export function toggleSeason(season: number, watched: number, seasons: number[]): number {
  const end = seasonEnd(season, seasons);
  return watched >= end ? seasonEnd(season - 1, seasons) : end;
}
