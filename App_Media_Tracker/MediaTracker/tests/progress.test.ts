import { describe, expect, it } from 'vitest';
import { PAGE_STEP, PERCENT_STEP, clampProgress, progressText, usesCounter } from '../store/progress';
import type { MediaItem } from '../store/useStore';

describe('usesCounter', () => {
  it('uses a counter for pages and for long lists, a checklist otherwise', () => {
    expect(usesCounter('pages', 12)).toBe(true);
    expect(usesCounter('episodes', 62)).toBe(true);
    expect(usesCounter('episodes', 12)).toBe(false);
    expect(usesCounter('levels', 40)).toBe(false);
    expect(usesCounter(undefined, 41)).toBe(true);
  });
});

describe('clampProgress', () => {
  it('moves by the delta within 0 and the total', () => {
    expect(clampProgress(10, 10, 476)).toBe(20);
    expect(clampProgress(5, -10, 476)).toBe(0);
    expect(clampProgress(470, 10, 476)).toBe(476);
  });

  it('treats typed garbage as zero and rounds decimals', () => {
    expect(clampProgress(NaN, 0, 100)).toBe(0);
    expect(clampProgress(NaN, 5, 100)).toBe(5);
    expect(clampProgress(2.6, 0, 100)).toBe(3);
  });
});

const entry = (over: Partial<MediaItem>): MediaItem => ({ id: 'i', title: 't', type: 'book', status: 'in_progress', progress: 0, createdAt: 1, updatedAt: 1, ...over });

describe('steps', () => {
  it('moves pages and percent ten at a time', () => {
    expect(PAGE_STEP).toBe(10);
    expect(PERCENT_STEP).toBe(10);
  });
});

describe('progressText', () => {
  it('describes each kind of progress as Disfrutando shows it', () => {
    expect(progressText(entry({ checkpointType: 'percentage', totalCheckpoints: 100, currentCheckpoint: 45 }))).toBe('45% Completado');
    expect(progressText(entry({ type: 'tv_show', checkpointType: 'episodes', totalCheckpoints: 30, currentCheckpoint: 13, seasons: [10, 8, 12] }))).toBe('T2 · E3 · 13 de 30');
    expect(progressText(entry({ checkpointType: 'pages', totalCheckpoints: 476, currentCheckpoint: 212 }))).toBe('Página 212 de 476');
    expect(progressText(entry({ type: 'tv_show', checkpointType: 'episodes', totalCheckpoints: 12, currentCheckpoint: 5 }))).toBe('Episodio 5 de 12');
    expect(progressText(entry({ type: 'video_game', checkpointType: 'levels', totalCheckpoints: 30, currentCheckpoint: 0 }))).toBe('Nivel 0 de 30');
  });

  it('falls back to Episodio for series and Capítulo for the rest when no unit is set', () => {
    expect(progressText(entry({ type: 'tv_show', totalCheckpoints: 8, currentCheckpoint: 2 }))).toBe('Episodio 2 de 8');
    expect(progressText(entry({ type: 'book', totalCheckpoints: 8, currentCheckpoint: 2 }))).toBe('Capítulo 2 de 8');
  });

  it('is undefined without a counter', () => {
    expect(progressText(entry({}))).toBeUndefined();
  });
});
