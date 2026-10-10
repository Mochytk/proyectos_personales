/** Above this many checkpoints a checkbox per step stops being usable (a 476-page book). */
export const MAX_CHECKLIST_STEPS = 40;

/** Pages, and anything with too many steps, are tracked with a counter instead of a checklist. */
export function usesCounter(checkpointType: string | undefined, total: number): boolean {
  return checkpointType === 'pages' || total > MAX_CHECKLIST_STEPS;
}

/** Moves a counter by `delta`, kept between 0 and `total`. Non-numeric input counts as 0. */
export function clampProgress(current: number, delta: number, total: number): number {
  const base = Number.isFinite(current) ? current : 0;
  return Math.min(total, Math.max(0, Math.round(base + delta)));
}
