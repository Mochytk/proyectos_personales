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

/** Short progress text for cards: "T2 · E3 · 13 de 30", or "Sin empezar". */
export function describeProgress(watched: number, seasons: number[]): string {
  const last = lastWatched(watched, seasons);
  if (!last) return 'Sin empezar';
  return `${formatPosition(last)} · ${Math.min(watched, totalEpisodes(seasons))} de ${totalEpisodes(seasons)}`;
}

/** True when `seasons` is usable for this item: episodes tracking and the split adds up to the total. */
export function hasSeasonSplit<T extends { seasons?: number[]; checkpointType?: string; totalCheckpoints?: number }>(item: T): item is T & { seasons: number[] } {
  return !!item.seasons && item.checkpointType === 'episodes' && totalEpisodes(item.seasons) === item.totalCheckpoints;
}

export interface NextEpisodeInfo {
  date: string; // "YYYY-MM-DD"
  season: number;
  episode: number;
}

export function sanitizeNextEpisode(raw: unknown): NextEpisodeInfo | undefined {
  if (typeof raw !== 'object' || raw === null) return undefined;
  const { date, season, episode } = raw as Record<string, unknown>;
  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return undefined;
  if (!Number.isInteger(season) || !Number.isInteger(episode)) return undefined;
  return { date, season: season as number, episode: episode as number };
}

/** Local midnight of the air date, or undefined if it is malformed. */
export function airDateTimestamp(date: string): number | undefined {
  const m = date.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return undefined;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return isNaN(d.getTime()) || d.getMonth() !== Number(m[2]) - 1 ? undefined : d.getTime();
}

/** The announced next episode, only while it has not aired yet (today still counts). */
export function upcomingEpisode(next: NextEpisodeInfo | undefined, now: number = Date.now()): NextEpisodeInfo | undefined {
  if (!next) return undefined;
  const at = airDateTimestamp(next.date);
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  return at !== undefined && at >= today.getTime() ? next : undefined;
}
