import { describe, expect, it } from 'vitest';
import {
  describeProgress, formatPosition, hasSeasonSplit, lastWatched, nextToWatch, sanitizeSeasons, seasonEnd, seasonProgress, toggleSeason, totalEpisodes,
} from '../store/seasons';

const seasons = [10, 8, 12]; // 30 episodes

describe('sanitizeSeasons', () => {
  it('keeps positive whole numbers and drops the rest', () => {
    expect(sanitizeSeasons([10, 0, -2, 1.5, '8', null, 12])).toEqual([10, 12]);
  });

  it('returns undefined when nothing is usable', () => {
    expect(sanitizeSeasons([])).toBeUndefined();
    expect(sanitizeSeasons([0, -1])).toBeUndefined();
    expect(sanitizeSeasons('x')).toBeUndefined();
    expect(sanitizeSeasons(undefined)).toBeUndefined();
  });
});

describe('positions', () => {
  it('adds up the episodes', () => {
    expect(totalEpisodes(seasons)).toBe(30);
    expect(seasonEnd(0, seasons)).toBe(0);
    expect(seasonEnd(2, seasons)).toBe(18);
    expect(seasonEnd(9, seasons)).toBe(30);
  });

  it('finds the last episode watched', () => {
    expect(lastWatched(0, seasons)).toBeNull();
    expect(lastWatched(1, seasons)).toEqual({ season: 1, episode: 1 });
    expect(lastWatched(10, seasons)).toEqual({ season: 1, episode: 10 });
    expect(lastWatched(11, seasons)).toEqual({ season: 2, episode: 1 });
    expect(lastWatched(30, seasons)).toEqual({ season: 3, episode: 12 });
    expect(lastWatched(99, seasons)).toEqual({ season: 3, episode: 12 });
  });

  it('finds the next episode, crossing seasons and ending at the finale', () => {
    expect(nextToWatch(0, seasons)).toEqual({ season: 1, episode: 1 });
    expect(nextToWatch(10, seasons)).toEqual({ season: 2, episode: 1 });
    expect(nextToWatch(29, seasons)).toEqual({ season: 3, episode: 12 });
    expect(nextToWatch(30, seasons)).toBeNull();
  });

  it('formats like Sofa', () => {
    expect(formatPosition({ season: 3, episode: 4 })).toBe('T3 · E4');
  });
});

describe('seasonProgress', () => {
  it('splits the counter across seasons', () => {
    expect(seasonProgress(13, seasons)).toEqual([
      { season: 1, total: 10, watched: 10 },
      { season: 2, total: 8, watched: 3 },
      { season: 3, total: 12, watched: 0 },
    ]);
  });
});

describe('toggleSeason', () => {
  it('jumps to the end of a season that is not finished', () => {
    expect(toggleSeason(2, 12, seasons)).toBe(18);
    expect(toggleSeason(1, 0, seasons)).toBe(10);
  });

  it('goes back to the start of a finished season', () => {
    expect(toggleSeason(2, 18, seasons)).toBe(10);
    expect(toggleSeason(1, 25, seasons)).toBe(0);
  });
});

describe('describeProgress', () => {
  it('summarises the position for cards', () => {
    expect(describeProgress(0, seasons)).toBe('Sin empezar');
    expect(describeProgress(13, seasons)).toBe('T2 · E3 · 13 de 30');
    expect(describeProgress(99, seasons)).toBe('T3 · E12 · 30 de 30');
  });
});

describe('hasSeasonSplit', () => {
  it('requires episode tracking and a split that adds up to the total', () => {
    expect(hasSeasonSplit({ seasons, checkpointType: 'episodes', totalCheckpoints: 30 })).toBe(true);
    expect(hasSeasonSplit({ seasons, checkpointType: 'episodes', totalCheckpoints: 31 })).toBe(false);
    expect(hasSeasonSplit({ seasons, checkpointType: 'pages', totalCheckpoints: 30 })).toBe(false);
    expect(hasSeasonSplit({ checkpointType: 'episodes', totalCheckpoints: 30 })).toBe(false);
  });
});
